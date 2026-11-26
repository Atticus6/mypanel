import PageView from '@/pages/views/host/ssh/session/index';
definePage({
    name: 'SSHSession',
    meta: {
        parent: 'menu.ssh',
        title: 'ssh.session',
        activeMenu: '/hosts/ssh/ssh',
        permission: 'host_ssh_view',
        hidden: true,
    },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'ssh.session',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
