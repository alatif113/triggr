from __future__ import print_function
import sys, json, logging, urllib, httplib2, re

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

formatter = logging.Formatter('%(levelname)s %(message)s')
handler = logging.StreamHandler(sys.stderr)
handler.setFormatter(formatter)
LOGGER.addHandler(handler)


def setLogLevel(logLevel):
    """
    Configures the log level 
    :param logLevel: string
        logLevel to be set DEBUG|INFO|WARN|ERROR|FATAL
    :return: none
    """
    if logLevel == 'DEBUG':
        LOGGER.setLevel(logging.DEBUG)
    elif logLevel == 'WARN':
        LOGGER.setLevel(logging.WARN)
    elif logLevel == 'ERROR':
        LOGGER.setLevel(logging.ERROR)
    elif logLevel == 'FATAL':
        LOGGER.setLevel(logging.FATAL)
    else:
        LOGGER.setLevel(logging.INFO)

def triggr(payload):
    """
    Dispatch searches
    :param payload: dictionary
        custom action alert payload
    :return: none
    """
    config = payload.get("configuration")
    sessionKey = payload.get("session_key")
    owner = payload.get("owner")
    app = payload.get("app", "")
    search = payload.get("search_name", "")
    logSource = 'src_app="{}" src_search="{}" '.format(app, search)

    if None in (config, sessionKey, owner):
        LOGGER.error(logSource + 'msg="Unable to retrieve input configuration, session key, or owner." status="fail"')
        sys.exit(1)

    # set certificate validation and log level
    disable_cert_validation = {"1": False, "0": True}[config.get("cert_validation", "1")]
    setLogLevel(config.get("log_level", "INFO"))

    # parse search object as JSON string
    try:
        targets = json.loads(config.get("targets"))
    except TypeError:
        LOGGER.error(logSource + 'msg="No targets have been defined" status="fail"')
        sys.exit(1)
    except Exception as e:
        LOGGER.error(logSource + 'msg="Unable to parse targets as a valid JSON string." status="fail"')
        LOGGER.error(logSource + e.message)
        sys.exit(1)

    # prepare REST calls to dispatch
    http = httplib2.Http(disable_ssl_certificate_validation=disable_cert_validation)
    baseurl = 'https://localhost:8089'
    headers = {'Authorization': 'Splunk {}'.format(sessionKey)}
    body = urllib.urlencode({'trigger_actions': 1})
    
    # dispatch each search in the search object
    for obj in targets:
        logTarget = logSource + 'target_app="{}" target_search="{}" '.format(obj["app"], obj["search"])
        url = '{}/servicesNS/{}/{}/saved/searches/{}/dispatch'.format(
            baseurl, 
            urllib.quote(owner), 
            urllib.quote(obj["app"]), 
            urllib.quote(obj["search"])
        )

        LOGGER.debug(logTarget + "Posting to REST Endpoint: {} with headers {} and body {}".format(url, headers, body))

        (response, content) = http.request(url,'POST',headers=headers,body=body)

        if response["status"] == "201":
            LOGGER.info(logTarget + 'msg="dispatched job at location {}" status="success"'.format(response["location"]))
        else:
            LOGGER.debug(logTarget + 'msg="{}"'.format(response))
            LOGGER.error(logTarget + 'msg="{}" status="fail"'.format(re.sub(r'[\s]+', ' ', content)))

if __name__ == "__main__":

    if len(sys.argv) > 1 and sys.argv[1] == "--execute":
        # read input configuration
        payload = json.loads(sys.stdin.read())
        LOGGER.debug("Recieved payload: {}".format(payload))
        triggr(payload)
    else:
        LOGGER.fatal("Unsupported execution mode (expected --execute flag).")
