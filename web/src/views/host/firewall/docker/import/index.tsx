import { $t } from '@/utils/i18n-t';
import { Firewall } from '@/types/firewall';
import { parseDockerPolicyImport } from '../transfer';
import i18n from '@/lang';
import { MsgError } from '@/utils/message';
import { getErrorMessage } from '@/utils/misc';
import { getHttpResponseMessage } from '@/api/http-core';
import { genFileId, type UploadFile, type UploadFiles, type UploadProps, type UploadRawFile } from 'element-plus';
import { ref } from 'vue';
import { dockerGuardEndpointKey, normalizeDockerGuardPolicy } from '@/views/host/firewall/docker/model';
import {
    FIREWALL_BATCH_LIMIT,
    FIREWALL_IMPORT_MAX_SIZE,
    formatHostAddressList,
} from '@/views/host/firewall/utils/validation';
import { Document } from '@element-plus/icons-vue';
import { rpc } from '@/lib/rpc';
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElAlert } from 'element-plus';
import { ElUpload } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElIcon } from 'element-plus';
import { ElText } from 'element-plus';
import { ElCard } from 'element-plus';
import { ElTag } from 'element-plus';
import { ElTableColumn } from 'element-plus';
import { ElCheckbox } from 'element-plus';
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
    __scopeId: 'data-v-fc765d1e',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const visible = ref(false);
        const loading = ref(false);
        const policies = ref<Firewall.DockerGuardPolicy[]>([]);
        const selects = ref(new Set<Firewall.DockerGuardPolicy>());
        const uploadRef = ref();
        const uploaderFiles = ref<UploadFile[]>([]);
        const displaySources = (policy: Firewall.DockerGuardPolicy) =>
            formatHostAddressList(policy.sources, policy.family);
        const fileOnChange = (uploadFile: UploadFile, uploadFiles: UploadFiles) => {
            if (!uploadFile.raw) return;
            loading.value = true;

            policies.value = [];
            selects.value = new Set();
            uploaderFiles.value = uploadFiles;
            if (uploadFile.raw.size > FIREWALL_IMPORT_MAX_SIZE) {
                uploadRef.value?.clearFiles();
                uploaderFiles.value = [];
                loading.value = false;
                MsgError(
                    i18n.global.t('firewall.importLimit', [FIREWALL_BATCH_LIMIT, FIREWALL_IMPORT_MAX_SIZE / 1024]),
                );
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const parsed = parseDockerPolicyImport(String(event.target?.result || ''));
                    if (parsed.length > FIREWALL_BATCH_LIMIT) {
                        MsgError(
                            i18n.global.t('firewall.importLimit', [
                                FIREWALL_BATCH_LIMIT,
                                FIREWALL_IMPORT_MAX_SIZE / 1024,
                            ]),
                        );
                        return;
                    }
                    const normalized = parsed.map(normalizeDockerGuardPolicy);
                    if (normalized.some((policy) => !policy)) throw new Error();
                    const byEndpoint = new Map<string, Firewall.DockerGuardPolicy>();
                    for (const policy of normalized as Firewall.DockerGuardPolicy[]) {
                        const key = dockerGuardEndpointKey(policy);
                        if (!byEndpoint.has(key)) byEndpoint.set(key, policy);
                    }
                    policies.value = [...byEndpoint.values()];
                    selects.value = new Set(policies.value);
                } catch {
                    policies.value = [];
                    selects.value = new Set();
                    MsgError(i18n.global.t('commons.msg.errImportFormat'));
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
            if (loading.value || selects.value.size === 0) return;
            if (selects.value.size > FIREWALL_BATCH_LIMIT) {
                MsgError(
                    i18n.global.t('firewall.importLimit', [FIREWALL_BATCH_LIMIT, FIREWALL_IMPORT_MAX_SIZE / 1024]),
                );
                return;
            }
            loading.value = true;
            try {
                const result = await rpc.firewall.upsertDockerPolicies({
                    import: true,
                    policies: policies.value.filter((policy) => selects.value.has(policy)),
                } as any);
                if (!result.taskId || !result.queued) {
                    MsgError(i18n.global.t('commons.msg.operationFailed'));
                    return;
                }
                visible.value = false;
                ctx.emit('created', result.taskId);
            } catch (error) {
                MsgError(
                    getHttpResponseMessage(error) ||
                        (error && getErrorMessage(error)) ||
                        i18n.global.t('commons.res.commonError'),
                );
            } finally {
                loading.value = false;
            }
        };
        const modeLabel = (mode: Firewall.DockerGuardPolicy['mode']) => {
            if (mode === 'deny_sources') return i18n.global.t('firewall.denySources');
            if (mode === 'allow_sources') return i18n.global.t('firewall.allowSources');
            if (mode === 'accept_sources') return i18n.global.t('firewall.acceptSources');
            if (mode === 'accept_all') return i18n.global.t('firewall.acceptAll');
            return i18n.global.t('firewall.denyAll');
        };
        const acceptParams = () => {
            loading.value = false;

            policies.value = [];
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
                title={$t('commons.button.import')}
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
                                disabled={unref(selects).size === 0}
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
                <ElAlert
                    type="info"
                    closable={false}
                    title={$t('firewall.importLimit', [FIREWALL_BATCH_LIMIT, FIREWALL_IMPORT_MAX_SIZE / 1024])}
                    class={'mb-3'}
                />
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
                                        {unref(policies).length ? (
                                            <ElTag type="info" effect="plain">
                                                {$t('commons.table.total', [unref(policies).length])}
                                            </ElTag>
                                        ) : null}
                                    </div>
                                </>
                            ),
                        }}
                    >
                        <ComplexTable data={unref(policies)} height={300}>
                            <ElTableColumn
                                width="48"
                                fixed
                                v-slots={{
                                    header: () => (
                                        <>
                                            <ElCheckbox
                                                model-value={
                                                    unref(policies).length > 0 &&
                                                    unref(selects).size === unref(policies).length
                                                }
                                                indeterminate={
                                                    unref(selects).size > 0 &&
                                                    unref(selects).size < unref(policies).length
                                                }
                                                onChange={($event?: any) => {
                                                    selects.value = $event ? new Set(unref(policies)) : new Set();
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
                            <ElTableColumn
                                label="IP"
                                prop="family"
                                min-width="65"
                                v-slots={{ default: ({ row }) => <>{row.family === 'ipv6' ? 'IPv6' : 'IPv4'}</> }}
                            />
                            <ElTableColumn label="IP" prop="hostIP" min-width="150" />
                            <ElTableColumn label={$t('commons.table.port')} prop="hostPort" min-width="90" />
                            <ElTableColumn label={$t('commons.table.protocol')} prop="protocol" min-width="90" />
                            <ElTableColumn
                                label={$t('firewall.protectionMode')}
                                min-width="140"
                                v-slots={{ default: ({ row }) => <>{modeLabel(row.mode)}</> }}
                            />
                            <ElTableColumn
                                label={$t('firewall.protection')}
                                min-width="180"
                                v-slots={{ default: ({ row }) => <>{displaySources(row) || '-'}</> }}
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
