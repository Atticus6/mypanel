import { $t } from '@/utils/i18n-t';
import GroupSelect from '@/pages/websites/_components/website/components/group/index';
import { Rules } from '@/global/form-rules';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'group',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const open = ref(false);
        const loading = ref(false);
        const websiteForm = ref<FormInstance>();
        const form = reactive({
            ids: [] as number[],
            groupID: 0,
        });
        const rules = ref({
            groupID: [Rules.requiredSelect],
        });
        const handleClose = () => {
            open.value = false;
        };
        const acceptParams = async (ids: []) => {
            form.ids = ids;
            form.groupID = 0;
            open.value = true;
        };
        const submit = async () => {
            loading.value = true;
            const valid = await websiteForm.value.validate();
            if (!valid) {
                loading.value = false;
                return;
            }
            rpc.website
                .batchGroup({ ids: form.ids, groupId: form.groupID })
                .then(() => {
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    open.value = false;
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                v-model={open.value}
                header={$t('commons.table.group')}
                size="30%"
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                v-slots={{
                    footer: () => (
                        <>
                            <ElButton
                                onClick={($event?: any) => {
                                    (handleClose as any)($event);
                                }}
                                disabled={unref(loading)}
                            >
                                {$t('commons.button.cancel')}
                            </ElButton>
                            {
                                <ElButton
                                    type="primary"
                                    onClick={($event?: any) => {
                                        submit();
                                    }}
                                    disabled={unref(loading)}
                                    v-permission={true}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            }
                        </>
                    ),
                }}
            >
                {
                    <ElForm
                        ref={websiteForm}
                        label-position="top"
                        model={form}
                        rules={unref(rules)}
                        v-loading={unref(loading)}
                    >
                        <GroupSelect v-model={form.groupID} prop={'groupID'} groupType={'website'} />
                    </ElForm>
                }
            </DrawerPro>
        );
    },
    options,
);
