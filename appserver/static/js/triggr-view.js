//# sourceURL=triggr-view.js

require.config({
    paths: {
        vue: '/static/app/triggr/js/vue.min',
        rete: '/static/app/triggr/js/rete.min',
        klay: '/static/app/triggr/js/klay',
        searchComponent: '/static/app/triggr/js/search-component',
        vueRenderPlugin: '/static/app/triggr/js/vue-render-plugin.min',
        connectionPlugin: '/static/app/triggr/js/connection-plugin.min',
        minimapPlugin: '/static/app/triggr/js/minimap-plugin.min',
        graphUtils: '/static/app/triggr/js/graph-utils'
    }
});

define(function(require, exports, module) {
    // load dependencies
    let mvc = require('splunkjs/mvc');
    let SimpleSplunkView = require('splunkjs/mvc/simplesplunkview');
    let $ = require('jquery');
    let Rete = require('rete');
    let Klay = require('klay');
    let ConnectionPlugin = require('connectionPlugin');
    let VueRenderPlugin = require('vueRenderPlugin');
    let SearchComponent = require('searchComponent');
    let MinimapPlugin = require('minimapPlugin');
    let GraphUtils = require('graphUtils');

    // Define the custom view class
    let TriggrView = SimpleSplunkView.extend({
        className: 'triggr-view',

        // Define our initial values, set the type of results to return
        options: {
            data: 'results', // Results type
            klayOptions: {
                direction: 'RIGHT',
                spacing: 60,
                nodePlace: 'BRANDES_KOEPF'
            }
        },

        // Override this method to configure the view
        createView: function() {
            // Clear element contents and set height
            let height = $(window).height() - $(this.el).offset().top - 15;
            $(this.el)
                .html('')
                .height(height)
                .css('max-height', height);

            // Initialize Rete editor
            this.searchComponent = new SearchComponent();
            this.graphUtils = new GraphUtils();
            this.graphId = this.id + '@0.1.0';
            this.reteGraph = {};
            this.editor = new Rete.NodeEditor(this.graphId, this.el);
            this.editor.use(ConnectionPlugin.default);
            this.editor.use(VueRenderPlugin.default);
            this.editor.use(MinimapPlugin.default);
            this.editor.register(this.searchComponent);

            let editor = this.editor;

            // Define editor events
            $(this.el).on('click', '.node-close', function() {
                editor.selected.each(function(node) {
                    editor.removeNode(node);
                });
            });

            return this;
        },

        // Override this method to put the Splunk data into the view
        updateView: function(viz, data) {
            this._makeLayout(data, 'Splunk', true);
        },

        formatLayout: function() {
            this._makeLayout(this.editor.nodes, 'Rete', false);
        },

        resetView: function() {
            this.editor.view.area.zoom(1, 0, 0);
            this.editor.view.area.translate(0, 0);
        },

        resetLayout: function() {
            this.editor.fromJSON(this.reteGraph);
            this.resetView();
        },

        addNode: function(app, search) {
            let key = this.graphUtils.makeKey(app, search, 'node');
            let id = this.graphUtils.getId(key);
            let node = this._findNode(this.editor.nodes, id, 0, this.editor.nodes.length - 1);

            if (node) {
                this.editor.selectNode(node);
                return 'Search <i>' + search + '</i> in app <i>' + app + '</i> already exists';
            } else {
                let position = $('div:first-child', $(this.el)).position();
                let x = -1 * position.left + 10;
                let y = -1 * position.top + 10;
                let that = this;
                this.searchComponent
                    .createNode({
                        app: app,
                        search: search
                    })
                    .then(function(node) {
                        node.id = id;
                        node.position = [x, y];
                        that.editor.addNode(node);
                        that.editor.selectNode(node);
                    });
            }
        },

        saveLayout: function(callback) {
            let currNodes = this.editor.toJSON().nodes; // current graph
            let prevNodes = this.reteGraph.nodes; // last saved graph
            let currKeys = Object.keys(currNodes); // current node ids
            let prevKeys = Object.keys(prevNodes); // last saved node ids
            let data = []; // changes

            // nodes in last saved graph, but not in current graph
            let removedNodes = prevKeys.filter(function(n) {
                return !currKeys.includes(n);
            });

            // map node ids to node data
            let mapNode = function(i, array) {
                return {
                    app: array[i].data.app,
                    search: array[i].data.search
                };
            };

            // for each node in current graph
            for (key in currNodes) {
                let added = []; // added connections
                let removed = []; // removed connections

                // all current connections
                let currConn = currNodes[key].outputs.search.connections.map(function(i) {
                    return i.node;
                });

                // if the current node exists within the previous graph
                if (key in prevNodes) {
                    // get connections differences
                    let prevConn = prevNodes[key].outputs.search.connections.map(function(i) {
                        return i.node;
                    });
                    removed = prevConn
                        .filter(function(n) {
                            return !currConn.includes(n);
                        })
                        .map(function(i) {
                            return mapNode(i, prevNodes);
                        });
                    added = currConn
                        .filter(function(n) {
                            return !prevConn.includes(n);
                        })
                        .map(function(i) {
                            return mapNode(i, currNodes);
                        });
                } else {
                    // otherwise this is a new node, add all of its connections
                    added = currConn.map(function(i) {
                        return mapNode(i, currNodes);
                    });
                }

                //if a connection was added or removed, add it to the list of changes
                if (added.length > 0 || removed.length > 0) {
                    data.push({
                        app: currNodes[key].data.app,
                        search: currNodes[key].data.search,
                        added: added,
                        removed: removed,
                        id: key
                    });
                }
            }

            // for each removed node
            removedNodes.forEach(function(key) {
                //get its previous connection and mark for removal
                let prevConn = prevNodes[key].outputs.search.connections.map(function(i) {
                    return i.node;
                });
                let removed = prevConn.map(function(i) {
                    return mapNode(i, prevNodes);
                });
                if (removed.length > 0) {
                    data.push({
                        app: prevNodes[key].data.app,
                        search: prevNodes[key].data.search,
                        added: [],
                        removed: removed,
                        id: key
                    });
                }
            });

            this._postChanges(data, callback);
        },

        _makeLayout: function(data, source, save) {
            let that = this;

            $klay.layout({
                graph: this.graphUtils.makeKlayGraph(data, source),
                options: this.options.klayOptions,
                success: function(layout) {
                    that._updateEditorFromKlay(layout, save);
                },
                error: function(error) {
                    console.log(error);
                }
            });
        },

        _findNode: function(nodes, id, start, end) {
            // Base Condition
            if (start > end) return false;
            // Find the middle index
            let mid = Math.floor((start + end) / 2);
            // Compare mid with given key id
            if (nodes[mid].id === id) return nodes[mid];
            // search upper or lower half
            if (nodes[mid].id > id) {
                return this._findNode(nodes, id, start, mid - 1);
            } else {
                return this._findNode(nodes, id, mid + 1, end);
            }
        },

        _updateEditorFromKlay: function(layout, save) {
            let reteGraph = this.graphUtils.makeReteGraph(this.graphId, layout);
            if (save) this.reteGraph = reteGraph;
            this.editor.fromJSON(reteGraph);
            this.resetView();
        },

        _postChanges: function(changes, callback) {
            let errorList = [];
            let service = mvc.createService();
            let promises = [];
            let manager = this.manager;

            for (let i = 0; i < changes.length; i++) {
                let node = changes[i];
                let promise = $.Deferred();
                service.app = node.app;

                service.savedSearches().fetch(function(err, savedsearches) {
                    let search = savedsearches.item(node.search);
                    if (err || !search) {
                        errorList.push({
                            app: node.app,
                            search: node.search,
                            error: err || 'Unable to find saved search'
                        });
                        promise.resolve(search);
                        return;
                    }

                    let props = search.properties();
                    let targets = props['action.triggr.param.targets'];
                    let actions = props['actions'];
                    let enabled = 0;

                    targets = targets ? JSON.parse(targets) : [];
                    actions = actions ? actions.split(', ') : [];

                    node.removed.forEach(function(n) {
                        for (let j = 0; j < targets.length; j++) {
                            if (targets[j].app === n.app && targets[j].search === n.search) {
                                targets.splice(j, 1);
                                break;
                            }
                        }
                    });

                    node.added.forEach(function(n) {
                        let found = targets.some(function(el) {
                            el.app == n.app && el.search == n.search;
                        });
                        if (!found) targets.push({ app: n.app, search: n.search });
                    });

                    if (targets.length > 0) {
                        enabled = 1;
                        if (actions.indexOf('triggr') == -1) actions.push('triggr');
                    } else {
                        enabled = 0;
                        actions = actions.filter(function(el) {
                            return el !== 'triggr';
                        });
                    }

                    search.update(
                        {
                            'actions': actions.join(', '),
                            'action.triggr': enabled,
                            'action.triggr.param.targets': JSON.stringify(targets)
                        },
                        function(error, search) {
                            if (error)
                                errorList.push({
                                    app: node.app,
                                    search: node.search,
                                    error: error.data.messages[0].text
                                });
                            promise.resolve(search);
                        }
                    );
                });

                promises.push(promise);
            }

            $.when.apply($, promises).then(function() {
                console.log(errorList);

                if (changes.length == 0) {
                    callback('There are no changes to be saved', 'info');
                    return;
                }

                if (errorList.length > 0) {
                    let html = 'Failed to update ' + errorList.length + ' searche(s)';
                    errorList.forEach(function(e) {
                        html += '<dl><dt>App: ' + e.app + ' Search: ' + e.search + '</dt><dd>' + e.error + '</dd></dl>';
                    });
                    callback(html, 'error');
                } else {
                    callback('Successfully saved changes', 'info');
                    manager.startSearch();
                }
            });
        }
    });

    return TriggrView;
});
