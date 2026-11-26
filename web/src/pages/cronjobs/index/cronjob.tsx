import { $t } from '@/utils/i18n-t';
import { useSearchState } from '@/utils/search-reset';
import Records from '@/pages/views/cronjob/cronjob/record/index';
import Backups from '@/pages/views/cronjob/cronjob/backup/index';
import Import from '@/pages/views/cronjob/cronjob/import/index';
import { exportCronjob } from '@/api/modules/cronjob';
import i18n from '@/lang';
import { Cronjob } from '@/types/cronjob';
import GroupDialog from '@/components/group/index';
import { MsgSuccess } from '@/utils/message';
import { hasBackup, transSpecToStr } from '@/pages/views/cronjob/cronjob/helper';
import { getCurrentDateFormatted } from '@/utils/date';
import { routerToNameWithQuery } from '@/utils/router';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { rpc } from '@/lib/rpc';
import { useOperateNodeContext } from '@/composables/useOperateNodeContext';
import { usePageState } from '@/composables/usePageState';
import permissionDirective from '@/directives/modules/permission';
import { nodeAdminDirective } from '@/directives/modules/permission';
import LayoutContent from '@/components/layout-content/index';
import TableViewSwitch from '@/components/table/TableViewSwitch';
import TableSearch from '@/components/table/TableSearch';
import TableRefresh from '@/components/table/TableRefresh';
import TableSetting from '@/components/table/TableSetting';
import ComplexTable from '@/components/table/complex/ComplexTable';
import FuSelectRwSwitch from '@/components/fu/FuSelectRwSwitch';
import Status from '@/components/status/index';
import FuTableOperations from '@/components/table/TableOperations';
import OpDialog from '@/components/del-dialog/index';
import { Star } from '@element-plus/icons-vue';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'cronjob',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode, isMobile } = useGlobalStore();
        useOperateNodeContext(currentNode);
        const loading = ref();
        const viewMode = ref<'table' | 'card'>('table');
        const selects = ref<any>([]);
        const isRecordShow = ref();
        const operateIDs = ref();
        const opRef = ref();
        const showClean = ref();
        const cleanData = ref();
        const cleanRemoteData = ref();
        const opExportRef = ref();
        const dialogImportRef = ref();
        const data = ref();
        const groupOptions = ref();
        const dialogGroupRef = ref();
        const pageState = usePageState(() => ({
            paginationConfig: {
                currentPage: 1,
                pageSize: 20,
                total: 0,
                orderBy: 'createdAt',
                order: 'null',
            },
            defaultGroupID: undefined as number | undefined,
            searchName: undefined as string | undefined,
            searchGroupID: undefined as number | undefined,
        }));
        const paginationConfig = pageState.paginationConfig;
        const { defaultGroupID, searchName, searchGroupID } = toRefs(pageState);
        useSearchState(
            'cronjob/cronjob/index',
            {
                search: searchName,
                page: toRef(paginationConfig, 'currentPage'),
                pageSize: toRef(paginationConfig, 'pageSize'),
            },
            { onRevisit: () => search() },
        );
        const search = async (column?: any) => {
            if (column) {
                paginationConfig.orderBy = column.order ? column.prop : 'createdAt';
                paginationConfig.order = column.order || 'null';
            }
            let groupIDs;
            if (searchGroupID.value) {
                groupIDs =
                    searchGroupID.value === defaultGroupID.value ? [searchGroupID.value, 0] : [searchGroupID.value];
            }
            let params = {
                info: searchName.value,
                groupIDs: groupIDs,
                page: paginationConfig.currentPage,
                pageSize: paginationConfig.pageSize,
                orderBy: paginationConfig.orderBy,
                order: paginationConfig.order,
            };
            loading.value = true;
            try {
                const res = await rpc.cronjob.search({
                    info: params.info,
                    groupIds: (params.groupIDs || []).map((id) => Number(id)),
                    page: params.page,
                    pageSize: params.pageSize,
                    orderBy: params.orderBy,
                    order: params.order,
                });
                data.value = (res.items || []).map((item) => ({
                    ...item,
                    retainCopies: Number(item.retainCopies),
                }));
                loadGroups();
                paginationConfig.total = Number(res.total);
            } finally {
                loading.value = false;
            }
        };
        const dialogRecordRef = ref();
        const dialogBackupRef = ref();
        const backupAccountsVisible = ref(false);
        const backupAccounts = ref<string[]>([]);
        const downloadAccount = ref('');
        const onOpenDialog = async (id: string) => {
            routerToNameWithQuery('CronjobOperate', { id: id });
        };
        function selectable(row) {
            return row.status !== 'Pending';
        }
        const onDelete = async (row: Cronjob.CronjobInfo | null) => {
            let names = [];
            let ids = [];
            showClean.value = false;
            cleanData.value = false;
            cleanRemoteData.value = true;
            if (row) {
                ids = [row.id];
                names = [row.name];
                if (hasBackup(row.type)) {
                    showClean.value = true;
                }
            } else {
                for (const item of selects.value) {
                    names.push(item.name);
                    ids.push(item.id);
                    if (hasBackup(item.type)) {
                        showClean.value = true;
                    }
                }
            }
            operateIDs.value = ids;
            opRef.value.acceptParams({
                title: i18n.global.t('commons.button.delete'),
                names: names,
                msg: i18n.global.t('commons.msg.operatorHelper', [
                    i18n.global.t('menu.cronjob'),
                    i18n.global.t('commons.button.delete'),
                ]),
                api: null,
                params: null,
            });
        };
        const onSubmitDelete = async () => {
            loading.value = true;
            await rpc.cronjob
                .deleteCronjobs({
                    ids: operateIDs.value,
                    cleanData: cleanData.value,
                    cleanRemoteData: cleanRemoteData.value,
                })
                .then(() => {
                    loading.value = false;
                    MsgSuccess(i18n.global.t('commons.msg.deleteSuccess'));
                    search();
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const onImport = () => {
            dialogImportRef.value.acceptParams();
        };
        const onExport = async () => {
            let names = [];
            let ids = [];
            for (const item of selects.value) {
                names.push(item.name);
                ids.push(item.id);
            }
            operateIDs.value = ids;
            opExportRef.value.acceptParams({
                title: i18n.global.t('commons.button.export'),
                names: names,
                msg: i18n.global.t('commons.msg.operatorHelper', [
                    i18n.global.t('menu.cronjob'),
                    i18n.global.t('commons.button.export'),
                ]),
                api: null,
                params: null,
            });
        };
        const onSubmitExport = async () => {
            loading.value = true;
            await exportCronjob({ ids: operateIDs.value })
                .then((res) => {
                    const downloadUrl = window.URL.createObjectURL(new Blob([res]));
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = downloadUrl;
                    a.download = '1panel-cronjob-' + getCurrentDateFormatted() + '.json';
                    const event = new MouseEvent('click');
                    a.dispatchEvent(event);
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        const loadGroups = async () => {
            const res = await rpc.core.group.list({ type: 'cronjob' });
            groupOptions.value = (res.items as any) || [];
            const invalidGroup =
                searchGroupID.value && !groupOptions.value.some((group) => group.id === searchGroupID.value);
            if (invalidGroup) {
                searchGroupID.value = undefined;
                paginationConfig.currentPage = 1;
            }
            defaultGroupID.value = groupOptions.value.find((group) => group.isDefault)?.id;
            for (const item of data.value) {
                if (item.groupId === 0) {
                    item.groupId = defaultGroupID.value;
                }
                let hasGroup = false;
                for (const group of groupOptions.value) {
                    if (item.groupId === group.id) {
                        hasGroup = true;
                        item.groupBelong = group.name;
                    }
                }
                if (!hasGroup) {
                    item.groupId = null;
                    item.groupBelong = '-';
                }
            }
            if (invalidGroup) {
                search();
            }
        };
        const updateGroup = async (row: any) => {
            await rpc.cronjob.updateCronjobGroup({ id: row.id, groupId: row.groupId });
            search();
            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
        };
        const onOpenGroupDialog = () => {
            dialogGroupRef.value!.acceptParams({ type: 'cronjob', hideDefaultButton: true });
        };
        const onChangeStatus = async (id: number, status: string) => {
            ElMessageBox.confirm(i18n.global.t('cronjob.' + status + 'Msg'), i18n.global.t('cronjob.changeStatus'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
            }).then(async () => {
                let itemStatus = status === 'enable' ? 'Enable' : 'Disable';
                await rpc.cronjob.updateCronjobStatus({ id: id, status: itemStatus });
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                search();
            });
        };
        const onBatchChangeStatus = async (status: string) => {
            ElMessageBox.confirm(i18n.global.t('cronjob.' + status + 'Msg'), i18n.global.t('cronjob.changeStatus'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
            }).then(async () => {
                let itemStatus = status === 'enable' ? 'Enable' : 'Disable';
                for (const item of selects.value) {
                    await rpc.cronjob.updateCronjobStatus({ id: item.id, status: itemStatus });
                }
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                search();
            });
        };
        const loadBackups = async (row: any) => {
            dialogBackupRef.value!.acceptParams({ cronjobID: row.id, cronjob: row.name });
        };
        const openBackupAccounts = (row: Cronjob.CronjobInfo) => {
            backupAccounts.value = row.sourceAccounts || [];
            downloadAccount.value = row.downloadAccount;
            backupAccountsVisible.value = true;
        };
        const onHandle = async (row: Cronjob.CronjobInfo) => {
            loading.value = true;
            await rpc.cronjob
                .handleCronjobOnce({ id: row.id })
                .then(() => {
                    loading.value = false;
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    search();
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const loadDetail = (row: any) => {
            isRecordShow.value = true;
            let params = {
                rowData: { ...row },
            };
            dialogRecordRef.value!.acceptParams(params);
        };
        const buttons = [
            {
                label: i18n.global.t('commons.button.handle'),
                permission: true,
                nodeAdmin: true,
                click: (row: Cronjob.CronjobInfo) => {
                    onHandle(row);
                },
                disabled: (row: any) => {
                    return row.status === 'Pending';
                },
            },
            {
                label: i18n.global.t('cronjob.record'),
                click: (row: Cronjob.CronjobInfo) => {
                    loadDetail(row);
                },
            },
            {
                label: i18n.global.t('commons.button.edit'),
                permission: true,
                nodeAdmin: true,
                click: (row: Cronjob.CronjobInfo) => {
                    onOpenDialog(row.id + '');
                },
            },
            {
                label: i18n.global.t('commons.button.delete'),
                permission: true,
                nodeAdmin: true,
                click: (row: Cronjob.CronjobInfo) => {
                    onDelete(row);
                },
            },
        ];
        onMounted(() => {
            search();
        });
        return () => (
            <div>
                {!unref(isRecordShow)
                    ? withDirectives(
                          <LayoutContent
                              title={$t('menu.cronjob')}
                              v-slots={{
                                  leftToolBar: () => (
                                      <>
                                          {withDirectives(
                                              <ElButton
                                                  type="primary"
                                                  onClick={($event?: any) => {
                                                      onOpenDialog('');
                                                  }}
                                              >
                                                  {$t('commons.button.create')}
                                              </ElButton>,
                                              [
                                                  [permissionDirective, true],
                                                  [nodeAdminDirective, true],
                                              ],
                                          )}
                                          {withDirectives(
                                              <ElButton
                                                  onClick={($event?: any) => {
                                                      onOpenGroupDialog();
                                                  }}
                                              >
                                                  {$t('commons.table.group')}
                                              </ElButton>,
                                              [
                                                  [permissionDirective, true],
                                                  [nodeAdminDirective, true],
                                              ],
                                          )}
                                          <ElButtonGroup>
                                              {withDirectives(
                                                  <ElButton
                                                      plain
                                                      disabled={unref(selects).length === 0}
                                                      onClick={($event?: any) => {
                                                          onBatchChangeStatus('enable');
                                                      }}
                                                  >
                                                      {$t('commons.button.enable')}
                                                  </ElButton>,
                                                  [
                                                      [permissionDirective, true],
                                                      [nodeAdminDirective, true],
                                                  ],
                                              )}
                                              {withDirectives(
                                                  <ElButton
                                                      plain
                                                      disabled={unref(selects).length === 0}
                                                      onClick={($event?: any) => {
                                                          onBatchChangeStatus('disable');
                                                      }}
                                                  >
                                                      {$t('commons.button.disable')}
                                                  </ElButton>,
                                                  [
                                                      [permissionDirective, true],
                                                      [nodeAdminDirective, true],
                                                  ],
                                              )}
                                              {withDirectives(
                                                  <ElButton
                                                      plain
                                                      disabled={unref(selects).length === 0}
                                                      onClick={($event?: any) => {
                                                          onDelete(null);
                                                      }}
                                                  >
                                                      {$t('commons.button.delete')}
                                                  </ElButton>,
                                                  [
                                                      [permissionDirective, true],
                                                      [nodeAdminDirective, true],
                                                  ],
                                              )}
                                          </ElButtonGroup>
                                          <ElButtonGroup>
                                              {withDirectives(
                                                  <ElButton
                                                      onClick={($event?: any) => {
                                                          (onImport as any)($event);
                                                      }}
                                                  >
                                                      {$t('commons.button.import')}
                                                  </ElButton>,
                                                  [
                                                      [permissionDirective, true],
                                                      [nodeAdminDirective, true],
                                                  ],
                                              )}
                                              {withDirectives(
                                                  <ElButton
                                                      disabled={unref(selects).length === 0}
                                                      onClick={($event?: any) => {
                                                          (onExport as any)($event);
                                                      }}
                                                  >
                                                      {$t('commons.button.export')}
                                                  </ElButton>,
                                                  [
                                                      [permissionDirective, true],
                                                      [nodeAdminDirective, true],
                                                  ],
                                              )}
                                          </ElButtonGroup>
                                      </>
                                  ),
                                  rightToolBar: () => (
                                      <>
                                          <TableViewSwitch
                                              modelValue={unref(viewMode)}
                                              onUpdate:modelValue={($v) => {
                                                  viewMode.value = $v as any;
                                              }}
                                              storage-key="cronjob"
                                          />
                                          <ElSelect
                                              modelValue={unref(searchGroupID)}
                                              onUpdate:modelValue={($v) => {
                                                  searchGroupID.value = $v as any;
                                              }}
                                              onChange={($event?: any) => {
                                                  search();
                                              }}
                                              clearable
                                              class={'p-w-200'}
                                              v-slots={{ prefix: () => <>{$t('commons.table.group')}</> }}
                                          >
                                              {(unref(groupOptions) || []).map((item) => (
                                                  <ElOption label={item.name} value={item.id} key={item.id} />
                                              ))}
                                          </ElSelect>
                                          <TableSearch
                                              onSearch={($event?: any) => {
                                                  search();
                                              }}
                                              searchName={unref(searchName)}
                                              onUpdate:searchName={($v) => {
                                                  searchName.value = $v as any;
                                              }}
                                          />
                                          <TableRefresh
                                              onSearch={($event?: any) => {
                                                  search();
                                              }}
                                          />
                                          <TableSetting
                                              title="cronjob-refresh"
                                              onSearch={($event?: any) => {
                                                  search();
                                              }}
                                          />
                                      </>
                                  ),
                                  main: () => (
                                      <>
                                          <ComplexTable
                                              selection-context={() => [unref(searchName), unref(searchGroupID)]}
                                              row-key="id"
                                              cache-pagination={false}
                                              pagination-config={paginationConfig}
                                              default-sort={
                                                  paginationConfig.order !== 'null'
                                                      ? {
                                                            prop: paginationConfig.orderBy,
                                                            order: paginationConfig.order,
                                                        }
                                                      : undefined
                                              }
                                              view-mode={unref(viewMode)}
                                              onUpdate:view-mode={($v) => {
                                                  viewMode.value = $v as any;
                                              }}
                                              selects={unref(selects)}
                                              onUpdate:selects={($v) => {
                                                  selects.value = $v as any;
                                              }}
                                              onSortChange={($event?: any) => {
                                                  (search as any)($event);
                                              }}
                                              onSearch={($event?: any) => {
                                                  (search as any)($event);
                                              }}
                                              data={unref(data)}
                                              heightDiff={300}
                                          >
                                              <ElTableColumn type="selection" selectable={selectable} fix />
                                              <ElTableColumn
                                                  label={$t('cronjob.taskName')}
                                                  min-width={120}
                                                  prop="name"
                                                  sortable
                                                  card-type="name"
                                                  show-overflow-tooltip
                                                  v-slots={{
                                                      default: ({ row }) => (
                                                          <>
                                                              <ElText
                                                                  type="primary"
                                                                  onClick={($event?: any) => {
                                                                      loadDetail(row);
                                                                  }}
                                                                  class={'cursor-pointer'}
                                                              >
                                                                  {row.name}
                                                              </ElText>
                                                          </>
                                                      ),
                                                  }}
                                              />
                                              <ElTableColumn
                                                  label={$t('commons.table.group')}
                                                  min-width="120"
                                                  prop="group"
                                                  card-type="content"
                                                  v-slots={{
                                                      default: ({ row }) => (
                                                          <>
                                                              {withDirectives(
                                                                  <FuSelectRwSwitch
                                                                      modelValue={row.groupId}
                                                                      onUpdate:modelValue={($v) => {
                                                                          row.groupId = $v as any;
                                                                      }}
                                                                      onChange={($event?: any) => {
                                                                          updateGroup(row);
                                                                      }}
                                                                      v-slots={{ read: () => <>{row.groupBelong}</> }}
                                                                  >
                                                                      {(unref(groupOptions) || []).map((item) => (
                                                                          <ElOption
                                                                              label={item.name}
                                                                              value={item.id}
                                                                              key={item.id}
                                                                          />
                                                                      ))}
                                                                  </FuSelectRwSwitch>,
                                                                  [
                                                                      [permissionDirective, true],
                                                                      [nodeAdminDirective, true],
                                                                  ],
                                                              )}
                                                          </>
                                                      ),
                                                  }}
                                              />
                                              <ElTableColumn
                                                  label={$t('commons.table.status')}
                                                  min-width={90}
                                                  prop="status"
                                                  sortable
                                                  card-type="status"
                                                  v-slots={{
                                                      default: ({ row }) => (
                                                          <>
                                                              {row.status === 'Enable'
                                                                  ? withDirectives(
                                                                        <Status
                                                                            onClick={($event?: any) => {
                                                                                onChangeStatus(row.id, 'disable');
                                                                            }}
                                                                            status={row.status}
                                                                            operate={true}
                                                                        />,
                                                                        [
                                                                            [permissionDirective, true],
                                                                            [nodeAdminDirective, true],
                                                                        ],
                                                                    )
                                                                  : null}
                                                              {row.status === 'Disable'
                                                                  ? withDirectives(
                                                                        <Status
                                                                            onClick={($event?: any) => {
                                                                                onChangeStatus(row.id, 'enable');
                                                                            }}
                                                                            status={row.status}
                                                                            operate={true}
                                                                        />,
                                                                        [
                                                                            [permissionDirective, true],
                                                                            [nodeAdminDirective, true],
                                                                        ],
                                                                    )
                                                                  : null}
                                                              {row.status === 'Pending' ? (
                                                                  <Status status={row.status} />
                                                              ) : null}
                                                          </>
                                                      ),
                                                  }}
                                              />
                                              <ElTableColumn
                                                  label={$t('cronjob.cronSpec')}
                                                  show-overflow-tooltip
                                                  min-width={120}
                                                  card-type="description"
                                                  v-slots={{
                                                      default: ({ row }) => (
                                                          <>
                                                              {(row.spec.split('&&') || []).map((item, index) => (
                                                                  <div key={index}>
                                                                      {row.expand ||
                                                                      (!row.expand && Number(index) < 3) ? (
                                                                          <div>
                                                                              <span>
                                                                                  {row.specCustom
                                                                                      ? item
                                                                                      : transSpecToStr(item)}
                                                                              </span>
                                                                          </div>
                                                                      ) : null}
                                                                  </div>
                                                              ))}
                                                              {!row.expand && row.spec.split('&&').length > 3 ? (
                                                                  <div>
                                                                      <ElButton
                                                                          type="primary"
                                                                          link
                                                                          onClick={($event?: any) => {
                                                                              row.expand = true;
                                                                          }}
                                                                      >
                                                                          {$t('commons.button.expand')}
                                                                          {'... '}
                                                                      </ElButton>
                                                                  </div>
                                                              ) : null}
                                                              {row.expand && row.spec.split('&&').length > 3 ? (
                                                                  <div>
                                                                      <ElButton
                                                                          type="primary"
                                                                          link
                                                                          onClick={($event?: any) => {
                                                                              row.expand = false;
                                                                          }}
                                                                      >
                                                                          {$t('commons.button.collapse')}
                                                                      </ElButton>
                                                                  </div>
                                                              ) : null}
                                                          </>
                                                      ),
                                                  }}
                                              />
                                              <ElTableColumn
                                                  label={$t('cronjob.retainCopies')}
                                                  min-width={120}
                                                  prop="retainCopies"
                                                  card-type="content"
                                                  v-slots={{
                                                      default: ({ row }) => (
                                                          <>
                                                              {hasBackup(row.type) ? (
                                                                  withDirectives(
                                                                      <ElButton
                                                                          onClick={($event?: any) => {
                                                                              loadBackups(row);
                                                                          }}
                                                                          plain
                                                                          size="small"
                                                                      >
                                                                          {row.retainCopies}
                                                                          {$t('cronjob.retainCopiesUnit')}
                                                                      </ElButton>,
                                                                      [
                                                                          [permissionDirective, true],
                                                                          [nodeAdminDirective, true],
                                                                      ],
                                                                  )
                                                              ) : (
                                                                  <span>{row.retainCopies}</span>
                                                              )}
                                                          </>
                                                      ),
                                                  }}
                                              />
                                              <ElTableColumn
                                                  label={$t('cronjob.lastRecordTime')}
                                                  min-width={120}
                                                  show-overflow-tooltip
                                                  prop="lastRecordTime"
                                                  card-type="description"
                                                  v-slots={{
                                                      default: ({ row }) => (
                                                          <>
                                                              {row.lastRecordStatus === 'Success' ? (
                                                                  <ElButton icon="Select" link type="success" />
                                                              ) : null}
                                                              {row.lastRecordStatus === 'Failed' ? (
                                                                  <ElButton icon="CloseBold" link type="danger" />
                                                              ) : null}
                                                              {row.lastRecordStatus === 'Waiting' ? (
                                                                  <ElButton loading={true} link type="info" />
                                                              ) : null}
                                                              {row.lastRecordStatus === 'Unexecuted' ? (
                                                                  <ElButton icon="Minus" link type="info" />
                                                              ) : null}
                                                              {row.lastRecordTime}
                                                          </>
                                                      ),
                                                  }}
                                              />
                                              <ElTableColumn
                                                  min-width={120}
                                                  label={$t('setting.backupAccount')}
                                                  card-type="content-full"
                                                  v-slots={{
                                                      default: ({ row }) => (
                                                          <>
                                                              {!hasBackup(row.type) ? (
                                                                  <span>{'-'}</span>
                                                              ) : (
                                                                  <div>
                                                                      {row.downloadAccount ? (
                                                                          <ElButton plain size="small">
                                                                              {row.downloadAccount === 'localhost'
                                                                                  ? $t('setting.LOCAL')
                                                                                  : row.downloadAccount}
                                                                          </ElButton>
                                                                      ) : (
                                                                          <span>{'-'}</span>
                                                                      )}
                                                                      {row.sourceAccounts?.length > 1 ? (
                                                                          <ElButton
                                                                              plain
                                                                              size="small"
                                                                              onClick={($event?: any) => {
                                                                                  openBackupAccounts(row);
                                                                              }}
                                                                          >
                                                                              {' +'}
                                                                              {row.sourceAccounts.length - 1}
                                                                          </ElButton>
                                                                      ) : null}
                                                                  </div>
                                                              )}
                                                          </>
                                                      ),
                                                  }}
                                              />
                                              <FuTableOperations
                                                  width="200px"
                                                  buttons={buttons}
                                                  ellipsis={2}
                                                  label={$t('commons.table.operate')}
                                                  min-width={unref(isMobile) ? 'auto' : 200}
                                                  fixed={unref(isMobile) ? false : 'right'}
                                                  fix
                                                  card-type="button"
                                              />
                                          </ComplexTable>
                                      </>
                                  ),
                              }}
                          />,
                          [[vLoading, unref(loading)]],
                      )
                    : null}
                <OpDialog
                    ref={opRef}
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                    onSubmit={($event?: any) => {
                        onSubmitDelete();
                    }}
                    v-slots={{
                        content: () => (
                            <>
                                {unref(showClean) ? (
                                    <ElForm ref="deleteForm" label-position="left" class={'mt-4 mb-1'}>
                                        <ElFormItem>
                                            <ElCheckbox
                                                modelValue={unref(cleanData)}
                                                onUpdate:modelValue={($v) => {
                                                    cleanData.value = $v as any;
                                                }}
                                                label={$t('cronjob.cleanData')}
                                            />
                                            {unref(cleanData) ? (
                                                <ElCheckbox
                                                    modelValue={unref(cleanRemoteData)}
                                                    onUpdate:modelValue={($v) => {
                                                        cleanRemoteData.value = $v as any;
                                                    }}
                                                    label={$t('cronjob.cleanRemoteData')}
                                                />
                                            ) : null}
                                            <span class={'input-help'}>{$t('cronjob.cleanDataHelper')}</span>
                                        </ElFormItem>
                                    </ElForm>
                                ) : null}
                            </>
                        ),
                    }}
                />
                <OpDialog
                    ref={opExportRef}
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                    onSubmit={($event?: any) => {
                        onSubmitExport();
                    }}
                />
                <GroupDialog
                    onSearch={($event?: any) => {
                        (loadGroups as any)($event);
                    }}
                    ref={dialogGroupRef}
                />
                <Records
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                    ref={dialogRecordRef}
                />
                <Import
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                    ref={dialogImportRef}
                />
                <Backups
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                    ref={dialogBackupRef}
                />
                <ElDialog
                    modelValue={unref(backupAccountsVisible)}
                    onUpdate:modelValue={($v) => {
                        backupAccountsVisible.value = $v as any;
                    }}
                    title={$t('setting.backupAccount')}
                    width="400px"
                >
                    {(unref(backupAccounts) || []).map((account) => (
                        <div class={'mb-2'} key={account}>
                            {account === 'localhost' ? $t('setting.LOCAL') : account}
                            {account === unref(downloadAccount) ? (
                                <ElIcon size="12" class={'relative top-px left-1'}>
                                    <Star />
                                </ElIcon>
                            ) : null}
                        </div>
                    ))}
                </ElDialog>
            </div>
        );
    },
    options,
);

definePage({
    name: 'CronjobItem',
    meta: { activeMenu: '/cronjobs', title: 'menu.cronjob', permission: 'cronjob_view', hidden: true },
});
