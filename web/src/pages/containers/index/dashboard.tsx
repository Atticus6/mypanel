import { useRoute } from 'vue-router';
import PageView from '@/views/container/dashboard/index';
definePage({
    name: 'ContainerDashboard',
    props: true,
    meta: {
        activeMenu: '/containers',
        permission: 'container_view',
        parent: 'menu.container',
        title: 'menu.home',
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
        name: "dashboard",
        props: {},
        emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const __vueRoute = useRoute();
        
        return () => (
            <PageView {...__vueRoute.params} />
        );
    },
    options,
);
