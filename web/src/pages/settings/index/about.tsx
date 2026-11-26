import PageView from '@/pages/views/setting/about/index';

definePage({
    name: 'About',
    meta: { parent: 'menu.settings', activeMenu: '/settings', title: 'setting.about', adminOnly: true, hidden: true },
});

export default defineComponent(() => () => <PageView />, {
    name: 'About',
});
