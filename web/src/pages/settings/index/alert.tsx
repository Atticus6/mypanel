import PageView from '@/views/setting/alert/index';
definePage({
    name: 'Alert',
    meta: {
        parent: 'menu.settings',
        activeMenu: '/settings',
        title: 'xpack.alert.alertNotice',
        permission: 'alert_view',
        hidden: true,
    },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'alert',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
