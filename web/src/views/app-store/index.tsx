import i18n from '@/lang';
import { onMounted, ref } from 'vue';
import { rpc } from '@/lib/rpc';
import bus from '@/global/bus';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import RouterButton from '@/components/router-button/index';
import LayoutContent from '@/components/layout-content/index';
import RouterViewCache from '@/components/router-view-cache/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'app-store',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        let showButton = ref(false);
        let buttons = [
            {
                label: i18n.global.t('app.all'),
                path: '/apps/all',
            },
            {
                label: i18n.global.t('app.installed'),
                path: '/apps/installed',
            },
            {
                label: i18n.global.t('app.canUpgrade'),
                path: '/apps/upgrade',
                count: 0,
            },
            {
                label: i18n.global.t('commons.button.set'),
                path: '/apps/setting',
            },
        ];
        const search = () => {
            rpc.app
                .searchInstalled({ update: true, page: 1, pageSize: 100 })
                .then((res) => {
                    buttons[2].count = res.items.length;
                })
                .finally(() => {
                    showButton.value = true;
                });
        };
        onMounted(() => {
            search();
            bus.on('upgrade', () => {
                showButton.value = false;
                search();
            });
        });
        return () => (
            <div>
                {unref(showButton) ? (
                    <div>
                        <RouterButton buttons={buttons} />
                    </div>
                ) : null}
                <LayoutContent>
                    <RouterViewCache />
                </LayoutContent>
            </div>
        );
    },
    options,
);
