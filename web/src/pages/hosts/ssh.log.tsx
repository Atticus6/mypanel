import FireRouter from '@/pages/hosts/_components/ssh/index';
import Log from '@/pages/logs/index/ssh';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'ssh.log',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => (
            <div>
                <FireRouter />
                <Log />
            </div>
        );
    },
    options,
);

definePage({
    name: 'SSHLog',
    meta: {
        parent: 'menu.ssh',
        title: 'ssh.loginLogs',
        activeMenu: '/hosts/ssh/ssh',
        permission: 'host_ssh_view',
        hidden: true,
    },
});
