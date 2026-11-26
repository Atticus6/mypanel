import PageView from '@/pages/views/setting/backup-account/index';
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
