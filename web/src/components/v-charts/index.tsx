import { h } from 'vue';
import line from './components/Line';
import pie from './components/Pie';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';

interface CodemodProps {
    [key: string]: any;
    type?: string;
    height?: string;
    dataZoom?: boolean;
    renderer?: string;
    option?: Record<string, any>;
}

const emits = {};

const options = {
    name: 'VCharts',
    props: {
        type: {
            type: String,
            default: 'line',
        },
        height: {
            type: String,
            default: '200px',
        },
        dataZoom: { type: Boolean },
        renderer: {
            type: String,
            default: undefined,
        },
        option: {
            type: Object,
            required: true,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const typeComponentMap = { line, pie };
        return () => (
            h(typeComponentMap[__panelSetupProps.type], { height: __panelSetupProps.height, option: __panelSetupProps.option, dataZoom: __panelSetupProps.dataZoom, renderer: __panelSetupProps.renderer, class: 'v-charts' })
        );
    },
    options,
);
