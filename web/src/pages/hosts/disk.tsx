import PageView from '@/views/host/disk-management/disk/index';
definePage({
    name: 'Disk',
    props: true,
    meta: { icon: 'p-disk-menu', title: 'menu.disk', permission: 'host_disk_view' },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'disk',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const __vueRoute = useRoute();

        return () => <PageView {...__vueRoute.params} />;
    },
    options,
);
