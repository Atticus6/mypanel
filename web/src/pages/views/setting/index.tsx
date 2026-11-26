import i18n from '@/lang';
import { useGlobalStore } from '@/composables/useGlobalStore';
import RouterButton from '@/components/router-button/index';
import LayoutContent from '@/components/layout-content/index';
import RouterViewCache from '@/components/router-view-cache/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'setting',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { globalStore, isOffline, isAdmin, isEnterprise } = useGlobalStore();
        const buttons = computed<RouterButton[]>(() => {
            const items = [
                ...(isAdmin.value
                    ? [
                          {
                              label: i18n.global.t('setting.panel'),
                              path: '/settings/panel',
                          },
                          {
                              label: i18n.global.t('setting.safe'),
                              path: '/settings/safe',
                          },
                      ]
                    : []),
                ...(globalStore.hasPermission('alert_view')
                    ? [
                          {
                              label: i18n.global.t('xpack.alert.alertNotice'),
                              path: '/settings/alert',
                              permission: 'alert_view',
                          },
                      ]
                    : []),
                ...(globalStore.hasPermission('backup_view')
                    ? [
                          {
                              label: i18n.global.t('setting.backupAccount', 2),
                              path: '/settings/backupaccount',
                              permission: 'backup_view',
                          },
                      ]
                    : []),
                ...(isAdmin.value
                    ? [
                          {
                              label: i18n.global.t('setting.snapshot', 2),
                              path: '/settings/snapshot',
                          },
                      ]
                    : []),
                {
                    label: i18n.global.t('apiKeyManagement.title'),
                    path: '/settings/apikeys',
                },
                ...(!isAdmin.value
                    ? []
                    : [
                          {
                              label: i18n.global.t('setting.about'),
                              path: '/settings/about',
                          },
                      ]),
            ];
            return items;
        });
        return () => (
            <div>
                <RouterButton buttons={unref(buttons)} />
                <LayoutContent>
                    <RouterViewCache />
                </LayoutContent>
            </div>
        );
    },
    options,
);
