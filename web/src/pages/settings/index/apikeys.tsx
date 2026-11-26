import i18n from '@/lang';
import LayoutContent from '@/components/layout-content/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'apikeys',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => (
            <LayoutContent title={i18n.global.t('apiKeyManagement.title')}>
                <ElEmpty description={i18n.global.t('apiKeyManagement.notAvailable')} />
            </LayoutContent>
        );
    },
    options,
);

definePage({
    name: 'ApiKeys',
    meta: { parent: 'menu.settings', activeMenu: '/settings', title: 'apiKeyManagement.title', hidden: true },
});
