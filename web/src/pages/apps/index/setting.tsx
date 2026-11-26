import { useRoute } from 'vue-router';
import PageView from '@/views/app-store/setting/index';
definePage({
    name: 'AppStoreSetting',
    props: true,
    meta: {
        activeMenu: '/apps',
        parent: 'menu.app',
        title: 'commons.button.set',
        permission: 'app_view',
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
    name: 'setting',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const __vueRoute = useRoute();

        return () => <PageView {...__vueRoute.params} />;
    },
    options,
);
