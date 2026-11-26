import { defineComponent } from 'vue';
import { useRoute } from 'vue-router';
import PageView from '@/views/host/file-management/index';

definePage({
    name: 'File',
    props: true,
    meta: { icon: 'p-file-menu', title: 'menu.files', permission: 'host_file_view' },
});

export default defineComponent(
    () => {
        const route = useRoute();

        return () => <PageView {...route.params} />;
    },
    {
        name: 'File',
    },
);
