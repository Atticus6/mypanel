import { $t } from '@/utils/i18n-t';
import { Rules } from '@/global/form-rules';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    group: string;
    groupType: string;
}
type FormInstance = InstanceType<typeof ElForm>;
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: (...args: unknown[]) => true,
    change: (...args: unknown[]) => true,
};

const options = {
    name: 'change',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref();
        const drawerVisible = ref(false);
        const dialogData = ref({
            groupID: 0,
            groupType: '',
        });
        const groupList = ref();
        const acceptParams = (params: DialogProps): void => {
            dialogData.value.groupType = params.groupType;
            loadGroups(params.group);
            drawerVisible.value = true;
        };
        const handleClose = () => {
            drawerVisible.value = false;
        };
        const hostInfoRef = ref<FormInstance>();
        const rules = reactive({
            groupID: [Rules.requiredSelect],
        });
        const loadGroups = async (groupName: string) => {
            const res = await rpc.core.group.list({ type: dialogData.value.groupType });
            groupList.value = res.items;
            for (const group of groupList.value) {
                if (group.name === groupName) {
                    dialogData.value.groupID = group.id;
                    break;
                }
            }
        };
        const onSubmit = (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                loading.value = true;
                ctx.emit('change', Number(dialogData.value.groupID));
                loading.value = false;
                drawerVisible.value = false;
            });
        };
        ctx.expose({
            acceptParams,
        });
        return () =>
            withDirectives(
                <div>
                    <DrawerPro
                        modelValue={unref(drawerVisible)}
                        onUpdate:modelValue={($v) => {
                            drawerVisible.value = $v as any;
                        }}
                        header={$t('terminal.groupChange')}
                        back={handleClose}
                        size="small"
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
                                        type="primary"
                                        onClick={($event?: any) => {
                                            onSubmit(unref(hostInfoRef));
                                        }}
                                    >
                                        {$t('commons.button.confirm')}
                                    </ElButton>
                                </>
                            ),
                        }}
                    >
                        <ElForm
                            onSubmit={($event?: any) => {
                                $event.preventDefault();
                            }}
                            ref={hostInfoRef}
                            label-position="top"
                            model={unref(dialogData)}
                            rules={rules}
                        >
                            <ElFormItem label={$t('commons.table.group')} prop="group">
                                <ElSelect
                                    filterable
                                    modelValue={unref(dialogData).groupID}
                                    onUpdate:modelValue={($v) => {
                                        unref(dialogData).groupID = $v as any;
                                    }}
                                    clearable
                                    style={'width: 100%'}
                                >
                                    {(unref(groupList) || []).map((item) => (
                                        <div key={item.id}>
                                            <ElOption label={item.name} value={item.id} />
                                        </div>
                                    ))}
                                </ElSelect>
                            </ElFormItem>
                        </ElForm>
                    </DrawerPro>
                </div>,
                [[vLoading, unref(loading)]],
            );
    },
    options,
);
