import PageView from '@/views/host/ssh/session/index';
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
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';


interface CodemodProps {
    [key: string]: any;

}

const emits = {};



const options = {
        name: "ssh.session",
        props: {},
        emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        
        return () => (
            <PageView />
        );
    },
    options,
);
