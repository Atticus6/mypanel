import { $t } from '@/utils/i18n-t';
import type { Alert } from '@/types/alert';
import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf';
type Init<T extends DescMessage> = MessageInitShape<T>;
import { AlertLogEntrySchema, AlertSchema } from '@/gen/panel/agent/v1/alert_pb';
type AlertInfo = Omit<Init<typeof AlertSchema>, '$typeName' | '$unknown'> & {
    type: string;
    title: string;
    subType: string;
    interval: number;
    sendMethod: string[];
    alertTriggerMode?: CronjobAlertTriggerMode;
};
type AlertLog = Init<typeof AlertLogEntrySchema> & {
    alertDetail: AlertDetail;
    alertRule: AlertInfo;
};
interface AlertDetail {
    type: string;
    subType?: string;
    licenseId: string;
    title: string;
    project: string;
    method: string;
    params: { index: string; key: string; value: string }[] | string;
}
interface CommonConfig {
    isOffline?: string;
    alertDailyNum?: number;
    alertSendTimeRange?: string;
}
import { TABLE_TOOLTIP_OPTIONS } from '@/components/table/shared';
import { useSearchState } from '@/utils/search-reset';
import { dateFormat } from '@/utils/date';
import { MsgSuccess } from '@/utils/message';
import i18n from '@/lang';
import { SyncAlertInfo, SyncAlertAll, SyncOfflineAlert, resolveAlertConfigExcludeTypes } from '@/api/modules/alert';
import { rpc } from '@/lib/rpc';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { getAlertConfigDisplayName } from '@/pages/settings/_components/alert/setting/drawer/secret-field';
import { cronjobAlertTypes, getCronjobAlertResult } from '@/utils/cronjob-alert';
import permissionDirective from '@/directives/modules/permission';
import LayoutContent from '@/components/layout-content/index';
import ComplexTable from '@/components/table/complex/ComplexTable';
import FuTableOperations from '@/components/table/TableOperations';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'log',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isMobile, isProductPro, isIntl, isMaster } = useGlobalStore();
        const { t } = i18n.global;
        const loading = ref(false);
        const data = ref();
        const isOffline = ref('Disable');
        const configMap = ref<Map<string, Alert.AlertConfigInfo>>(new Map());
        const loadConfigMap = async () => {
            try {
                const res = await rpc.alert.searchAlertConfigs({
                    page: 1,
                    pageSize: 1000,
                    excludeTypes: resolveAlertConfigExcludeTypes(),
                });
                const map = new Map<string, Alert.AlertConfigInfo>();
                for (const c of res.items || []) {
                    map.set(String(c.id), c);
                }
                configMap.value = map;
            } catch {}
        };
        const resourceTypes = [
            'cpu',
            'memory',
            'load',
            'disk',
            'nodeException',
            'licenseException',
            'panelLogin',
            'sshLogin',
            'panelIpLogin',
            'sshIpLogin',
        ];
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 20,
            total: 0,
        });
        useSearchState(
            'setting/alert/log/index',
            {
                page: toRef(paginationConfig, 'currentPage'),
                pageSize: toRef(paginationConfig, 'pageSize'),
            },
            { onRevisit: () => search() },
        );
        const req = reactive({
            page: 1,
            pageSize: 10,
            total: 0,
            count: null,
            message: '',
            CreatedAt: '',
            status: '',
        });
        const buttons = [
            {
                label: i18n.global.t('commons.button.sync'),
                permission: true,
                click: function (row: AlertLog) {
                    syncAlert(row);
                },
                disabled: (row: AlertLog) => {
                    const isSms = row.method
                        .split(',')
                        .filter(Boolean)
                        .some((item) => {
                            const config = configMap.value.get(item.trim());
                            return config ? config.type === 'sms' : item.trim() === 'sms';
                        });
                    return (
                        (!isSms && row.status != 'PushSuccess' && row.status != 'SyncError') || row.status == 'Success'
                    );
                },
            },
        ];
        const statusMap = {
            PushSuccess: { type: 'success', text: 'xpack.alert.pushSuccess' },
            Pushing: { type: 'warning', text: 'xpack.alert.pushing' },
            Success: { type: 'success', text: 'xpack.alert.success' },
            Error: { type: 'danger', text: 'xpack.alert.error' },
            SyncError: { type: 'danger', text: 'xpack.alert.syncError', link: true },
            default: { type: 'danger', text: 'xpack.alert.pushError', link: true },
        };
        const statusConfig = (row) => {
            return statusMap[row.status] || statusMap['default'];
        };
        const syncAlert = (row: AlertLog) => {
            ElMessageBox.confirm(t('xpack.alert.syncAlertInfoMsg'), t('xpack.alert.syncAlertInfo'), {
                confirmButtonText: t('commons.button.confirm'),
                cancelButtonText: t('commons.button.cancel'),
            }).then(async () => {
                if (!isMaster.value && isOffline.value == 'Enable') {
                    await SyncOfflineAlert();
                } else {
                    await SyncAlertInfo({ id: row.id });
                }
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                await search();
            });
        };
        const formatMessage = (row: AlertDetail) => {
            const type = row.type === 'cronJob' ? row.subType : row.type;
            if (cronjobAlertTypes.includes(type)) {
                const title =
                    getCronjobAlertResult(row.params) === 'success'
                        ? 'xpack.alert.notificationSuccessTitle'
                        : 'cronjob.alertTitle';
                return t(title, [t('cronjob.' + type), row.project]);
            }
            const messageTemplates = {
                ssl: () => {
                    return row.project === 'all'
                        ? t('xpack.alert.allSslTitle')
                        : t('xpack.alert.sslTitle', [row.project]);
                },
                siteEndTime: () => {
                    return row.project === 'all'
                        ? t('xpack.alert.allSiteEndTimeTitle')
                        : t('xpack.alert.siteEndTimeTitle', [row.project]);
                },
                panelPwdEndTime: () => t('xpack.alert.panelPwdEndTimeTitle'),
                panelUpdate: () => t('xpack.alert.panelUpdateTitle'),
                cpu: () => t('xpack.alert.cpuTitle'),
                memory: () => t('xpack.alert.memoryTitle'),
                load: () => t('xpack.alert.loadTitle'),
                disk: () => {
                    return row.project === 'all'
                        ? t('xpack.alert.allDiskTitle')
                        : t('xpack.alert.diskTitle', [row.project]);
                },
                clams: () => t('xpack.alert.clamsTitle', [row.project]),
                nodeException: () => t('xpack.alert.nodeException'),
                licenseException: () => t('xpack.alert.licenseException'),
                panelLogin: () => t('xpack.alert.panelLogin'),
                sshLogin: () => t('xpack.alert.sshLogin'),
                panelIpLogin: () => t('xpack.alert.panelIpLogin'),
                sshIpLogin: () => t('xpack.alert.sshIpLogin'),
            };
            return messageTemplates[type] ? messageTemplates[type]() : '';
        };
        const formatMethod = (row: AlertLog) => {
            if (!row.method) return '-';

            const formatMethodPart = (method: string) => {
                const config = configMap.value.get(method);
                if (config) {
                    const typeKey = config.type === 'email' ? 'mail' : config.type;
                    const typeLabel = i18n.global.t('xpack.alert.' + typeKey);
                    try {
                        const cfg = JSON.parse(config.config || '{}') as Record<string, unknown>;
                        const name = getAlertConfigDisplayName(config.type, cfg);
                        return name ? `${name}(${typeLabel})` : typeLabel;
                    } catch {
                        return typeLabel;
                    }
                }

                const invalidLabel = /^\d+$/.test(method)
                    ? i18n.global.t('xpack.alert.methodInvalid', [`#${method}`])
                    : i18n.global.t('xpack.alert.methodInvalid', [method]);
                switch (method) {
                    case 'mail':
                    case 'email':
                        return t('xpack.alert.mail');
                    case 'dingTalk':
                        return t('xpack.alert.dingTalk');
                    case 'weCom':
                        return t('xpack.alert.weCom');
                    case 'feiShu':
                        return t('xpack.alert.feiShu');
                    case 'wechat':
                        return t('xpack.alert.wechat');
                    case 'sms':
                        return t('xpack.alert.sms');
                    case 'webhook':
                    case 'custom':
                        return t('xpack.alert.custom');
                    case 'bark':
                        return t('xpack.alert.bark');
                    default:
                        return invalidLabel;
                }
            };

            return `「${row.method
                .split(',')
                .filter(Boolean)
                .map((item) => formatMethodPart(item.trim()))
                .join('｜')}」`;
        };
        const formatCount = (row: AlertInfo) => {
            return resourceTypes.includes(row.type) || row.type === 'cronJob' || row.type === 'clams'
                ? t('xpack.alert.daily', [row.count])
                : t('xpack.alert.cumulative', [row.count]);
        };
        const search = async () => {
            loading.value = true;
            if (req.status) {
                req.status = req.status.toLowerCase() === 'enable' ? 'Enable' : 'Disable';
            }
            let params = {
                page: paginationConfig.currentPage,
                pageSize: paginationConfig.pageSize,
                count: req.count ?? 0,
                status: req.status,
                startTime: '',
                endTime: '',
            };
            try {
                const res = await rpc.alert.searchAlertLogs(params);
                data.value = res.items || [];
                paginationConfig.total = Number(res.total) || 0;
            } catch (error) {
            } finally {
                loading.value = false;
            }
        };
        const syncAll = async () => {
            ElMessageBox.confirm(t('xpack.alert.syncAlertInfoMsg'), t('xpack.alert.syncAlertInfo'), {
                confirmButtonText: t('commons.button.confirm'),
                cancelButtonText: t('commons.button.cancel'),
            }).then(async () => {
                await syncAllAlert();
                await search();
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            });
        };
        const syncAllAlert = async () => {
            if (!isMaster.value && isOffline.value == 'Enable') {
                await SyncOfflineAlert();
            } else {
                await SyncAlertAll();
            }
        };
        const onClean = async () => {
            ElMessageBox.confirm(i18n.global.t('commons.msg.clean'), i18n.global.t('xpack.alert.cleanAlertLogs'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
                type: 'info',
            }).then(async () => {
                loading.value = true;
                await rpc.alert
                    .cleanAlertLogs({})
                    .then(() => {
                        loading.value = false;
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    })
                    .catch(() => {
                        loading.value = false;
                    });
                await search();
            });
        };
        const searchAlertInfo = async () => {
            if (!isMaster.value) {
                loading.value = true;
                try {
                    const res = await rpc.alert.getAlertConfig({ excludeTypes: resolveAlertConfigExcludeTypes() });
                    const commonFound = res.items.find((s: any) => s.type === 'common');
                    const config: CommonConfig = JSON.parse(commonFound.config);
                    isOffline.value = config.isOffline;
                } finally {
                    loading.value = false;
                }
            }
        };
        onMounted(async () => {
            await loadConfigMap();
            await searchAlertInfo();
            if (isProductPro.value && !isIntl.value) {
                await syncAllAlert();
            }
            await search();
        });
        return () => (
            <div>
                {withDirectives(
                    <LayoutContent
                        title={$t('xpack.alert.logs')}
                        v-slots={{
                            toolbar: () => (
                                <>
                                    <div class={'flex flex-wrap justify-between gap-2 sm:flex-row'}>
                                        <div class={'flex flex-wrap gap-3'}>
                                            {unref(isProductPro) && !unref(isIntl)
                                                ? withDirectives(
                                                      <ElButton
                                                          type="primary"
                                                          onClick={($event?: any) => {
                                                              (syncAll as any)($event);
                                                          }}
                                                      >
                                                          {$t('commons.button.sync')}
                                                      </ElButton>,
                                                      [[permissionDirective, true]],
                                                  )
                                                : null}
                                            {withDirectives(
                                                <ElButton
                                                    type="primary"
                                                    plain
                                                    onClick={($event?: any) => {
                                                        (onClean as any)($event);
                                                    }}
                                                >
                                                    {$t('xpack.alert.cleanLog')}
                                                </ElButton>,
                                                [[permissionDirective, true]],
                                            )}
                                        </div>
                                    </div>
                                </>
                            ),
                            main: () => (
                                <>
                                    <ComplexTable
                                        cache-pagination={false}
                                        pagination-config={paginationConfig}
                                        data={unref(data)}
                                        onSearch={($event?: any) => {
                                            search();
                                        }}
                                    >
                                        <ElTableColumn
                                            label={$t('xpack.alert.alertMsg')}
                                            prop="message"
                                            show-overflow-tooltip
                                            v-slots={{ default: ({ row }) => <>{formatMessage(row.alertDetail)}</> }}
                                        />
                                        <ElTableColumn
                                            label={$t('xpack.alert.alertMethod')}
                                            prop="method"
                                            width="200px"
                                            show-overflow-tooltip
                                            v-slots={{ default: ({ row }) => <>{formatMethod(row)}</> }}
                                        />
                                        <ElTableColumn
                                            label={$t('commons.table.status')}
                                            fix
                                            show-overflow-tooltip
                                            prop="status"
                                            width="150px"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        {statusConfig(row) ? (
                                                            <ElTag
                                                                type={statusConfig(row).type}
                                                                link={statusConfig(row).link}
                                                            >
                                                                {row.message ? (
                                                                    <ElTooltip
                                                                        content={row.message}
                                                                        {...TABLE_TOOLTIP_OPTIONS}
                                                                        trigger="click"
                                                                    >
                                                                        {$t(statusConfig(row).text)}
                                                                    </ElTooltip>
                                                                ) : (
                                                                    <>{$t(statusConfig(row).text)}</>
                                                                )}
                                                            </ElTag>
                                                        ) : null}
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            label={$t('commons.table.createdAt')}
                                            formatter={dateFormat}
                                            prop="createdAt"
                                            width="180px"
                                        />
                                        <ElTableColumn
                                            label={$t('xpack.alert.sendCount')}
                                            prop="count"
                                            width="150px"
                                            v-slots={{ default: ({ row }) => <>{formatCount(row)}</> }}
                                        />
                                        {unref(isProductPro) && !unref(isIntl) ? (
                                            <FuTableOperations
                                                ellipsis={2}
                                                width="130px"
                                                buttons={buttons}
                                                label={$t('commons.table.operate')}
                                                fixed={unref(isMobile) ? false : 'right'}
                                                fix
                                            />
                                        ) : null}
                                    </ComplexTable>
                                </>
                            ),
                        }}
                    />,
                    [[vLoading, unref(loading)]],
                )}
            </div>
        );
    },
    options,
);
