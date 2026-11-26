import { $t } from '@/utils/i18n-t';
import asset_no_update_app from '@/assets/images/no_update_app.svg';
import { useSearchState } from '@/utils/search-reset';
import AppCard from '@/pages/apps/_components/installed/app/card';
import Backups from '@/components/backup/index';
import Uploads from '@/components/upload/index';
import AppResources from './check/index';
import AppDelete from './delete/index';
import AppParams from './detail/index';
import AppUpgrade from './upgrade/index';
import AppIgnore from './ignore/index';
import TaskLog from '@/components/log/task/index';
import Detail from '@/pages/apps/_components/detail/index';
import Tags from '@/pages/apps/_components/components/tag';
import MainDiv from '@/components/main-div/index';
import ComposeLogs from '@/components/log/compose/index';
import IgnoreApp from '@/pages/apps/_components/installed/ignore/create/index';
import TerminalDialog from '@/pages/containers/_components/container/terminal/index';
import Sortable from 'sortablejs';
import i18n from '@/lang';
import { rpc } from '@/lib/rpc';
import { App } from '@/types/app';
import { jumpToPath } from '@/utils/router';
import { MsgSuccess } from '@/utils/message';
import { routerToFileWithPath, routerToNameWithQuery } from '@/utils/router';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { useOperateNodeContext } from '@/composables/useOperateNodeContext';
import './index.styles.css';
import LayoutContent from '@/components/layout-content/index';
import TableSearch from '@/components/table/TableSearch';
import FuTablePagination from '@/components/table/TablePagination';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'installed',
    props: {},
    emits: emits,
    __scopeId: 'data-v-f866143a',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode, isMaster, currentNodeAddr, isIntl } = useGlobalStore();
        useOperateNodeContext(currentNode);
        const data = ref<any>();
        const loading = ref(false);
        const syncLoading = ref(false);
        const sortMode = ref(false);
        const sortContainer = ref();
        let sortableInstance: Sortable | null = null;
        let timer: NodeJS.Timer | null = null;
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 20,
            total: 0,
        });
        const open = ref(false);
        const operateReq = reactive({
            installId: 0,
            operate: '',
            detailId: 0,
            favorite: false,
        });
        const backupRef = ref();
        const uploadRef = ref();
        const checkRef = ref();
        const deleteRef = ref();
        const appParamRef = ref();
        const upgradeRef = ref();
        const ignoreRef = ref();
        const composeLogRef = ref();
        const dialogTerminalRef = ref();
        const taskLogRef = ref();
        const searchReq = reactive({
            page: 1,
            pageSize: 20,
            name: '',
            tags: [],
            update: false,
            sync: false,
        });
        useSearchState(
            'app-store/installed/index',
            {
                search: toRef(searchReq, 'name'),
                page: toRef(paginationConfig, 'currentPage'),
                pageSize: toRef(paginationConfig, 'pageSize'),
            },
            { onRevisit: () => search() },
        );
        const router = useRouter();
        const activeName = ref(i18n.global.t('app.installed'));
        const mode = ref('installed');
        const defaultLink = ref('');
        const detailRef = ref();
        const ignoreAppRef = ref();
        const openDetail = (key: string) => {
            detailRef.value.acceptParams(key, 'install');
        };
        const changeTag = (key: string) => {
            searchReq.tags = [];
            if (key !== 'all') {
                searchReq.tags = [key];
            }
            search();
        };
        const search = async () => {
            searchReq.page = paginationConfig.currentPage;
            searchReq.pageSize = paginationConfig.pageSize;

            const res = await rpc.app.searchInstalled(searchReq);
            data.value = res.items;
            paginationConfig.total = Number(res.total);
        };
        const sync = async () => {
            loading.value = true;
            const searchItem = {
                page: paginationConfig.currentPage,
                pageSize: paginationConfig.pageSize,
                name: searchReq.name,
                tags: searchReq.tags,
                update: false,
                sync: true,
            };
            const res = await rpc.app.searchInstalled(searchItem);
            loading.value = false;
            data.value = res.items;
            paginationConfig.total = Number(res.total);
        };
        const openOperate = async (row: any, op: string) => {
            operateReq.installId = row.id;
            operateReq.operate = op;
            if (op == 'upgrade') {
                upgradeRef.value.acceptParams(row, op);
            } else if (op == 'delete') {
                const res = await rpc.app.checkDeleteInstalled({ appInstallId: row.id });
                const items = res.items;
                if (items.length > 0) {
                    checkRef.value.acceptParams({ items: items, key: row.appKey, installID: row.id });
                } else {
                    deleteRef.value.acceptParams(row);
                }
            } else {
                onOperate(op);
            }
        };
        const favoriteInstall = (row: App.AppInstalled) => {
            operateReq.installId = row.id;
            operateReq.operate = 'favorite';
            operateReq.favorite = !row.favorite;
            operate();
        };
        const openIgnore = () => {
            ignoreRef.value.acceptParams();
        };
        const operate = async () => {
            open.value = false;
            loading.value = true;
            await rpc.app
                .operate({
                    installId: operateReq.installId,
                    operate: operateReq.operate,
                    detailId: operateReq.detailId,
                    favorite: operateReq.favorite,
                })
                .then(() => {
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    searchReq.sync = true;
                    search();
                    setTimeout(() => {
                        search();
                    }, 3000);
                    setTimeout(() => {
                        search();
                    }, 15000);
                })
                .catch(() => {
                    search();
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        const onOperate = async (operation: string) => {
            ElMessageBox.confirm(
                i18n.global.t('app.operatorHelper', [i18n.global.t('commons.operate.' + operation)]),
                i18n.global.t('commons.operate.' + operation),
                {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                    type: 'info',
                },
            ).then(() => {
                operate();
            });
        };
        const buttons = [
            {
                label: i18n.global.t('commons.operate.rebuild'),
                click: (row: any) => {
                    openOperate(row, 'rebuild');
                },
                permission: true,
                disabled: (row: any) => {
                    return (
                        row.status === 'DownloadErr' ||
                        row.status === 'Upgrading' ||
                        row.status === 'Rebuilding' ||
                        row.status === 'Uninstalling'
                    );
                },
            },
            {
                label: i18n.global.t('commons.operate.restart'),
                click: (row: any) => {
                    openOperate(row, 'restart');
                },
                permission: true,
                disabled: (row: any) => {
                    return (
                        row.status === 'DownloadErr' ||
                        row.status === 'Upgrading' ||
                        row.status === 'Rebuilding' ||
                        row.status === 'Uninstalling'
                    );
                },
            },
            {
                label: i18n.global.t('commons.operate.start'),
                click: (row: any) => {
                    openOperate(row, 'start');
                },
                permission: true,
                disabled: (row: any) => {
                    return (
                        row.status === 'Running' ||
                        row.status === 'Error' ||
                        row.status === 'DownloadErr' ||
                        row.status === 'Upgrading' ||
                        row.status === 'Rebuilding' ||
                        row.status === 'Uninstalling'
                    );
                },
            },
            {
                label: i18n.global.t('commons.operate.stop'),
                click: (row: any) => {
                    openOperate(row, 'stop');
                },
                permission: true,
                disabled: (row: any) => {
                    return (
                        row.status !== 'Running' ||
                        row.status === 'DownloadErr' ||
                        row.status === 'Upgrading' ||
                        row.status === 'Rebuilding' ||
                        row.status === 'Uninstalling'
                    );
                },
            },
            {
                label: i18n.global.t('commons.button.uninstall'),
                click: (row: any) => {
                    openOperate(row, 'delete');
                },
                permission: true,
            },
            {
                label: i18n.global.t('app.params'),
                click: (row: any) => {
                    openParam(row);
                },
                disabled: (row: any) => {
                    return (
                        row.status === 'DownloadErr' ||
                        row.status === 'Upgrading' ||
                        row.status === 'Rebuilding' ||
                        row.status === 'Uninstalling'
                    );
                },
            },
        ];
        const ignoreApp = (row: App.AppInstalled) => {
            ignoreAppRef.value.acceptParams(row);
        };
        const toContainer = async (row: App.AppInstalled) => {
            routerToNameWithQuery('ContainerItem', {
                filters: 'com.docker.compose.project=' + row.serviceName,
                uncached: 'true',
            });
        };
        const openBackups = (row: App.AppInstalled) => {
            let params = {
                type: 'app',
                name: row.appKey,
                detailName: row.name,
                status: row.status,
                appInstallID: row.id,
            };
            backupRef.value.acceptParams(params);
        };
        const openUploads = (key: string, name: string) => {
            let params = {
                type: 'app',
                name: key,
                detailName: name,
            };
            uploadRef.value.acceptParams(params);
        };
        const openParam = (row: any) => {
            appParamRef.value.acceptParams({ id: row.id });
        };
        const openLog = (row: any) => {
            switch (row.status) {
                case 'Installing':
                    taskLogRef.value.openWithResourceID('App', 'TaskInstall', row.id);
                    break;
                default:
                    composeLogRef.value.acceptParams({
                        compose: row.path + '/docker-compose.yml',
                        resource: row.name,
                        container: row.container,
                    });
            }
        };
        const openTerminal = (row: any) => {
            const title = i18n.global.t('app.app') + ' ' + row.name;
            dialogTerminalRef.value!.acceptParams({ containerID: row.container, title: title });
        };
        const enterSortMode = async () => {
            sortMode.value = true;
            clearInterval(Number(timer));
            timer = null;
            const res = await rpc.app.searchInstalled({ page: 1, pageSize: 10000, name: '', tags: [], update: false });
            data.value = res.items;
            await nextTick();
            const el = sortContainer.value?.$el;
            if (el) {
                const favCount = data.value.filter((i: any) => i.favorite).length;
                sortableInstance = Sortable.create(el, {
                    animation: 150,
                    ghostClass: 'sortable-ghost',
                    onMove: (evt: any) => {
                        const from = evt.dragged.dataset.sortIndex;
                        const to = evt.related.dataset.sortIndex;
                        const fromFav = Number(from) < favCount;
                        const toFav = Number(to) < favCount;
                        return fromFav === toFav;
                    },
                    onEnd: (evt: any) => {
                        const el = evt.from;
                        el.removeChild(evt.item);
                        el.insertBefore(evt.item, el.children[evt.oldIndex] || null);

                        const list = [...data.value];
                        const [moved] = list.splice(evt.oldIndex, 1);
                        list.splice(evt.newIndex, 0, moved);
                        data.value = list;
                    },
                });
            }
        };
        const saveSortOrder = async () => {
            if (!data.value) return;
            let favIdx = 0;
            let normalIdx = 0;
            const items = data.value.map((item: any) => ({
                installId: item.id as number,
                sortOrder: item.favorite ? favIdx++ : normalIdx++,
            }));
            await rpc.app.updateInstalledSort({ items });
            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            exitSortMode();
        };
        const exitSortMode = () => {
            if (sortableInstance) {
                sortableInstance.destroy();
                sortableInstance = null;
            }
            sortMode.value = false;
            search();
            timer = setInterval(() => {
                search();
            }, 1000 * 30);
        };
        const getConfig = async () => {
            try {
                const res = await rpc.agentSetting.getInfo({});
                if (res.systemIp) {
                    defaultLink.value = res.systemIp;
                    return;
                }
                if (!isMaster.value || currentNodeAddr.value != '127.0.0.1') {
                    defaultLink.value = currentNodeAddr.value;
                }
            } catch (error) {}
        };
        onMounted(() => {
            getConfig();
            const path = router.currentRoute.value.path;
            if (path == '/apps/upgrade') {
                activeName.value = i18n.global.t('app.canUpgrade');
                mode.value = 'upgrade';
                searchReq.update = true;
            }
            loading.value = true;
            search();
            loading.value = false;
            setTimeout(() => {
                searchReq.sync = true;
                search();
            }, 1000);
            timer = setInterval(() => {
                search();
            }, 1000 * 30);
        });
        onUnmounted(() => {
            clearInterval(Number(timer));
            timer = null;
        });
        return () => (
            <>
                {
                    <LayoutContent
                        title={unref(activeName)}
                        v-slots={{
                            search: () => (
                                <>
                                    <Tags
                                        onChange={($event?: any) => {
                                            (changeTag as any)($event);
                                        }}
                                        hideKey="Runtime"
                                    />
                                </>
                            ),
                            leftToolBar: () => (
                                <>
                                    {unref(mode) === 'installed' && !unref(sortMode) && unref(data) != null ? (
                                        <ElButton
                                            onClick={($event?: any) => {
                                                (sync as any)($event);
                                            }}
                                            type="primary"
                                            plain
                                        >
                                            {$t('commons.button.refresh')}
                                        </ElButton>
                                    ) : null}
                                    {unref(mode) === 'installed' && !unref(sortMode) && unref(data) != null ? (
                                        <ElButton
                                            onClick={($event?: any) => {
                                                (enterSortMode as any)($event);
                                            }}
                                            type="primary"
                                            plain
                                            v-permission={true}
                                        >
                                            {$t('app.sortMode')}
                                        </ElButton>
                                    ) : null}
                                    {unref(sortMode) ? (
                                        <ElButton
                                            onClick={($event?: any) => {
                                                (saveSortOrder as any)($event);
                                            }}
                                            type="primary"
                                        >
                                            {$t('commons.button.confirm')}
                                        </ElButton>
                                    ) : null}
                                    {unref(sortMode) ? (
                                        <ElButton
                                            onClick={($event?: any) => {
                                                (exitSortMode as any)($event);
                                            }}
                                            plain
                                        >
                                            {$t('commons.button.cancel')}
                                        </ElButton>
                                    ) : null}
                                    {unref(mode) === 'upgrade' ? (
                                        <ElButton
                                            onClick={($event?: any) => {
                                                (openIgnore as any)($event);
                                            }}
                                            type="primary"
                                            plain
                                        >
                                            {$t('app.showIgnore')}
                                        </ElButton>
                                    ) : null}
                                </>
                            ),
                            rightToolBar: () => (
                                <>
                                    <TableSearch
                                        onSearch={($event?: any) => {
                                            search();
                                        }}
                                        searchName={searchReq.name}
                                        onUpdate:searchName={($v) => {
                                            searchReq.name = $v as any;
                                        }}
                                    />
                                </>
                            ),
                            main: () => (
                                <>
                                    <div>
                                        <MainDiv heightDiff={unref(mode) === 'upgrade' ? 280 : 300}>
                                            {unref(mode) === 'installed' && !unref(isIntl) ? (
                                                <ElAlert
                                                    type="info"
                                                    closable={false}
                                                    class={'app-install-alert'}
                                                    v-slots={{
                                                        title: () => (
                                                            <>
                                                                <span class={'flx-align-center app-install-helper'}>
                                                                    <span class={'app-install-helper-text'}>
                                                                        {$t('app.installHelper')}
                                                                    </span>
                                                                    <ElLink
                                                                        icon="Position"
                                                                        onClick={($event?: any) => {
                                                                            jumpToPath(
                                                                                unref(router),
                                                                                '/containers/setting',
                                                                            );
                                                                        }}
                                                                        type="primary"
                                                                        class={'app-install-helper-link'}
                                                                    >
                                                                        {$t('firewall.quickJump')}
                                                                    </ElLink>
                                                                </span>
                                                            </>
                                                        ),
                                                    }}
                                                />
                                            ) : null}
                                            {unref(data) === null ? (
                                                <div class={'update-prompt'}>
                                                    <span>
                                                        {unref(mode) === 'upgrade'
                                                            ? $t('app.updatePrompt')
                                                            : $t('app.installPrompt')}
                                                    </span>
                                                    <div>
                                                        <img src={asset_no_update_app} />
                                                    </div>
                                                </div>
                                            ) : null}
                                            <ElRow gutter={5} ref={sortContainer}>
                                                {(unref(data) || []).map((installed, index) => (
                                                    <ElCol
                                                        data-sort-index={index}
                                                        xs={24}
                                                        sm={24}
                                                        md={24}
                                                        lg={12}
                                                        xl={12}
                                                        key={installed.id}
                                                    >
                                                        <AppCard
                                                            installed={installed}
                                                            mode={unref(mode)}
                                                            defaultLink={unref(defaultLink)}
                                                            currentNode={unref(currentNode)}
                                                            sortMode={unref(sortMode)}
                                                            onOpenDetail={($event?: any) => {
                                                                openDetail(installed.appKey);
                                                            }}
                                                            onOpenBackups={($event?: any) => {
                                                                openBackups(installed);
                                                            }}
                                                            onOpenLog={($event?: any) => {
                                                                openLog(installed);
                                                            }}
                                                            onOpenTerminal={($event?: any) => {
                                                                openTerminal(installed);
                                                            }}
                                                            onOpenOperate={($event?: any) => {
                                                                openOperate(installed, 'upgrade');
                                                            }}
                                                            onFavoriteInstall={($event?: any) => {
                                                                favoriteInstall(installed);
                                                            }}
                                                            onToFolder={($event?: any) => {
                                                                routerToFileWithPath(installed.path);
                                                            }}
                                                            onOpenUploads={($event?: any) => {
                                                                openUploads(installed.appKey, installed.name);
                                                            }}
                                                            onJumpToPath={($event?: any) => {
                                                                jumpToPath(unref(router), '/settings/panel');
                                                            }}
                                                            onToContainer={($event?: any) => {
                                                                toContainer(installed);
                                                            }}
                                                            onIgnoreApp={($event?: any) => {
                                                                ignoreApp(installed);
                                                            }}
                                                            v-slots={{
                                                                buttons: () => (
                                                                    <>
                                                                        {unref(mode) === 'installed' &&
                                                                        installed.status != 'Installing' ? (
                                                                            <div
                                                                                class={
                                                                                    'd-button flex flex-wrap items-center justify-start gap-1.5'
                                                                                }
                                                                            >
                                                                                {(buttons || []).map((button, key) => (
                                                                                    <>
                                                                                        {
                                                                                            <ElButton
                                                                                                type={
                                                                                                    button.disabled &&
                                                                                                    button.disabled(
                                                                                                        installed,
                                                                                                    )
                                                                                                        ? 'info'
                                                                                                        : ''
                                                                                                }
                                                                                                plain
                                                                                                round
                                                                                                size="small"
                                                                                                onClick={(
                                                                                                    $event?: any,
                                                                                                ) => {
                                                                                                    button.click(
                                                                                                        installed,
                                                                                                    );
                                                                                                }}
                                                                                                disabled={
                                                                                                    button.disabled &&
                                                                                                    button.disabled(
                                                                                                        installed,
                                                                                                    )
                                                                                                }
                                                                                                class={'app-button'}
                                                                                                v-permission={true}
                                                                                            >
                                                                                                {button.label}
                                                                                            </ElButton>
                                                                                        }
                                                                                    </>
                                                                                ))}
                                                                            </div>
                                                                        ) : null}
                                                                    </>
                                                                ),
                                                            }}
                                                        />
                                                    </ElCol>
                                                ))}
                                            </ElRow>
                                        </MainDiv>
                                    </div>
                                    {unref(mode) === 'installed' && !unref(sortMode) ? (
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
                                                    (search as any)($event);
                                                }}
                                                layout={'total, sizes, prev, pager, next, jumper'}
                                            />
                                        </div>
                                    ) : null}
                                </>
                            ),
                        }}
                        v-loading={unref(loading) || unref(syncLoading)}
                    />
                }
                <Backups ref={backupRef} />
                <Uploads ref={uploadRef} />
                <AppResources
                    ref={checkRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <AppDelete
                    ref={deleteRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <AppParams
                    ref={appParamRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <AppUpgrade
                    ref={upgradeRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <AppIgnore
                    ref={ignoreRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <ComposeLogs ref={composeLogRef} />
                <TerminalDialog ref={dialogTerminalRef} />
                <TaskLog
                    ref={taskLogRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <Detail ref={detailRef} />
                <IgnoreApp
                    ref={ignoreAppRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
            </>
        );
    },
    options,
);
