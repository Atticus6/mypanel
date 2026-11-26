import { $t } from '@/utils/i18n-t';
import { useSearchState } from '@/utils/search-reset';
import { rpc } from '@/lib/rpc';
import { computeSize } from '@/utils/size';
import { dateFormat } from '@/utils/date';
import { newUUID } from '@/utils/id';
import i18n from '@/lang';
import { Setting } from '@/types/setting';
import TaskLog from '@/components/log/task/index';
import RecoverStatus from '@/views/setting/snapshot/status/index';
import SnapshotImport from '@/views/setting/snapshot/import/index';
import SnapshotCreate from '@/views/setting/snapshot/create/index';
import SnapRecover from '@/views/setting/snapshot/recover/index';
import { MsgError, MsgSuccess } from '@/utils/message';
import './index.styles.css';
import LayoutContent from '@/components/layout-content/index';
import TableSearch from '@/components/table/TableSearch';
import TableRefresh from '@/components/table/TableRefresh';
import TableSetting from '@/components/table/TableSetting';
import ComplexTable from '@/components/table/complex/ComplexTable';
import { Star } from '@element-plus/icons-vue';
import FuInputRwSwitch from '@/components/fu/FuInputRwSwitch';
import FuTableOperations from '@/components/table/TableOperations';
import OpDialog from '@/components/del-dialog/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'snapshot',
    props: {},
    emits: emits,
    __scopeId: 'data-v-d74fdd5b',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref(false);
        const data = ref();
        const selects = ref<any>([]);
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 20,
            total: 0,
            orderBy: 'createdAt',
            order: 'null',
        });
        const searchName = ref();
        useSearchState(
            'setting/snapshot/index',
            {
                search: searchName,
                page: toRef(paginationConfig, 'currentPage'),
                pageSize: toRef(paginationConfig, 'pageSize'),
            },
            { onRevisit: () => search() },
        );
        const opRef = ref();
        const createRef = ref();
        const recoverStatusRef = ref();
        const importRef = ref();
        const isRecordShow = ref();
        const taskLogRef = ref();
        const recoverRef = ref();
        const operateIDs = ref();
        const cleanData = ref();
        const onImport = () => {
            let names = [];
            for (const item of data.value) {
                names.push(item.name);
            }
            importRef.value.acceptParams({ names: names });
        };
        const onCreate = () => {
            createRef.value.acceptParams();
        };
        const reCreate = (row: any) => {
            ElMessageBox.confirm(row.message, i18n.global.t('setting.reCreate'), {
                confirmButtonText: i18n.global.t('commons.button.retry'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
                type: 'error',
            }).then(async () => {
                await rpc.snapshot
                    .recreate({ id: row.id })
                    .then(() => {
                        loading.value = false;
                        openTaskLog(row.taskID);
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            });
        };
        const openTaskLog = (taskID: string) => {
            taskLogRef.value.openWithTaskID(taskID);
        };
        const openWithResource = (row: any, op: string) => {
            op = op === 'create' ? 'TaskCreate' : 'TaskRecover';
            taskLogRef.value.openWithResourceID('Snapshot', op, row.id);
        };
        const reRollback = (row: any) => {
            ElMessageBox.confirm(row.rollbackMessage, i18n.global.t('setting.reRollback'), {
                confirmButtonText: i18n.global.t('commons.button.retry'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
                type: 'error',
            }).then(async () => {
                let param = {
                    id: row.id,
                    taskID: newUUID(),
                    isNew: false,
                    reDownload: false,
                    secret: '',
                };
                await rpc.snapshot
                    .rollback(param)
                    .then(() => {
                        loading.value = false;
                        openTaskLog(row.taskRollbackID || param.taskID);
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            });
        };
        const onChange = async (info: any) => {
            await rpc.snapshot.updateDescription({ id: info.id, description: info.description });
            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
        };
        const onRecover = async (row: any) => {
            if (row.downloadAccount.indexOf('ALIYUN') !== -1 && row.size > 100 * 1024 * 1024) {
                MsgError(i18n.global.t('setting.ALIYUNRecover'));
                return;
            }
            loading.value = true;
            await rpc.dashboard
                .getOsInfo({})
                .then((res) => {
                    loading.value = false;
                    let params = {
                        id: row.id,
                        taskID: row.taskRecoverID,
                        isNew: row.recoverStatus === '',
                        name: row.name,
                        reDownload: false,
                        secret: row.secret,

                        arch: res.kernelArch,
                        size: row.size,
                        freeSize: Number(res.diskSize),

                        interruptStep: row.interruptStep,
                        status: row.recoverStatus,
                        message: row.recoverMessage,
                    };
                    recoverRef.value.acceptParams(params);
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const batchDelete = async (row: Setting.SnapshotInfo | null) => {
            let names = [];
            let ids = [];
            if (row) {
                ids.push(row.id);
                names.push(row.name);
            } else {
                selects.value.forEach((item: Setting.SnapshotInfo) => {
                    ids.push(item.id);
                    names.push(item.name);
                });
            }
            operateIDs.value = ids;
            opRef.value.acceptParams({
                title: i18n.global.t('commons.button.delete'),
                names: names,
                msg: i18n.global.t('commons.msg.operatorHelper', [
                    i18n.global.t('setting.snapshot'),
                    i18n.global.t('commons.button.delete'),
                ]),
                api: null,
                params: null,
            });
        };
        const onSubmitDelete = async () => {
            loading.value = true;
            await rpc.snapshot
                .delete({ ids: operateIDs.value, deleteWithFile: cleanData.value })
                .then(() => {
                    loading.value = false;
                    MsgSuccess(i18n.global.t('commons.msg.deleteSuccess'));
                    search();
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const buttons = [
            {
                label: i18n.global.t('commons.button.recover'),
                click: (row: any) => {
                    onRecover(row);
                },
                disabled: (row: any) => {
                    return !(row.status === 'Success');
                },
            },
            {
                label: i18n.global.t('commons.button.delete'),
                click: batchDelete,
            },
        ];
        const search = async (column?: any) => {
            paginationConfig.orderBy = column?.order ? column.prop : paginationConfig.orderBy;
            paginationConfig.order = column?.order ? column.order : paginationConfig.order;
            let params = {
                info: searchName.value,
                page: paginationConfig.currentPage,
                pageSize: paginationConfig.pageSize,
                orderBy: paginationConfig.orderBy,
                order: paginationConfig.order,
            };
            loading.value = true;
            await rpc.snapshot
                .search(params)
                .then((res) => {
                    loading.value = false;
                    loadSize(params);
                    cleanData.value = false;
                    data.value = res.items || [];
                    paginationConfig.total = Number(res.total);
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const loadSize = async (params: any) => {
            params.type = 'snapshot';
            await rpc.backup
                .loadRecordSize(params)
                .then((res) => {
                    let stats = res.items || [];
                    if (stats.length === 0) {
                        return;
                    }
                    for (const snap of data.value) {
                        for (const item of stats) {
                            if (snap.id === item.id) {
                                snap.hasLoad = true;
                                snap.size = Number(item.size);
                                break;
                            }
                        }
                    }
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        onMounted(() => {
            search();
        });
        return () => (
            <div>
                {!unref(isRecordShow)
                    ? withDirectives(
                          <LayoutContent
                              title={$t('setting.snapshot', 2)}
                              v-slots={{
                                  leftToolBar: () => (
                                      <>
                                          <ElButton
                                              type="primary"
                                              onClick={($event?: any) => {
                                                  onCreate();
                                              }}
                                          >
                                              {$t('commons.button.create')}
                                          </ElButton>
                                          <ElButton
                                              type="primary"
                                              plain
                                              onClick={($event?: any) => {
                                                  onImport();
                                              }}
                                          >
                                              {$t('commons.button.sync')}
                                          </ElButton>
                                          <ElButton
                                              type="primary"
                                              plain
                                              disabled={unref(selects).length === 0}
                                              onClick={($event?: any) => {
                                                  batchDelete(null);
                                              }}
                                          >
                                              {$t('commons.button.delete')}
                                          </ElButton>
                                      </>
                                  ),
                                  rightToolBar: () => (
                                      <>
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
                                              title="snapshot-refresh"
                                              ref="timerRef"
                                              onSearch={($event?: any) => {
                                                  search();
                                              }}
                                          />
                                      </>
                                  ),
                                  main: () => (
                                      <>
                                          <ComplexTable
                                              selection-context={() => [unref(searchName)]}
                                              row-key="id"
                                              cache-pagination={false}
                                              pagination-config={paginationConfig}
                                              selects={unref(selects)}
                                              onUpdate:selects={($v) => {
                                                  selects.value = $v as any;
                                              }}
                                              data={unref(data)}
                                              onSortChange={($event?: any) => {
                                                  (search as any)($event);
                                              }}
                                              onSearch={($event?: any) => {
                                                  (search as any)($event);
                                              }}
                                              class={'mt-5'}
                                          >
                                              <ElTableColumn type="selection" fix />
                                              <ElTableColumn
                                                  show-overflow-tooltip
                                                  label={$t('commons.table.name')}
                                                  min-width="100"
                                                  prop="name"
                                                  sortable
                                                  fix
                                              />
                                              <ElTableColumn prop="version" label={$t('app.version')} />
                                              <ElTableColumn
                                                  label={$t('setting.backupAccount')}
                                                  min-width={120}
                                                  prop="from"
                                                  v-slots={{
                                                      default: ({ row }) => (
                                                          <>
                                                              {(row.sourceAccounts || []).map((item, index) => (
                                                                  <div key={index}>
                                                                      {row.expand ||
                                                                      (!row.expand && Number(index) < 3) ? (
                                                                          <div>
                                                                              <span type="info">
                                                                                  <span>
                                                                                      {item === 'localhost'
                                                                                          ? $t('setting.LOCAL')
                                                                                          : item}
                                                                                  </span>
                                                                                  {item === row.downloadAccount ? (
                                                                                      <ElIcon
                                                                                          size="12"
                                                                                          class={
                                                                                              'relative top-px left-1'
                                                                                          }
                                                                                      >
                                                                                          <Star />
                                                                                      </ElIcon>
                                                                                  ) : null}
                                                                              </span>
                                                                          </div>
                                                                      ) : null}
                                                                  </div>
                                                              ))}
                                                              {!row.expand && row.sourceAccounts?.length > 3 ? (
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
                                                              {row.expand && row.sourceAccounts?.length > 3 ? (
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
                                                  label={$t('file.size')}
                                                  prop="size"
                                                  min-width="60"
                                                  show-overflow-tooltip
                                                  v-slots={{
                                                      default: ({ row }) => (
                                                          <>
                                                              {row.hasLoad ? (
                                                                  <div>
                                                                      {row.size ? (
                                                                          <span>{computeSize(row.size)}</span>
                                                                      ) : (
                                                                          <span>{'-'}</span>
                                                                      )}
                                                                  </div>
                                                              ) : null}
                                                              {!row.hasLoad ? (
                                                                  <div>
                                                                      <ElButton link loading />
                                                                  </div>
                                                              ) : null}
                                                          </>
                                                      ),
                                                  }}
                                              />
                                              <ElTableColumn
                                                  label={$t('commons.table.status')}
                                                  min-width="80"
                                                  prop="status"
                                                  v-slots={{
                                                      default: ({ row }) => (
                                                          <>
                                                              <div>
                                                                  {row.status === 'Waiting' ? (
                                                                      <ElButton
                                                                          onClick={($event?: any) => {
                                                                              openTaskLog(row.taskID);
                                                                          }}
                                                                          link
                                                                          type="primary"
                                                                      >
                                                                          {$t('setting.snapshot')}
                                                                          {$t('commons.status.waiting')}
                                                                      </ElButton>
                                                                  ) : null}
                                                                  {row.status === 'Failed' ? (
                                                                      <ElButton
                                                                          onClick={($event?: any) => {
                                                                              openTaskLog(row.taskID);
                                                                          }}
                                                                          link
                                                                          type="danger"
                                                                      >
                                                                          {$t('setting.snapshot')}
                                                                          {$t('commons.status.error')}
                                                                      </ElButton>
                                                                  ) : null}
                                                                  {row.status === 'Failed' ? (
                                                                      <ElButton
                                                                          type="danger"
                                                                          icon="Warning"
                                                                          link
                                                                          onClick={($event?: any) => {
                                                                              reCreate(row);
                                                                          }}
                                                                          class={'retry'}
                                                                      />
                                                                  ) : null}
                                                                  {row.status === 'Success' ? (
                                                                      <ElButton
                                                                          onClick={($event?: any) => {
                                                                              openTaskLog(row.taskID);
                                                                          }}
                                                                          link
                                                                          type="success"
                                                                      >
                                                                          {$t('setting.snapshot')}
                                                                          {$t('commons.status.success')}
                                                                      </ElButton>
                                                                  ) : null}
                                                              </div>
                                                              {row.recoverStatus ? (
                                                                  <div>
                                                                      {row.recoverStatus === 'Waiting' ? (
                                                                          <ElButton
                                                                              onClick={($event?: any) => {
                                                                                  openWithResource(row, 'recover');
                                                                              }}
                                                                              link
                                                                              type="primary"
                                                                          >
                                                                              {$t('commons.button.recover')}
                                                                              {$t('commons.status.waiting')}
                                                                          </ElButton>
                                                                      ) : null}
                                                                      {row.recoverStatus === 'Failed' ? (
                                                                          <ElButton
                                                                              onClick={($event?: any) => {
                                                                                  openWithResource(row, 'recover');
                                                                              }}
                                                                              type="danger"
                                                                              link
                                                                          >
                                                                              {$t('commons.button.recover')}
                                                                              {$t('commons.status.error')}
                                                                          </ElButton>
                                                                      ) : null}
                                                                      {row.recoverStatus === 'Failed' ? (
                                                                          <ElButton
                                                                              type="danger"
                                                                              icon="Warning"
                                                                              link
                                                                              onClick={($event?: any) => {
                                                                                  onRecover(row);
                                                                              }}
                                                                              class={'retry'}
                                                                          />
                                                                      ) : null}
                                                                      {row.recoverStatus === 'Success' ? (
                                                                          <ElButton
                                                                              onClick={($event?: any) => {
                                                                                  openWithResource(row, 'recover');
                                                                              }}
                                                                              link
                                                                              type="success"
                                                                          >
                                                                              {$t('commons.button.recover')}
                                                                              {$t('commons.status.success')}
                                                                          </ElButton>
                                                                      ) : null}
                                                                  </div>
                                                              ) : null}
                                                              {row.rollbackStatus ? (
                                                                  <div>
                                                                      {row.rollbackStatus === 'Waiting' ? (
                                                                          <ElButton link type="primary">
                                                                              {$t('setting.rollback')}
                                                                              {$t('commons.status.waiting')}
                                                                          </ElButton>
                                                                      ) : null}
                                                                      {row.rollbackStatus === 'Failed' ? (
                                                                          <ElButton
                                                                              link
                                                                              onClick={($event?: any) => {
                                                                                  reRollback(row);
                                                                              }}
                                                                              type="danger"
                                                                          >
                                                                              {$t('setting.rollback')}
                                                                              {$t('commons.status.error')}
                                                                          </ElButton>
                                                                      ) : null}
                                                                      {row.rollbackStatus === 'Failed' ? (
                                                                          <ElButton
                                                                              icon="Warning"
                                                                              type="danger"
                                                                              link
                                                                              onClick={($event?: any) => {
                                                                                  reRollback(row);
                                                                              }}
                                                                              class={'retry'}
                                                                          />
                                                                      ) : null}
                                                                      {row.recoverStatus === 'Success' ? (
                                                                          <ElButton link type="success">
                                                                              {$t('setting.rollback')}
                                                                              {$t('commons.status.success')}
                                                                          </ElButton>
                                                                      ) : null}
                                                                  </div>
                                                              ) : null}
                                                          </>
                                                      ),
                                                  }}
                                              />
                                              <ElTableColumn
                                                  label={$t('commons.table.description')}
                                                  prop="description"
                                                  show-overflow-tooltip
                                                  v-slots={{
                                                      default: ({ row }) => (
                                                          <>
                                                              <FuInputRwSwitch
                                                                  modelValue={row.description}
                                                                  onUpdate:modelValue={($v) => {
                                                                      row.description = $v as any;
                                                                  }}
                                                                  onEnter={($event?: any) => {
                                                                      onChange(row);
                                                                  }}
                                                                  onBlur={($event?: any) => {
                                                                      onChange(row);
                                                                  }}
                                                              />
                                                          </>
                                                      ),
                                                  }}
                                              />
                                              <ElTableColumn
                                                  prop="createdAt"
                                                  sortable
                                                  label={$t('commons.table.date')}
                                                  formatter={dateFormat}
                                                  show-overflow-tooltip
                                              />
                                              <FuTableOperations
                                                  width="240px"
                                                  ellipsis={10}
                                                  buttons={buttons}
                                                  label={$t('commons.table.operate')}
                                                  fix
                                              />
                                          </ComplexTable>
                                      </>
                                  ),
                              }}
                          />,
                          [[vLoading, unref(loading)]],
                      )
                    : null}
                <RecoverStatus
                    ref={recoverStatusRef}
                    onSearch={($event?: any) => {
                        search();
                    }}
                />
                <SnapshotCreate
                    ref={createRef}
                    onSearch={($event?: any) => {
                        search();
                    }}
                />
                <SnapshotImport
                    ref={importRef}
                    onSearch={($event?: any) => {
                        search();
                    }}
                />
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
                                <ElForm ref="deleteForm" label-position="left" class={'mt-4 mb-1'}>
                                    <ElFormItem>
                                        <ElCheckbox
                                            modelValue={unref(cleanData)}
                                            onUpdate:modelValue={($v) => {
                                                cleanData.value = $v as any;
                                            }}
                                            label={$t('cronjob.cleanData')}
                                        />
                                        <span class={'input-help'}>{$t('setting.deleteHelper')}</span>
                                    </ElFormItem>
                                </ElForm>
                            </>
                        ),
                    }}
                />
                <TaskLog
                    ref={taskLogRef}
                    width="70%"
                    onClose={($event?: any) => {
                        search();
                    }}
                />
                <SnapRecover
                    ref={recoverRef}
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                />
            </div>
        );
    },
    options,
);
