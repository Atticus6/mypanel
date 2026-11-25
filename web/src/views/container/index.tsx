import i18n from '@/lang';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import RouterButton from '@/components/router-button/index.vue';
import LayoutContent from '@/components/layout-content/index.vue';
import RouterViewCache from '@/components/router-view-cache/index.vue';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'container',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const buttons = [
            {
                label: i18n.global.t('menu.home'),
                path: '/containers/dashboard',
            },
            {
                label: i18n.global.t('menu.container', 2),
                path: '/containers/container',
            },
            {
                label: i18n.global.t('container.compose', 2),
                path: '/containers/compose',
            },
            {
                label: i18n.global.t('container.image', 2),
                path: '/containers/image',
            },
            {
                label: i18n.global.t('container.network', 2),
                path: '/containers/network',
            },
            {
                label: i18n.global.t('container.volume', 2),
                path: '/containers/volume',
            },
            {
                label: i18n.global.t('container.repo', 2),
                path: '/containers/repo',
            },
            {
                label: i18n.global.t('container.composeTemplate', 2),
                path: '/containers/template',
            },
            {
                label: i18n.global.t('container.setting', 2),
                path: '/containers/setting',
            },
        ];
        return () => (
            <div>
                <RouterButton buttons={buttons} />
                <LayoutContent>
                    <RouterViewCache />
                </LayoutContent>
            </div>
        );
    },
    options,
);
