import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    permitRootLogin: string;
}
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'root',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const drawerVisible = ref();
        const loading = ref();
        const form = reactive({
            permitRootLogin: 'yes',
        });
        const formRef = ref<FormInstance>();
        const acceptParams = (params: DialogProps): void => {
            form.permitRootLogin = params.permitRootLogin;
            drawerVisible.value = true;
        };
        const onSave = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                ElMessageBox.confirm(
                    i18n.global.t('ssh.sshChangeHelper', [
                        i18n.global.t('ssh.permitRootLogin'),
                        loadPermitLabel(form.permitRootLogin),
                    ]),
                    i18n.global.t('ssh.sshChange'),
                    {
                        confirmButtonText: i18n.global.t('commons.button.confirm'),
                        cancelButtonText: i18n.global.t('commons.button.cancel'),
                        type: 'info',
                    },
                )
                    .then(async () => {
                        let params = {
                            key: 'PermitRootLogin',
                            newValue: form.permitRootLogin,
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
        const loadPermitLabel = (value: string) => {
            switch (value) {
                case 'yes':
                    return i18n.global.t('ssh.rootHelper1');
                case 'no':
                    return i18n.global.t('ssh.rootHelper2');
                case 'without-password':
                    return i18n.global.t('ssh.rootHelper3');
                case 'forced-commands-only':
                    return i18n.global.t('ssh.rootHelper4');
            }
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
                header={$t('ssh.permitRootLogin')}
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
                        <ElFormItem label={$t('ssh.permitRootLogin')} prop="permitRootLogin">
                            <ElSelect
                                modelValue={form.permitRootLogin}
                                onUpdate:modelValue={($v) => {
                                    form.permitRootLogin = $v as any;
                                }}
                                style={'width: 100%'}
                            >
                                <ElOption label={$t('ssh.rootHelper1')} value="yes" />
                                <ElOption label={$t('ssh.rootHelper2')} value="no" />
                                <ElOption label={$t('ssh.rootHelper3')} value="without-password" />
                                <ElOption label={$t('ssh.rootHelper4')} value="forced-commands-only" />
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
