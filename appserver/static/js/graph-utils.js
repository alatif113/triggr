//# sourceURL=graph-utils.js

define(function(require, exports, module) {
    let $ = require('jquery');

    // Define the custom view class
    let GraphUtils = function() {
        this.nodeIds = {};
        this.nextId = 1;
    };

    GraphUtils.prototype.makeKey = function(a, b, type) {
        if (type === 'node') {
            return a.replace(/\s/g, '_') + ':' + b.replace(/\s/g, '_');
        } else {
            return a + '::' + b;
        }
    };

    GraphUtils.prototype.getId = function(key) {
        if (key in this.nodeIds) {
            return this.nodeIds[key];
        } else {
            let nodeId = this.nextId.toString();
            this.nodeIds[key] = nodeId;
            this.nextId++;
            return nodeId;
        }
    };

    GraphUtils.prototype.isUnique = function(array, id) {
        let found = array.some(function(el) {
            return el.id == id;
        });
        return !found;
    };

    GraphUtils.prototype.pushUniqueNode = function(array, app, search, tempEl) {
        let key = this.makeKey(app, search, 'node');
        let id = this.getId(key);
        let unique = this.isUnique(array, id);
        if (unique) {
            $('.node-text', tempEl).text(search);
            let h = tempEl.outerHeight();
            let w = tempEl.outerWidth();

            array.push({
                id: id,
                data: {
                    app: app,
                    search: search
                },
                width: w,
                height: h
            });
        }
        return id;
    };

    GraphUtils.prototype.pushUniqueEdge = function(array, source, target) {
        let key = this.makeKey(source, target, 'edge');
        let id = this.getId(key);
        let unique = this.isUnique(array, id);
        if (unique) array.push({ id: id, source: source, target: target });
        return id;
    };

    GraphUtils.prototype.makeKlayGraph = function(array, source) {
        let nodes = [];
        let edges = [];
        let that = this;

        let tempEl = $('<div class="node-container"><div class="node-app">Temp</div><div class="node-search"><i class="material-icons node-icon">search</i><div class="node-text"></div></div></div>')
            .hide()
            .appendTo(document.body);

        if (source == 'Splunk') {
            array.forEach(function(row) {
                if (row[0] && row[1]) {
                    let source = that.pushUniqueNode(nodes, row[0], row[1], tempEl);
                    let targets = JSON.parse(row[2]);
                    targets.forEach(function(obj) {
                        let target = that.pushUniqueNode(nodes, obj.app, obj.search, tempEl);
                        that.pushUniqueEdge(edges, source, target);
                    });
                }
            });
        } else if (source == 'Rete') {
            array.forEach(function(n) {
                let source = that.pushUniqueNode(nodes, n.data.app, n.data.search, tempEl);
                n.outputs.get('search').connections.forEach(function(c) {
                    let target = that.pushUniqueNode(nodes, c.input.node.data.app, c.input.node.data.search, tempEl);
                    that.pushUniqueEdge(edges, source, target);
                });
            });
        }

        tempEl.remove();

        return {
            id: 'root',
            children: nodes,
            edges: edges
        };
    };

    GraphUtils.prototype.makeReteGraph = function(id, layout) {
        let data = { id: id, nodes: {} };

        layout.children.forEach(function(el) {
            data.nodes[el.id] = {
                id: el.id,
                data: el.data,
                inputs: { search: { connections: [] } },
                outputs: { search: { connections: [] } },
                position: [el.x, el.y],
                name: 'Search'
            };
        });

        layout.edges.forEach(function(el) {
            data.nodes[el.source].outputs.search.connections.push({ node: el.target, input: 'search' });
        });

        return data;
    };

    return GraphUtils;
});
