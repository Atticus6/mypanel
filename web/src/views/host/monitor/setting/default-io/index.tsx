import { $t } from '@/utils/i18n-t';
import { reactive, ref } from 'vue';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { FormInstance } from 'element-plus';
import { Rules } from '@/global/form-rules';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    defaultIO: string;
}
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'default-io',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { defaultIO } = useGlobalStore();
        const drawerVisible = ref();
        const loading = ref();
        const ioOptions = ref();
        const form = reactive({
            defaultIO: '',
        });
        const formRef = ref<FormInstance>();
        const acceptParams = (params: DialogProps): void => {
            form.defaultIO = params.defaultIO;
            loadIOOptions();
            drawerVisible.value = true;
        };
        const loadIOOptions = async () => {
            const res = await rpc.monitor.listIOOptions({});
            ioOptions.value = res.items;
        };
        const onSave = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                await rpc.monitor
                    .updateSetting({ key: 'DefaultIO', value: form.defaultIO })
                    .then(async () => {
                        defaultIO.value = form.defaultIO;
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        loading.value = false;
                        drawerVisible.value = false;
                        ctx.emit('search');
                        return;
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            });
        };
        const handleClose = () => {
            drawerVisible.value = false;
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
                header={$t('monitor.defaultIO')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="small"
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
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
                                        onSave(unref(formRef));
                                    }}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            >
                {withDirectives(
                    <ElForm
                        ref={formRef}
                        label-position="top"
                        model={form}
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                    >
                        <ElFormItem label={$t('monitor.defaultIO')} prop="defaultIO" rules={Rules.requiredSelect}>
                            <ElSelect
                                modelValue={form.defaultIO}
                                onUpdate:modelValue={($v) => {
                                    form.defaultIO = $v as any;
                                }}
                                filterable
                            >
                                {(unref(ioOptions) || []).map((item) => (
                                    <ElOption
                                        label={item == 'all' ? $t('commons.table.all') : item}
                                        value={item}
                                        key={item}
                                    />
                                ))}
                            </ElSelect>
                        </ElFormItem>
                    </ElForm>,
                    [[vLoading, unref(loading)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
