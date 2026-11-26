import { $t } from '@/utils/i18n-t';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { Backup } from '@/types/backup';
import FileList from '@/components/file-list/index';
import { cities } from './../helper';
import { dateFormat } from '@/utils/date';
import { encodeBase64Fields } from '@/utils/base64';
import { deepCopy } from '@/utils/misc';
import { spliceHttp, splitHttp } from '@/utils/validate';
import { MsgError, MsgSuccess } from '@/utils/message';
import { Base64 } from 'js-base64';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { rpc } from '@/lib/rpc';
type FormInstance = InstanceType<typeof ElForm>;
interface DialogProps {
    title: string;
    rowData?: Backup.BackupInfo;
}
import './index.styles.css';
import permissionDirective from '@/directives/modules/permission';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: (...args: unknown[]) => true,
};

const options = {
    name: 'operate',
    props: {},
    emits: emits,
    __scopeId: 'data-v-58b8ef03',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { docsUrl, isProductPro } = useGlobalStore();
        const loading = ref(false);
        const formRef = ref<FormInstance>();
        const buckets = ref();
        const clientInfo = ref();
        const fileRef = ref();
        const isOK = ref();
        const stopWatch = ref();
        const regionInput = ref();
        const domainProto = ref('http');
        const title = ref<string>('');
        const drawerVisible = ref(false);
        const dialogData = ref<DialogProps>({
            title: '',
        });
        const supportsCustomCA = computed(() => {
            const row = dialogData.value.rowData;
            if (!row) return false;
            if (row.type === 'S3' || row.type === 'MINIO') return domainProto.value === 'https';
            return row.type === 'WebDAV' && /^https:\/\//i.test(String(row.varsJson?.['address'] || '').trim());
        });
        const formWatcher = computed(() => {
            const { type, isPublic, accessKey, bucket, credential, backupPath, bucketInput, varsJson } =
                dialogData.value.rowData || {};
            return {
                type,
                isPublic,
                accessKey,
                bucket,
                credential,
                backupPath,
                bucketInput,
                varsJson,
                protocol: domainProto.value,
            };
        });
        const startWatcher = () => {
            if (stopWatch.value) {
                stopWatcher();
            }
            stopWatch.value = watch(
                () => formWatcher.value,
                () => {
                    stopWatcher();
                    isOK.value = false;
                },
                { deep: true },
            );
        };
        const stopWatcher = () => {
            if (stopWatch.value) {
                stopWatch.value();
                stopWatch.value = null;
            }
        };
        const acceptParams = (params: DialogProps): void => {
            dialogData.value = params;
            dialogData.value.rowData.varsJson = dialogData.value.rowData!.vars
                ? JSON.parse(dialogData.value.rowData!.vars)
                : {};
            title.value = i18n.global.t('commons.button.' + dialogData.value.title);
            if (dialogData.value.title === 'create') {
                dialogData.value.rowData!.type = 'OSS';
                changeType();
                drawerVisible.value = true;
                return;
            }
            buckets.value = [];
            if (hasAccessKey()) {
                let itemJson = dialogData.value.rowData!.varsJson['endpoint'];
                if (dialogData.value.rowData!.type === 'KODO') {
                    itemJson = dialogData.value.rowData!.varsJson['domain'];
                }
                let httpItem = splitHttp(itemJson);
                dialogData.value.rowData!.varsJson['endpointItem'] = httpItem.url;
                domainProto.value = httpItem.proto;
            }
            if (dialogData.value.rowData!.rememberAuth) {
                dialogData.value.rowData!.accessKey = Base64.decode(dialogData.value.rowData!.accessKey);
                dialogData.value.rowData!.credential = Base64.decode(dialogData.value.rowData!.credential);
            }
            if (dialogData.value.rowData!.varsJson['timeout'] === undefined) {
                dialogData.value.rowData!.varsJson['timeout'] = 1;
            }
            drawerVisible.value = true;
        };
        const toDoc = (type: string) => {
            let uri = '';
            switch (type) {
                case 'onedrive':
                    uri = '#42-onedrive';
                    break;
                case 'onedrive-bind':
                    uri = '#43-onedrive';
                    break;
                case 'ali-pan':
                    uri = '#44';
                    break;
                case 'google-drive':
                    uri = '#45';
                    break;
                case 'webdav':
                    uri = '#46-webdav-alist';
                    break;
            }
            window.open(docsUrl.value + '/user_manual/settings/' + uri, '_blank', 'noopener,noreferrer');
        };
        const jumpForCode = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            const result = await formEl.validateField('varsJson.client_id', callback);
            if (!result) {
                return;
            }
            const result1 = await formEl.validateField('varsJson.redirect_uri', callback);
            if (!result1) {
                return;
            }
            let client_id = dialogData.value.rowData.varsJson['client_id'];
            let redirect_uri = dialogData.value.rowData.varsJson['redirect_uri'];
            if (isOneDrive()) {
                let commonUrl = `response_type=code&client_id=${client_id}&redirect_uri=${redirect_uri}&scope=offline_access+Files.ReadWrite.All+User.Read`;
                if (!dialogData.value.rowData!.varsJson['isCN']) {
                    window.open(
                        'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?' + commonUrl,
                        '_blank',
                    );
                } else {
                    window.open('https://login.chinacloudapi.cn/common/oauth2/v2.0/authorize?' + commonUrl, '_blank');
                }
                return;
            }

            let url = `https://accounts.google.com/o/oauth2/auth/oauthchooseaccount?client_id=${client_id}&response_type=code&redirect_uri=${redirect_uri}&scope=openid%20profile%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fphotoslibrary&access_type=offline&prompt=consent&service=lso&o2v=1&ddm=1&flowName=GeneralOAuthFlow`;
            window.open(url, '_blank');
        };
        function callback(error: any) {
            if (error) {
                return error.message;
            } else {
                return;
            }
        }
        const loadFromTokenForAliyun = () => {
            const obj = JSON.parse(dialogData.value.rowData!.varsJson['token']);
            dialogData.value.rowData!.varsJson['drive_id'] = obj.default_drive_id;
            dialogData.value.rowData!.varsJson['refresh_token'] = obj.refresh_token;
        };
        const hasRemember = () => {
            return (
                dialogData.value.rowData!.type !== 'LOCAL' &&
                dialogData.value.rowData!.type !== 'OneDrive' &&
                dialogData.value.rowData!.type !== 'ALIYUN' &&
                dialogData.value.rowData!.type !== 'GoogleDrive'
            );
        };
        const hasClient = () => {
            let itemType = dialogData.value.rowData!.type;
            return itemType === 'OneDrive' || itemType === 'GoogleDrive';
        };
        const isOneDrive = () => {
            let itemType = dialogData.value.rowData!.type;
            return itemType === 'OneDrive';
        };
        const isUPYUN = () => {
            let itemType = dialogData.value.rowData!.type;
            return itemType === 'UPYUN';
        };
        const isALIYUNYUN = () => {
            let itemType = dialogData.value.rowData!.type;
            return itemType === 'ALIYUN';
        };
        const hasAccessKey = () => {
            let itemType = dialogData.value.rowData!.type;
            return (
                itemType === 'COS' ||
                itemType === 'KODO' ||
                itemType === 'MINIO' ||
                itemType === 'OSS' ||
                itemType === 'S3'
            );
        };
        const hasPassword = () => {
            let itemType = dialogData.value.rowData!.type;
            return itemType === 'SFTP' || itemType === 'WebDAV';
        };
        const hasBackDir = () => {
            let itemType = dialogData.value.rowData!.type;
            return itemType !== 'LOCAL' && itemType !== 'SFTP';
        };
        const loadDir = async (path: string) => {
            dialogData.value.rowData!.backupPath = path;
        };
        const changeType = async () => {
            buckets.value = [];
            dialogData.value.rowData!.varsJson = {};
            dialogData.value.rowData!.rememberAuth = false;
            switch (dialogData.value.rowData!.type) {
                case 'COS':
                case 'OSS':
                    dialogData.value.rowData.varsJson['scType'] = 'Standard';
                    break;
                case 'S3':
                    dialogData.value.rowData.varsJson['scType'] = 'STANDARD';
                    dialogData.value.rowData.varsJson['mode'] = 'virtual hosted';
                    break;
                case 'KODO':
                    dialogData.value.rowData!.varsJson['timeout'] = 1;
                    break;
                case 'OneDrive':
                    dialogData.value.rowData.varsJson['isCN'] = false;
                    const res = await rpc.core.backups.getClientInfo({ clientType: 'Onedrive' });
                    clientInfo.value = res as any;
                    if (!dialogData.value.rowData.id) {
                        dialogData.value.rowData.varsJson = {
                            isCN: false,
                            client_id: res.clientId,
                            client_secret: res.clientSecret,
                            redirect_uri: res.redirectUri,
                        };
                    }
                    break;
                case 'SFTP':
                    dialogData.value.rowData.varsJson['port'] = 22;
                    dialogData.value.rowData.varsJson['authMode'] = 'password';
                    break;
            }
        };
        const changeClientFrom = () => {
            if (dialogData.value.rowData.varsJson['isCN']) {
                dialogData.value.rowData.varsJson = {
                    isCN: true,
                    client_id: '',
                    client_secret: '',
                    redirect_uri: '',
                };
            } else {
                dialogData.value.rowData.varsJson = {
                    isCN: false,
                    client_id: clientInfo.value.clientId,
                    client_secret: clientInfo.value.clientSecret,
                    redirect_uri: clientInfo.value.redirectUri,
                };
            }
        };
        const handleClose = () => {
            ctx.emit('search');
            drawerVisible.value = false;
        };
        const getBuckets = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            const result1 = await formEl.validateField('varsJson.endpointItem', callback);
            const result2 = await formEl.validateField('accessKey', callback);
            const result3 = await formEl.validateField('credential', callback);
            const result4 = await formEl.validateField('varsJson.region', callback);
            if (!result1 || !result2 || !result3 || !result4) {
                return;
            }
            loading.value = true;
            let item = deepCopy(dialogData.value.rowData!.varsJson);
            let itemEndpoint = loadEndpoint();
            if (dialogData.value.rowData!.type === 'KODO') {
                item['domain'] = itemEndpoint;
            } else {
                item['endpoint'] = itemEndpoint;
            }
            item['endpointItem'] = undefined;
            const params = {
                type: dialogData.value.rowData!.type,
                vars: JSON.stringify(item),
                accessKey: dialogData.value.rowData!.accessKey,
                credential: dialogData.value.rowData!.credential,
            };
            let request = deepCopy(params) as typeof params;
            encodeBase64Fields(request, ['accessKey', 'credential']);
            rpc.backup
                .listBuckets(request)
                .then((res) => {
                    loading.value = false;
                    buckets.value = res.items;
                })
                .catch(() => {
                    buckets.value = [];
                    loading.value = false;
                });
        };
        const loadEndpoint = () => {
            let item = splitHttp(dialogData.value.rowData!.varsJson['endpointItem']);
            if (item.proto) {
                domainProto.value = item.proto;
                dialogData.value.rowData!.varsJson['endpointItem'] = item.url;
            }
            return spliceHttp(domainProto.value, dialogData.value.rowData!.varsJson['endpointItem']);
        };
        const onCheck = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                if (!dialogData.value.rowData) return;
                if (hasAccessKey()) {
                    let itemEndpoint = loadEndpoint();
                    if (dialogData.value.rowData!.type === 'KODO') {
                        dialogData.value.rowData!.varsJson['domain'] = itemEndpoint;
                    } else {
                        dialogData.value.rowData!.varsJson['endpoint'] = itemEndpoint;
                    }
                }
                if (isOneDrive()) {
                    dialogData.value.rowData!.varsJson['code'] = decodeURIComponent(
                        dialogData.value.rowData!.varsJson['code'] || '',
                    );
                }
                if (isALIYUNYUN()) {
                    dialogData.value.rowData!.varsJson['token'] = undefined;
                }
                dialogData.value.rowData.vars = JSON.stringify(dialogData.value.rowData!.varsJson);
                const request = deepCopy(dialogData.value.rowData!) as Backup.BackupOperate;
                encodeBase64Fields(request, ['accessKey', 'credential']);
                loading.value = true;
                await rpc.backup
                    .checkBackupConn(request)
                    .then((res) => {
                        loading.value = false;
                        if (res.isOk) {
                            isOK.value = true;
                            MsgSuccess(i18n.global.t('terminal.connTestOk'));
                            if (hasClient()) {
                                dialogData.value.rowData!.varsJson['refresh_token'] = Base64.decode(res.token);
                                dialogData.value.rowData!.varsJson['refresh_status'] = 'Success';
                                dialogData.value.rowData!.varsJson['refresh_time'] = dateFormat(null, null, new Date());
                            }
                            if (isALIYUNYUN()) {
                                dialogData.value.rowData!.varsJson['refresh_status'] = 'Success';
                                dialogData.value.rowData!.varsJson['refresh_time'] = dateFormat(null, null, new Date());
                            }
                            startWatcher();
                            return;
                        }
                        isOK.value = false;
                        MsgError(i18n.global.t('terminal.connTestFailed') + ':' + res.msg);
                    })
                    .catch(() => {
                        loading.value = false;
                        isOK.value = false;
                    });
            });
        };
        const onSubmit = async () => {
            dialogData.value.rowData.vars = JSON.stringify(dialogData.value.rowData!.varsJson);
            const request = deepCopy(dialogData.value.rowData!) as Backup.BackupOperate;
            encodeBase64Fields(request, ['accessKey', 'credential']);
            const isPublic = !!dialogData.value.rowData!.isPublic;
            loading.value = true;
            let call: Promise<unknown>;
            if (dialogData.value.title === 'create') {
                call = isPublic ? rpc.core.backups.create(request) : rpc.backup.createBackupAccount(request);
            } else {
                call = isPublic ? rpc.core.backups.update(request) : rpc.backup.updateBackupAccount(request);
            }
            await call
                .then(() => {
                    loading.value = false;
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    drawerVisible.value = false;
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        onUnmounted(() => {
            if (stopWatch.value) stopWatcher();
        });
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
                    header={unref(title) + $t('setting.backupAccount')}
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                    size="large"
                    v-slots={{
                        footer: () => (
                            <>
                                <ElButton
                                    disabled={unref(loading)}
                                    onClick={($event?: any) => {
                                        (handleClose as any)($event);
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                {withDirectives(
                                    <ElButton
                                        disabled={unref(loading)}
                                        onClick={($event?: any) => {
                                            onCheck(unref(formRef));
                                        }}
                                    >
                                        {$t('terminal.testConn')}
                                    </ElButton>,
                                    [[permissionDirective, true]],
                                )}
                                {withDirectives(
                                    <ElButton
                                        type="primary"
                                        disabled={!unref(isOK) || unref(loading)}
                                        onClick={($event?: any) => {
                                            onSubmit();
                                        }}
                                    >
                                        {$t('commons.button.confirm')}
                                    </ElButton>,
                                    [[permissionDirective, true]],
                                )}
                            </>
                        ),
                    }}
                >
                    {withDirectives(
                        <ElForm
                            onSubmit={($event?: any) => {
                                $event.preventDefault();
                            }}
                            ref={formRef}
                            label-position="top"
                            model={unref(dialogData).rowData}
                        >
                            <ElFormItem label={$t('commons.table.name')} prop="name" rules={Rules.requiredInput}>
                                {unref(dialogData).title === 'edit' ? (
                                    <ElTag>
                                        {unref(dialogData).rowData!.name === 'localhost'
                                            ? $t('terminal.local')
                                            : unref(dialogData).rowData!.name}
                                    </ElTag>
                                ) : (
                                    <ElInput
                                        modelValue={unref(dialogData).rowData!.name}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.name = $v as any;
                                        }}
                                    />
                                )}
                            </ElFormItem>
                            {unref(isProductPro) ? (
                                <ElFormItem label={$t('setting.scope')} prop="isPublic" rules={Rules.requiredSelect}>
                                    {unref(dialogData).title === 'edit' ? (
                                        <ElTag>
                                            {unref(dialogData).rowData!.isPublic
                                                ? $t('setting.public')
                                                : $t('setting.private')}
                                        </ElTag>
                                    ) : (
                                        <ElRadioGroup
                                            modelValue={unref(dialogData).rowData!.isPublic}
                                            onUpdate:modelValue={($v) => {
                                                unref(dialogData).rowData!.isPublic = $v as any;
                                            }}
                                        >
                                            <ElRadio value={true} size="large">
                                                {$t('setting.public')}
                                            </ElRadio>
                                            <ElRadio value={false} size="large">
                                                {$t('setting.private')}
                                            </ElRadio>
                                        </ElRadioGroup>
                                    )}
                                    <span class={'input-help'}>
                                        {unref(dialogData).rowData!.isPublic
                                            ? $t('setting.publicHelper')
                                            : $t('setting.privateHelper')}
                                    </span>
                                </ElFormItem>
                            ) : null}
                            <ElFormItem label={$t('commons.table.type')} prop="type" rules={Rules.requiredSelect}>
                                {unref(dialogData).title === 'edit' ? (
                                    <ElTag>{$t('setting.' + unref(dialogData).rowData!.type)}</ElTag>
                                ) : (
                                    <ElSelect
                                        modelValue={unref(dialogData).rowData!.type}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.type = $v as any;
                                        }}
                                        onChange={($event?: any) => {
                                            (changeType as any)($event);
                                        }}
                                    >
                                        <ElOption label={$t('setting.OSS')} value="OSS" />
                                        <ElOption label={$t('setting.COS')} value="COS" />
                                        <ElOption label={$t('setting.S3')} value="S3" />
                                        <ElOption label={$t('setting.OneDrive')} value="OneDrive" />
                                        <ElOption label={$t('setting.GoogleDrive')} value="GoogleDrive" />
                                        <ElOption label={$t('setting.ALIYUN')} value="ALIYUN" />
                                        <ElOption label={$t('setting.MINIO')} value="MINIO" />
                                        <ElOption label={$t('setting.WebDAV')} value="WebDAV" />
                                        <ElOption label={$t('setting.SFTP')} value="SFTP" />
                                        <ElOption label={$t('setting.KODO')} value="KODO" />
                                        <ElOption label={$t('setting.UPYUN')} value="UPYUN" />
                                    </ElSelect>
                                )}
                                {isALIYUNYUN() ? <span class={'input-help'}>{$t('setting.ALIYUNHelper')}</span> : null}
                                {unref(dialogData).rowData?.type === 'GoogleDrive' ? (
                                    <span class={'input-help'}>
                                        {$t('setting.googleHelper', [$t('setting.' + unref(dialogData).rowData?.type)])}
                                        <ElLink
                                            icon="Position"
                                            onClick={($event?: any) => {
                                                toDoc('google-drive');
                                            }}
                                            type="primary"
                                            style={'font-size: 12px; margin-left: 5px'}
                                        >
                                            {$t('firewall.quickJump')}
                                        </ElLink>
                                    </span>
                                ) : null}
                            </ElFormItem>
                            {unref(dialogData).rowData!.type === 'S3' ? (
                                <ElFormItem
                                    label={$t('setting.mode')}
                                    prop="varsJson.mode"
                                    rules={Rules.requiredSelect}
                                >
                                    <ElRadioGroup
                                        modelValue={unref(dialogData).rowData!.varsJson['mode']}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.varsJson['mode'] = $v as any;
                                        }}
                                    >
                                        <ElRadio value="virtual hosted">{'Virtual Hosted'}</ElRadio>
                                        <ElRadio value="path">{'Path'}</ElRadio>
                                    </ElRadioGroup>
                                </ElFormItem>
                            ) : null}
                            {hasAccessKey() ? (
                                <ElFormItem label="Access Key ID" prop="accessKey" rules={Rules.requiredInput}>
                                    <ElInput
                                        clearable
                                        modelValue={unref(dialogData).rowData!.accessKey}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.accessKey =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                            ) : null}
                            {hasAccessKey() ? (
                                <ElFormItem label="Secret Key" prop="credential" rules={Rules.requiredInput}>
                                    <ElInput
                                        show-password
                                        clearable
                                        modelValue={unref(dialogData).rowData!.credential}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.credential =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                            ) : null}
                            {isUPYUN() ? (
                                <div>
                                    <ElFormItem
                                        label={$t('setting.operator')}
                                        prop="accessKey"
                                        rules={Rules.requiredInput}
                                    >
                                        <ElInput
                                            clearable
                                            modelValue={unref(dialogData).rowData!.accessKey}
                                            onUpdate:modelValue={($v) => {
                                                unref(dialogData).rowData!.accessKey =
                                                    typeof $v === 'string' ? $v.trim() : $v;
                                            }}
                                        />
                                    </ElFormItem>
                                    <ElFormItem
                                        label={$t('commons.login.password')}
                                        prop="credential"
                                        rules={Rules.requiredInput}
                                    >
                                        <ElInput
                                            show-password
                                            clearable
                                            modelValue={unref(dialogData).rowData!.credential}
                                            onUpdate:modelValue={($v) => {
                                                unref(dialogData).rowData!.credential =
                                                    typeof $v === 'string' ? $v.trim() : $v;
                                            }}
                                        />
                                    </ElFormItem>
                                </div>
                            ) : null}
                            {unref(dialogData).rowData!.type === 'WebDAV' ? (
                                <ElFormItem
                                    label={$t('setting.address')}
                                    prop="varsJson.address"
                                    rules={Rules.requiredInput}
                                >
                                    <ElInput
                                        modelValue={unref(dialogData).rowData!.varsJson['address']}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.varsJson['address'] = $v as any;
                                        }}
                                    />
                                    <span class={'input-help'}>
                                        {$t('setting.WebDAVAlist')}
                                        <ElLink
                                            icon="Position"
                                            onClick={($event?: any) => {
                                                toDoc('webdav');
                                            }}
                                            type="primary"
                                            style={'font-size: 12px; margin-left: 5px'}
                                        >
                                            {$t('firewall.quickJump')}
                                        </ElLink>
                                    </span>
                                </ElFormItem>
                            ) : null}
                            {unref(dialogData).rowData!.type === 'SFTP' ? (
                                <div>
                                    <ElFormItem
                                        label={$t('setting.address')}
                                        prop="varsJson.address"
                                        rules={Rules.host}
                                    >
                                        <ElInput
                                            modelValue={unref(dialogData).rowData!.varsJson['address']}
                                            onUpdate:modelValue={($v) => {
                                                unref(dialogData).rowData!.varsJson['address'] =
                                                    typeof $v === 'string' ? $v.trim() : $v;
                                            }}
                                            clearable
                                        />
                                    </ElFormItem>
                                    <ElFormItem
                                        label={$t('commons.table.port')}
                                        prop="varsJson.port"
                                        rules={[Rules.port]}
                                    >
                                        <ElInputNumber
                                            min={0}
                                            max={65535}
                                            modelValue={unref(dialogData).rowData!.varsJson['port']}
                                            onUpdate:modelValue={($v) => {
                                                unref(dialogData).rowData!.varsJson['port'] =
                                                    $v === '' ? $v : Number($v);
                                            }}
                                        />
                                    </ElFormItem>
                                </div>
                            ) : null}
                            {hasPassword() ? (
                                <div>
                                    <ElFormItem
                                        label={$t('commons.login.username')}
                                        prop="accessKey"
                                        rules={[Rules.requiredInput]}
                                    >
                                        <ElInput
                                            modelValue={unref(dialogData).rowData!.accessKey}
                                            onUpdate:modelValue={($v) => {
                                                unref(dialogData).rowData!.accessKey =
                                                    typeof $v === 'string' ? $v.trim() : $v;
                                            }}
                                        />
                                    </ElFormItem>
                                    {unref(dialogData).rowData!.type === 'SFTP' ? (
                                        <div>
                                            <ElFormItem label={$t('terminal.authMode')} prop="varsJson.authMode">
                                                <ElRadioGroup
                                                    modelValue={unref(dialogData).rowData!.varsJson['authMode']}
                                                    onUpdate:modelValue={($v) => {
                                                        unref(dialogData).rowData!.varsJson['authMode'] = $v as any;
                                                    }}
                                                >
                                                    <ElRadio value="password">{$t('terminal.passwordMode')}</ElRadio>
                                                    <ElRadio value="key">{$t('terminal.keyMode')}</ElRadio>
                                                </ElRadioGroup>
                                            </ElFormItem>
                                        </div>
                                    ) : null}
                                    {unref(dialogData).rowData!.type === 'SFTP' &&
                                    unref(dialogData).rowData!.varsJson['authMode'] === 'key' ? (
                                        <div>
                                            <ElFormItem
                                                label={$t('terminal.key')}
                                                prop="credential"
                                                rules={[Rules.requiredInput]}
                                            >
                                                <ElInput
                                                    type="textarea"
                                                    modelValue={unref(dialogData).rowData!.credential}
                                                    onUpdate:modelValue={($v) => {
                                                        unref(dialogData).rowData!.credential = $v as any;
                                                    }}
                                                />
                                            </ElFormItem>
                                            <ElFormItem label={$t('terminal.keyPassword')} prop="varsJson.passPhrase">
                                                <ElInput
                                                    type="password"
                                                    show-password
                                                    clearable
                                                    modelValue={unref(dialogData).rowData!.varsJson['passPhrase']}
                                                    onUpdate:modelValue={($v) => {
                                                        unref(dialogData).rowData!.varsJson['passPhrase'] = $v as any;
                                                    }}
                                                />
                                            </ElFormItem>
                                        </div>
                                    ) : (
                                        <ElFormItem
                                            label={$t('commons.login.password')}
                                            prop="credential"
                                            rules={[Rules.requiredInput]}
                                        >
                                            <ElInput
                                                type="password"
                                                clearable
                                                show-password
                                                modelValue={unref(dialogData).rowData!.credential}
                                                onUpdate:modelValue={($v) => {
                                                    unref(dialogData).rowData!.credential =
                                                        typeof $v === 'string' ? $v.trim() : $v;
                                                }}
                                            />
                                        </ElFormItem>
                                    )}
                                </div>
                            ) : null}
                            {hasRemember() ? (
                                <ElFormItem prop="rememberAuth">
                                    <ElCheckbox
                                        modelValue={unref(dialogData).rowData!.rememberAuth}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.rememberAuth = $v as any;
                                        }}
                                    >
                                        {$t('terminal.rememberPassword')}
                                    </ElCheckbox>
                                </ElFormItem>
                            ) : null}
                            {unref(dialogData).rowData!.type === 'COS' ? (
                                <ElFormItem label="Region" prop="varsJson.region" rules={Rules.requiredInput}>
                                    <ElCheckbox
                                        modelValue={unref(regionInput)}
                                        onUpdate:modelValue={($v) => {
                                            regionInput.value = $v as any;
                                        }}
                                        label={$t('container.input')}
                                    />
                                    {!unref(regionInput) ? (
                                        <ElSelect
                                            modelValue={unref(dialogData).rowData!.varsJson['region']}
                                            onUpdate:modelValue={($v) => {
                                                unref(dialogData).rowData!.varsJson['region'] = $v as any;
                                            }}
                                            filterable
                                            clearable
                                        >
                                            {(cities || []).map((item) => (
                                                <ElOption label={item.label} value={item.value} key={item.value}>
                                                    <span class={'float-left'}>{item.label}</span>
                                                    <span class={'option-help'}>{item.value}</span>
                                                </ElOption>
                                            ))}
                                        </ElSelect>
                                    ) : (
                                        <ElInput
                                            modelValue={unref(dialogData).rowData!.varsJson['region']}
                                            onUpdate:modelValue={($v) => {
                                                unref(dialogData).rowData!.varsJson['region'] =
                                                    typeof $v === 'string' ? $v.trim() : $v;
                                            }}
                                        />
                                    )}
                                </ElFormItem>
                            ) : null}
                            {unref(dialogData).rowData!.type === 'S3' ? (
                                <ElFormItem label="Region" prop="varsJson.region" rules={Rules.requiredInput}>
                                    <ElInput
                                        modelValue={unref(dialogData).rowData!.varsJson['region']}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.varsJson['region'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                            ) : null}
                            {hasAccessKey() ? (
                                <ElFormItem
                                    label={
                                        unref(dialogData).rowData!.type === 'KODO' ? $t('setting.domain') : 'Endpoint'
                                    }
                                    prop="varsJson.endpointItem"
                                    rules={Rules.requiredInput}
                                >
                                    <ElInput
                                        modelValue={unref(dialogData).rowData!.varsJson['endpointItem']}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.varsJson['endpointItem'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                        v-slots={{
                                            prepend: () => (
                                                <>
                                                    <ElSelect
                                                        modelValue={unref(domainProto)}
                                                        onUpdate:modelValue={($v) => {
                                                            domainProto.value = typeof $v === 'string' ? $v.trim() : $v;
                                                        }}
                                                        class={'p-w-100'}
                                                    >
                                                        <ElOption label="http" value="http" />
                                                        <ElOption label="https" value="https" />
                                                    </ElSelect>
                                                </>
                                            ),
                                        }}
                                    />
                                </ElFormItem>
                            ) : null}
                            {unref(supportsCustomCA) ? (
                                <ElFormItem label={$t('setting.backupCACert')} prop="varsJson.caCertPEM">
                                    <ElInput
                                        modelValue={unref(dialogData).rowData!.varsJson['caCertPEM']}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.varsJson['caCertPEM'] = $v as any;
                                        }}
                                        type="textarea"
                                        rows={5}
                                        spellcheck={false}
                                    />
                                    <span class={'input-help'}>{$t('setting.backupCACertHelp')}</span>
                                </ElFormItem>
                            ) : null}
                            {hasAccessKey() ? (
                                <ElFormItem label="Bucket" prop="bucket" rules={Rules.requiredInput}>
                                    <ElCheckbox
                                        modelValue={unref(dialogData).rowData!.bucketInput}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.bucketInput = $v as any;
                                        }}
                                        label={$t('container.input')}
                                    />
                                    {unref(dialogData).rowData!.bucketInput ? (
                                        <ElInput
                                            clearable
                                            modelValue={unref(dialogData).rowData!.bucket}
                                            onUpdate:modelValue={($v) => {
                                                unref(dialogData).rowData!.bucket = $v as any;
                                            }}
                                        />
                                    ) : (
                                        <div class={'w-full'}>
                                            <ElSelect
                                                modelValue={unref(dialogData).rowData!.bucket}
                                                onUpdate:modelValue={($v) => {
                                                    unref(dialogData).rowData!.bucket = $v as any;
                                                }}
                                                class={'!w-4/5'}
                                            >
                                                {(unref(buckets) || []).map((item) => (
                                                    <ElOption value={item} key={item} />
                                                ))}
                                            </ElSelect>
                                            <ElButton
                                                plain
                                                onClick={($event?: any) => {
                                                    getBuckets(unref(formRef));
                                                }}
                                                class={'!w-1/5'}
                                            >
                                                {$t('setting.loadBucket')}
                                            </ElButton>
                                        </div>
                                    )}
                                </ElFormItem>
                            ) : null}
                            {isUPYUN() ? (
                                <ElFormItem label={$t('setting.serviceName')} prop="bucket" rules={Rules.requiredInput}>
                                    <ElInput
                                        modelValue={unref(dialogData).rowData!.bucket}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.bucket = $v as any;
                                        }}
                                    />
                                </ElFormItem>
                            ) : null}
                            {unref(dialogData).rowData!.type === 'COS' ? (
                                <ElFormItem
                                    label={$t('setting.scType')}
                                    prop="varsJson.scType"
                                    rules={[Rules.requiredSelect]}
                                >
                                    <ElSelect
                                        modelValue={unref(dialogData).rowData!.varsJson['scType']}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.varsJson['scType'] = $v as any;
                                        }}
                                    >
                                        <ElOption value="DEFAULT" label={$t('setting.scLighthouse')} />
                                        <ElOption value="Standard" label={$t('setting.scStandard')} />
                                        <ElOption value="Standard_IA" label={$t('setting.scStandard_IA')} />
                                        <ElOption value="Archive" label={$t('setting.scArchive')} />
                                        <ElOption value="Deep_Archive" label={$t('setting.scDeep_Archive')} />
                                    </ElSelect>
                                    {unref(dialogData).rowData!.varsJson['scType'] === 'Archive' ||
                                    unref(dialogData).rowData!.varsJson['scType'] === 'Deep_Archive' ? (
                                        <ElAlert
                                            closable={false}
                                            type="warning"
                                            title={$t('setting.archiveHelper')}
                                            class={'mt-2.5'}
                                        />
                                    ) : null}
                                </ElFormItem>
                            ) : null}
                            {unref(dialogData).rowData!.type === 'OSS' ? (
                                <ElFormItem
                                    label={$t('setting.scType')}
                                    prop="varsJson.scType"
                                    rules={[Rules.requiredSelect]}
                                >
                                    <ElSelect
                                        modelValue={unref(dialogData).rowData!.varsJson['scType']}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.varsJson['scType'] = $v as any;
                                        }}
                                    >
                                        <ElOption value="Standard" label={$t('setting.scStandard')} />
                                        <ElOption value="IA" label={$t('setting.scStandard_IA')} />
                                        <ElOption value="Archive" label={$t('setting.scArchive')} />
                                        <ElOption value="ColdArchive" label={$t('setting.scDeep_Archive')} />
                                    </ElSelect>
                                    {unref(dialogData).rowData!.varsJson['scType'] === 'Archive' ||
                                    unref(dialogData).rowData!.varsJson['scType'] === 'ColdArchive' ? (
                                        <ElAlert
                                            closable={false}
                                            type="warning"
                                            title={$t('setting.archiveHelper')}
                                            class={'mt-2.5'}
                                        />
                                    ) : null}
                                </ElFormItem>
                            ) : null}
                            {unref(dialogData).rowData!.type === 'S3' ? (
                                <ElFormItem
                                    label={$t('setting.scType')}
                                    prop="varsJson.scType"
                                    rules={[Rules.requiredSelect]}
                                >
                                    <ElSelect
                                        modelValue={unref(dialogData).rowData!.varsJson['scType']}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.varsJson['scType'] = $v as any;
                                        }}
                                    >
                                        <ElOption value="STANDARD" label={$t('setting.scStandard')} />
                                        <ElOption value="STANDARD_IA" label={$t('setting.scStandard_IA')} />
                                        <ElOption value="GLACIER" label={$t('setting.scArchive')} />
                                        <ElOption value="DEEP_ARCHIVE" label={$t('setting.scDeep_Archive')} />
                                    </ElSelect>
                                    {unref(dialogData).rowData!.varsJson['scType'] === 'GLACIER' ||
                                    unref(dialogData).rowData!.varsJson['scType'] === 'DEEP_ARCHIVE' ? (
                                        <ElAlert
                                            closable={false}
                                            type="warning"
                                            title={$t('setting.archiveHelper')}
                                            class={'mt-2.5'}
                                        />
                                    ) : null}
                                </ElFormItem>
                            ) : null}
                            {unref(dialogData).rowData!.type === 'KODO' ? (
                                <ElFormItem label={$t('cronjob.requestExpirationTime')} prop="varsJson.timeout">
                                    <ElInputNumber
                                        min={1}
                                        step-strictly
                                        step={1}
                                        modelValue={unref(dialogData).rowData!.varsJson['timeout']}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.varsJson['timeout'] =
                                                $v === '' ? $v : Number($v);
                                        }}
                                        style={'width: 200px'}
                                    />
                                </ElFormItem>
                            ) : null}
                            {isALIYUNYUN() ? (
                                <div>
                                    <ElFormItem label="Token" prop="varsJson.token">
                                        <div class={'!w-full'}>
                                            <ElInput
                                                rows={3}
                                                type="textarea"
                                                clearable
                                                modelValue={unref(dialogData).rowData!.varsJson['token']}
                                                onUpdate:modelValue={($v) => {
                                                    unref(dialogData).rowData!.varsJson['token'] =
                                                        typeof $v === 'string' ? $v.trim() : $v;
                                                }}
                                                style={'width: calc(100% - 80px)'}
                                            />
                                            <ElButton
                                                onClick={($event?: any) => {
                                                    loadFromTokenForAliyun();
                                                }}
                                                class={'append-button'}
                                            >
                                                {$t('setting.analysis')}
                                            </ElButton>
                                            <span class={'input-help'}>
                                                {$t('setting.analysisHelper')}
                                                <ElLink
                                                    icon="Position"
                                                    onClick={($event?: any) => {
                                                        toDoc('ali-pan');
                                                    }}
                                                    type="primary"
                                                    style={'font-size: 12px; margin-left: 5px'}
                                                >
                                                    {$t('firewall.quickJump')}
                                                </ElLink>
                                            </span>
                                        </div>
                                    </ElFormItem>
                                    <ElFormItem label="Drive ID" prop="varsJson.drive_id" rules={Rules.requiredInput}>
                                        <ElInput
                                            modelValue={unref(dialogData).rowData!.varsJson['drive_id']}
                                            onUpdate:modelValue={($v) => {
                                                unref(dialogData).rowData!.varsJson['drive_id'] =
                                                    typeof $v === 'string' ? $v.trim() : $v;
                                            }}
                                        />
                                    </ElFormItem>
                                    <ElFormItem
                                        label="Refresh Token"
                                        prop="varsJson.refresh_token"
                                        rules={Rules.requiredInput}
                                    >
                                        <ElInput
                                            modelValue={unref(dialogData).rowData!.varsJson['refresh_token']}
                                            onUpdate:modelValue={($v) => {
                                                unref(dialogData).rowData!.varsJson['refresh_token'] =
                                                    typeof $v === 'string' ? $v.trim() : $v;
                                            }}
                                        />
                                    </ElFormItem>
                                </div>
                            ) : null}
                            {hasClient() ? (
                                <div>
                                    {isOneDrive() ? (
                                        <ElFormItem>
                                            <ElRadioGroup
                                                modelValue={unref(dialogData).rowData!.varsJson['isCN']}
                                                onUpdate:modelValue={($v) => {
                                                    unref(dialogData).rowData!.varsJson['isCN'] = $v as any;
                                                }}
                                                onChange={($event?: any) => {
                                                    (changeClientFrom as any)($event);
                                                }}
                                            >
                                                <ElRadioButton value={false}>{$t('setting.isNotCN')}</ElRadioButton>
                                                <ElRadioButton value={true}>{$t('setting.isCN')}</ElRadioButton>
                                            </ElRadioGroup>
                                            <span class={'input-help'}>
                                                {$t('setting.onedrive_helper')}
                                                <ElLink
                                                    icon="Position"
                                                    onClick={($event?: any) => {
                                                        toDoc('onedrive');
                                                    }}
                                                    type="primary"
                                                    style={'font-size: 12px; margin-left: 5px'}
                                                >
                                                    {$t('firewall.quickJump')}
                                                </ElLink>
                                            </span>
                                        </ElFormItem>
                                    ) : null}
                                    <ElFormItem
                                        label={$t('setting.client_id')}
                                        prop="varsJson.client_id"
                                        rules={Rules.requiredInput}
                                    >
                                        <ElInput
                                            modelValue={unref(dialogData).rowData!.varsJson['client_id']}
                                            onUpdate:modelValue={($v) => {
                                                unref(dialogData).rowData!.varsJson['client_id'] =
                                                    typeof $v === 'string' ? $v.trim() : $v;
                                            }}
                                        />
                                    </ElFormItem>
                                    <ElFormItem
                                        label={$t('setting.client_secret')}
                                        prop="varsJson.client_secret"
                                        rules={Rules.requiredInput}
                                    >
                                        <ElInput
                                            modelValue={unref(dialogData).rowData!.varsJson['client_secret']}
                                            onUpdate:modelValue={($v) => {
                                                unref(dialogData).rowData!.varsJson['client_secret'] =
                                                    typeof $v === 'string' ? $v.trim() : $v;
                                            }}
                                        />
                                    </ElFormItem>
                                    <ElFormItem
                                        label={$t('setting.redirect_uri')}
                                        prop="varsJson.redirect_uri"
                                        rules={Rules.requiredInput}
                                    >
                                        <ElInput
                                            modelValue={unref(dialogData).rowData!.varsJson['redirect_uri']}
                                            onUpdate:modelValue={($v) => {
                                                unref(dialogData).rowData!.varsJson['redirect_uri'] =
                                                    typeof $v === 'string' ? $v.trim() : $v;
                                            }}
                                        />
                                    </ElFormItem>
                                    <ElFormItem label={$t('setting.code')} prop="varsJson.code">
                                        <div class={'!w-full'}>
                                            <ElInput
                                                rows={3}
                                                type="textarea"
                                                clearable
                                                modelValue={unref(dialogData).rowData!.varsJson['code']}
                                                onUpdate:modelValue={($v) => {
                                                    unref(dialogData).rowData!.varsJson['code'] =
                                                        typeof $v === 'string' ? $v.trim() : $v;
                                                }}
                                                style={'width: calc(100% - 80px)'}
                                            />
                                            <ElButton
                                                onClick={($event?: any) => {
                                                    jumpForCode(unref(formRef));
                                                }}
                                                class={'append-button'}
                                            >
                                                {$t('setting.loadCode')}
                                            </ElButton>
                                        </div>
                                    </ElFormItem>
                                </div>
                            ) : null}
                            {hasBackDir() ? (
                                <ElFormItem label={$t('setting.backupDir')} prop="backupPath">
                                    <ElInput
                                        clearable
                                        modelValue={unref(dialogData).rowData!.backupPath}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.backupPath =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                        placeholder="/1panel"
                                    />
                                </ElFormItem>
                            ) : null}
                            {unref(dialogData).rowData!.type === 'SFTP' ? (
                                <ElFormItem
                                    label={$t('setting.backupDir')}
                                    prop="backupPath"
                                    rules={[Rules.requiredInput]}
                                >
                                    <ElInput
                                        modelValue={unref(dialogData).rowData!.backupPath}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.backupPath =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                            ) : null}
                            {unref(dialogData).rowData!.type === 'LOCAL' ? (
                                <ElFormItem
                                    label={$t('setting.backupDir')}
                                    prop="backupPath"
                                    rules={Rules.requiredInput}
                                >
                                    <ElInput
                                        modelValue={unref(dialogData).rowData!.backupPath}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.backupPath = $v as any;
                                        }}
                                        v-slots={{
                                            prepend: () => (
                                                <>
                                                    <ElButton
                                                        icon="Folder"
                                                        onClick={($event?: any) => {
                                                            unref(fileRef).acceptParams({ dir: true });
                                                        }}
                                                    />
                                                </>
                                            ),
                                        }}
                                    />
                                </ElFormItem>
                            ) : null}
                        </ElForm>,
                        [[vLoading, unref(loading)]],
                    )}
                </DrawerPro>
                <FileList
                    ref={fileRef}
                    onChoose={($event?: any) => {
                        (loadDir as any)($event);
                    }}
                />
            </>
        );
    },
    options,
);
