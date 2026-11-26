import PageView from '@/views/host/process/process/index';
definePage({
    name: 'Process',
    meta: {
        icon: 'p-process-menu',
        title: 'menu.processManage',
        detail: 'menu.process',
        activeMenu: '/hosts/process/process',
        permission: 'host_process_view',
    },
});
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'process.process',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
