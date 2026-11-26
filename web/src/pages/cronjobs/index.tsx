import i18n from '@/lang';
import RouterButton from '@/components/router-button/index';
import LayoutContent from '@/components/layout-content/index';
import RouterViewCache from '@/components/router-view-cache/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'cronjobs',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const buttons = [
            {
                label: i18n.global.t('menu.cronjob'),
                path: '/cronjobs/cronjob',
            },
            {
                label: i18n.global.t('cronjob.library.library'),
                path: '/cronjobs/library',
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

definePage({
    name: 'Cronjob',
    redirect: '/cronjobs/cronjob',
});
