import { $t } from '@/utils/i18n-t';
interface RepoInfo {
    id: number;
    createdAt?: string;
    name: string;
    downloadUrl: string;
    protocol: string;
    username: string;
    password: string;
    auth: boolean;
}
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    title: string;
    rowData?: RepoInfo;
    getTableList?: () => Promise<any>;
}
type FormInstance = InstanceType<typeof ElForm>;
import DrawerPro from '@/components/drawer-pro/index';
import ConfirmDialog from '@/components/confirm-dialog/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'operator',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref(false);
        const confirmDialog = ref();
        const oldUrl = ref();
        const oldProto = ref();
        const title = ref<string>('');
        const drawerVisible = ref(false);
        const dialogData = ref<DialogProps>({
            title: '',
        });
        const acceptParams = (params: DialogProps): void => {
            dialogData.value = params;
            oldUrl.value = params.rowData.downloadUrl;
            oldProto.value = params.rowData.protocol;
            title.value = i18n.global.t('commons.button.' + dialogData.value.title);
            drawerVisible.value = true;
        };
        const handleClose = () => {
            ctx.emit('search');
            drawerVisible.value = false;
        };
        const rules = reactive({
            name: [Rules.requiredInput, Rules.name],
            downloadUrl: [{ validator: validateDownloadUrl, trigger: 'blur' }, Rules.illegal],
            protocol: [Rules.requiredSelect],
            username: [Rules.illegal],
            password: [Rules.illegal],
            auth: [Rules.requiredSelect],
        });
        const formRef = ref<FormInstance>();
        function validateDownloadUrl(rule: any, value: any, callback: any) {
            if (value === '') {
                callback();
            }
            const pattern = /^(http:\/\/|https:\/\/)/i;
            if (pattern.test(value)) {
                return callback(new Error(i18n.global.t('container.urlWarning')));
            }
            callback();
        }
        const onSubmit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                let newProto = dialogData.value.rowData.protocol;
                if (newProto === 'https' && dialogData.value.title === 'add') {
                    submit();
                    return;
                }
                if (newProto === oldProto.value) {
                    if (
                        (oldProto.value === 'http' && dialogData.value.rowData.downloadUrl === oldUrl.value) ||
                        oldProto.value === 'https'
                    ) {
                        submit();
                        return;
                    }
                }
                let params = {
                    header: i18n.global.t('container.repo'),
                    operationInfo: i18n.global.t('container.httpRepoHelper'),
                    submitInputInfo: i18n.global.t('database.restartNow'),
                };
                confirmDialog.value!.acceptParams(params);
            });
        };
        const submit = async () => {
            loading.value = true;
            if (dialogData.value.title === 'add') {
                await rpc.container
                    .createRepo(dialogData.value.rowData! as any)
                    .then(() => {
                        loading.value = false;
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        ctx.emit('search');
                        drawerVisible.value = false;
                    })
                    .catch(() => {
                        loading.value = false;
                    });
                return;
            }
            await rpc.container
                .updateRepo(dialogData.value.rowData! as any)
                .then(() => {
                    loading.value = false;
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    ctx.emit('search');
                    drawerVisible.value = false;
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <>
                <DrawerPro
                    modelValue={unref(drawerVisible)}
                    onUpdate:modelValue={($v) => {
                        drawerVisible.value = $v as any;
                    }}
                    header={unref(title)}
                    resource={unref(dialogData).rowData?.name}
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                    size="small"
                    v-slots={{
                        footer: () => (
                            <>
                                <span class={'dialog-footer'}>
                                    <ElButton
                                        disabled={unref(loading)}
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
                                </span>
                            </>
                        ),
                    }}
                >
                    {withDirectives(
                        <ElForm
                            ref={formRef}
                            label-position="top"
                            model={unref(dialogData).rowData}
                            rules={rules}
                            label-width="120px"
                        >
                            <ElFormItem label={$t('commons.table.name')} prop="name">
                                <ElInput
                                    clearable
                                    disabled={unref(dialogData).title === 'edit'}
                                    modelValue={unref(dialogData).rowData!.name}
                                    onUpdate:modelValue={($v) => {
                                        unref(dialogData).rowData!.name = typeof $v === 'string' ? $v.trim() : $v;
                                    }}
                                />
                            </ElFormItem>
                            <ElFormItem label={$t('container.auth')} prop="auth">
                                <ElRadioGroup
                                    modelValue={unref(dialogData).rowData!.auth}
                                    onUpdate:modelValue={($v) => {
                                        unref(dialogData).rowData!.auth = $v as any;
                                    }}
                                >
                                    <ElRadio value={true}>{$t('commons.true')}</ElRadio>
                                    <ElRadio value={false}>{$t('commons.false')}</ElRadio>
                                </ElRadioGroup>
                            </ElFormItem>
                            {unref(dialogData).rowData!.auth ? (
                                <ElFormItem label={$t('commons.login.username')} prop="username">
                                    <ElInput
                                        clearable
                                        modelValue={unref(dialogData).rowData!.username}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.username =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                            ) : null}
                            {unref(dialogData).rowData!.auth ? (
                                <ElFormItem label={$t('commons.login.password')} prop="password">
                                    <ElInput
                                        clearable
                                        type="password"
                                        show-password
                                        modelValue={unref(dialogData).rowData!.password}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.password =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                            ) : null}
                            <ElFormItem label={$t('container.downloadUrl')} prop="downloadUrl">
                                <ElInput
                                    clearable
                                    modelValue={unref(dialogData).rowData!.downloadUrl}
                                    onUpdate:modelValue={($v) => {
                                        unref(dialogData).rowData!.downloadUrl =
                                            typeof $v === 'string' ? $v.trim() : $v;
                                    }}
                                    placeholder={'172.16.10.10:8081'}
                                />
                                {unref(dialogData).rowData!.downloadUrl ? (
                                    <span class={'input-help'}>
                                        {' Pull example: docker pull '}
                                        {unref(dialogData).rowData!.downloadUrl}
                                        {'/nginx '}
                                    </span>
                                ) : null}
                            </ElFormItem>
                            <ElFormItem label={$t('commons.table.protocol')} prop="protocol">
                                <ElRadioGroup
                                    modelValue={unref(dialogData).rowData!.protocol}
                                    onUpdate:modelValue={($v) => {
                                        unref(dialogData).rowData!.protocol = $v as any;
                                    }}
                                >
                                    <ElRadio label="http">{'http'}</ElRadio>
                                    <ElRadio label="https">{'https'}</ElRadio>
                                </ElRadioGroup>
                                {unref(dialogData).rowData!.protocol === 'http' ? (
                                    <span class={'input-help'}>{$t('container.httpRepo')}</span>
                                ) : null}
                            </ElFormItem>
                        </ElForm>,
                        [[vLoading, unref(loading)]],
                    )}
                </DrawerPro>
                <ConfirmDialog
                    ref={confirmDialog}
                    onConfirm={($event?: any) => {
                        (submit as any)($event);
                    }}
                />
            </>
        );
    },
    options,
);
