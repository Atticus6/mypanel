import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import { File } from '@/types/file';
import type { FileShareInfo as FileShareInfoMessage } from '@/gen/panel/agent/v1/file_pb';
import { CopyDocument, Download, Picture } from '@element-plus/icons-vue';
import i18n from '@/lang';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { buildFileSharePageUrl, buildFileShareQrCodeUrl, withFileSharePassword } from '@/utils/file';
import { copyText } from '@/utils/clipboard';
import { dateFormat as formatDateTime } from '@/utils/date';
import type { FormInstance, FormRules } from 'element-plus';
import { computed, reactive, ref, watch } from 'vue';
interface ShareProps {
    path: string;
}
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import permissionDirective from '@/directives/modules/permission';
import { nodeAdminDirective } from '@/directives/modules/permission';
import { ElAlert } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElLink } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElDivider } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';
import SvgIcon from '@/components/svg-icon/svg-icon';
import DialogPro from '@/components/dialog-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'share',
    props: {},
    emits: emits,
    __scopeId: 'data-v-6cfd7728',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode } = useGlobalStore();
        const open = ref(false);
        const loading = ref(false);
        const changed = ref(false);
        const filePath = ref('');
        const shareInfo = ref<File.FileShareInfo | null>(null);
        const shareUrl = ref('');
        const expiresAtText = ref('');
        const qrCodeUrl = ref('');
        const qrDialogOpen = ref(false);
        const shareFormRef = ref<FormInstance>();
        const syncingPassword = ref(false);
        const initialSharePassword = ref('');
        const passwordTouched = ref(false);
        const form = reactive({
            expireMinutes: 1440,
            sharePassword: '',
        });
        const expireOptions = computed(() => [
            { label: i18n.global.t('file.shareExpire1h'), value: 60 },
            { label: i18n.global.t('file.shareExpire6h'), value: 360 },
            { label: i18n.global.t('file.shareExpire24h'), value: 1440 },
            { label: i18n.global.t('file.shareExpire3d'), value: 4320 },
            { label: i18n.global.t('file.shareExpire7d'), value: 10080 },
            { label: i18n.global.t('website.ever'), value: 0 },
        ]);
        const validatePassword = (_rule, value, callback) => {
            const password = typeof value === 'string' ? value.trim() : '';
            if (password.length === 0) {
                callback();
                return;
            }
            if (password.length < 4 || password.length > 256) {
                callback(new Error(String(i18n.global.t('file.sharePasswordLengthHint'))));
                return;
            }
            callback();
        };
        const rules = reactive<FormRules>({
            sharePassword: [{ validator: validatePassword, trigger: 'blur' }],
        });
        watch(
            () => form.sharePassword,
            (val) => {
                if (syncingPassword.value) {
                    return;
                }
                if (val === initialSharePassword.value) {
                    return;
                }
                passwordTouched.value = true;
            },
        );
        const mapExpireMinutes = (info: File.FileShareInfo) => {
            if (info.permanent || info.expiresAt === 0) {
                return 0;
            }
            const remainMinutes = Math.max(1, Math.round((info.expiresAt * 1000 - Date.now()) / 60000));
            const matched = expireOptions.value.find((item) => item.value === remainMinutes);
            return matched ? matched.value : 1440;
        };
        const applyShareInfo = (info: File.FileShareInfo | null) => {
            shareInfo.value = info;
            if (!info) {
                shareUrl.value = '';
                expiresAtText.value = '';
                qrCodeUrl.value = '';
                qrDialogOpen.value = false;
                form.expireMinutes = 1440;
                form.sharePassword = '';
                syncingPassword.value = true;
                initialSharePassword.value = '';
                passwordTouched.value = false;
                syncingPassword.value = false;
                return;
            }
            shareUrl.value = buildFileSharePageUrl(info.code, currentNode.value);
            qrCodeUrl.value = buildFileShareQrCodeUrl(info.code, currentNode.value);
            expiresAtText.value = info.permanent
                ? i18n.global.t('website.ever')
                : formatDateTime(null, null, info.expiresAt * 1000);
            form.expireMinutes = mapExpireMinutes(info);
            syncingPassword.value = true;
            form.sharePassword = info.password || '';
            initialSharePassword.value = form.sharePassword;
            passwordTouched.value = false;
            syncingPassword.value = false;
        };
        const toShareInfo = (share?: FileShareInfoMessage): File.FileShareInfo | null =>
            share
                ? {
                      code: share.code,
                      path: share.path,
                      fileName: share.fileName,
                      expiresAt: Number(share.expiresAt),
                      permanent: share.permanent,
                      hasPassword: share.hasPassword,
                      password: share.password,
                  }
                : null;
        const loadShareDetail = async () => {
            const res = await rpc.file.getShare({ path: filePath.value });
            applyShareInfo(toShareInfo(res.share));
        };
        const resetForm = () => {
            filePath.value = '';
            changed.value = false;
            applyShareInfo(null);
            shareFormRef.value?.clearValidate();
        };
        const handleClose = () => {
            const needRefresh = changed.value;
            open.value = false;
            resetForm();
            ctx.emit('close', needRefresh);
        };
        const generate = async () => {
            const valid = await shareFormRef.value?.validate().catch(() => false);
            if (valid === false) {
                return;
            }
            loading.value = true;
            try {
                const pw = form.sharePassword.trim();
                const payload: File.FileShareCreate = {
                    path: filePath.value,
                    expireMinutes: form.expireMinutes,
                };

                if (passwordTouched.value) {
                    payload.password = pw;
                } else if (!shareInfo.value?.hasPassword && pw.length > 0) {
                    payload.password = pw;
                }

                const res = await rpc.file.createShare(payload);
                applyShareInfo(toShareInfo(res.share));
                changed.value = true;
            } finally {
                loading.value = false;
            }
        };
        const cancelShare = async () => {
            loading.value = true;
            try {
                await rpc.file.deleteShare({ path: filePath.value });
                applyShareInfo(null);
                changed.value = true;
            } finally {
                loading.value = false;
            }
        };
        const copyLink = () => {
            if (shareUrl.value) {
                copyText(withFileSharePassword(shareUrl.value, form.sharePassword));
            }
        };
        const openShareUrl = () => {
            if (shareUrl.value) {
                window.open(shareUrl.value, '_blank', 'noopener,noreferrer');
            }
        };
        const openQrDialog = () => {
            if (qrCodeUrl.value) {
                qrDialogOpen.value = true;
            }
        };
        const openQrImage = () => {
            if (qrCodeUrl.value) {
                window.open(qrCodeUrl.value, '_blank', 'noopener,noreferrer');
            }
        };
        const saveQrImage = () => {
            if (!qrCodeUrl.value) {
                return;
            }
            const link = document.createElement('a');
            link.href = qrCodeUrl.value;
            link.download = `share-${shareInfo.value?.code || 'qrcode'}.png`;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.click();
        };
        const acceptParams = async (params: ShareProps) => {
            resetForm();
            filePath.value = params.path;
            open.value = true;
            loading.value = true;
            try {
                await loadShareDetail();
            } finally {
                loading.value = false;
            }
        };
        ctx.expose({ acceptParams });
        return () => (
            <>
                <DrawerPro
                    modelValue={unref(open)}
                    onUpdate:modelValue={($v) => {
                        open.value = $v as any;
                    }}
                    header={$t('file.shareFile')}
                    size="large"
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                    v-slots={{
                        footer: () => (
                            <>
                                <span class={'dialog-footer'}>
                                    <ElButton
                                        disabled={unref(loading)}
                                        onClick={($event?: any) => {
                                            (handleClose as any)($event);
                                        }}
                                    >
                                        {$t('commons.button.cancel')}
                                    </ElButton>
                                    {unref(shareInfo)
                                        ? withDirectives(
                                              <ElButton
                                                  disabled={unref(loading)}
                                                  onClick={($event?: any) => {
                                                      (cancelShare as any)($event);
                                                  }}
                                              >
                                                  {$t('file.shareClose')}
                                              </ElButton>,
                                              [
                                                  [permissionDirective, true],
                                                  [nodeAdminDirective, true],
                                              ],
                                          )
                                        : null}
                                    {unref(shareInfo) ? (
                                        <ElButton
                                            disabled={unref(loading)}
                                            onClick={($event?: any) => {
                                                (copyLink as any)($event);
                                            }}
                                        >
                                            {$t('file.shareCopyLink')}
                                        </ElButton>
                                    ) : null}
                                    {withDirectives(
                                        <ElButton
                                            type="primary"
                                            disabled={unref(loading)}
                                            onClick={($event?: any) => {
                                                (generate as any)($event);
                                            }}
                                        >
                                            {unref(shareInfo) ? $t('file.shareRegenerate') : $t('file.shareGenerate')}
                                        </ElButton>,
                                        [
                                            [permissionDirective, true],
                                            [nodeAdminDirective, true],
                                        ],
                                    )}
                                </span>
                            </>
                        ),
                    }}
                >
                    <ElAlert
                        title={$t('file.shareRiskAlert')}
                        type="warning"
                        closable={false}
                        show-icon
                        class={'share-risk-alert'}
                    />
                    {withDirectives(
                        <ElForm ref={shareFormRef} model={form} rules={rules} label-position="top" label-width="100px">
                            <ElFormItem label={$t('file.path')}>
                                <ElInput model-value={unref(filePath)} type="textarea" rows={2} readonly />
                            </ElFormItem>
                            <ElFormItem label={$t('file.shareExpire')}>
                                <ElSelect
                                    modelValue={form.expireMinutes}
                                    onUpdate:modelValue={($v) => {
                                        form.expireMinutes = $v as any;
                                    }}
                                    class={'w-full'}
                                >
                                    {(unref(expireOptions) || []).map((opt) => (
                                        <ElOption label={opt.label} value={opt.value} key={opt.value} />
                                    ))}
                                </ElSelect>
                            </ElFormItem>
                            <ElFormItem label={$t('file.sharePassword')} prop="sharePassword">
                                <ElInput
                                    modelValue={form.sharePassword}
                                    onUpdate:modelValue={($v) => {
                                        form.sharePassword = $v as any;
                                    }}
                                    type="password"
                                    show-password
                                    clearable
                                    maxlength="256"
                                    show-word-limit
                                    placeholder={$t('file.sharePasswordPlaceholder')}
                                    autocomplete="new-password"
                                />
                            </ElFormItem>
                            {unref(shareInfo) ? (
                                <>
                                    <ElFormItem label={$t('file.shareLinkLabel')}>
                                        <div class={'share-link-bar'}>
                                            <ElLink
                                                underline={false}
                                                type="primary"
                                                onClick={($event?: any) => {
                                                    (openShareUrl as any)($event);
                                                }}
                                                class={'share-link-value'}
                                            >
                                                {unref(shareUrl)}
                                            </ElLink>
                                            <div class={'flex items-center justify-end'}>
                                                <ElButton
                                                    link
                                                    onClick={($event?: any) => {
                                                        (copyLink as any)($event);
                                                    }}
                                                    class={'share-link-button'}
                                                >
                                                    <CopyDocument size="16" class={'share-link-icon'} />
                                                </ElButton>
                                                <ElDivider direction="vertical" />
                                                <ElButton
                                                    link
                                                    onClick={($event?: any) => {
                                                        (openQrDialog as any)($event);
                                                    }}
                                                    class={'share-link-button'}
                                                >
                                                    <SvgIcon iconName="p-qrcode" class={'share-link-icon'} />
                                                </ElButton>
                                            </div>
                                        </div>
                                    </ElFormItem>
                                    <ElFormItem label={$t('file.shareExpiresAt')}>
                                        <ElInput model-value={unref(expiresAtText)} readonly />
                                    </ElFormItem>
                                </>
                            ) : null}
                        </ElForm>,
                        [[vLoading, unref(loading)]],
                    )}
                </DrawerPro>
                <DialogPro
                    modelValue={unref(qrDialogOpen)}
                    onUpdate:modelValue={($v) => {
                        qrDialogOpen.value = $v as any;
                    }}
                    title={$t('file.shareQrDialogTitle')}
                    size="small"
                >
                    <div class={'share-qr-dialog'}>
                        <div class={'share-qr-title'}>{$t('file.shareQrDialogTitle')}</div>
                        {unref(qrCodeUrl) ? (
                            <img src={unref(qrCodeUrl)} alt={$t('file.shareQrCode')} class={'share-qr-image'} />
                        ) : null}
                        <div class={'share-qr-helper'}>{$t('file.shareQrDialogHelper')}</div>
                        <div class={'share-qr-actions'}>
                            <ElButton
                                text
                                onClick={($event?: any) => {
                                    (saveQrImage as any)($event);
                                }}
                            >
                                <Download class={'share-link-icon'} />
                                {$t('file.shareSaveImage')}
                            </ElButton>
                            <ElButton
                                text
                                onClick={($event?: any) => {
                                    (openQrImage as any)($event);
                                }}
                            >
                                <Picture class={'share-link-icon'} />
                                {$t('file.shareOpenImage')}
                            </ElButton>
                        </div>
                    </div>
                </DialogPro>
            </>
        );
    },
    options,
);
