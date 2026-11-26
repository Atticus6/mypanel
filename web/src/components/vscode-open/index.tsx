import { $t } from '@/utils/i18n-t';
interface RootCertInfo {
    id: number;
    createAt: Date;
    name: string;
    mode: string;
    encryptionMode: string;
    passPhrase: string;
    description: string;
    publicKey: string;
    privateKey: string;
}
import { Base64 } from 'js-base64';
import i18n from '@/lang';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { Rules } from '@/global/form-rules';
import { copyText } from '@/utils/clipboard';
import { MsgError } from '@/utils/message';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    path: string;
}
type AuthMode = 'key' | 'password';
import './index.styles.css';
import DialogPro from '@/components/dialog-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'vscode-open',
    props: {},
    emits: emits,
    __scopeId: 'data-v-33907ad3',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode, currentNodeAddr } = useGlobalStore();
        const open = ref(false);
        const loading = ref(false);
        const showScriptPreview = ref(false);
        const vscodeConnectInfoForm = ref<FormInstance>();
        const certOptions = ref<RootCertInfo[]>([]);
        const STORAGE_KEY = 'VscodeConnectInfo';
        const normalizeAuthMode = (value: unknown): AuthMode => (value === 'key' ? 'key' : 'password');
        const defaultForm = () => ({
            authMode: 'password' as AuthMode,
            host: '',
            port: 22,
            username: 'root',
            certID: '' as number | '',
            sshKeyPath: '',
            path: '',
        });
        const addForm = reactive(defaultForm());
        const getStorageKey = () => `${STORAGE_KEY}:${currentNode.value}:${currentNodeAddr.value || 'local'}`;
        const isKeyMode = computed(() => addForm.authMode === 'key');
        const selectedCert = computed(() =>
            certOptions.value.find((item) => String(item.id) === String(addForm.certID)),
        );
        const sshConfigValue = (value: string) =>
            `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$')}"`;
        const normalizeHost = (value: string) => value.trim().replace(/^\[(.*)\]$/, '$1');
        const formatHostForRemote = (value: string) => {
            const trimmed = normalizeHost(value);
            if (trimmed.includes(':') && !trimmed.startsWith('[')) {
                return `[${trimmed}]`;
            }
            return trimmed;
        };
        const getKeyPathFileName = () => {
            const keyPath = addForm.sshKeyPath.trim();
            const normalizedPath = keyPath.replace(/\\/g, '/').replace(/\/+$/, '');
            return normalizedPath.split('/').pop() || selectedCert.value?.name || 'ssh-private-key';
        };
        const getSafeKeyFileName = (name = 'ssh-private-key') =>
            name
                .trim()
                .replace(/[/\\]/g, '-')
                .replace(/\s+/g, '-')
                .replace(/[^a-zA-Z0-9._-]+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^[.-]+|[.-]+$/g, '') || 'ssh-private-key';
        const buildSshAlias = () => {
            const host = normalizeHost(addForm.host);
            const port = Number(addForm.port) || 22;
            const username = addForm.username.trim() || 'root';
            const certName = selectedCert.value?.name?.trim() || 'key';
            const certID = selectedCert.value?.id ?? 0;
            return `1panel-${host}-${port}-${username}-${certName}-${certID}`
                .replace(/[^a-zA-Z0-9._-]+/g, '-')
                .replace(/-+/g, '-');
        };
        const buildVscodeUrl = () => {
            const remoteTarget = isKeyMode.value
                ? buildSshAlias()
                : `${addForm.username.trim() || 'root'}@${formatHostForRemote(addForm.host)}:${Number(addForm.port) || 22}`;
            const remotePath = encodeURI(addForm.path);
            return `vscode://vscode-remote/ssh-remote+${encodeURIComponent(remoteTarget)}${remotePath}?windowId=_blank`;
        };
        const buildSetupScript = () => {
            const host = normalizeHost(addForm.host);
            const port = Number(addForm.port) || 22;
            const username = addForm.username.trim() || 'root';
            const keyPath = addForm.sshKeyPath.trim();
            const alias = buildSshAlias();
            const managedBegin = `# 1Panel VS Code managed block: ${alias}`;
            const managedEnd = `# 1Panel VS Code managed block end: ${alias}`;

            return [
                '#!/usr/bin/env bash',
                'set -euo pipefail',
                '',
                '# Run this script on the computer running VS Code.',
                `SSH_CONFIG="$HOME/.ssh/config"`,
                `KEY_PATH=${sshConfigValue(keyPath)}`,
                `MANAGED_BEGIN=${sshConfigValue(managedBegin)}`,
                `MANAGED_END=${sshConfigValue(managedEnd)}`,
                '',
                'mkdir -p "$(dirname "$SSH_CONFIG")"',
                'chmod 700 "$(dirname "$SSH_CONFIG")" || true',
                'touch "$SSH_CONFIG"',
                '',
                'tmp_file="$(mktemp)"',
                'awk -v begin="$MANAGED_BEGIN" -v end="$MANAGED_END" \'',
                '  $0 == begin { skip = 1; next }',
                '  $0 == end { skip = 0; next }',
                '  !skip { print }',
                '\' "$SSH_CONFIG" > "$tmp_file"',
                '',
                'cat <<EOF >> "$tmp_file"',
                managedBegin,
                `Host ${alias}`,
                `    HostName ${sshConfigValue(host)}`,
                `    User ${sshConfigValue(username)}`,
                `    Port ${port}`,
                `    IdentityFile ${sshConfigValue(keyPath)}`,
                '    IdentitiesOnly yes',
                managedEnd,
                'EOF',
                '',
                'mv "$tmp_file" "$SSH_CONFIG"',
                'chmod 600 "$SSH_CONFIG"',
                'if [ ! -f "$KEY_PATH" ]; then',
                '    echo "1Panel: private key not found: $KEY_PATH" >&2',
                '    echo "1Panel: download the private key and save it to this exact path, then rerun this script." >&2',
                '    exit 1',
                'fi',
                'chmod 600 "$KEY_PATH"',
                `echo "1Panel: SSH config ready for ${alias}"`,
            ].join('\n');
        };
        const scriptText = computed(() =>
            addForm.authMode === 'key' && addForm.path && canGenerate.value ? buildSetupScript() : '',
        );
        const canGenerate = computed(() => {
            if (!addForm.host.trim() || !addForm.username.trim() || !addForm.port) {
                return false;
            }
            if (!isKeyMode.value) {
                return true;
            }
            return Boolean(selectedCert.value && addForm.sshKeyPath.trim());
        });
        const requiredKeyValidator = (_rule: FormItemRule, value: unknown, callback: (error?: Error) => void) => {
            if (!isKeyMode.value) {
                callback();
                return;
            }
            if (value === '' || typeof value === 'undefined' || value === null) {
                callback(new Error(String(i18n.global.t('commons.rule.requiredSelect'))));
                return;
            }
            callback();
        };
        const requiredKeyPathValidator = (_rule: FormItemRule, value: unknown, callback: (error?: Error) => void) => {
            if (!isKeyMode.value) {
                callback();
                return;
            }
            if (value === '' || typeof value === 'undefined' || value === null) {
                callback(new Error(String(i18n.global.t('commons.rule.requiredInput'))));
                return;
            }
            callback();
        };
        const rules = reactive<FormRules>({
            authMode: [Rules.requiredSelect],
            host: [Rules.requiredInput, Rules.ipV4V6OrDomain],
            port: [Rules.requiredInput, Rules.port],
            username: [Rules.requiredInput],
            certID: [{ validator: requiredKeyValidator, trigger: 'change' }],
            sshKeyPath: [{ validator: requiredKeyPathValidator, trigger: 'blur' }],
        });
        const saveDraft = () => {
            localStorage.setItem(
                getStorageKey(),
                JSON.stringify({
                    authMode: addForm.authMode,
                    host: addForm.host,
                    port: addForm.port,
                    username: addForm.username,
                    certID: addForm.certID,
                    sshKeyPath: addForm.sshKeyPath,
                }),
            );
        };
        const restoreDraft = () => {
            const storedInfo = localStorage.getItem(getStorageKey());
            if (!storedInfo) return;

            try {
                const parsed = JSON.parse(storedInfo);
                addForm.authMode = normalizeAuthMode(parsed.authMode);
                addForm.host = parsed.host?.trim() || addForm.host;
                addForm.port = parsed.port || addForm.port;
                addForm.username = parsed.username?.trim() || addForm.username;
                addForm.certID = parsed.certID ?? '';
                addForm.sshKeyPath = parsed.sshKeyPath?.trim() || '';
            } catch {
                localStorage.removeItem(getStorageKey());
            }
        };
        const loadConnectionInfo = async () => {
            if (currentNode.value === 'local') {
                try {
                    const res = await rpc.agentSetting.getLocalConn({});
                    if (res.addr) {
                        addForm.host = res.addr || currentNodeAddr.value || '127.0.0.1';
                        addForm.port = Number(res.port) || 22;
                        addForm.username = res.user || 'root';
                        return;
                    }
                } catch {}
            }

            try {
                const res = await rpc.ssh.getInfo({});
                if (res) {
                    addForm.port = Number(res.port) || 22;
                    addForm.username = res.currentUser || 'root';
                }
            } catch {}

            addForm.host = currentNodeAddr.value || addForm.host || '127.0.0.1';
        };
        const loadCertOptions = async () => {
            const res = await rpc.ssh.searchCerts({ page: 1, pageSize: 500 });
            certOptions.value = (res.items || []) as any;
        };
        const loadDialogData = async () => {
            loading.value = true;
            await Promise.allSettled([loadConnectionInfo(), loadCertOptions()]);
            restoreDraft();
            if (addForm.authMode === 'key' && addForm.certID && !selectedCert.value) {
                addForm.certID = '';
            }
            loading.value = false;
        };
        const formatCertLabel = (item: RootCertInfo) => {
            const desc = item.description?.trim();
            return desc ? `${item.name} (${item.encryptionMode}) - ${desc}` : `${item.name} (${item.encryptionMode})`;
        };
        const handleClose = () => {
            saveDraft();
            open.value = false;
            showScriptPreview.value = false;
            vscodeConnectInfoForm.value?.resetFields();
            Object.assign(addForm, defaultForm());
            certOptions.value = [];
            ctx.emit('close', false);
        };
        const handleAuthModeChange = () => {
            showScriptPreview.value = false;
        };
        const handleCertChange = () => {
            if (addForm.sshKeyPath.trim() || !selectedCert.value?.name) {
                return;
            }
            addForm.sshKeyPath = `~/.ssh/${getSafeKeyFileName(selectedCert.value.name)}`;
        };
        const copySetupScript = async () => {
            if (addForm.authMode !== 'key') return;
            if (!canGenerate.value) {
                MsgError(String(i18n.global.t('commons.msg.inputOrSelect')));
                return;
            }
            await copyText(buildSetupScript());
        };
        const downloadPrivateKey = () => {
            if (!selectedCert.value?.privateKey) {
                MsgError(String(i18n.global.t('commons.msg.noneData')));
                return;
            }
            const content = Base64.decode(selectedCert.value.privateKey);
            const fileName = getKeyPathFileName();
            const downloadUrl = window.URL.createObjectURL(new Blob([content], { type: 'application/octet-stream' }));
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = downloadUrl;
            a.download = fileName;
            a.dispatchEvent(new MouseEvent('click'));

            setTimeout(() => {
                window.URL.revokeObjectURL(downloadUrl);
            }, 100);
        };
        const submit = async () => {
            if (!vscodeConnectInfoForm.value) return;

            await vscodeConnectInfoForm.value.validate((valid) => {
                if (!valid || !canGenerate.value) return;

                saveDraft();
                open.value = false;
                window.open(buildVscodeUrl(), '_blank', 'noopener,noreferrer');
            });
        };
        const acceptParams = async (params: DialogProps): Promise<void> => {
            Object.assign(addForm, defaultForm());
            certOptions.value = [];
            showScriptPreview.value = false;
            addForm.path = params.path;
            open.value = true;
            await loadDialogData();
        };
        ctx.expose({ acceptParams });
        return () => (
            <DialogPro
                v-model={open.value}
                title={$t('file.openWithVscode')}
                size="large"
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer flex flex-wrap items-center justify-end gap-2'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        (handleClose as any)($event);
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                {addForm.authMode === 'key' ? (
                                    <ElButton
                                        disabled={!unref(selectedCert)}
                                        plain
                                        onClick={($event?: any) => {
                                            (downloadPrivateKey as any)($event);
                                        }}
                                    >
                                        {$t('commons.button.download')}
                                    </ElButton>
                                ) : null}
                                {addForm.authMode === 'key' ? (
                                    <ElButton
                                        disabled={!unref(canGenerate)}
                                        onClick={($event?: any) => {
                                            (copySetupScript as any)($event);
                                        }}
                                    >
                                        {$t('file.vscodeCopyConfig')}
                                    </ElButton>
                                ) : null}
                                <ElButton
                                    disabled={!unref(canGenerate)}
                                    type="primary"
                                    onClick={($event?: any) => {
                                        (submit as any)($event);
                                    }}
                                >
                                    {$t('file.openWithVscode')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            >
                {
                    <div class={'vscode-open space-y-4'} v-loading={unref(loading)}>
                        {addForm.authMode === 'key' ? (
                            <ElAlert
                                closable={false}
                                title={$t('file.vscodeHelper')}
                                description={$t('file.vscodeKeyHelper')}
                                show-icon
                                type="info"
                            />
                        ) : null}
                        <div class={'grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]'}>
                            <section class={'vscode-open__panel'}>
                                <ElForm ref={vscodeConnectInfoForm} model={addForm} rules={rules} label-position="top">
                                    <ElFormItem label={$t('terminal.authMode')} prop="authMode" class={'mb-5'}>
                                        <ElRadioGroup
                                            v-model={addForm.authMode}
                                            onChange={($event?: any) => {
                                                (handleAuthModeChange as any)($event);
                                            }}
                                        >
                                            <ElRadioButton value="password">
                                                {$t('terminal.passwordMode')}
                                            </ElRadioButton>
                                            <ElRadioButton value="key">{$t('terminal.keyMode')}</ElRadioButton>
                                        </ElRadioGroup>
                                    </ElFormItem>
                                    <div class={'grid gap-4 md:grid-cols-2'}>
                                        <ElFormItem label={$t('terminal.ip')} prop="host">
                                            <ElInput
                                                modelValue={addForm.host}
                                                onUpdate:modelValue={($v) => {
                                                    addForm.host = typeof $v === 'string' ? $v.trim() : $v;
                                                }}
                                                autocomplete="off"
                                            />
                                        </ElFormItem>
                                        <ElFormItem label={$t('commons.table.port')} prop="port">
                                            <ElInput
                                                modelValue={addForm.port}
                                                onUpdate:modelValue={($v) => {
                                                    addForm.port = $v === '' ? $v : Number($v);
                                                }}
                                                autocomplete="off"
                                            />
                                        </ElFormItem>
                                    </div>
                                    <ElFormItem label={$t('commons.login.username')} prop="username">
                                        <ElInput
                                            modelValue={addForm.username}
                                            onUpdate:modelValue={($v) => {
                                                addForm.username = typeof $v === 'string' ? $v.trim() : $v;
                                            }}
                                            autocomplete="off"
                                        />
                                    </ElFormItem>
                                    {addForm.authMode === 'key' ? (
                                        <>
                                            <ElFormItem label={$t('file.vscodeSelectKey')} prop="certID">
                                                <ElSelect
                                                    v-model={addForm.certID}
                                                    clearable
                                                    filterable
                                                    loading={unref(loading)}
                                                    placeholder={$t('commons.msg.inputOrSelect')}
                                                    onChange={($event?: any) => {
                                                        (handleCertChange as any)($event);
                                                    }}
                                                    class={'w-full'}
                                                >
                                                    {(unref(certOptions) || []).map((item) => (
                                                        <ElOption
                                                            label={formatCertLabel(item)}
                                                            value={item.id}
                                                            key={item.id}
                                                        />
                                                    ))}
                                                </ElSelect>
                                            </ElFormItem>
                                            <ElFormItem label={$t('file.vscodeKeyPath')} prop="sshKeyPath">
                                                <ElInput
                                                    modelValue={addForm.sshKeyPath}
                                                    onUpdate:modelValue={($v) => {
                                                        addForm.sshKeyPath = typeof $v === 'string' ? $v.trim() : $v;
                                                    }}
                                                    placeholder={$t('file.vscodeKeyPathPlaceholder')}
                                                    autocomplete="off"
                                                />
                                            </ElFormItem>
                                        </>
                                    ) : null}
                                </ElForm>
                            </section>
                            <section class={'vscode-open__panel'}>
                                {addForm.authMode === 'key' ? (
                                    <div class={'space-y-4'}>
                                        <div class={'flex items-center justify-between gap-2'}>
                                            <div>
                                                <div class={'vscode-open__title'}>{$t('file.vscodeScriptPreview')}</div>
                                                <p class={'vscode-open__tip'}>{$t('file.vscodeScriptPreviewHint')}</p>
                                            </div>
                                            <div class={'flex flex-wrap justify-end gap-2'}>
                                                <ElButton
                                                    disabled={!unref(canGenerate)}
                                                    plain
                                                    onClick={($event?: any) => {
                                                        showScriptPreview.value = !unref(showScriptPreview);
                                                    }}
                                                >
                                                    {unref(showScriptPreview)
                                                        ? $t('commons.button.collapse')
                                                        : $t('commons.button.preview')}
                                                </ElButton>
                                                <ElButton
                                                    disabled={!unref(canGenerate)}
                                                    plain
                                                    onClick={($event?: any) => {
                                                        (copySetupScript as any)($event);
                                                    }}
                                                >
                                                    {$t('file.vscodeCopyConfig')}
                                                </ElButton>
                                            </div>
                                        </div>
                                        {unref(showScriptPreview) ? (
                                            <pre
                                                class={
                                                    'vscode-open__script max-h-[430px] overflow-auto p-3 text-xs leading-6'
                                                }
                                            >
                                                {unref(scriptText)}
                                            </pre>
                                        ) : null}
                                    </div>
                                ) : (
                                    <div class={'flex h-full min-h-[320px] flex-col justify-between gap-4'}>
                                        <div class={'space-y-3'}>
                                            <div class={'vscode-open__title'}>{$t('file.vscodePasswordModeTitle')}</div>
                                            <p class={'vscode-open__tip'}>{$t('file.vscodePasswordModeHint')}</p>
                                            <div class={'vscode-open__steps space-y-2 p-3'}>
                                                <div class={'flex items-center gap-2 text-sm'}>
                                                    <span class={'vscode-open__step-index'}>{'1'}</span>
                                                    {$t('file.vscodePasswordStep1')}
                                                </div>
                                                <div class={'flex items-center gap-2 text-sm'}>
                                                    <span class={'vscode-open__step-index'}>{'2'}</span>
                                                    {$t('file.vscodePasswordStep2')}
                                                </div>
                                                <div class={'flex items-center gap-2 text-sm'}>
                                                    <span class={'vscode-open__step-index'}>{'3'}</span>
                                                    {$t('file.vscodePasswordStep3')}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                }
            </DialogPro>
        );
    },
    options,
);
