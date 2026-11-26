import PageView from '@/views/cronjob/cronjob/operate/index';
definePage({
    name: 'CronjobOperate',
    meta: { activeMenu: '/cronjobs', ignoreTab: true, permission: 'cronjob_view', hidden: true },
});
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';


interface CodemodProps {
    [key: string]: any;

}

const emits = {};



const options = {
        name: "cronjob.operate",
        props: {},
        emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        
        return () => (
            <PageView />
        );
    },
    options,
);
