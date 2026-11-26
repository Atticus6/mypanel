import i18n from '@/lang';
import RouterButton from '@/components/router-button/index';
import LayoutContent from '@/components/layout-content/index';
import RouterViewCache from '@/components/router-view-cache/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'ssh',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const buttons = [
            {
                label: i18n.global.t('menu.config', 2),
                path: '/hosts/ssh/ssh',
            },
            {
                label: i18n.global.t('ssh.session', 2),
                path: '/hosts/ssh/session',
            },
            {
                label: i18n.global.t('ssh.loginLogs', 2),
                path: '/hosts/ssh/log',
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
