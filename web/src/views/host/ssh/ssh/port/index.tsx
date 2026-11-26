import { $t } from '@/utils/i18n-t';
import { reactive, ref } from 'vue';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { ElMessageBox, FormInstance } from 'element-plus';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    port: string;
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

const emits = {
    search: () => true,
};

const options = {
    name: 'port',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const drawerVisible = ref();
        const loading = ref();
        const form = reactive({
            port: '22',
        });
        const rules = reactive({
            port: [{ validator: checkPorts, trigger: 'blur', required: true }],
        });
        function checkPorts(rule: any, value: string, callback: any) {
            const ports = value
                .split(',')
                .map((item) => item.trim())
                .filter((item) => item !== '');
            if (ports.length === 0) {
                callback(new Error(i18n.global.t('commons.rule.requiredInput')));
                return;
            }
            const portSet = new Set<string>();
            for (const port of ports) {
                const portNumber = Number(port);
                if (!/^\d+$/.test(port) || Number.isNaN(portNumber) || portNumber < 1 || portNumber > 65535) {
                    callback(new Error(i18n.global.t('commons.rule.port')));
                    return;
                }
                if (portSet.has(port)) {
                    callback(new Error(i18n.global.t('commons.rule.port')));
                    return;
                }
                portSet.add(port);
            }
            callback();
        }
        const formRef = ref<FormInstance>();
        const acceptParams = (params: DialogProps): void => {
            form.port = params.port;
            drawerVisible.value = true;
        };
        const onSave = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                ElMessageBox.confirm(
                    i18n.global.t('ssh.sshChangeHelper', [i18n.global.t('commons.table.port'), form.port]),
                    i18n.global.t('ssh.sshChange'),
                    {
                        confirmButtonText: i18n.global.t('commons.button.confirm'),
                        cancelButtonText: i18n.global.t('commons.button.cancel'),
                        type: 'info',
                    },
                )
                    .then(async () => {
                        let params = {
                            key: 'Port',
                            newValue: form.port,
                        };
                        loading.value = true;
                        await rpc.ssh
                            .update(params)
                            .then(() => {
                                loading.value = false;
                                handleClose();
                                ctx.emit('search');
                                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                            })
                            .catch(() => {
                                loading.value = false;
                            });
                    })
                    .catch(() => {
                        ctx.emit('search');
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
                header={$t('ssh.port')}
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
                        <ElFormItem label={$t('ssh.port')} prop="port" rules={rules.port}>
                            <ElInput
                                clearable
                                modelValue={form.port}
                                onUpdate:modelValue={($v) => {
                                    form.port = $v as any;
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
