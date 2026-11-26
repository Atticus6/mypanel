import PageView from '@/views/host/ssh/ssh/index';
definePage({
    name: 'SSH',
    meta: {
        icon: 'p-ssh-menu',
        title: 'menu.ssh',
        detail: 'menu.config',
        activeMenu: '/hosts/ssh/ssh',
        permission: 'host_ssh_view',
    },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'ssh.ssh',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
