//# sourceURL=search-component.js
require.config({
    paths: {
        vue: '/static/app/triggr/js/vue.min',
        rete: '/static/app/triggr/js/rete.min',
        vueRenderPlugin: '/static/app/triggr/js/vue-render-plugin.min'
    }
});

define(function(require, exports, module) {
    let Rete = require('rete');
    let VueRenderPlugin = require('vueRenderPlugin');

    let searchSocket = new Rete.Socket('search');

    let CustomSocket = {
        template: '<div class="socket" :class="[type, used()?' + "'used'" + ":''" + ']"></div>',
        props: ['type', 'used']
    };
    let CustomNode = {
        template:
            '<div class="node-container" :class="[selected()]"><div class="node-app"><div class="node-icon triggr-icon triggr-icon-app"></div><div class="node-text">{{node.data.app}}</div></div><div class="node-search"><div class="node-icon triggr-icon triggr-icon-search"></div><div class="node-text">{{node.data.search}}</div></div><Socket v-for="input in inputs()" v-socket:input="input" type="input" :used="() => input.connections.length"></Socket><Socket v-for="output in outputs()" v-socket:output="output" type="output" :used="() => output.connections.length"></Socket><div class="node-close""><div class="triggr-icon triggr-icon-clear-small"></div></div></div>',
        mixins: [VueRenderPlugin.default.mixin],
        methods: {
            used: function(io) {
                return io.connections.length;
            }
        },
        components: { Socket: CustomSocket }
    };

    let SearchComponent = function() {
        Rete.Component.call(this, 'Search');
        this.data.component = CustomNode;
    };

    SearchComponent.prototype = Object.create(Rete.Component.prototype);
    SearchComponent.prototype.constructor = SearchComponent;

    SearchComponent.prototype.builder = function(node) {
        let output = new Rete.Output('search', 'Search', searchSocket, true);
        let input = new Rete.Input('search', 'Search', searchSocket, true);
        return node.addOutput(output).addInput(input);
    };

    SearchComponent.prototype.worker = function(node, inputs, outputs) {
        outputs.app = node.data.app;
        outputs.search = node.data.search;
    };

    return SearchComponent;
});
