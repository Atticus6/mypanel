import { $t } from '@/utils/i18n-t';
import { useSearchState } from '@/utils/search-reset';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { getAlertConfigDisplayName } from '@/pages/settings/_components/alert/setting/drawer/secret-field';
import { MsgSuccess } from '@/utils/message';
import i18n from '@/lang';
import AddTask from '@/pages/settings/_components/alert/dash/task/index';
import { Alert } from '@/types/alert';
import { resolveAlertConfigExcludeTypes } from '@/api/modules/alert';
import { rpc } from '@/lib/rpc';
import {
    cronjobAlertTypes,
    getCronjobAlertMode,
    getCronjobAlertModeLabel,
    getCronjobAlertTitle,
} from '@/utils/cronjob-alert';
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
    name: 'dash',
    props: {},
    emits: emits,
    __scopeId: 'data-v-dab662c0',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isMobile, isMaster, isProductPro, isEE } = useGlobalStore();
        const { t } = i18n.global;
        const loading = ref(false);
        const addTaskRef = ref();
        const req = reactive({
            page: 1,
            pageSize: 10,
            total: 0,
            type: '',
            status: '',
            method: '',
        });
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 20,
            total: 0,
            orderBy: 'createdAt',
            order: 'null',
        });
        useSearchState(
            'setting/alert/dash/index',
            {
                page: toRef(paginationConfig, 'currentPage'),
                pageSize: toRef(paginationConfig, 'pageSize'),
            },
            { onRevisit: () => search() },
        );
        const data = ref();
        const buttons = [
            {
                label: i18n.global.t('commons.button.edit'),
                permission: true,
                click: function (row: Alert.AlertInfo) {
                    openView('edit', row);
                },
            },
            {
                label: i18n.global.t('commons.button.delete'),
                permission: true,
                click: function (row: Alert.AlertInfo) {
                    onDelete(row);
                },
            },
        ];
        const openView = async (
            title: string,
            rowData: Partial<Alert.AlertInfo> = {
                type: isMaster.value && !isEE.value ? 'panelPwdEndTime' : 'sshLogin',
                cycle: isMaster.value && !isEE.value ? 15 : 30,
                count: isMaster.value && !isEE.value ? 0 : 3,
                sendCount: 3,
                method: '',
                project: isMaster.value && !isEE.value ? '' : 'all',
                status: 'Enable',
                title: '',
            },
        ) => {
            let params = {
                title,
                rowData: { ...rowData },
            };
            addTaskRef.value.acceptParams(params);
        };
        const changeSort = ({ prop, order }) => {
            if (order) {
                // proto 的 order_by 仅允许空串、createdAt、orderBy，其它列名会被校验拒绝。
                paginationConfig.orderBy = prop === 'createdAt' || prop === 'orderBy' ? prop : 'createdAt';
                paginationConfig.order = order;
            }
            search();
        };
        const formatTitle = (row: Alert.AlertInfo) => {
            return getCronjobAlertTitle(row, (type, taskName) =>
                t('xpack.alert.notificationTitle', [t('cronjob.' + type), taskName]),
            );
        };
        const formatRule = (row: Alert.AlertInfo) => {
            const type = row.type === 'cronJob' ? row.subType : row.type;
            if (cronjobAlertTypes.includes(type)) {
                return t('xpack.alert.notificationRule', [
                    t('cronjob.' + type),
                    t(getCronjobAlertModeLabel(getCronjobAlertMode(row.advancedParams))),
                    row.sendCount,
                ]);
            }
            const ruleTemplates = {
                ssl: () => t('xpack.alert.timeRule', [row.cycle, row.sendCount]),
                siteEndTime: () => t('xpack.alert.timeRule', [row.cycle, row.sendCount]),
                panelPwdEndTime: () => t('xpack.alert.timeRule', [row.cycle, row.sendCount]),
                panelUpdate: () => t('xpack.alert.panelUpdateRule', [row.cycle, row.sendCount]),
                cpu: () =>
                    t('xpack.alert.avgRule', [row.cycle, t(`xpack.alert.${row.type}Name`), row.count, row.sendCount]),
                memory: () =>
                    t('xpack.alert.avgRule', [row.cycle, t(`xpack.alert.${row.type}Name`), row.count, row.sendCount]),
                load: () =>
                    t('xpack.alert.avgRule', [row.cycle, t(`xpack.alert.${row.type}Name`), row.count, row.sendCount]),
                disk: () => {
                    return row.project === 'all'
                        ? t('xpack.alert.allDiskRule', [row.count, row.cycle === 1 ? 'G' : '%', row.sendCount])
                        : t('xpack.alert.diskRule', [
                              row.project,
                              row.count,
                              row.cycle === 1 ? 'G' : '%',
                              row.sendCount,
                          ]);
                },
                clams: () => t('xpack.alert.clamsRule', [row.sendCount]),
                nodeException: () => t('xpack.alert.nodeExceptionRule', [row.sendCount]),
                licenseException: () => t('xpack.alert.licenseExceptionRule', [row.sendCount]),
                panelLogin: () => t('xpack.alert.panelLoginRule', [row.sendCount]),
                sshLogin: () => t('xpack.alert.sshLoginRule', [row.sendCount]),
            };

            return ruleTemplates[row.type] ? ruleTemplates[row.type]() : '';
        };
        const configMap = ref<Map<string, Alert.AlertConfigInfo>>(new Map());
        const loadConfigMap = async () => {
            try {
                const res = await rpc.alert.getAlertConfig({
                    excludeTypes: resolveAlertConfigExcludeTypes(),
                });
                const map = new Map<string, Alert.AlertConfigInfo>();
                for (const c of res.items || []) {
                    map.set(String(c.id), c);
                }
                configMap.value = map;
            } catch {}
        };
        const formatMethod = (row: Alert.AlertInfo) => {
            if (!row.method) return '';

            const resolveMethodLabel = (method: string) => {
                const config = configMap.value.get(method);
                if (config) {
                    const typeLabel = i18n.global.t(`xpack.alert.${config.type === 'email' ? 'mail' : config.type}`);
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
                const oldLabel = i18n.global.t(`xpack.alert.${method}`);
                if (!oldLabel || oldLabel === `xpack.alert.${method}` || oldLabel.includes('.')) {
                    return invalidLabel;
                }
                return oldLabel;
            };

            return `「${row.method
                .split(',')
                .filter(Boolean)
                .map((item) => resolveMethodLabel(item.trim()))
                .join('｜')}」`;
        };
        const search = async () => {
            if (req.status) {
                req.status = req.status.toLowerCase() === 'enable' ? 'Enable' : 'Disable';
            }
            loading.value = true;
            let params = {
                page: paginationConfig.currentPage,
                pageSize: paginationConfig.pageSize,
                type: req.type,
                status: req.status,
                method: req.method,
                orderBy: paginationConfig.orderBy,
                order: paginationConfig.order,
            };
            try {
                await loadConfigMap();
                const res = await rpc.alert.page(params);
                data.value = res.items || [];
                paginationConfig.total = Number(res.total) || 0;
            } catch (error) {
            } finally {
                loading.value = false;
            }
        };
        const onDelete = (row: Alert.AlertInfo) => {
            ElMessageBox.confirm(i18n.global.t('xpack.alert.deleteMsg'), i18n.global.t('xpack.alert.deleteTitle'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
            }).then(async () => {
                await rpc.alert.deleteAlert({ id: row.id });
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                await search();
            });
        };
        const updateAlertStatus = (status: string, id: number) => {
            ElMessageBox.confirm(
                i18n.global.t('xpack.alert.' + status + 'Msg'),
                i18n.global.t('xpack.alert.changeStatus'),
                {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                },
            ).then(async () => {
                let itemStatus = status.toLowerCase() === 'enable' ? 'Enable' : 'Disable';
                await rpc.alert.updateAlertStatus({ id: id, status: itemStatus });
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                await search();
            });
        };
        onMounted(() => {
            search();
        });
        return () =>
            withDirectives(
                <div>
                    {withDirectives(
                        <LayoutContent
                            title={$t('xpack.alert.list')}
                            v-slots={{
                                prompt: () => (
                                    <>
                                        <ElAlert
                                            type="info"
                                            closable={false}
                                            class={'!mt-2'}
                                            v-slots={{ title: () => <>{$t('xpack.alert.agentOfflineAlertHelper')}</> }}
                                        />
                                    </>
                                ),
                                leftToolBar: () => (
                                    <>
                                        {withDirectives(
                                            <ElButton
                                                type="primary"
                                                onClick={($event?: any) => {
                                                    openView('create');
                                                }}
                                            >
                                                {$t('xpack.alert.addTask')}
                                            </ElButton>,
                                            [[permissionDirective, true]],
                                        )}
                                    </>
                                ),
                                rightToolBar: () => (
                                    <>
                                        <div class={'dropdowns'}>
                                            <ElSelect
                                                filterable
                                                clearable
                                                modelValue={req.type}
                                                onUpdate:modelValue={($v) => {
                                                    req.type = $v as any;
                                                }}
                                                onChange={($event?: any) => {
                                                    search();
                                                }}
                                                class={'dropdown !w-52'}
                                                v-slots={{ prefix: () => <>{$t('commons.table.type')}</> }}
                                            >
                                                {unref(isMaster) ? (
                                                    <>
                                                        {!unref(isEE) ? (
                                                            <ElOption
                                                                value="panelPwdEndTime"
                                                                label={$t('xpack.alert.panelPwdEndTime')}
                                                            />
                                                        ) : null}
                                                        <ElOption
                                                            value="panelLogin"
                                                            label={$t('xpack.alert.panelLogin')}
                                                        />
                                                        {unref(isProductPro) && !unref(isEE) ? (
                                                            <ElOption
                                                                value="licenseException"
                                                                label={$t('xpack.alert.licenseException')}
                                                            />
                                                        ) : null}
                                                        {unref(isProductPro) ? (
                                                            <ElOption
                                                                value="nodeException"
                                                                label={$t('xpack.alert.nodeException')}
                                                            />
                                                        ) : null}
                                                        {!unref(isEE) ? (
                                                            <ElOption
                                                                value="panelUpdate"
                                                                label={$t('xpack.alert.panelUpdate')}
                                                            />
                                                        ) : null}
                                                    </>
                                                ) : null}
                                                <ElOption value="sshLogin" label={$t('xpack.alert.sshLogin')} />
                                                <ElOption value="ssl" label={$t('xpack.alert.ssl')} />
                                                <ElOption value="siteEndTime" label={$t('xpack.alert.siteEndTime')} />
                                                <ElOption value="cpu" label={$t('xpack.alert.cpu')} />
                                                <ElOption value="memory" label={$t('xpack.alert.memory')} />
                                                <ElOption value="disk" label={$t('xpack.alert.disk')} />
                                                <ElOption value="load" label={$t('xpack.alert.load')} />
                                                <ElOption value="clams" label={$t('xpack.alert.clams')} />
                                                <ElOption
                                                    value="shell"
                                                    label={$t('xpack.alert.cronjob', [$t('cronjob.shell')])}
                                                />
                                                <ElOption
                                                    value="app"
                                                    label={$t('xpack.alert.cronjob', [$t('cronjob.app')])}
                                                />
                                                <ElOption
                                                    value="website"
                                                    label={$t('xpack.alert.cronjob', [$t('cronjob.website')])}
                                                />
                                                <ElOption
                                                    value="database"
                                                    label={$t('xpack.alert.cronjob', [$t('cronjob.database')])}
                                                />
                                                <ElOption
                                                    value="directory"
                                                    label={$t('xpack.alert.cronjob', [$t('cronjob.directory')])}
                                                />
                                                <ElOption
                                                    value="log"
                                                    label={$t('xpack.alert.cronjob', [$t('cronjob.log')])}
                                                />
                                                <ElOption
                                                    value="snapshot"
                                                    label={$t('xpack.alert.cronjob', [$t('cronjob.snapshot')])}
                                                />
                                                <ElOption
                                                    value="curl"
                                                    label={$t('xpack.alert.cronjob', [$t('cronjob.curl')])}
                                                />
                                                <ElOption
                                                    value="cutWebsiteLog"
                                                    label={$t('xpack.alert.cronjob', [$t('cronjob.cutWebsiteLog')])}
                                                />
                                                <ElOption
                                                    value="clean"
                                                    label={$t('xpack.alert.cronjob', [$t('cronjob.clean')])}
                                                />
                                                <ElOption
                                                    value="ntp"
                                                    label={$t('xpack.alert.cronjob', [$t('cronjob.ntp')])}
                                                />
                                            </ElSelect>
                                            <ElSelect
                                                clearable
                                                filterable
                                                modelValue={req.status}
                                                onUpdate:modelValue={($v) => {
                                                    req.status = $v as any;
                                                }}
                                                onChange={($event?: any) => {
                                                    search();
                                                }}
                                                onClear={($event?: any) => {
                                                    (search as any)($event);
                                                }}
                                                class={'dropdown !w-52'}
                                                v-slots={{ prefix: () => <>{$t('commons.table.status')}</> }}
                                            >
                                                <ElOption label={$t('commons.button.enable')} value="Enable" />
                                                <ElOption label={$t('commons.button.disable')} value="Disable" />
                                            </ElSelect>
                                        </div>
                                    </>
                                ),
                                main: () => (
                                    <>
                                        <ComplexTable
                                            cache-pagination={false}
                                            pagination-config={paginationConfig}
                                            data={unref(data)}
                                            height-diff={380}
                                            onSortChange={($event?: any) => {
                                                (changeSort as any)($event);
                                            }}
                                            onSearch={($event?: any) => {
                                                search();
                                            }}
                                        >
                                            <ElTableColumn
                                                label={$t('commons.table.title')}
                                                prop="title"
                                                formatter={formatTitle}
                                                min-width="300px"
                                                show-overflow-tooltip
                                            />
                                            <ElTableColumn
                                                label={$t('commons.table.status')}
                                                prop="status"
                                                width="110px"
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>
                                                            {row.status === 'Enable'
                                                                ? withDirectives(
                                                                      <ElButton
                                                                          onClick={($event?: any) => {
                                                                              updateAlertStatus('disable', row.id);
                                                                          }}
                                                                          link
                                                                          icon="VideoPlay"
                                                                          type="success"
                                                                      >
                                                                          {$t('commons.status.enabled')}
                                                                      </ElButton>,
                                                                      [[permissionDirective, true]],
                                                                  )
                                                                : withDirectives(
                                                                      <ElButton
                                                                          icon="VideoPause"
                                                                          link
                                                                          type="danger"
                                                                          onClick={($event?: any) => {
                                                                              updateAlertStatus('enable', row.id);
                                                                          }}
                                                                      >
                                                                          {$t('commons.status.disabled')}
                                                                      </ElButton>,
                                                                      [[permissionDirective, true]],
                                                                  )}
                                                        </>
                                                    ),
                                                }}
                                            />
                                            <ElTableColumn
                                                label={$t('xpack.alert.alertMethod')}
                                                prop="method"
                                                width="200px"
                                                show-overflow-tooltip
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>{row.method ? <span>{formatMethod(row)}</span> : null}</>
                                                    ),
                                                }}
                                            />
                                            <ElTableColumn
                                                label={$t('xpack.alert.alertRule')}
                                                prop="rule"
                                                min-width="300px"
                                                show-overflow-tooltip
                                                v-slots={{ default: ({ row }) => <>{formatRule(row)}</> }}
                                            />
                                            {unref(isEE) ? (
                                                <ElTableColumn
                                                    label={$t('commons.table.creator')}
                                                    prop="createUser"
                                                    width="100px"
                                                    show-overflow-tooltip
                                                    v-slots={{ default: ({ row }) => <>{row.createUser || '-'}</> }}
                                                />
                                            ) : null}
                                            <FuTableOperations
                                                ellipsis={2}
                                                width="130px"
                                                buttons={buttons}
                                                label={$t('commons.table.operate')}
                                                fixed={unref(isMobile) ? false : 'right'}
                                                fix
                                            />
                                        </ComplexTable>
                                    </>
                                ),
                            }}
                        />,
                        [[vLoading, unref(loading)]],
                    )}
                    <AddTask
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                        ref={addTaskRef}
                    />
                </div>,
                [[vLoading, unref(loading)]],
            );
    },
    options,
);
