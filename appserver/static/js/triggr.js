//# sourceURL=triggr.js

// LIBRARY REQUIREMENTS
//
// In the require function, we include the necessary libraries and modules for
// the HTML dashboard. Then, we pass letiable names for these libraries and
// modules as function parameters, in order.
//
// When you add libraries or modules, remember to retain this mapping order
// between the library or module and its function parameter. You can do this by
// adding to the end of these lists, as shown in the commented examples below.

require([
    'splunkjs/mvc',
    'underscore',
    'jquery',
    'splunkjs/mvc/simplexml',
    'splunkjs/mvc/layoutview',
    'splunkjs/mvc/simplexml/dashboardview',
    'splunkjs/mvc/simpleform/formutils',
    'splunkjs/mvc/simpleform/input/dropdown',
    'splunkjs/mvc/simpleform/input/text',
    'splunkjs/mvc/searchmanager',
    'splunkjs/mvc/postprocessmanager',
    'splunkjs/mvc/simplexml/urltokenmodel',
    '/static/app/triggr/js/triggr-view.js'
    // Add comma-separated libraries and modules manually here, for example:
    // ..."splunkjs/mvc/simplexml/urltokenmodel",
    // "splunkjs/mvc/tokenforwarder"
], function(
    mvc,
    _,
    $,
    DashboardController,
    LayoutView,
    Dashboard,
    FormUtils,
    DropdownInput,
    TextInput,
    SearchManager,
    PostProcessManager,
    UrlTokenModel,
    TriggrView

    // Add comma-separated parameter names here, for example:
    // ...UrlTokenModel,
    // TokenForwarder
) {
    let pageLoading = true;

    // ================================
    // TOKENS
    // ================================

    // Create token namespaces
    let urlTokenModel = new UrlTokenModel();
    mvc.Components.registerInstance('url', urlTokenModel);
    let defaultTokenModel = mvc.Components.getInstance('default', { create: true });
    let submittedTokenModel = mvc.Components.getInstance('submitted', { create: true });

    urlTokenModel.on('url:navigate', function() {
        defaultTokenModel.set(urlTokenModel.toJSON());
        if (!_.isEmpty(urlTokenModel.toJSON()) && !_.all(urlTokenModel.toJSON(), _.isUndefined)) {
            submitTokens();
        } else {
            submittedTokenModel.clear();
        }
    });

    // Initialize tokens
    defaultTokenModel.set(urlTokenModel.toJSON());

    function submitTokens() {
        // Copy the contents of the defaultTokenModel to the submittedTokenModel and urlTokenModel
        FormUtils.submitForm({ replaceState: pageLoading });
    }

    function setToken(name, value) {
        defaultTokenModel.set(name, value);
        submittedTokenModel.set(name, value);
    }

    function unsetToken(name) {
        defaultTokenModel.unset(name);
        submittedTokenModel.unset(name);
    }

    // ================================
    // SEARCH MANAGERS
    // ================================

    new SearchManager(
        {
            id: 'triggr-search',
            preview: true,
            cache: true,
            search:
                '| rest /servicesNS/-/-/saved/searches | search action.triggr=1 action.triggr.param.targets=* disabled=0 | fields eai:acl.app title action.triggr.param.targets | rename eai:acl.app as app action.triggr.param.targets as targets title as search | rex max_match=100 field=targets "\\"app\\":\\s*\\"(?<app_>[^\\"]+)\\",\\s*\\"search\\":\\s*\\"(?<search_>[^\\"]+)" | eval app_=mvappend(app_,app), search_=mvappend(search_, search) | search app_=$app$ $search$ | append [| makeresults] | fields - _time'
        },
        {
            tokens: true
        }
    );

    new SearchManager(
        {
            id: 'triggr-apps',
            preview: true,
            cache: true,
            search: '| rest /services/apps/local | search disabled=0 | fields title'
        },
        { tokens: true }
    );

    new SearchManager(
        {
            id: 'triggr-base-savedsearches',
            preview: true,
            cache: true,
            search: '| rest /servicesNS/-/-/saved/searches | search disabled=0 | fields eai:acl.app title'
        },
        { tokens: true }
    );

    new PostProcessManager(
        {
            id: 'triggr-savedsearches',
            managerid: 'triggr-base-savedsearches',
            search: 'search eai:acl.app=$modalApp$'
        },
        { tokens: true }
    );

    // ================================
    // SPLUNK LAYOUT
    // ================================

    $('header').remove();
    new LayoutView({ hideChrome: false, hideAppBar: false, hideSplunkBar: false })
        .render()
        .getContainerElement()
        .appendChild($('.dashboard-body')[0]);

    // ================================
    // DASHBOARD EDITOR
    // ================================

    new Dashboard(
        {
            id: 'dashboard',
            el: $('.dashboard-body'),
            showTitle: true,
            editable: false
        },
        { tokens: true }
    ).render();

    // ================================
    // VIEWS: VISUAL ELEMENTS
    // ================================

    let triggrView = new TriggrView({
        id: 'triggrView',
        managerid: 'triggr-search',
        el: $('#triggr-graph')
    }).render();

    // ================================
    // VIEWS: INPUTS
    // ================================

    let search_input = new TextInput(
        {
            id: 'search-input',
            default: '',
            prefix: 'search_="*',
            suffix: '*"',
            value: '$form.search$',
            el: $('#search-input')
        },
        { tokens: true }
    ).render();

    $('#search-input input').attr('placeholder', 'Search...');

    search_input.on('change', function(newValue) {
        FormUtils.handleValueChange(search_input);
    });

    let app_input = new DropdownInput(
        {
            id: 'app-input',
            choices: [{ label: 'All Apps', value: '*' }],
            searchWhenChanged: true,
            showClearButton: true,
            default: '*',
            selectFirstChoice: false,
            labelField: 'title',
            valueField: 'title',
            value: '$form.app$',
            managerid: 'triggr-apps',
            el: $('#app-input')
        },
        { tokens: true }
    ).render();

    app_input.on('change', function(newValue) {
        FormUtils.handleValueChange(app_input);
    });

    let modal_app_input = new DropdownInput(
        {
            id: 'modal-app-input',
            searchWhenChanged: true,
            showClearButton: true,
            selectFirstChoice: true,
            labelField: 'title',
            valueField: 'title',
            value: '$form.modalApp$',
            managerid: 'triggr-apps',
            el: $('#triggr-modal-app-input')
        },
        { tokens: true }
    ).render();

    modal_app_input.on('change', function(newValue) {
        FormUtils.handleValueChange(modal_app_input);
    });

    let modal_search_input = new DropdownInput(
        {
            id: 'modal-search-input',
            searchWhenChanged: true,
            showClearButton: true,
            selectFirstChoice: false,
            labelField: 'title',
            valueField: 'title',
            value: '$form.modalSearch$',
            managerid: 'triggr-savedsearches',
            el: $('#triggr-modal-search-input')
        },
        { tokens: true }
    ).render();

    modal_search_input.on('change', function(newValue) {
        FormUtils.handleValueChange(modal_search_input);
    });

    // ================================
    // SUBMIT FORM DATA
    // ================================

    $('.search-button .btn').click(function() {
        submitTokens();
        triggrView.updateEditorRete();
    });

    // Initialize time tokens to default
    if (!defaultTokenModel.has('earliest') && !defaultTokenModel.has('latest')) {
        defaultTokenModel.set({ earliest: '0', latest: '' });
    }

    submitTokens();

    // ================================
    // EVENTS
    // ================================

    defaultTokenModel.on('change:form.modalApp', function(newToken, modalApp) {
        unsetToken('form.modalSearch');
    });

    // ===== Information Panel =====

    // show errors, alerts, and informational text
    function updateInfo(text, type) {
        $('#triggr-info')
            .removeClass('closed error info')
            .addClass(type);
        $('#triggr-info .triggr-info-text').html(text);
        var scrollHeight = $('#triggr-info')[0].scrollHeight;
        var height = $('#triggr-info').outerHeight();
        if (scrollHeight > height) {
            $('#triggr-info .triggr-info-toggle').css('display', 'block');
        } else {
            $('#triggr-info .triggr-info-toggle').css('display', 'none');
        }
    }

    // click close button in information panel
    $('#triggr-info .triggr-icon-clear').click(function() {
        $('#triggr-info')
            .addClass('closed')
            .css('height', '');
        $('#triggr-info .triggr-info-toggle').removeClass('toggle-open');
    });

    // click the dropdown toggle up button
    $('#triggr-info .triggr-info-toggle').click(function() {
        if ($(this).hasClass('toggle-open')) {
            $('#triggr-info').css('height', '');
            $(this).removeClass('toggle-open');
        } else {
            $('#triggr-info').css('height', $('#triggr-info')[0].scrollHeight + 'px');
            $(this).addClass('toggle-open');
        }
    });

    // ========== Modals ==========

    // open a modal identified by the elements id
    function modalOpen(el) {
        $('.triggr-modal-overlay').removeClass('closed');
        $(el).removeClass('closed');
    }

    // close all modals
    function modalClose() {
        $('.triggr-modal-overlay').addClass('closed');
        $('.triggr-modal-error').addClass('closed');
        $('.triggr-modal').addClass('closed');
    }

    // clicking the modal add search button
    $('#triggr-btn-modal-add').click(function(e) {
        let app = defaultTokenModel.get('form.modalApp');
        let search = defaultTokenModel.get('form.modalSearch');

        if (app && search) {
            modalClose();
            let ret = triggrView.addNode(app, search);
            if (ret) updateInfo(ret, 'error');
        } else {
            $('.triggr-modal-error').removeClass('closed');
            let modal = $(this).closest('.triggr-modal');
            modal
                .addClass('shake')
                .delay(1000)
                .queue(function() {
                    modal.removeClass('shake').dequeue();
                });
        }
    });

    // clicking the modal discard button
    $('#triggr-btn-modal-discard').click(function() {
        modalClose();
        triggrView.resetLayout();
        updateInfo('Discarded all changes since the last save', 'info');
    });

    // clicking a modal close button or background overlay
    $('.triggr-btn-modal-cancel, .triggr-modal-overlay').click(function(e) {
        if (e.target == this) modalClose();
    });

    // ======== Menu Items ========

    // clicking the add search button
    $('.triggr-add').click(function() {
        modalOpen('#triggr-modal-add');
    });

    // clicking the format layout button
    $('.triggr-layout').click(function() {
        triggrView.formatLayout();
    });

    // clicking the reset view button
    $('.triggr-reset').click(function() {
        triggrView.resetView();
    });

    // clicking the discard changes button
    $('.triggr-discard').click(function() {
        modalOpen('#triggr-modal-discard');
    });

    // clicking the save button
    $('.triggr-save').click(function() {
        $(this).addClass('saving');
        triggrView.saveLayout(function(text, type) {
            $('.triggr-save').removeClass('saving');
            updateInfo(text, type);
        });
    });

    // ================================
    // DASHBOARD READY
    // ================================

    DashboardController.ready();
    pageLoading = false;
});
