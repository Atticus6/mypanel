import { $t } from '@/utils/i18n-t';
import { Firewall } from '@/types/firewall';
import i18n from '@/lang';
import { MsgError } from '@/utils/message';
import { formatHostAddress, inferAddressFamily } from '@/pages/views/host/firewall/utils/validation';
import { Document } from '@element-plus/icons-vue';
import { rpc } from '@/lib/rpc';
import './index.styles.css';
import DialogPro from '@/components/dialog-pro/index';
import ComplexTable from '@/components/table/complex/ComplexTable';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    created: (arg0?: string) => true,
};

const options = {
    name: 'import',
    props: {},
    emits: emits,
    __scopeId: 'data-v-34e9717a',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const visible = ref(false);
        const initialize = ref(false);
        const provider = ref<Firewall.Provider>('iptables');
        const maxFileSize = 64 * 1024 * 1024;
        const loading = ref(false);
        const fileLoaded = ref(false);
        const rules = ref<Firewall.Rule[]>([]);
        const selects = ref(new Set<Firewall.Rule>());
        const uploadRef = ref();
        const uploaderFiles = ref<UploadFile[]>([]);
        const displayAddress = (rule: Firewall.Rule, address?: string) => {
            const wildcard =
                rule.scope.family === 'ipv6' ? '::/0' : rule.scope.family === 'inet' ? '0.0.0.0/0, ::/0' : '0.0.0.0/0';
            if (address && address !== wildcard) return formatHostAddress(address, rule.scope.family);
            return `${wildcard}（${i18n.global.t('firewall.anyWhere')}）`;
        };
        const actionLabel = (action: Firewall.Action) => {
            if (action === 'accept') return i18n.global.t('firewall.accept');
            if (action === 'reject') return i18n.global.t('firewall.reject');
            if (action === 'drop') return i18n.global.t('firewall.drop');
            return i18n.global.t('commons.status.unknown');
        };
        const isRule = (value: unknown): value is Firewall.Rule => {
            if (!value || typeof value !== 'object') return false;
            const rule = value as Partial<Firewall.Rule>;
            return (
                Boolean(rule.scope) &&
                ['iptables', 'nftables', 'firewalld', 'ufw'].includes(String(rule.scope?.provider)) &&
                typeof rule.protocol === 'string' &&
                (['accept', 'drop', 'reject'].includes(String(rule.action)) ||
                    (Boolean(rule.raw) && ['partial', 'opaque'].includes(rule.parseStatus || '')))
            );
        };
        const normalizeLegacyImportedRule = (value: unknown): Firewall.Rule | undefined => {
            if (!value || typeof value !== 'object') return;
            const rule = value as Record<string, unknown>;
            if (rule.scope !== undefined || !['accept', 'drop'].includes(String(rule.strategy))) return;
            if (typeof rule.address !== 'string') return;
            if (rule.description !== undefined && typeof rule.description !== 'string') return;
            if (rule.port !== undefined && typeof rule.port !== 'string') return;
            if (rule.protocol !== undefined && typeof rule.protocol !== 'string') return;
            if (rule.family && !['ipv4', 'ipv6'].includes(String(rule.family))) return;

            const family = (rule.family as 'ipv4' | 'ipv6' | undefined) || inferAddressFamily(rule.address);
            const port = typeof rule.port === 'string' ? rule.port.trim() : '';
            const protocol = typeof rule.protocol === 'string' ? rule.protocol.trim().toLowerCase() : '';
            if (port && !['tcp', 'udp', 'tcp/udp'].includes(protocol)) return;
            if (!port && protocol && !['all', 'any'].includes(protocol)) return;

            const scope: Firewall.Scope = { provider: provider.value, family, direction: 'input' };
            if (provider.value === 'iptables' || provider.value === 'nftables') {
                scope.table = 'filter';
                scope.chain = '1PANEL_BASIC';
            } else if (provider.value === 'firewalld') {
                scope.zone = 'public';
            } else {
                scope.chain = 'incoming';
            }
            return {
                scope,
                protocol: port ? protocol : 'all',
                sourceAddress: rule.address,
                destinationPort: port || undefined,
                action: rule.strategy as Firewall.Action,
                description: (rule.description as string | undefined) || '',
            };
        };
        const fileOnChange = (uploadFile: UploadFile, uploadFiles: UploadFiles) => {
            if (!uploadFile.raw) return;
            loading.value = true;

            fileLoaded.value = false;
            rules.value = [];
            selects.value = new Set();
            uploaderFiles.value = uploadFiles;
            if (uploadFile.raw.size > maxFileSize) {
                uploadRef.value?.clearFiles();
                uploaderFiles.value = [];
                loading.value = false;
                MsgError(i18n.global.t('firewall.importFileHelper'));
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const parsed: unknown = JSON.parse(String(event.target?.result || ''));
                    if (!Array.isArray(parsed) || (!initialize.value && parsed.length === 0)) {
                        MsgError(i18n.global.t('commons.msg.errImportFormat'));
                        return;
                    }
                    const normalized = parsed.map((rule) => (isRule(rule) ? rule : normalizeLegacyImportedRule(rule)));
                    if (!normalized.every(isRule)) {
                        MsgError(i18n.global.t('commons.msg.errImportFormat'));
                        return;
                    }
                    fileLoaded.value = true;
                    rules.value = normalized;
                    selects.value = new Set(rules.value);
                } catch (error) {
                    MsgError(i18n.global.t('commons.msg.errImport') + String(error));
                } finally {
                    loading.value = false;
                }
            };
            reader.readAsText(uploadFile.raw);
        };
        const handleExceed: UploadProps['onExceed'] = (files) => {
            uploadRef.value?.clearFiles();
            const file = files[0] as UploadRawFile;
            file.uid = genFileId();
            uploadRef.value?.handleStart(file);
        };
        const onImport = async () => {
            if (loading.value || !fileLoaded.value || (rules.value.length > 0 && selects.value.size === 0)) return;
            loading.value = true;
            try {
                const result = await rpc.firewall.createRules({
                    initialize: initialize.value,
                    items: rules.value
                        .filter((rule) => selects.value.has(rule))
                        .map((rule) => ({
                            rule: rule as any,
                            sourceKind: 'imported',
                            raw: rule.raw,
                            parseStatus: rule.parseStatus,
                        })),
                } as any);
                if (!result.taskId || !result.queued) {
                    MsgError(i18n.global.t('commons.msg.operationFailed'));
                    return;
                }
                visible.value = false;
                ctx.emit('created', result.taskId);
            } finally {
                loading.value = false;
            }
        };
        const acceptParams = (value: Firewall.Provider, withInitialization = false) => {
            provider.value = value;
            initialize.value = withInitialization;
            loading.value = false;

            fileLoaded.value = false;
            rules.value = [];
            selects.value = new Set();
            uploaderFiles.value = [];
            uploadRef.value?.clearFiles();
            visible.value = true;
        };
        ctx.expose({ acceptParams });
        return () => (
            <DialogPro
                modelValue={unref(visible)}
                onUpdate:modelValue={($v) => {
                    visible.value = $v as any;
                }}
                title={unref(initialize) ? $t('firewall.initializeFromFile') : $t('commons.button.import')}
                size="w-70"
                v-slots={{
                    footer: () => (
                        <>
                            <ElButton
                                onClick={($event?: any) => {
                                    visible.value = false;
                                }}
                            >
                                {$t('commons.button.cancel')}
                            </ElButton>
                            <ElButton
                                type="primary"
                                loading={unref(loading)}
                                disabled={!unref(fileLoaded) || (unref(rules).length > 0 && unref(selects).size === 0)}
                                onClick={($event?: any) => {
                                    (onImport as any)($event);
                                }}
                            >
                                {$t('commons.button.import')}
                            </ElButton>
                        </>
                    ),
                }}
            >
                <ElAlert type="info" closable={false} title={$t('firewall.importFileHelper')} class={'mb-3'} />
                <div class={'import-file-bar mt-3'}>
                    <ElUpload
                        ref={uploadRef}
                        file-list={unref(uploaderFiles)}
                        onUpdate:file-list={($v) => {
                            uploaderFiles.value = $v as any;
                        }}
                        action="#"
                        auto-upload={false}
                        show-file-list={false}
                        limit={1}
                        accept=".json"
                        on-change={fileOnChange}
                        on-exceed={handleExceed}
                    >
                        <ElButton type="primary" icon="Upload">
                            {$t('commons.button.upload')}
                        </ElButton>
                    </ElUpload>
                    {unref(uploaderFiles).length ? (
                        <div class={'import-file-info'}>
                            <ElIcon>
                                <Document />
                            </ElIcon>
                            <span class={'import-file-name'}>{unref(uploaderFiles)[0].name}</span>
                        </div>
                    ) : (
                        <ElText type="info">{'.json'}</ElText>
                    )}
                </div>
                {withDirectives(
                    <ElCard
                        shadow="never"
                        class={'mt-3 w-full'}
                        v-slots={{
                            header: () => (
                                <>
                                    <div class={'import-preview-header'}>
                                        <span>{$t('commons.button.preview')}</span>
                                        {unref(rules).length ? (
                                            <ElTag type="info" effect="plain">
                                                {$t('commons.table.total', [unref(rules).length])}
                                            </ElTag>
                                        ) : null}
                                    </div>
                                </>
                            ),
                        }}
                    >
                        <ComplexTable data={unref(rules)} height={300}>
                            <ElTableColumn
                                width="48"
                                fixed
                                v-slots={{
                                    header: () => (
                                        <>
                                            <ElCheckbox
                                                model-value={
                                                    unref(rules).length > 0 &&
                                                    unref(selects).size === unref(rules).length
                                                }
                                                indeterminate={
                                                    unref(selects).size > 0 && unref(selects).size < unref(rules).length
                                                }
                                                onChange={($event?: any) => {
                                                    selects.value = $event ? new Set(unref(rules)) : new Set();
                                                }}
                                            />
                                        </>
                                    ),
                                    default: ({ row }) => (
                                        <>
                                            <ElCheckbox
                                                model-value={unref(selects).has(row)}
                                                onChange={($event?: any) => {
                                                    $event ? unref(selects).add(row) : unref(selects).delete(row);
                                                }}
                                            />
                                        </>
                                    ),
                                }}
                            />
                            <ElTableColumn label={$t('commons.table.protocol')} prop="protocol" min-width="90" />
                            <ElTableColumn
                                label={$t('firewall.sourceIP')}
                                min-width="150"
                                v-slots={{ default: ({ row }) => <>{displayAddress(row, row.sourceAddress)}</> }}
                            />
                            <ElTableColumn
                                label={$t('firewall.sourcePort')}
                                min-width="110"
                                v-slots={{ default: ({ row }) => <>{row.sourcePort || '*'}</> }}
                            />
                            <ElTableColumn
                                label={$t('firewall.destIP')}
                                min-width="150"
                                v-slots={{ default: ({ row }) => <>{displayAddress(row, row.destinationAddress)}</> }}
                            />
                            <ElTableColumn
                                label={$t('firewall.destPort')}
                                min-width="110"
                                v-slots={{ default: ({ row }) => <>{row.destinationPort || '*'}</> }}
                            />
                            <ElTableColumn
                                label={$t('firewall.action')}
                                prop="action"
                                min-width="90"
                                v-slots={{ default: ({ row }) => <>{actionLabel(row.action)}</> }}
                            />
                            <ElTableColumn label={$t('commons.table.description')} prop="description" min-width="150" />
                            <ElTableColumn
                                label={$t('commons.button.view')}
                                prop="raw"
                                min-width="180"
                                show-overflow-tooltip
                            />
                        </ComplexTable>
                    </ElCard>,
                    [[vLoading, unref(loading)]],
                )}
            </DialogPro>
        );
    },
    options,
);
