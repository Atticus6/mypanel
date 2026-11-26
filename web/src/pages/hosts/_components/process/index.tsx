import i18n from '@/lang';
import RouterButton from '@/components/router-button/index';
import LayoutContent from '@/components/layout-content/index';
import RouterViewCache from '@/components/router-view-cache/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'process',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const buttons = [
            {
                label: i18n.global.t('menu.process', 2),
                path: '/hosts/process/process',
            },
            {
                label: i18n.global.t('menu.network', 2),
                path: '/hosts/process/network',
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
