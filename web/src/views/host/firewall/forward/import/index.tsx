import { $t } from '@/utils/i18n-t';
import { ref } from 'vue';
import { genFileId, type UploadFile, type UploadFiles, type UploadProps, type UploadRawFile } from 'element-plus';
import { MsgError } from '@/utils/message';
import i18n from '@/lang';
import { getErrorMessage } from '@/utils/misc';
import { isAxiosError } from 'axios';
import { Firewall } from '@/types/firewall';
import { normalizeForwardRuleImport, parseForwardRuleImport } from '../transfer';
import { FIREWALL_BATCH_LIMIT, FIREWALL_IMPORT_MAX_SIZE } from '@/views/host/firewall/utils/validation';
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
    __scopeId: 'data-v-d2de7654',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const visible = ref(false);
        const loading = ref(false);
        const submitError = ref('');
        const selects = ref<Firewall.RuleForward[]>([]);
        const displayData = ref<Firewall.RuleForward[]>([]);
        const deduplicatedCount = ref(0);
        const currentFireName = ref('');
        const uploadRef = ref();
        const uploaderFiles = ref<UploadFile[]>([]);
        const acceptParams = (fireName: string) => {
            loading.value = false;
            submitError.value = '';
            displayData.value = [];
            selects.value = [];
            deduplicatedCount.value = 0;
            uploaderFiles.value = [];

            uploadRef.value?.clearFiles();
            currentFireName.value = fireName;
            visible.value = true;
        };
        const fileOnChange = async (uploadFile: UploadFile, uploadFiles: UploadFiles) => {
            if (!uploadFile.raw) return;
            loading.value = true;
            submitError.value = '';
            displayData.value = [];
            deduplicatedCount.value = 0;
            selects.value = [];
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
            try {
                const parsed = parseForwardRuleImport(await uploadFile.raw.text());
                if (!parsed) throw new Error(i18n.global.t('commons.msg.errImportFormat'));
                const imported = parsed.flatMap((item) => {
                    const rule = normalizeForwardRuleImport(item);
                    return rule.protocol.split('/').map((protocol) => ({ ...rule, protocol }));
                });
                const response = await rpc.firewall.searchForwardRules({
                    strategy: '',
                    info: '',
                    page: 1,
                    pageSize: 200,
                    all: true,
                });
                if (!visible.value || uploaderFiles.value[0]?.uid !== uploadFile.uid) return;
                const ruleKey = (rule: Firewall.RuleForward) =>
                    JSON.stringify([
                        rule.family,
                        rule.protocol,
                        rule.port,
                        rule.targetIP,
                        rule.targetPort,
                        rule.interface,
                    ]);
                const seen = new Set(
                    ((response.items || []) as any[]).map((rule) => ruleKey(normalizeForwardRuleImport(rule as any))),
                );
                const unique: Firewall.RuleForward[] = [];
                let duplicates = 0;
                for (const rule of imported) {
                    const key = ruleKey(rule);
                    if (seen.has(key)) {
                        duplicates++;
                        continue;
                    }
                    seen.add(key);
                    unique.push(rule);
                }
                if (unique.length > FIREWALL_BATCH_LIMIT) {
                    MsgError(
                        i18n.global.t('firewall.importLimit', [FIREWALL_BATCH_LIMIT, FIREWALL_IMPORT_MAX_SIZE / 1024]),
                    );
                    return;
                }
                displayData.value = unique;
                deduplicatedCount.value = duplicates;
            } catch (error) {
                if (visible.value && uploaderFiles.value[0]?.uid === uploadFile.uid) {
                    submitError.value = getErrorMessage(error) || i18n.global.t('commons.msg.errImportFormat');
                }
            } finally {
                if (uploaderFiles.value[0]?.uid === uploadFile.uid) loading.value = false;
            }
        };
        const handleExceed: UploadProps['onExceed'] = (files) => {
            uploadRef.value!.clearFiles();
            const file = files[0] as UploadRawFile;
            file.uid = genFileId();
            uploadRef.value!.handleStart(file);
        };
        const onImport = async () => {
            if (loading.value || selects.value.length === 0) return;
            if (
                selects.value.reduce(
                    (total: number, rule: Firewall.RuleForward) => total + rule.protocol.split('/').length,
                    0,
                ) > FIREWALL_BATCH_LIMIT
            ) {
                MsgError(
                    i18n.global.t('firewall.importLimit', [FIREWALL_BATCH_LIMIT, FIREWALL_IMPORT_MAX_SIZE / 1024]),
                );
                return;
            }
            loading.value = true;
            submitError.value = '';
            const rules: Firewall.RuleForward[] = [];
            for (const rule of selects.value) {
                rules.push({
                    operation: 'add',
                    family: rule.family,
                    protocol: rule.protocol,
                    port: rule.port,
                    targetIP: rule.targetIP,
                    targetPort: rule.targetPort,
                    interface: rule.interface || '',
                });
            }

            try {
                const result = await rpc.firewall.operateForwardRules({ rules, import: true } as any);
                if (!result.taskId || !result.queued) {
                    submitError.value = i18n.global.t('commons.msg.operationFailed');
                    return;
                }
                visible.value = false;
                ctx.emit('created', result.taskId);
            } catch (error) {
                submitError.value =
                    (isAxiosError(error) && error.response?.data?.message) ||
                    (error && getErrorMessage(error)) ||
                    i18n.global.t('commons.res.commonError');
            } finally {
                loading.value = false;
            }
        };
        ctx.expose({
            acceptParams,
        });
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
                            <span class={'dialog-footer'}>
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
                                    disabled={unref(selects).length === 0}
                                    onClick={($event?: any) => {
                                        (onImport as any)($event);
                                    }}
                                >
                                    {$t('commons.button.import')}
                                </ElButton>
                            </span>
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
                <div>
                    {unref(submitError) ? (
                        <ElAlert type="error" closable={false} title={unref(submitError)} class={'mb-3'} />
                    ) : null}
                    <div class={'import-file-bar mt-3'}>
                        <ElUpload
                            ref={uploadRef}
                            file-list={unref(uploaderFiles)}
                            onUpdate:file-list={($v) => {
                                uploaderFiles.value = $v as any;
                            }}
                            action="#"
                            auto-upload={false}
                            disabled={unref(loading)}
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
                    {unref(deduplicatedCount) ? (
                        <ElAlert
                            type="info"
                            closable={false}
                            title={$t('firewall.importDuplicatesRemoved', [unref(deduplicatedCount)])}
                            class={'mt-3'}
                        />
                    ) : null}
                    {withDirectives(
                        <ElCard
                            shadow="never"
                            class={'mt-3 w-full'}
                            v-slots={{
                                header: () => (
                                    <>
                                        <div class={'import-preview-header'}>
                                            <span>{$t('commons.button.preview')}</span>
                                            {unref(displayData).length ? (
                                                <ElTag type="info" effect="plain">
                                                    {$t('commons.table.total', [unref(displayData).length])}
                                                </ElTag>
                                            ) : null}
                                        </div>
                                    </>
                                ),
                            }}
                        >
                            <ComplexTable
                                selects={unref(selects)}
                                onUpdate:selects={($v) => {
                                    selects.value = $v as any;
                                }}
                                data={unref(displayData)}
                                height={300}
                            >
                                <ElTableColumn type="selection" fix />
                                <ElTableColumn
                                    label="IP"
                                    min-width={60}
                                    prop="family"
                                    v-slots={{ default: ({ row }) => <>{row.family === 'ipv6' ? 'IPv6' : 'IPv4'}</> }}
                                />
                                <ElTableColumn label={$t('commons.table.protocol')} min-width={70} prop="protocol" />
                                <ElTableColumn label={$t('firewall.sourcePort')} min-width={70} prop="port" />
                                <ElTableColumn label={$t('firewall.targetIP')} min-width={100} prop="targetIP" />
                                <ElTableColumn label={$t('firewall.targetPort')} min-width={70} prop="targetPort" />
                                {unref(currentFireName) === 'iptables' || unref(currentFireName) === 'nftables' ? (
                                    <ElTableColumn
                                        label={$t('firewall.forwardInboundInterface')}
                                        min-width={100}
                                        prop="interface"
                                        v-slots={{
                                            default: ({ row }) => (
                                                <>
                                                    <span>
                                                        {row.interface === '' || row.interface === 'all'
                                                            ? $t('commons.table.all')
                                                            : row.interface}
                                                    </span>
                                                </>
                                            ),
                                        }}
                                    />
                                ) : null}
                            </ComplexTable>
                        </ElCard>,
                        [[vLoading, unref(loading)]],
                    )}
                </div>
            </DialogPro>
        );
    },
    options,
);
