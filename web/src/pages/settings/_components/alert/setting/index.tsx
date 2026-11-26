import { $t } from '@/utils/i18n-t';
type AlertConfigInfo = any;
type AlertConfigUpdateReq = any;
interface CommonConfig {
    isOffline?: string;
    alertDailyNum?: number;
    alertSendTimeRange?: string;
}
interface CommonAlertConfig {
    id?: number;
    type: string;
    title: string;
    status: string;
    config: CommonConfig;
}
import { useSearchState } from '@/utils/search-reset';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { resolveAlertConfigExcludeTypes } from '@/api/modules/alert';
import { rpc } from '@/lib/rpc';
import { Message, ChatDotRound, Bell, View, Hide, Link } from '@element-plus/icons-vue';
import SendTimeRange from '@/pages/settings/_components/alert/setting/time-range/index';
import i18n from '@/lang';
import { MsgError, MsgSuccess } from '@/utils/message';
import AlertDrawer from '@/pages/settings/_components/alert/setting/drawer/index';
import { formatCustomWebhookDetails, formatCustomWebhookSafeSummary } from './drawer/custom-webhook';
import { getAlertConfigDisplayName, rawSecretValue } from './drawer/secret-field';
import './index.styles.css';
import permissionDirective from '@/directives/modules/permission';
import LayoutContent from '@/components/layout-content/index';
import ComplexTable from '@/components/table/complex/ComplexTable';
import FuTableOperations from '@/components/table/TableOperations';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'setting',
    props: {},
    emits: emits,
    __scopeId: 'data-v-59d863e9',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { docsUrl, isMaster, isMobile, isProductPro, isEE, isIntl } = useGlobalStore();
        const loading = ref(false);
        const alertDrawerRef = ref();
        const sendTimeRangeRef = ref();
        const sendTimeRangeValue = ref();
        const sendTimeRange = ref();
        const alertFormRef = ref();
        const allConfigs = ref<AlertConfigInfo[]>([]);
        const expandedIds = ref<Set<number>>(new Set());
        const toggleDetail = (id: number) => {
            const next = new Set(expandedIds.value);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            expandedIds.value = next;
        };
        const defaultCommonConfig: CommonAlertConfig = {
            id: undefined,
            type: 'common',
            title: 'xpack.alert.commonConfig',
            status: 'Enable',
            config: {
                alertSendTimeRange:
                    i18n.global.t('xpack.alert.noticeAlert') +
                    ': ' +
                    '08:00:00 - 23:59:59' +
                    ' | ' +
                    i18n.global.t('xpack.alert.resourceAlert') +
                    ': ' +
                    '00:00:00 - 23:59:59',
                isOffline: 'Disable',
            },
        };
        const commonConfig = ref<CommonAlertConfig>({ ...defaultCommonConfig });
        const isInitialized = ref(false);
        const config = ref<AlertConfigUpdateReq>({
            id: 0,
            type: '',
            title: '',
            status: '',
            config: '',
            displayName: '',
        });
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 20,
            total: 0,
        });
        useSearchState(
            'setting/alert/setting/index',
            {
                page: toRef(paginationConfig, 'currentPage'),
                pageSize: toRef(paginationConfig, 'pageSize'),
            },
            { onRevisit: () => search() },
        );
        const parseConfig = <T extends object>(raw: AlertConfigInfo, fallback: T): T => {
            try {
                const parsed = JSON.parse(raw.config || '{}');
                return { ...fallback, ...parsed };
            } catch {
                return { ...fallback };
            }
        };
        function getDisplayName(row: AlertConfigInfo): string {
            try {
                const cfg = JSON.parse(row.config || '{}') as Record<string, unknown>;
                return getAlertConfigDisplayName(row.type, cfg);
            } catch {
                return '';
            }
        }
        function getConfigDetails(row: AlertConfigInfo): string {
            try {
                const cfg = JSON.parse(row.config || '{}');
                if (row.type === 'email') {
                    const recipients =
                        cfg.recipients && cfg.recipients.length > 0 ? cfg.recipients.join(', ') : cfg.recipient || '';
                    return `${cfg.sender || ''} → ${cfg.host || ''}:${cfg.port || ''} | ${i18n.global.t('xpack.alert.recipient')}: ${recipients}`;
                }
                if (row.type === 'sms') {
                    return `${i18n.global.t('xpack.alert.phone')}: ${rawSecretValue(cfg.phone)}`;
                }
                if (row.type === 'custom') {
                    return formatCustomWebhookDetails(cfg, i18n.global.t('commons.msg.noneData'));
                }
                if (cfg.webhooks && cfg.webhooks.length > 0) {
                    return cfg.webhooks
                        .map(
                            (webhook: { displayName: string; url: unknown }) =>
                                `${webhook.displayName}: ${rawSecretValue(webhook.url)}`,
                        )
                        .join(' | ');
                }
                if (cfg.displayName && cfg.url) {
                    return `${cfg.displayName}: ${rawSecretValue(cfg.url)}`;
                }
                if (cfg.url) {
                    return rawSecretValue(cfg.url);
                }
                return '';
            } catch {
                return '';
            }
        }
        function maskString(s: string, visibleLen = 3): string {
            if (!s || s.length <= visibleLen) return s;
            return s.slice(0, visibleLen) + '***';
        }
        function getConfigSummary(row: AlertConfigInfo): string {
            try {
                const cfg = JSON.parse(row.config || '{}');
                if (row.type === 'email') {
                    const recipientCount =
                        cfg.recipients && cfg.recipients.length > 0 ? cfg.recipients.length : cfg.recipient ? 1 : 0;
                    return `${maskString(cfg.sender || '')} → ${cfg.host || ''}:${cfg.port || ''} | ${i18n.global.t('xpack.alert.recipient')}: ${recipientCount}`;
                }
                if (row.type === 'sms') {
                    return `${i18n.global.t('xpack.alert.phone')}: ${maskString(rawSecretValue(cfg.phone), 4)}`;
                }
                if (row.type === 'custom') {
                    return formatCustomWebhookSafeSummary(cfg, { includeUrl: false });
                }
                return getAlertConfigDisplayName(row.type, cfg) || '***';
            } catch {
                return '***';
            }
        }
        const getTypeIcon = (type: string) => {
            const map: Record<string, any> = {
                email: Message,
                sms: Message,
                weCom: ChatDotRound,
                dingTalk: ChatDotRound,
                feiShu: ChatDotRound,
                bark: Bell,
                custom: Link,
            };
            return map[type] || Message;
        };
        const getTypeColor = (type: string) => {
            const map: Record<string, string> = {
                email: '#409eff',
                sms: '#909399',
                weCom: '#67c23a',
                dingTalk: '#409eff',
                feiShu: '#7c3aed',
                bark: '#e6a23c',
                custom: '#6366f1',
            };
            return map[type] || '#909399';
        };
        const getTypeTagType = (type: string) => {
            const map: Record<string, string> = {
                email: '',
                sms: 'info',
                weCom: 'success',
                dingTalk: '',
                feiShu: 'danger',
                bark: 'warning',
                custom: 'primary',
            };
            return map[type] || 'info';
        };
        const searchConfigs = async () => {
            expandedIds.value = new Set();
            loading.value = true;
            try {
                const [configRes, pageRes] = await Promise.all([
                    rpc.alert.getAlertConfig({ excludeTypes: resolveAlertConfigExcludeTypes() }),
                    rpc.alert.searchAlertConfigs({
                        page: paginationConfig.currentPage,
                        pageSize: paginationConfig.pageSize,
                        excludeTypes: resolveAlertConfigExcludeTypes(),
                    }),
                ]);
                const commonFound = configRes.items.find((s: AlertConfigInfo) => s.type === 'common');
                if (commonFound) {
                    const parsedConfig = parseConfig(commonFound, defaultCommonConfig.config);
                    commonConfig.value = {
                        id: commonFound.id,
                        type: commonFound.type,
                        title: commonFound.title,
                        status: commonFound.status,
                        config: parsedConfig,
                    };
                    sendTimeRangeValue.value = commonConfig.value.config.alertSendTimeRange;
                    const noticeTimeRange =
                        sendTimeRangeValue.value.noticeAlert?.sendTimeRange || '08:00:00 - 23:59:59';
                    const resourceTimeRange =
                        sendTimeRangeValue.value.resourceAlert?.sendTimeRange || '00:00:00 - 23:59:59';
                    sendTimeRange.value =
                        i18n.global.t('xpack.alert.noticeAlert') +
                        ': ' +
                        noticeTimeRange +
                        ' | ' +
                        i18n.global.t('xpack.alert.resourceAlert') +
                        ': ' +
                        resourceTimeRange;
                } else {
                    commonConfig.value = { ...defaultCommonConfig };
                    sendTimeRangeValue.value = commonConfig.value.config.alertSendTimeRange;
                    sendTimeRange.value = commonConfig.value.config.alertSendTimeRange;
                }
                isInitialized.value = true;

                allConfigs.value = pageRes.items || [];
                paginationConfig.total = Number(pageRes.total) || 0;
            } catch {
                allConfigs.value = [];
                paginationConfig.total = 0;
            } finally {
                loading.value = false;
            }
        };
        const search = async () => {
            await searchConfigs();
        };
        const onDrawerSearch = () => {
            void searchConfigs();
        };
        const onChangeCommon = (id: any) => {
            sendTimeRangeRef.value.acceptParams({
                id: id,
                sendTimeRange: sendTimeRangeValue.value,
                isOffline: commonConfig.value.config.isOffline,
            });
        };
        const onChangeOffline = async () => {
            if (!isInitialized.value) return;
            if (!isMaster.value && commonConfig.value.config.isOffline != '') {
                const title =
                    commonConfig.value.config.isOffline == 'Enable'
                        ? i18n.global.t('xpack.alert.offlineOff')
                        : i18n.global.t('xpack.alert.offlineClose');
                const content =
                    commonConfig.value.config.isOffline == 'Enable'
                        ? i18n.global.t('xpack.alert.offlineOffHelper')
                        : i18n.global.t('xpack.alert.offlineCloseHelper');
                ElMessageBox.confirm(content, title, {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                })
                    .then(async () => {
                        loading.value = true;
                        try {
                            config.value.id = commonConfig.value.id!;
                            config.value.type = 'common';
                            config.value.title = 'xpack.alert.commonConfig';
                            config.value.status = 'Enable';
                            config.value.config = JSON.stringify(commonConfig.value.config);
                            config.value.displayName = i18n.global.t('xpack.alert.commonConfig');
                            await rpc.alert.updateAlertConfig(config.value);
                            loading.value = false;
                            await searchConfigs();
                            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        } catch {
                            loading.value = false;
                        }
                    })
                    .catch(() => {
                        commonConfig.value.config.isOffline =
                            commonConfig.value.config.isOffline == 'Enable' ? 'Disable' : 'Enable';
                    });
            }
        };
        const onStatusChange = async (row: AlertConfigInfo) => {
            try {
                await rpc.alert.updateAlertConfigStatus({
                    id: row.id!,
                    status: row.status,
                });
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                await searchConfigs();
            } catch {
                row.status = row.status === 'Enable' ? 'Disable' : 'Enable';
            }
        };
        const isStatusChangeDisabled = (row: AlertConfigInfo): boolean => {
            return !isProductPro.value && ['weCom', 'dingTalk', 'feiShu', 'sms'].includes(row.type);
        };
        const onDelete = (id: number) => {
            ElMessageBox.confirm(
                i18n.global.t('xpack.alert.deleteConfigMsg'),
                i18n.global.t('xpack.alert.deleteConfigTitle'),
                {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                },
            ).then(async () => {
                await rpc.alert.deleteAlertConfig({ id: id });
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                await searchConfigs();
            });
        };
        const onCreate = () => {
            alertDrawerRef.value.acceptParams({ type: 'email' });
        };
        const openEditDrawer = (row: AlertConfigInfo) => {
            if (!row.updatedAt) {
                MsgError(i18n.global.t('xpack.alert.alertConfigChanged'));
                return;
            }
            let configData: Record<string, any> = {};
            try {
                configData = JSON.parse(row.config || '{}');
            } catch {}
            alertDrawerRef.value.acceptParams({
                id: row.id,
                revision: row.updatedAt,
                type: row.type,
                config: configData,
                status: row.status,
                updateUser: row.updateUser,
            });
        };
        const buttons = computed(() => [
            {
                label: i18n.global.t('commons.button.edit'),
                permission: true,
                click: (row: AlertConfigInfo) => {
                    openEditDrawer(row);
                },
                disabled: (row: AlertConfigInfo) =>
                    !row.updatedAt ||
                    ((isIntl.value || !isProductPro.value) &&
                        ['weCom', 'dingTalk', 'feiShu', 'sms'].includes(row.type)),
            },
            {
                label: i18n.global.t('commons.button.delete'),
                permission: true,
                click: (row: AlertConfigInfo) => {
                    onDelete(row.id!);
                },
            },
        ]);
        onMounted(async () => {
            await searchConfigs();
        });
        return () => (
            <div>
                {withDirectives(
                    <LayoutContent
                        title={$t('commons.button.set')}
                        divider={true}
                        v-slots={{
                            title: () => (
                                <>
                                    <div class={'flex items-center justify-between'}>
                                        <span>{$t('xpack.alert.commonConfig')}</span>
                                        {withDirectives(
                                            <ElButton
                                                plain
                                                round
                                                size="default"
                                                onClick={($event?: any) => {
                                                    onChangeCommon(unref(commonConfig).id);
                                                }}
                                            >
                                                {$t('commons.button.edit')}
                                            </ElButton>,
                                            [[permissionDirective, true]],
                                        )}
                                    </div>
                                </>
                            ),
                            main: () => (
                                <>
                                    <ElForm
                                        onSubmit={($event?: any) => {
                                            $event.preventDefault();
                                        }}
                                        ref={alertFormRef}
                                        label-position={unref(isMobile) ? 'top' : 'left'}
                                        label-width="120px"
                                    >
                                        <ElRow>
                                            <ElCol>
                                                <ElFormItem
                                                    label={$t('xpack.alert.sendTimeRange')}
                                                    prop="sendTimeRange"
                                                >
                                                    {unref(sendTimeRange)}
                                                </ElFormItem>
                                                {!unref(isMaster) ? (
                                                    <div>
                                                        <ElFormItem label={$t('xpack.alert.offline')} prop="isOffline">
                                                            {withDirectives(
                                                                <ElSwitch
                                                                    onChange={($event?: any) => {
                                                                        (onChangeOffline as any)($event);
                                                                    }}
                                                                    modelValue={unref(commonConfig).config.isOffline}
                                                                    onUpdate:modelValue={($v) => {
                                                                        unref(commonConfig).config.isOffline =
                                                                            $v as any;
                                                                    }}
                                                                    active-value="Enable"
                                                                    inactive-value="Disable"
                                                                />,
                                                                [[permissionDirective, true]],
                                                            )}
                                                            <span class={'input-help'}>
                                                                {$t('xpack.alert.offlineHelper')}
                                                            </span>
                                                        </ElFormItem>
                                                    </div>
                                                ) : null}
                                            </ElCol>
                                        </ElRow>
                                    </ElForm>
                                </>
                            ),
                        }}
                    />,
                    [[vLoading, unref(loading)]],
                )}
                {withDirectives(
                    <LayoutContent
                        title={$t('xpack.alert.methodConfig')}
                        divider={true}
                        v-slots={{
                            leftToolBar: () => (
                                <>
                                    {withDirectives(
                                        <ElButton
                                            type="primary"
                                            onClick={($event?: any) => {
                                                (onCreate as any)($event);
                                            }}
                                        >
                                            {$t('xpack.alert.createMethod')}
                                        </ElButton>,
                                        [[permissionDirective, true]],
                                    )}
                                </>
                            ),
                            main: () => (
                                <>
                                    <ElAlert
                                        type="info"
                                        closable={false}
                                        v-slots={{
                                            title: () => (
                                                <>
                                                    <div class={'flex items-center justify-start'}>
                                                        {$t('xpack.alert.alertConfigHelper')}
                                                        {!unref(isProductPro) && !unref(isEE) ? (
                                                            <span>
                                                                {$t('commons.units.semicolon')}
                                                                {$t('xpack.alert.alertConfigProHelper')}
                                                            </span>
                                                        ) : null}
                                                        <ElLink
                                                            type="primary"
                                                            target="_blank"
                                                            href={unref(docsUrl) + '/user_manual/settings/#3'}
                                                            class={'ml-1 text-xs'}
                                                        >
                                                            {$t('commons.button.helpDoc')}
                                                        </ElLink>
                                                    </div>
                                                </>
                                            ),
                                        }}
                                    />
                                    <ComplexTable
                                        cache-pagination={false}
                                        pagination-config={paginationConfig}
                                        data={unref(allConfigs)}
                                        empty-text={$t('commons.msg.noneData')}
                                        onSearch={($event?: any) => {
                                            (searchConfigs as any)($event);
                                        }}
                                        class={'mt-3'}
                                    >
                                        <ElTableColumn
                                            label={$t('commons.table.type')}
                                            min-width="120"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        <div class={'flex items-center gap-2'}>
                                                            <ElIcon size={20} style={{ color: getTypeColor(row.type) }}>
                                                                {h(getTypeIcon(row.type), {})}
                                                            </ElIcon>
                                                            <ElTag type={getTypeTagType(row.type)} effect="plain" round>
                                                                {$t('xpack.alert.' + row.type)}
                                                            </ElTag>
                                                        </div>
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            label={$t('xpack.alert.displayName')}
                                            min-width="120"
                                            prop="displayName"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        <span>{getDisplayName(row) || '-'}</span>
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            label={$t('xpack.alert.configDetail')}
                                            min-width="240"
                                            prop="details"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        <div class={'config-detail text-sm'}>
                                                            <span class={'config-detail__value'}>
                                                                {unref(expandedIds).has(row.id!)
                                                                    ? getConfigDetails(row)
                                                                    : getConfigSummary(row)}
                                                            </span>
                                                            <ElButton
                                                                link
                                                                title={$t(
                                                                    unref(expandedIds).has(row.id!)
                                                                        ? 'commons.button.hide'
                                                                        : 'commons.button.view',
                                                                )}
                                                                aria-label={$t(
                                                                    unref(expandedIds).has(row.id!)
                                                                        ? 'commons.button.hide'
                                                                        : 'commons.button.view',
                                                                )}
                                                                onClick={($event?: any) => {
                                                                    toggleDetail(row.id!);
                                                                }}
                                                                class={'config-detail__toggle'}
                                                            >
                                                                {unref(expandedIds).has(row.id!) ? (
                                                                    <ElIcon>
                                                                        <View />
                                                                    </ElIcon>
                                                                ) : (
                                                                    <ElIcon>
                                                                        <Hide />
                                                                    </ElIcon>
                                                                )}
                                                            </ElButton>
                                                        </div>
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            label={$t('commons.table.status')}
                                            width="100px"
                                            prop="status"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        <ElSwitch
                                                            modelValue={row.status}
                                                            onUpdate:modelValue={($v) => {
                                                                row.status = $v as any;
                                                            }}
                                                            active-value="Enable"
                                                            inactive-value="Disable"
                                                            disabled={isStatusChangeDisabled(row)}
                                                            onChange={($event?: any) => {
                                                                onStatusChange(row);
                                                            }}
                                                        />
                                                    </>
                                                ),
                                            }}
                                        />
                                        {unref(isEE) ? (
                                            <ElTableColumn
                                                label={$t('commons.table.creator')}
                                                width="100px"
                                                prop="createUser"
                                                show-overflow-tooltip
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>
                                                            <span>{row.createUser || '-'}</span>
                                                        </>
                                                    ),
                                                }}
                                            />
                                        ) : null}
                                        <FuTableOperations
                                            width="130px"
                                            ellipsis={2}
                                            buttons={unref(buttons)}
                                            label={$t('commons.table.operate')}
                                            fix
                                        />
                                    </ComplexTable>
                                </>
                            ),
                        }}
                    />,
                    [[vLoading, unref(loading)]],
                )}
                <AlertDrawer
                    ref={alertDrawerRef}
                    onSearch={($event?: any) => {
                        (onDrawerSearch as any)($event);
                    }}
                />
                <SendTimeRange
                    ref={sendTimeRangeRef}
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                />
            </div>
        );
    },
    options,
);
