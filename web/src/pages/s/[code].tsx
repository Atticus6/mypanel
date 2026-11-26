import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import { File } from '@/types/file';
import i18n, { loadLocaleMessages } from '@/lang';
import { buildFileShareDownloadUrl, getFileSharePasswordFromHash, removeFileSharePasswordFromHash } from '@/utils/file';
import { dateFormat } from '@/utils/date';
import '@/pages/s/_components/index.styles.css';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: '[code]',
    props: {},
    emits: emits,
    __scopeId: 'data-v-b234bc2b',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const route = useRoute();
        const password = ref('');
        const downloading = ref(false);
        const initializing = ref(true);
        const errorMessage = ref('');
        const shareInfo = ref<File.FileSharePublicInfo | null>(null);
        const shareLocale = ref('en');
        const supportedLocales = ['zh', 'zh-Hant', 'en', 'pt-BR', 'ja', 'ru', 'ms', 'ko', 'tr', 'es-ES', 'fa', 'lo'];
        const code = computed(() => String((route.params as { code?: string }).code || '').trim());
        const currentNode = computed(() => String(route.query.operateNode || 'local'));
        const expiresAtText = computed(() => {
            if (!shareInfo.value) {
                return '--';
            }
            if (shareInfo.value.permanent || shareInfo.value.expiresAt === 0) {
                return String(i18n.global.t('website.ever'));
            }
            return dateFormat(null, null, shareInfo.value.expiresAt * 1000);
        });
        const getFallbackText = (type: 'invalid' | 'failed') => {
            return String(i18n.global.t(type === 'invalid' ? 'file.shareInvalid' : 'file.shareDownloadFailed'));
        };
        const getPasswordRequiredText = () => {
            return String(i18n.global.t('file.sharePasswordRequiredInput'));
        };
        const triggerDownload = (pwd = '') => {
            window.location.href = buildFileShareDownloadUrl(code.value, currentNode.value, pwd);
        };
        const applySharedPassword = () => {
            const sharedPassword = getFileSharePasswordFromHash(window.location.hash);
            if (!sharedPassword) {
                return;
            }
            password.value = sharedPassword;
            const remainingHash = removeFileSharePasswordFromHash(window.location.hash);
            window.history.replaceState(
                window.history.state,
                '',
                `${window.location.pathname}${window.location.search}${remainingHash}`,
            );
        };
        const resolveBrowserLocale = () => {
            if (typeof navigator === 'undefined') {
                return 'en';
            }
            const browserLocale = String(navigator.language || '').trim();
            const normalized = browserLocale.toLowerCase();
            if (normalized.startsWith('zh-hant') || normalized.startsWith('zh-tw') || normalized.startsWith('zh-hk')) {
                return 'zh-Hant';
            }
            if (normalized.startsWith('zh')) {
                return 'zh';
            }
            const exactMatch = supportedLocales.find((locale) => locale.toLowerCase() === normalized);
            if (exactMatch) {
                return exactMatch;
            }
            const prefix = normalized.split('-')[0];
            const prefixMatch = supportedLocales.find((locale) => locale.toLowerCase().split('-')[0] === prefix);
            return prefixMatch || 'en';
        };
        const applyPublicLocale = async () => {
            const locale = resolveBrowserLocale();
            const loaded = await loadLocaleMessages(locale);
            i18n.global.locale.value = loaded;
            shareLocale.value = loaded;
        };
        const loadShareInfo = async () => {
            if (!code.value) {
                errorMessage.value = getFallbackText('invalid');
                return;
            }
            const res = await rpc.file.getPublicShare(
                { code: code.value },
                { headers: { 'Accept-Language': shareLocale.value } },
            );
            // proto 的 expiresAt 是 int64（bigint），展示层按毫秒数处理，此处统一转成 number。
            shareInfo.value = {
                fileName: res.fileName,
                expiresAt: Number(res.expiresAt),
                permanent: res.permanent,
                hasPassword: res.hasPassword,
            };
        };
        const downloadWithPassword = async () => {
            if (!code.value) {
                errorMessage.value = getFallbackText('invalid');
                return;
            }
            if (shareInfo.value?.hasPassword && !password.value.trim()) {
                errorMessage.value = getPasswordRequiredText();
                return;
            }
            downloading.value = true;
            errorMessage.value = '';
            try {
                await rpc.file.checkShare(
                    {
                        code: code.value,
                        password: password.value.trim(),
                    },
                    {
                        headers: { 'Accept-Language': shareLocale.value },
                    },
                );
                triggerDownload(password.value.trim());
            } catch (error) {
                errorMessage.value = (error as { message?: string })?.message || getFallbackText('failed');
            } finally {
                downloading.value = false;
            }
        };
        onMounted(async () => {
            try {
                applySharedPassword();
                await applyPublicLocale();
                await loadShareInfo();
                if (shareInfo.value && !shareInfo.value.hasPassword) {
                    await downloadWithPassword();
                }
            } catch (error) {
                errorMessage.value = (error as { message?: string })?.message || getFallbackText('invalid');
            } finally {
                initializing.value = false;
            }
        });
        return () =>
            withDirectives(
                <div class={'share-page'}>
                    <div class={'share-card'}>
                        <h1>{$t('file.shareLinkLabel')}</h1>
                        {unref(shareInfo) ? (
                            <div class={'share-meta'}>
                                <div class={'meta-item'}>
                                    <span class={'meta-label'}>{$t('file.fileName')}</span>
                                    <span class={'meta-value'}>{unref(shareInfo).fileName}</span>
                                </div>
                                <div class={'meta-item'}>
                                    <span class={'meta-label'}>{$t('file.shareExpiresAt')}</span>
                                    <span class={'meta-value'}>{unref(expiresAtText)}</span>
                                </div>
                            </div>
                        ) : null}
                        {unref(shareInfo)?.hasPassword ? (
                            <p class={'share-description'}>{$t('file.shareDownloadPasswordTip')}</p>
                        ) : unref(shareInfo) && !unref(errorMessage) ? (
                            <p class={'share-description'}>{$t('file.shareDownloadingHint')}</p>
                        ) : null}
                        {unref(shareInfo) ? (
                            <ElForm
                                onSubmit={($event?: any) => {
                                    $event.preventDefault();
                                }}
                            >
                                {unref(shareInfo).hasPassword ? (
                                    <ElFormItem label={$t('file.sharePasswordRequired')}>
                                        <ElInput
                                            modelValue={unref(password)}
                                            onUpdate:modelValue={($v) => {
                                                password.value = $v as any;
                                            }}
                                            type="password"
                                            show-password
                                            clearable
                                            maxlength="256"
                                            placeholder={$t('file.sharePasswordPlaceholder')}
                                            autocomplete="current-password"
                                            onKeyup={($event?: any) => {
                                                if (!($event.key === 'Enter')) return;
                                                (downloadWithPassword as any)($event);
                                            }}
                                        />
                                    </ElFormItem>
                                ) : null}
                                {unref(errorMessage) ? <div class={'share-error'}>{unref(errorMessage)}</div> : null}
                                <ElButton
                                    type="primary"
                                    loading={unref(downloading)}
                                    onClick={($event?: any) => {
                                        (downloadWithPassword as any)($event);
                                    }}
                                    class={'share-button'}
                                >
                                    {$t('file.shareExtractFile')}
                                </ElButton>
                            </ElForm>
                        ) : null}
                    </div>
                </div>,
                [[vLoading, unref(initializing)]],
            );
    },
    options,
);

definePage({
    name: 'file-share',
});
