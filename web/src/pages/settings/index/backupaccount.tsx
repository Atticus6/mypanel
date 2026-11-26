import PageView from '@/views/setting/backup-account/index';
definePage({
    name: 'BackupAccount',
    meta: {
        parent: 'menu.settings',
        activeMenu: '/settings',
        title: 'setting.backupAccount',
        permission: 'backup_view',
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
    name: 'backupaccount',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
