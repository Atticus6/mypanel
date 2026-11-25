import Layout from '@/layout/index.vue';
definePage({
    name: 'App-Menu',
    redirect: '/apps/all',
    meta: { icon: 'p-appstore', title: 'menu.apps', permission: 'app_view', sort: 2 },
});
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'apps',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <Layout />;
    },
    options,
);
