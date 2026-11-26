import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
import { useGlobalStore } from '@/composables/useGlobalStore';
interface DialogProps {
    panelName: string;
}
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'name',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { themeConfig } = useGlobalStore();
        const drawerVisible = ref();
        const loading = ref();
        const form = reactive({
            panelName: '',
        });
        const rules = reactive({
            panelName: [{ validator: checkPanelName, trigger: 'blur', required: true }],
        });
        function checkPanelName(rule: any, value: any, callback: any) {
            if (value === '') {
                return callback(new Error(i18n.global.t('setting.titleHelper')));
            }
            const reg = /^[a-zA-Z0-9\u4e00-\u9fa5 .,:!@#%&^*_+[\]{}~\-=?，。！｜？：；「」『』【】（）《》·]{3,30}$/;
            if (!reg.test(value)) {
                return callback(new Error(i18n.global.t('setting.titleHelper')));
            }
            callback();
        }
        const formRef = ref<FormInstance>();
        const acceptParams = (params: DialogProps): void => {
            form.panelName = params.panelName;
            drawerVisible.value = true;
        };
        const onSavePanelName = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                await rpc.core.setting
                    .updateSetting({ key: 'PanelName', value: form.panelName })
                    .then(async () => {
                        themeConfig.value = { ...themeConfig.value, panelName: form.panelName };
                        document.title = form.panelName;
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
                header={$t('setting.title')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
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
                                disabled={unref(loading)}
                                type="primary"
                                onClick={($event?: any) => {
                                    onSavePanelName(unref(formRef));
                                }}
                            >
                                {$t('commons.button.confirm')}
                            </ElButton>
                        </>
                    ),
                }}
            >
                {withDirectives(
                    <ElForm
                        ref={formRef}
                        label-position="top"
                        model={form}
                        rules={rules}
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                    >
                        <ElFormItem label={$t('setting.title')} prop="panelName">
                            <ElInput
                                clearable
                                modelValue={form.panelName}
                                onUpdate:modelValue={($v) => {
                                    form.panelName = $v as any;
                                }}
                            />
                        </ElFormItem>
                    </ElForm>,
                    [[vLoading, unref(loading)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
