import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { MsgInfo, MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
import DrawerPro from '@/components/drawer-pro/index';
import ComplexTable from '@/components/table/complex/ComplexTable';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'quick',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const drawerVisible = ref();
        const loading = ref();
        const acceptParams = (): void => {
            search();
            drawerVisible.value = true;
        };
        const quickOptions = ref([]);
        const search = async () => {
            loading.value = true;
            await rpc.dashboard
                .quickJumps({})
                .then((res) => {
                    loading.value = false;
                    quickOptions.value = res.items || [];
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const onChangeShow = async () => {
            let i = 0;
            for (const item of quickOptions.value) {
                if (item.isShow) {
                    i++;
                }
            }
            if (i === 0) {
                MsgInfo(i18n.global.t('home.minQuickJump'));
                return;
            }
            if (i > 5) {
                MsgInfo(i18n.global.t('home.maxQuickJump'));
                return;
            }
            loading.value = true;
            await rpc.dashboard
                .changeQuickJump({
                    quicksJson: JSON.stringify(quickOptions.value.map(({ id, isShow }) => ({ id, isShow }))),
                })
                .then(() => {
                    loading.value = false;
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    drawerVisible.value = false;
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const handleClose = () => {
            drawerVisible.value = false;
            ctx.emit('search');
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                modelValue={unref(drawerVisible)}
                onUpdate:modelValue={($v) => {
                    drawerVisible.value = $v as any;
                }}
                header={$t('menu.home')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                v-slots={{
                    footer: () => (
                        <>
                            <ElButton
                                onClick={($event?: any) => {
                                    drawerVisible.value = false;
                                }}
                            >
                                {$t('commons.button.cancel')}
                            </ElButton>
                            <ElButton
                                disabled={unref(loading)}
                                type="primary"
                                onClick={($event?: any) => {
                                    (onChangeShow as any)($event);
                                }}
                            >
                                {$t('commons.button.confirm')}
                            </ElButton>
                        </>
                    ),
                }}
            >
                <div>
                    <ComplexTable heightDiff={1} data={unref(quickOptions)} show-header={false} row-key="id">
                        <ElTableColumn
                            prop="title"
                            label={$t('setting.menu')}
                            v-slots={{ default: ({ row }) => <>{i18n.global.t(row.title)}</> }}
                        />
                        <ElTableColumn
                            prop="isShow"
                            label={$t('setting.ifShow')}
                            v-slots={{
                                default: ({ row }) => (
                                    <>
                                        <ElSwitch
                                            modelValue={row.isShow}
                                            onUpdate:modelValue={($v) => {
                                                row.isShow = $v as any;
                                            }}
                                        />
                                    </>
                                ),
                            }}
                        />
                    </ComplexTable>
                </div>
            </DrawerPro>
        );
    },
    options,
);
