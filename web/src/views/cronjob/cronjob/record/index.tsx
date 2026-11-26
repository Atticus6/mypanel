import { $t } from '@/utils/i18n-t';
import asset_no_app from '@/assets/images/no_app.svg';
import { panelCacheKey, writePanelCache, readCachedPageSize } from '@/utils/panel-cache';
import { reactive, ref } from 'vue';
import { useMediaQuery } from '@/composables/useMediaQuery';
import { Cronjob } from '@/types/cronjob';
import type { CronjobRecord } from '@/gen/panel/agent/v1/cronjob_pb';
import { rpc } from '@/lib/rpc';
import { dateFormat } from '@/utils/date';
import LogFile from '@/components/log/file/index';
import i18n from '@/lang';
import { ElMessageBox } from 'element-plus';
import { MsgSuccess } from '@/utils/message';
import { shortcuts } from '@/utils/shortcuts';
import { hasBackup } from '../helper';
interface DialogProps {
    rowData: Cronjob.CronjobInfo;
}
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import permissionDirective from '@/directives/modules/permission';
import { nodeAdminDirective } from '@/directives/modules/permission';
import { ElCard } from 'element-plus';
import { ElPopover } from 'element-plus';
import { ElTag } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElDivider } from 'element-plus';
import { ElDatePicker } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElRow } from 'element-plus';
import { ElCol } from 'element-plus';
import { ElTableColumn } from 'element-plus';
import { ElTooltip } from 'element-plus';
import { ElPagination } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import Status from '@/components/status/index';
import LayoutContent from '@/components/layout-content/index';
import TableRefresh from '@/components/table/TableRefresh';
import ComplexTable from '@/components/table/complex/ComplexTable';
import DialogPro from '@/components/dialog-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'record',
    props: {},
    emits: emits,
    __scopeId: 'data-v-e69d259d',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const hasFinePointer = useMediaQuery('(hover: hover) and (pointer: fine)');
        const loading = ref();
        const hasRecords = ref();
        const recordShow = ref(false);
        const dialogData = ref();
        const records = ref<Array<CronjobRecord>>([]);
        const currentRecord = ref<CronjobRecord>();
        const open = ref();
        const delLoading = ref();
        const cleanData = ref();
        const cleanRemoteData = ref();
        const formatInterval = (interval?: number) => {
            if (!interval || interval < 0) {
                return '-';
            }

            const totalMilliseconds = Math.floor(interval);
            const hours = Math.floor(totalMilliseconds / 3600000);
            const minutes = Math.floor((totalMilliseconds % 3600000) / 60000);
            const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
            const milliseconds = totalMilliseconds % 1000;
            return [
                hours ? `${hours}h` : '',
                minutes ? `${minutes}min` : '',
                seconds ? `${seconds}s` : '',
                milliseconds ? `${milliseconds}ms` : '',
            ]
                .filter(Boolean)
                .join(' ');
        };
        const acceptParams = async (params: DialogProps): Promise<void> => {
            let itemSize = readCachedPageSize(searchInfo.cacheSizeKey);
            if (itemSize) {
                searchInfo.pageSize = itemSize;
            }

            recordShow.value = true;
            dialogData.value = params;
            if (dialogData.value.rowData.type === 'app') {
                const res = await rpc.app.listInstalled({});
                let itemApps = res.items || [];
                for (const item of itemApps) {
                    if (item.id == dialogData.value.rowData.appID) {
                        dialogData.value.rowData.appID = item.key + ' [' + item.name + ']';
                        break;
                    }
                }
            }
            search(true);
        };
        const handleSizeChange = (val: number) => {
            searchInfo.pageSize = val;
            writePanelCache('pagination', panelCacheKey(`size:${searchInfo.cacheSizeKey}`), val);
            search(true);
        };
        const handleCurrentChange = (val: number) => {
            searchInfo.page = val;
            search(false);
        };
        const timeRangeLoad = ref<[Date, Date]>([
            new Date(new Date(new Date().getTime() - 3600 * 1000 * 24 * 7).setHours(0, 0, 0, 0)),
            new Date(new Date().setHours(23, 59, 59, 999)),
        ]);
        const searchInfo = reactive({
            cacheSizeKey: 'cronjob-record-page-size',
            page: 1,
            pageSize: 10,
            recordTotal: 0,
            cronjobID: 0,
            startTime: new Date(),
            endTime: new Date(),
            status: '',
        });
        const onHandle = async (row: Cronjob.CronjobInfo) => {
            loading.value = true;
            await rpc.cronjob
                .handleCronjobOnce({ id: row.id })
                .then(() => {
                    loading.value = false;
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    search(true);
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const onChangeStatus = async (id: number, status: string) => {
            ElMessageBox.confirm(i18n.global.t('cronjob.' + status + 'Msg'), i18n.global.t('cronjob.changeStatus'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
            }).then(async () => {
                let itemStatus = status === 'enable' ? 'Enable' : 'Disable';
                await rpc.cronjob.updateCronjobStatus({ id: id, status: itemStatus });
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                dialogData.value.rowData.status = itemStatus;
            });
        };
        const search = async (changeToLatest: boolean) => {
            if (timeRangeLoad.value && timeRangeLoad.value.length === 2) {
                searchInfo.startTime = timeRangeLoad.value[0];
                searchInfo.endTime = timeRangeLoad.value[1];
            } else {
                searchInfo.startTime = new Date(new Date().setHours(0, 0, 0, 0));
                searchInfo.endTime = new Date();
            }
            const res = await rpc.cronjob.searchRecords({
                page: searchInfo.page,
                pageSize: searchInfo.pageSize,
                cronjobId: dialogData.value.rowData!.id,
                startTime: new Date(searchInfo.startTime).toISOString(),
                endTime: new Date(searchInfo.endTime).toISOString(),
                status: searchInfo.status,
            });
            records.value = res.items;
            searchInfo.recordTotal = Number(res.total);
            hasRecords.value = searchInfo.recordTotal !== 0;
            if (!hasRecords.value) {
                return;
            }
            if (changeToLatest || !currentRecord.value) {
                currentRecord.value = records.value[0];
                return;
            }
            for (const item of records.value) {
                if (item.id === currentRecord.value.id) {
                    currentRecord.value = item;
                    break;
                }
            }
        };
        const forDetail = (row: CronjobRecord) => {
            currentRecord.value = row;
        };
        const onClean = async () => {
            if (!hasBackup(dialogData.value.rowData.type)) {
                ElMessageBox.confirm(i18n.global.t('commons.msg.clean'), i18n.global.t('commons.button.clean'), {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                    type: 'warning',
                }).then(async () => {
                    await rpc.cronjob
                        .cleanCronjobRecords({
                            cronjobId: dialogData.value.rowData.id,
                            cleanData: cleanData.value,
                            cleanRemoteData: cleanRemoteData.value,
                        })
                        .then(() => {
                            delLoading.value = false;
                            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                            search(true);
                        })
                        .catch(() => {
                            delLoading.value = false;
                        });
                });
            } else {
                open.value = true;
            }
        };
        const onStop = async (id: number) => {
            ElMessageBox.confirm(i18n.global.t('cronjob.stopHelper'), i18n.global.t('cronjob.stop'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
                type: 'warning',
            }).then(async () => {
                await rpc.cronjob.stopCronjob({ id });
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            });
        };
        const cleanRecord = async () => {
            delLoading.value = true;
            await rpc.cronjob
                .cleanCronjobRecords({
                    cronjobId: dialogData.value.rowData.id,
                    cleanData: cleanData.value,
                    cleanRemoteData: cleanRemoteData.value,
                })
                .then(() => {
                    delLoading.value = false;
                    open.value = false;
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    search(true);
                })
                .catch(() => {
                    delLoading.value = false;
                });
        };
        ctx.expose({
            acceptParams,
        });
        return () =>
            unref(recordShow)
                ? withDirectives(
                      <div>
                          <div class={'app-status card-interval'}>
                              <ElCard>
                                  <div class={'flex w-full flex-col gap-4 md:flex-row'}>
                                      <div class={'ml-3 flex flex-wrap gap-4'}>
                                          {unref(dialogData).rowData.name.length >= 15 ? (
                                              <ElPopover
                                                  placement="top-start"
                                                  trigger={unref(hasFinePointer) ? 'hover' : 'click'}
                                                  width="250"
                                                  content={
                                                      $t('cronjob.' + unref(dialogData).rowData.type) +
                                                      ' - ' +
                                                      unref(dialogData).rowData.name
                                                  }
                                                  v-slots={{
                                                      reference: () => (
                                                          <>
                                                              <ElTag effect="dark" type="success" style={'float: left'}>
                                                                  {$t('cronjob.' + unref(dialogData).rowData.type)}
                                                                  {' - '}
                                                                  {unref(dialogData).rowData.name.substring(0, 12)}
                                                                  {'... '}
                                                              </ElTag>
                                                          </>
                                                      ),
                                                  }}
                                              />
                                          ) : null}
                                          {unref(dialogData).rowData.name.length < 15 ? (
                                              <ElTag effect="dark" type="success" class={'float-left'}>
                                                  {$t('cronjob.' + unref(dialogData).rowData.type)}
                                                  {' - '}
                                                  {unref(dialogData).rowData.name}
                                              </ElTag>
                                          ) : null}
                                          <Status status={unref(dialogData).rowData.status} class={'mt-0.5'} />
                                      </div>
                                      <div class={'mt-0.5'}>
                                          {withDirectives(
                                              <ElButton
                                                  type="primary"
                                                  disabled={unref(dialogData).rowData.status === 'Pending'}
                                                  onClick={($event?: any) => {
                                                      onHandle(unref(dialogData).rowData);
                                                  }}
                                                  link
                                              >
                                                  {$t('commons.button.handle')}
                                              </ElButton>,
                                              [
                                                  [permissionDirective, true],
                                                  [nodeAdminDirective, true],
                                              ],
                                          )}
                                          {unref(dialogData).rowData.status !== 'Pending' ? (
                                              <ElDivider direction="vertical" />
                                          ) : null}
                                          {unref(dialogData).rowData.status === 'Enable'
                                              ? withDirectives(
                                                    <ElButton
                                                        type="primary"
                                                        onClick={($event?: any) => {
                                                            onChangeStatus(unref(dialogData).rowData.id, 'disable');
                                                        }}
                                                        link
                                                    >
                                                        {$t('commons.button.disable')}
                                                    </ElButton>,
                                                    [
                                                        [permissionDirective, true],
                                                        [nodeAdminDirective, true],
                                                    ],
                                                )
                                              : null}
                                          {unref(dialogData).rowData.status === 'Disable'
                                              ? withDirectives(
                                                    <ElButton
                                                        type="primary"
                                                        onClick={($event?: any) => {
                                                            onChangeStatus(unref(dialogData).rowData.id, 'enable');
                                                        }}
                                                        link
                                                    >
                                                        {$t('commons.button.enable')}
                                                    </ElButton>,
                                                    [
                                                        [permissionDirective, true],
                                                        [nodeAdminDirective, true],
                                                    ],
                                                )
                                              : null}
                                          <ElDivider direction="vertical" />
                                          {withDirectives(
                                              <ElButton
                                                  disabled={!unref(hasRecords)}
                                                  type="primary"
                                                  onClick={($event?: any) => {
                                                      (onClean as any)($event);
                                                  }}
                                                  link
                                              >
                                                  {$t('commons.button.clean')}
                                              </ElButton>,
                                              [
                                                  [permissionDirective, true],
                                                  [nodeAdminDirective, true],
                                              ],
                                          )}
                                      </div>
                                  </div>
                              </ElCard>
                          </div>
                          <LayoutContent
                              title={$t('cronjob.record')}
                              reload={true}
                              v-slots={{
                                  rightToolBar: () => (
                                      <>
                                          <ElDatePicker
                                              onChange={($event?: any) => {
                                                  search(true);
                                              }}
                                              modelValue={unref(timeRangeLoad)}
                                              onUpdate:modelValue={($v) => {
                                                  timeRangeLoad.value = $v as any;
                                              }}
                                              type="datetimerange"
                                              range-separator="-"
                                              start-placeholder={$t('commons.search.timeStart')}
                                              end-placeholder={$t('commons.search.timeEnd')}
                                              shortcuts={shortcuts}
                                              class={'record-time-range mr-2.5'}
                                          />
                                          <ElSelect
                                              onChange={($event?: any) => {
                                                  search(true);
                                              }}
                                              modelValue={searchInfo.status}
                                              onUpdate:modelValue={($v) => {
                                                  searchInfo.status = $v as any;
                                              }}
                                              class={'p-w-200'}
                                              v-slots={{ prefix: () => <>{$t('commons.table.status')}</> }}
                                          >
                                              <ElOption label={$t('commons.table.all')} value />
                                              <ElOption label={$t('commons.status.success')} value="Success" />
                                              <ElOption label={$t('commons.status.waiting')} value="Waiting" />
                                              <ElOption label={$t('commons.status.unexecuted')} value="Unexecuted" />
                                              <ElOption label={$t('commons.status.failed')} value="Failed" />
                                          </ElSelect>
                                          <TableRefresh
                                              onSearch={($event?: any) => {
                                                  search(false);
                                              }}
                                          />
                                      </>
                                  ),
                                  main: () => (
                                      <>
                                          <div class={'mainClass'}>
                                              <ElRow
                                                  gutter={20}
                                                  class={'mainRowClass row-box'}
                                                  style={[{}, { display: unref(hasRecords) ? '' : 'none' }]}
                                              >
                                                  <ElCol span={7}>
                                                      <ElCard class={'el-card'}>
                                                          <div class={'infinite-list'} style={'overflow: auto'}>
                                                              <ComplexTable
                                                                  data={unref(records)}
                                                                  show-header={false}
                                                                  onRowClick={($event?: any) => {
                                                                      (forDetail as any)($event);
                                                                  }}
                                                                  style={'cursor: pointer'}
                                                              >
                                                                  <ElTableColumn
                                                                      min-width="230px"
                                                                      v-slots={{
                                                                          default: ({ row }) => (
                                                                              <>
                                                                                  {row.id ===
                                                                                  unref(currentRecord).id ? (
                                                                                      <span class={'select-sign'} />
                                                                                  ) : null}
                                                                                  <Status
                                                                                      status={row.status}
                                                                                      class={
                                                                                          'float-left mt-1 mr-2 ml-1 w-20'
                                                                                      }
                                                                                  />
                                                                                  <div class={'mt-0.5'}>
                                                                                      <span>{row.startTime}</span>
                                                                                  </div>
                                                                              </>
                                                                          ),
                                                                      }}
                                                                  />
                                                                  <ElTableColumn
                                                                      min-width="30px"
                                                                      v-slots={{
                                                                          default: ({ row }) => (
                                                                              <>
                                                                                  <ElTooltip
                                                                                      content={$t('cronjob.stop')}
                                                                                  >
                                                                                      {unref(dialogData).rowData
                                                                                          .type === 'shell' &&
                                                                                      row.status === 'Waiting' ? (
                                                                                          <ElButton
                                                                                              link
                                                                                              type="primary"
                                                                                              onClick={(
                                                                                                  $event?: any,
                                                                                              ) => {
                                                                                                  onStop(row.id);
                                                                                              }}
                                                                                              icon="SwitchButton"
                                                                                              class={'float-right'}
                                                                                          />
                                                                                      ) : null}
                                                                                  </ElTooltip>
                                                                              </>
                                                                          ),
                                                                      }}
                                                                  />
                                                              </ComplexTable>
                                                          </div>
                                                          <div class={'page-item'}>
                                                              <ElPagination
                                                                  page-size={searchInfo.pageSize}
                                                                  current-page={searchInfo.page}
                                                                  onCurrentChange={($event?: any) => {
                                                                      (handleCurrentChange as any)($event);
                                                                  }}
                                                                  onSizeChange={($event?: any) => {
                                                                      (handleSizeChange as any)($event);
                                                                  }}
                                                                  pager-count={5}
                                                                  page-sizes={[5, 10, 20, 50, 100, 200, 500, 1000]}
                                                                  small
                                                                  layout="total, sizes, prev, pager, next"
                                                                  total={searchInfo.recordTotal}
                                                              />
                                                          </div>
                                                      </ElCard>
                                                  </ElCol>
                                                  <ElCol span={17}>
                                                      <ElCard class={'el-card'}>
                                                          <ElForm label-position="top">
                                                              <ElRow type="flex" justify="center">
                                                                  <ElFormItem
                                                                      class={'descriptionWide'}
                                                                      v-slots={{
                                                                          label: () => (
                                                                              <>
                                                                                  <span class={'status-label'}>
                                                                                      {$t('commons.search.timeStart')}
                                                                                  </span>
                                                                              </>
                                                                          ),
                                                                      }}
                                                                  >
                                                                      <span class={'status-count'}>
                                                                          {dateFormat(
                                                                              0,
                                                                              0,
                                                                              unref(currentRecord)?.startTime,
                                                                          )}
                                                                      </span>
                                                                  </ElFormItem>
                                                                  <ElFormItem
                                                                      class={'description'}
                                                                      v-slots={{
                                                                          label: () => (
                                                                              <>
                                                                                  <span class={'status-label'}>
                                                                                      {$t('commons.table.interval')}
                                                                                  </span>
                                                                              </>
                                                                          ),
                                                                      }}
                                                                  >
                                                                      {unref(currentRecord)?.status === 'Waiting' &&
                                                                      !unref(currentRecord)?.interval ? (
                                                                          <ElButton link loading={true} />
                                                                      ) : (
                                                                          <span class={'status-count'}>
                                                                              {formatInterval(
                                                                                  unref(currentRecord)?.interval,
                                                                              )}
                                                                          </span>
                                                                      )}
                                                                  </ElFormItem>
                                                                  <ElFormItem
                                                                      class={'description'}
                                                                      v-slots={{
                                                                          label: () => (
                                                                              <>
                                                                                  <span class={'status-label'}>
                                                                                      {$t('commons.table.status')}
                                                                                  </span>
                                                                              </>
                                                                          ),
                                                                      }}
                                                                  >
                                                                      <Status status={unref(currentRecord)?.status} />
                                                                      <ElTooltip
                                                                          content={unref(currentRecord)?.message}
                                                                      >
                                                                          {unref(currentRecord)?.status === 'Failed' ||
                                                                          unref(currentRecord)?.status ===
                                                                              'Unexecuted' ? (
                                                                              <ElButton
                                                                                  type="danger"
                                                                                  icon="Warning"
                                                                                  link
                                                                                  class={'mt-0.5'}
                                                                              />
                                                                          ) : null}
                                                                      </ElTooltip>
                                                                  </ElFormItem>
                                                              </ElRow>
                                                              {unref(currentRecord)?.taskId &&
                                                              unref(currentRecord)?.taskId != '' ? (
                                                                  <ElRow>
                                                                      <LogFile
                                                                          defaultButton={true}
                                                                          onStopReading={($event?: any) => {
                                                                              search(false);
                                                                          }}
                                                                          heightDiff={420}
                                                                          config={{
                                                                              type: 'task',
                                                                              colorMode: 'task',
                                                                              taskID: unref(currentRecord)?.taskId,
                                                                              tail: true,
                                                                          }}
                                                                          class={'w-full'}
                                                                          key={unref(currentRecord)?.taskId}
                                                                      />
                                                                  </ElRow>
                                                              ) : null}
                                                          </ElForm>
                                                      </ElCard>
                                                  </ElCol>
                                              </ElRow>
                                          </div>
                                          <div
                                              class={'app-warn'}
                                              style={[{}, { display: !unref(hasRecords) ? '' : 'none' }]}
                                          >
                                              <div>
                                                  <span>{$t('cronjob.noRecord')}</span>
                                                  <div>
                                                      <img src={asset_no_app} />
                                                  </div>
                                              </div>
                                          </div>
                                      </>
                                  ),
                              }}
                          />
                          <DialogPro
                              modelValue={unref(open)}
                              onUpdate:modelValue={($v) => {
                                  open.value = $v as any;
                              }}
                              title={$t('commons.button.clean')}
                              size="small"
                              v-slots={{
                                  footer: () => (
                                      <>
                                          <span class={'dialog-footer'}>
                                              <ElButton
                                                  onClick={($event?: any) => {
                                                      open.value = false;
                                                  }}
                                                  disabled={unref(delLoading)}
                                              >
                                                  {$t('commons.button.cancel')}
                                              </ElButton>
                                              <ElButton
                                                  type="primary"
                                                  onClick={($event?: any) => {
                                                      (cleanRecord as any)($event);
                                                  }}
                                              >
                                                  {$t('commons.button.confirm')}
                                              </ElButton>
                                          </span>
                                      </>
                                  ),
                              }}
                          >
                              {withDirectives(
                                  <ElForm ref="deleteForm" label-position="left">
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
                                  </ElForm>,
                                  [[vLoading, unref(delLoading)]],
                              )}
                          </DialogPro>
                      </div>,
                      [[vLoading, unref(loading)]],
                  )
                : null;
    },
    options,
);
