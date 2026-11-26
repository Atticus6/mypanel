import { $t } from '@/utils/i18n-t';
import { reactive, ref } from 'vue';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
import { ElMessageBox, FormInstance } from 'element-plus';
import { Rules } from '@/global/form-rules';
import { useGlobalStore } from '@/composables/useGlobalStore';
interface DialogProps {
    serverPort: number;
}
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'port',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { entrance, isLogin } = useGlobalStore();
        const drawerVisible = ref();
        const loading = ref();
        const form = reactive({
            serverPort: 9999,
        });
        const formRef = ref<FormInstance>();
        const acceptParams = (params: DialogProps): void => {
            form.serverPort = params.serverPort;
            drawerVisible.value = true;
        };
        const onSavePort = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                ElMessageBox.confirm(i18n.global.t('setting.portChangeHelper'), i18n.global.t('setting.portChange'), {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                    type: 'info',
                }).then(async () => {
                    loading.value = true;
                    let param = {
                        serverPort: form.serverPort,
                    };
                    await rpc.core.setting
                        .updatePort({ port: Number(param.serverPort) })
                        .then(() => {
                            loading.value = false;
                            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                            isLogin.value = false;
                            let href = window.location.href;
                            let ip = href.split('//')[1].split(':')[0];
                            if (entrance.value) {
                                window.open(
                                    `${href.split('//')[0]}//${ip}:${form.serverPort}/${entrance.value}`,
                                    '_self',
                                );
                            } else {
                                window.open(`${href.split('//')[0]}//${ip}:${form.serverPort}/login`, '_self');
                            }
                        })
                        .catch(() => {
                            loading.value = false;
                        });
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
                header={$t('setting.panelPort')}
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
                                    onSavePort(unref(formRef));
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
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                    >
                        <ElFormItem label={$t('setting.panelPort')} prop="serverPort" rules={Rules.port}>
                            <ElInput
                                clearable
                                modelValue={form.serverPort}
                                onUpdate:modelValue={($v) => {
                                    form.serverPort = $v === '' ? $v : Number($v);
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
