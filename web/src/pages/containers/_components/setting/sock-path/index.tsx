import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import FileList from '@/components/file-list/index';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    dockerSockPath: string;
}
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'sock-path',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const drawerVisible = ref();
        const loading = ref();
        const fileRef = ref();
        const form = reactive({
            dockerSockPath: '',
            currentPath: '',
        });
        const formRef = ref<FormInstance>();
        const rules = reactive({
            dockerSockPath: [{ required: true, validator: checkSockPath, trigger: 'blur' }],
        });
        function checkSockPath(rule: any, value: any, callback: any) {
            if (!value.endsWith('.sock')) {
                return callback(new Error(i18n.global.t('container.sockPathErr')));
            }
            callback();
        }
        const acceptParams = (params: DialogProps): void => {
            form.dockerSockPath = params.dockerSockPath.replaceAll('unix://', '');
            form.currentPath = params.dockerSockPath.replaceAll('unix://', '');
            drawerVisible.value = true;
        };
        const loadBuildDir = async (path: string) => {
            form.dockerSockPath = path;
        };
        const onSubmit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                ElMessageBox.confirm(
                    `
                    <div style="line-height: 1.6;">
                        <ul style="padding-left: 18px; margin: 0;">
                            <li>${i18n.global.t('container.restartHelper')}</li>
                            <li>${i18n.global.t('container.sockPathMsg')}</li>
                        </ul>
                    </div>
                    `,
                    i18n.global.t('container.sockPath'),
                    {
                        confirmButtonText: i18n.global.t('commons.button.confirm'),
                        cancelButtonText: i18n.global.t('commons.button.cancel'),
                        dangerouslyUseHTMLString: true,
                    },
                ).then(async () => {
                    loading.value = true;
                    let params = {
                        key: 'DockerSockPath',
                        value: form.dockerSockPath.startsWith('unix://')
                            ? form.dockerSockPath
                            : 'unix://' + form.dockerSockPath,
                    };
                    await rpc.agentSetting
                        .updateSetting(params)
                        .then(() => {
                            loading.value = false;
                            handleClose();
                            ctx.emit('search');
                            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
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
            <div>
                <DrawerPro
                    v-model={drawerVisible.value}
                    header={$t('container.sockPath')}
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
                                        onSubmit(unref(formRef));
                                    }}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </>
                        ),
                    }}
                >
                    {
                        <ElForm
                            ref={formRef}
                            label-position="top"
                            model={form}
                            rules={rules}
                            onSubmit={($event?: any) => {
                                $event.preventDefault();
                            }}
                            v-loading={unref(loading)}
                        >
                            <ElFormItem label={$t('container.sockPath')} prop="dockerSockPath">
                                <ElInput
                                    v-model={form.dockerSockPath}
                                    v-slots={{
                                        prepend: () => <>{'unix://'}</>,
                                        append: () => (
                                            <>
                                                <ElButton
                                                    icon="Folder"
                                                    onClick={($event?: any) => {
                                                        unref(fileRef).acceptParams({});
                                                    }}
                                                />
                                            </>
                                        ),
                                    }}
                                />
                                <span class={'input-help'}>{$t('container.sockPathHelper1')}</span>
                            </ElFormItem>
                        </ElForm>
                    }
                </DrawerPro>
                <FileList
                    ref={fileRef}
                    onChoose={($event?: any) => {
                        (loadBuildDir as any)($event);
                    }}
                />
            </div>
        );
    },
    options,
);
