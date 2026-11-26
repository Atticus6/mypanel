import PageView from '@/views/setting/snapshot/index';
definePage({
    name: 'Snapshot',
    meta: {
        parent: 'menu.settings',
        activeMenu: '/settings',
        title: 'setting.snapshot',
        adminOnly: true,
        hidden: true,
    },
});
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'snapshot',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
