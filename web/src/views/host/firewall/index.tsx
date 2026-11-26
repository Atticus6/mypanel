import i18n from '@/lang';
import RouterButton from '@/components/router-button/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'firewall',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const buttons = [
            {
                label: i18n.global.t('firewall.systemFirewall'),
                path: '/hosts/firewall/rules',
            },
            {
                label: i18n.global.t('firewall.dockerGuard'),
                path: '/hosts/firewall/docker',
            },
            {
                label: i18n.global.t('firewall.forwardRule', 2),
                path: '/hosts/firewall/forward',
            },
            {
                label: i18n.global.t('commons.button.set'),
                path: '/hosts/firewall/setting',
            },
        ];
        return () => <RouterButton buttons={buttons} />;
    },
    options,
);
