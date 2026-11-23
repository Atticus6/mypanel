import { Layout } from '@/routers/constant';

const webSiteRouter = {
    sort: 4,
    path: '/websites',
    name: 'Website-Menu',
    component: Layout,
    redirect: '/websites',
    meta: {
        icon: 'p-website',
        title: 'menu.website',
    },
    children: [
        {
            path: '/websites',
            name: 'Website',
            component: () => import('@/views/website/website/index.vue'),
            meta: {
                icon: 'p-website',
                title: 'menu.website',
                permission: 'website_view',
            },
        },
        {
            path: '/websites/:id/config/:tab',
            name: 'WebsiteConfig',
            component: () => import('@/views/website/website/config/index.vue'),
            hidden: true,
            props: true,
            meta: {
                activeMenu: '/websites',
                ignoreTab: true,
                permission: 'website_view',
            },
        },
        {
            path: '/websites/ssl',
            name: 'SSL',
            component: () => import('@/views/website/ssl/index.vue'),
            meta: {
                icon: 'p-ssl-menu',
                title: 'menu.ssl',
                permission: 'website_cert_view',
            },
        },
        {
            path: '/websites/ssl/ca',
            name: 'SSL-CA',
            component: () => import('@/views/website/ssl/ca/index.vue'),
            hidden: true,
            meta: {
                activeMenu: '/websites/ssl',
                title: 'menu.ssl',
                detail: 'ssl.selfSigned',
                permission: 'website_cert_view',
            },
        },
        {
            path: '/websites/ssl/acme-account',
            name: 'SSL-ACME',
            component: () => import('@/views/website/ssl/acme-account/index.vue'),
            hidden: true,
            meta: {
                activeMenu: '/websites/ssl',
                title: 'menu.ssl',
                detail: 'website.acmeAccountManage',
                permission: 'website_cert_view',
            },
        },
        {
            path: '/websites/ssl/dns-account',
            name: 'SSL-DNS',
            component: () => import('@/views/website/ssl/dns-account/index.vue'),
            hidden: true,
            meta: {
                activeMenu: '/websites/ssl',
                title: 'menu.ssl',
                detail: 'website.dnsAccountManage',
                permission: 'website_cert_view',
            },
        },
    ],
};

export default webSiteRouter;
