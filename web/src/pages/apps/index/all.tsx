import { $t } from '@/utils/i18n-t';
import { useSearchState } from '@/utils/search-reset';
import { App } from '@/types/app';
import {
    syncCutomAppStore,
    getCurrentNodeCustomAppConfig,
    getLocalAppSyncConfig,
    dispatchLocalAppSync,
} from '@/api/modules/app';
import Install from '@/pages/apps/_components/detail/install/index';
import router from '@/routers';
import { MsgSuccess } from '@/utils/message';
import { newUUID } from '@/utils/id';
import Detail from '@/pages/apps/_components/detail/index';
import TaskLog from '@/components/log/task/index';
import bus from '@/global/bus';
import Tags from '@/pages/apps/_components/components/tag';
import DockerStatus from '@/pages/containers/_components/docker-status/index';
import NoApp from '@/pages/apps/_components/apps/no-app/index';
import AppCard from '@/pages/apps/_components/apps/app/index';
import MainDiv from '@/components/main-div/index';
import { jumpToInstall } from '@/utils/app';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { rpc } from '@/lib/rpc';
import '@/pages/apps/_components/apps/index.styles.css';
import permissionDirective from '@/directives/modules/permission';
import LayoutContent from '@/components/layout-content/index';
import TableSearch from '@/components/table/TableSearch';
import FuTablePagination from '@/components/table/TablePagination';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'AppAll',
    props: {},
    emits: emits,
    __scopeId: 'data-v-4baf8ce6',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isProductPro, isOffline, isMobile, isEnterprise, isMaster, isXpackOrEE, isAdmin } = useGlobalStore();
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 60,
            total: 0,
        });
        const req = reactive({
            name: '',
            tags: [],
            page: 1,
            pageSize: 60,
            resource: 'all',
            showCurrentArch: false,
        });
        useSearchState(
            'app-store/apps/index',
            {
                search: toRef(req, 'name'),
                page: toRef(paginationConfig, 'currentPage'),
                pageSize: toRef(paginationConfig, 'pageSize'),
            },
            { onRevisit: () => search(req) },
        );
        const apps = ref<App.AppItem[]>([]);
        const loading = ref(false);
        const canUpdate = ref(false);
        const syncing = ref(false);
        const installRef = ref();
        const installKey = ref('');
        const mainHeight = ref(0);
        const detailRef = ref();
        const taskLogRef = ref();
        const syncCustomAppstore = ref(false);
        const customAppStoreEnabled = ref(false);
        const isActive = ref(false);
        const isExist = ref(false);
        const noApp = ref(false);
        const autoSynced = ref(false);
        const refresh = () => {
            search(req);
        };
        const search = async (req: App.AppReq) => {
            loading.value = true;
            req.pageSize = paginationConfig.pageSize;
            req.page = paginationConfig.currentPage;

            const customReq = {
                page: req.page,
                pageSize: req.pageSize,
                tags: req.tags,
                name: req.name,
                resource: req.resource,
                showCurrentArch: req.showCurrentArch,
            };
            if (syncCustomAppstore.value && req.resource === 'remote') {
                customReq.resource = 'custom';
            }
            try {
                const res = await rpc.app.searchApps(customReq);
                apps.value = res.items;
                paginationConfig.total = Number(res.total);
                if (apps.value.length === 0) {
                    noApp.value = true;
                    // 首次访问应用商店且本地没有任何应用时，自动拉取一次远程应用列表。
                    // 只自动同步一次，避免空列表页面反复触发同步。
                    if (
                        !autoSynced.value &&
                        !syncing.value &&
                        !isOffline.value &&
                        !req.name &&
                        (req.resource === 'all' || req.resource === 'remote')
                    ) {
                        autoSynced.value = true;
                        sync();
                    }
                } else {
                    noApp.value = false;
                    autoSynced.value = true;
                }
            } finally {
                loading.value = false;
            }
        };
        const openInstall = (app: App.App) => {
            if (!jumpToInstall(app.type, app.key)) {
                const params = {
                    app: app,
                };
                installRef.value.acceptParams(params);
            }
        };
        const openDetail = (key: string) => {
            detailRef.value.acceptParams(key, 'install');
        };
        const openTaskLog = (taskID: string) => {
            taskLogRef.value.openWithTaskID(taskID);
        };
        const sync = async () => {
            syncing.value = true;
            const taskID = newUUID();
            const syncReq = {
                taskID: taskID,
            };
            try {
                let message = '';
                if ((isOffline.value && !isEnterprise.value) || (isProductPro.value && syncCustomAppstore.value)) {
                    const res = await syncCutomAppStore(syncReq);
                    message = res.message;
                } else {
                    const res = await rpc.app.syncAppsFromRemote({ taskId: taskID });
                    message = res.message;
                }
                if (message != '' && message != 'success') {
                    MsgSuccess(message);
                } else {
                    openTaskLog(taskID);
                }
                canUpdate.value = false;
                search(req);
            } finally {
                syncing.value = false;
            }
        };
        const syncLocal = async () => {
            const taskID = newUUID();
            const syncReq = {
                taskID: taskID,
            };
            syncing.value = true;
            try {
                const dispatch =
                    isMaster.value &&
                    isXpackOrEE.value &&
                    isAdmin.value &&
                    (await getLocalAppSyncConfig()).data.enabled;
                if (dispatch) {
                    await dispatchLocalAppSync(syncReq);
                    taskLogRef.value.openWithTaskID(taskID, true, 'local');
                } else {
                    await rpc.app.syncAppsFromLocal({ taskId: taskID });
                    openTaskLog(taskID);
                }
                canUpdate.value = false;
                search(req);
            } finally {
                syncing.value = false;
            }
        };
        const changeTag = (key: string) => {
            req.tags = [];
            if (key !== 'all') {
                req.tags = [key];
            }
            search(req);
        };
        const searchByName = () => {
            search(req);
        };
        onMounted(async () => {
            bus.on('refreshApp', () => {
                search(req);
            });
            if (router.currentRoute.value.query.install) {
                installKey.value = String(router.currentRoute.value.query.install);
                const params = {
                    app: {
                        key: installKey.value,
                    },
                };
                if (installKey.value !== 'vllm' || !jumpToInstall('', installKey.value)) {
                    installRef.value.acceptParams(params);
                }
            }
            search(req);
            if (isProductPro.value) {
                const res = await getCurrentNodeCustomAppConfig();
                if (res && res.data) {
                    customAppStoreEnabled.value = res.data.status === 'Enable';
                    syncCustomAppstore.value = customAppStoreEnabled.value;
                }
            } else {
                syncCustomAppstore.value = isOffline.value;
            }
            mainHeight.value = window.innerHeight - 380;
            window.onresize = () => {
                return (() => {
                    mainHeight.value = window.innerHeight - 380;
                })();
            };
        });
        return () => (
            <>
                <div>
                    <DockerStatus
                        isActive={unref(isActive)}
                        onUpdate:isActive={($v) => {
                            isActive.value = $v as any;
                        }}
                        isExist={unref(isExist)}
                        onUpdate:isExist={($v) => {
                            isExist.value = $v as any;
                        }}
                    />
                    {unref(isExist)
                        ? withDirectives(
                              <LayoutContent
                                  title={$t('app.app', 2)}
                                  class={{ mask: !unref(isActive) }}
                                  v-slots={{
                                      search: () => (
                                          <>
                                              <Tags
                                                  onChange={($event?: any) => {
                                                      (changeTag as any)($event);
                                                  }}
                                              />
                                          </>
                                      ),
                                      leftToolBar: () => (
                                          <>
                                              {withDirectives(
                                                  <ElButton
                                                      onClick={($event?: any) => {
                                                          (sync as any)($event);
                                                      }}
                                                      type="primary"
                                                      plain
                                                      disabled={unref(syncing)}
                                                  >
                                                      <span>
                                                          {unref(customAppStoreEnabled)
                                                              ? $t('app.syncCustomApp')
                                                              : $t('app.syncAppList')}
                                                      </span>
                                                  </ElButton>,
                                                  [[permissionDirective, true]],
                                              )}
                                              {withDirectives(
                                                  <ElButton
                                                      onClick={($event?: any) => {
                                                          (syncLocal as any)($event);
                                                      }}
                                                      type="primary"
                                                      plain
                                                      disabled={unref(syncing)}
                                                      class={'ml-2'}
                                                  >
                                                      {$t('app.syncLocalApp')}
                                                  </ElButton>,
                                                  [[permissionDirective, true]],
                                              )}
                                          </>
                                      ),
                                      rightToolBar: () => (
                                          <>
                                              <ElCheckbox
                                                  modelValue={req.showCurrentArch}
                                                  onUpdate:modelValue={($v) => {
                                                      req.showCurrentArch = $v as any;
                                                  }}
                                                  onChange={($event?: any) => {
                                                      search(req);
                                                  }}
                                                  class={'!mr-2.5'}
                                              >
                                                  {$t('app.showCurrentArch')}
                                              </ElCheckbox>
                                              <ElCheckbox
                                                  modelValue={req.resource}
                                                  onUpdate:modelValue={($v) => {
                                                      req.resource = $v as any;
                                                  }}
                                                  true-value="all"
                                                  false-value="remote"
                                                  onChange={($event?: any) => {
                                                      search(req);
                                                  }}
                                                  class={'!mr-2.5'}
                                              >
                                                  {$t('app.showLocal')}
                                              </ElCheckbox>
                                              <TableSearch
                                                  onSearch={($event?: any) => {
                                                      searchByName();
                                                  }}
                                                  searchName={req.name}
                                                  onUpdate:searchName={($v) => {
                                                      req.name = $v as any;
                                                  }}
                                              />
                                          </>
                                      ),
                                      main: () => (
                                          <>
                                              <div>
                                                  <MainDiv heightDiff={300}>
                                                      <ElAlert
                                                          type="info"
                                                          title={$t('app.appHelper')}
                                                          closable={false}
                                                      />
                                                      {unref(apps).length > 0 ? (
                                                          <ElRow gutter={5}>
                                                              {(unref(apps) || []).map((app, index) => (
                                                                  <ElCol
                                                                      xs={24}
                                                                      sm={12}
                                                                      md={8}
                                                                      lg={8}
                                                                      xl={6}
                                                                      class={'app-col-12'}
                                                                      key={index}
                                                                  >
                                                                      <AppCard
                                                                          app={app}
                                                                          onOpenInstall={($event?: any) => {
                                                                              (openInstall as any)($event);
                                                                          }}
                                                                          onOpenDetail={($event?: any) => {
                                                                              (openDetail as any)($event);
                                                                          }}
                                                                      />
                                                                  </ElCol>
                                                              ))}
                                                          </ElRow>
                                                      ) : null}
                                                      {unref(noApp) ? <NoApp /> : null}
                                                  </MainDiv>
                                                  <div class={'page-button'}>
                                                      <FuTablePagination
                                                          current-page={paginationConfig.currentPage}
                                                          onUpdate:current-page={($v) => {
                                                              paginationConfig.currentPage = $v as any;
                                                          }}
                                                          page-size={paginationConfig.pageSize}
                                                          onUpdate:page-size={($v) => {
                                                              paginationConfig.pageSize = $v as any;
                                                          }}
                                                          {...paginationConfig}
                                                          onChange={($event?: any) => {
                                                              search(req);
                                                          }}
                                                          page-sizes={[30, 60, 90]}
                                                          layout={
                                                              unref(isMobile)
                                                                  ? 'total, prev, pager, next'
                                                                  : 'total, sizes, prev, pager, next, jumper'
                                                          }
                                                      />
                                                  </div>
                                              </div>
                                          </>
                                      ),
                                  }}
                              />,
                              [[vLoading, unref(loading)]],
                          )
                        : null}
                </div>
                <Install ref={installRef} />
                <Detail ref={detailRef} />
                <TaskLog
                    ref={taskLogRef}
                    onClose={($event?: any) => {
                        (refresh as any)($event);
                    }}
                />
            </>
        );
    },
    options,
);

definePage({
    name: 'AppAll',
    props: true,
    meta: { activeMenu: '/apps', parent: 'menu.app', title: 'app.all', permission: 'app_view', hidden: true },
});
