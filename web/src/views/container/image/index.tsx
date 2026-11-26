import { $t } from '@/utils/i18n-t';
import { TABLE_TOOLTIP_OPTIONS } from '@/components/table/shared';
import { useSearchState } from '@/utils/search-reset';
import { dateFormat } from '@/utils/date';
import { newUUID } from '@/utils/id';
import { computeSize2 } from '@/utils/size';
import { Container } from '@/types/container';
import Pull from '@/views/container/image/pull/index';
import RemoteSearch from '@/views/container/image/remote/index';
import Tag from '@/views/container/image/tag/index';
import Push from '@/views/container/image/push/index';
import Save from '@/views/container/image/save/index';
import Load from '@/views/container/image/load/index';
import Build from '@/views/container/image/build/index';
import Delete from '@/views/container/image/delete/index';
import Prune from '@/views/container/image/prune/index';
import DockerStatus from '@/views/container/docker-status/index';
import CodemirrorDrawer from '@/components/codemirror-pro/drawer';
import TaskLog from '@/components/log/task/index';
import i18n from '@/lang';
import { rpc } from '@/lib/rpc';
import { MsgError, MsgSuccess } from '@/utils/message';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { toImageView } from '@/lib/rpc/container';
import './index.styles.css';
import permissionDirective from '@/directives/modules/permission';
import { cn } from '@/utils/cn';
import LayoutContent from '@/components/layout-content/index';
import TableSearch from '@/components/table/TableSearch';
import TableRefresh from '@/components/table/TableRefresh';
import TableSetting from '@/components/table/TableSetting';
import ComplexTable from '@/components/table/complex/ComplexTable';
import SvgIcon from '@/components/svg-icon/svg-icon';
import Status from '@/components/status/index';
import FuTableOperations from '@/components/table/TableOperations';
import DialogPro from '@/components/dialog-pro/index';
import OpDialog from '@/components/del-dialog/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'image',
    props: {},
    emits: emits,
    __scopeId: 'data-v-3b08cae1',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isMobile, currentNode, globalStore } = useGlobalStore();
        const route = useRoute();
        const router = useRouter();
        let pageActive = true;
        const taskLogRef = ref();
        const loading = ref(false);
        const opRef = ref();
        const data = ref();
        const names = ref();
        const repos = ref();
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 20,
            total: 0,
            name: '',
            orderBy: 'createdAt',
            order: 'null',
        });
        useSearchState(
            'container/image/index',
            {
                search: toRef(paginationConfig, 'name'),
                page: toRef(paginationConfig, 'currentPage'),
                pageSize: toRef(paginationConfig, 'pageSize'),
            },
            { onRevisit: () => search() },
        );
        const columns = ref([]);
        const isActive = ref(false);
        const isExist = ref(false);
        const myDetail = ref();
        const dialogPullRef = ref();
        const dialogTagRef = ref();
        const dialogPushRef = ref();
        const dialogLoadRef = ref();
        const dialogSaveRef = ref();
        const dialogBuildRef = ref();
        const dialogDeleteRef = ref();
        const dialogPruneRef = ref();
        const updateDialogVisible = ref(false);
        const updateTagOptions = ref<Array<string>>([]);
        const updateSelectedTags = ref<Array<string>>([]);
        const updateCheckAll = computed(
            () =>
                updateTagOptions.value.length > 0 && updateSelectedTags.value.length === updateTagOptions.value.length,
        );
        const updateIndeterminate = computed(
            () =>
                updateSelectedTags.value.length > 0 && updateSelectedTags.value.length < updateTagOptions.value.length,
        );
        const search = async (column?: any) => {
            if (!isActive.value || !isExist.value) {
                return;
            }
            paginationConfig.orderBy = column?.order ? column.prop : paginationConfig.orderBy;
            paginationConfig.order = column?.order ? column.order : paginationConfig.order;
            const params = {
                name: paginationConfig.name,
                page: paginationConfig.currentPage,
                pageSize: paginationConfig.pageSize,
                orderBy: paginationConfig.orderBy,
                order: paginationConfig.order,
            };
            loading.value = true;
            try {
                const res = await rpc.container.searchImages(params);
                data.value = (res.items || []).map((item) => toImageView(item));
                paginationConfig.total = Number(res.total);
            } finally {
                loading.value = false;
            }
        };
        let repoRequest: Promise<void> | undefined;
        let repoGeneration = 0;
        let pullGeneration = 0;
        const resetRepos = () => {
            repoGeneration++;
            pullGeneration++;
            repoRequest = undefined;
            repos.value = undefined;
        };
        watch(currentNode, resetRepos, { flush: 'sync' });
        onBeforeUnmount(() => {
            pageActive = false;
            resetRepos();
        });
        const loadRepos = () => {
            if (repoRequest) return repoRequest;
            const version = repoGeneration;
            repoRequest = rpc.container
                .listRepos({})
                .then((res) => {
                    if (version === repoGeneration) repos.value = (res.items || []) as any;
                })
                .finally(() => {
                    if (version === repoGeneration) repoRequest = undefined;
                });
            return repoRequest;
        };
        const onDelete = (row: Container.ImageInfo) => {
            names.value = [row.id.replaceAll('sha256:', '').substring(0, 12)];
            opRef.value.acceptParams({
                title: i18n.global.t('commons.button.delete'),
                names: names.value,
                msg: i18n.global.t('commons.msg.operatorHelper', [
                    i18n.global.t('container.image'),
                    i18n.global.t('commons.button.delete'),
                ]),
                api: null,
                params: null,
            });
        };
        const onSubmitDelete = async () => {
            loading.value = true;
            let taskID = newUUID();
            await rpc.container
                .removeImages({ names: names.value, taskId: taskID })
                .then(() => {
                    loading.value = false;
                    openTaskLog(taskID);
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const changePinned = (row: any, isPinned: boolean) => {
            let params = {
                id: row.id.replaceAll('sha256:', ''),
                type: 'image',
                detailType: '',
                isPinned: !row.isPinned,
                description: row.description || '',
            };
            if (isPinned) {
                params.isPinned = !row.isPinned;
            }
            rpc.agentSetting.saveDescription(params).then(() => {
                search();
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            });
        };
        const onInspect = async (id: string) => {
            const res = await rpc.container.inspect({ id: id, type: 'image' });
            let detailInfo = JSON.stringify(JSON.parse(res.content), null, 2);
            let param = {
                header: i18n.global.t('commons.button.view'),
                detailInfo: detailInfo,
                mode: 'json',
            };
            myDetail.value!.acceptParams(param);
        };
        const remoteSearchRef = ref();
        const onRemotePull = async (imageName: string) => {
            const version = ++pullGeneration;
            const node = currentNode.value;
            try {
                if (!repos.value) await loadRepos();
                if (
                    version !== pullGeneration ||
                    !pageActive ||
                    route.name !== 'Image' ||
                    node !== currentNode.value ||
                    !isActive.value ||
                    !isExist.value ||
                    !globalStore.hasPermission('container_manage')
                )
                    return;
                dialogPullRef.value!.acceptParams({ repos: repos.value, imageName });
            } catch {
                // The request interceptor displays errors.
            }
        };
        let openingPullQuery = false;
        const openRequestedPull = async () => {
            if (openingPullQuery || !pageActive || route.name !== 'Image' || route.query.pull === undefined) return;
            openingPullQuery = true;
            const imageName = route.query.pull;
            const requestPath = route.fullPath;
            const node = currentNode.value;
            const version = pullGeneration;
            const isCurrent = () =>
                pageActive && route.name === 'Image' && node === currentNode.value && version === pullGeneration;
            const query = { ...route.query };
            delete query.pull;
            try {
                const failure = await router.replace({ path: route.path, query, hash: route.hash });
                if (
                    failure ||
                    !isCurrent() ||
                    !globalStore.hasPermission('container_manage') ||
                    typeof imageName !== 'string' ||
                    !/^[a-zA-Z0-9][a-z:@A-Z0-9_/.-]{0,255}$/.test(imageName)
                )
                    return;
                const status = await rpc.container.getDockerStatus({});
                if (!isCurrent()) return;
                const needsSearch = !isActive.value || !isExist.value;
                isActive.value = status.isActive;
                isExist.value = status.isExist;
                if (!isActive.value || !isExist.value) return;
                if (needsSearch) void search();
                await onRemotePull(imageName);
            } catch {
                // Navigation and request errors use their existing handlers.
            } finally {
                openingPullQuery = false;
                if (
                    pageActive &&
                    route.name === 'Image' &&
                    route.query.pull !== undefined &&
                    (route.fullPath !== requestPath || node !== currentNode.value || version !== pullGeneration)
                )
                    void openRequestedPull();
            }
        };
        watch(
            () => route.fullPath,
            () => void openRequestedPull(),
            { immediate: true, flush: 'post' },
        );
        onActivated(() => {
            pageActive = true;
            void openRequestedPull();
        });
        onDeactivated(() => {
            pageActive = false;
            pullGeneration++;
        });
        const onOpenPull = () => {
            let params = {
                repos: repos.value,
            };
            dialogPullRef.value!.acceptParams(params);
        };
        const onOpenBuild = () => {
            dialogBuildRef.value!.acceptParams();
        };
        const onOpenPrune = () => {
            dialogPruneRef.value!.acceptParams();
        };
        const onOpenBuildCache = () => {
            ElMessageBox.confirm(
                i18n.global.t('container.delBuildCacheHelper'),
                i18n.global.t('container.cleanBuildCache'),
                {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                    type: 'info',
                },
            ).then(async () => {
                loading.value = true;
                let params = {
                    taskID: newUUID(),
                    pruneType: 'buildcache',
                    withTagAll: false,
                };
                await rpc.container
                    .prune(params)
                    .then(() => {
                        loading.value = false;
                        openTaskLog(params.taskID);
                        search();
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            });
        };
        const openTaskLog = (taskID: string) => {
            taskLogRef.value.openWithTaskID(taskID);
        };
        const onOpenLoad = () => {
            dialogLoadRef.value!.acceptParams();
        };
        const normalizeImageTags = (tags: string[]) => {
            return (tags || []).filter((tag) => tag && !tag.includes('<none>'));
        };
        const pullImageTags = async (tags: string[]) => {
            const taskID = newUUID();
            await rpc.container.pullImages({
                taskId: taskID,
                repoId: 0,
                imageName: tags,
            });
            openTaskLog(taskID);
        };
        const runUpdate = async (tags: string[]) => {
            const validTags = normalizeImageTags(tags);
            if (validTags.length === 0) {
                MsgError(i18n.global.t('container.imageUpdateTagEmpty'));
                return;
            }
            try {
                await ElMessageBox.confirm(
                    i18n.global.t('container.imageUpdateHelper'),
                    i18n.global.t('commons.button.update'),
                    {
                        confirmButtonText: i18n.global.t('commons.button.confirm'),
                        cancelButtonText: i18n.global.t('commons.button.cancel'),
                        type: 'info',
                    },
                );
            } catch {
                return;
            }
            await pullImageTags(validTags);
        };
        const onUpdate = async (row: Container.ImageInfo) => {
            const tags = normalizeImageTags(row.tags || []);
            if (tags.length === 0) {
                MsgError(i18n.global.t('container.imageUpdateTagEmpty'));
                return;
            }
            if (tags.length === 1) {
                await runUpdate(tags);
                return;
            }
            updateTagOptions.value = tags;
            updateSelectedTags.value = [...tags];
            updateDialogVisible.value = true;
        };
        const onUpdateCheckAllChange = (checked: boolean) => {
            updateSelectedTags.value = checked ? [...updateTagOptions.value] : [];
        };
        const handleUpdateDialogClose = () => {
            updateDialogVisible.value = false;
            updateTagOptions.value = [];
            updateSelectedTags.value = [];
        };
        const submitUpdateSelection = async () => {
            if (updateSelectedTags.value.length === 0) {
                MsgError(i18n.global.t('commons.msg.confirmNoNull', [i18n.global.t('container.tag')]));
                return;
            }
            const selected = [...updateSelectedTags.value];
            handleUpdateDialogClose();
            await runUpdate(selected);
        };
        const buttons = [
            {
                label: i18n.global.t('container.push'),
                permission: true,
                click: (row: Container.ImageInfo) => {
                    let params = {
                        repos: repos.value,
                        tags: row.tags,
                    };
                    dialogPushRef.value!.acceptParams(params);
                },
            },
            {
                label: i18n.global.t('container.export'),
                permission: true,
                click: (row: Container.ImageInfo) => {
                    let params = {
                        repos: repos.value,
                        tags: row.tags,
                    };
                    dialogSaveRef.value!.acceptParams(params);
                },
            },
            {
                label: i18n.global.t('commons.button.update'),
                permission: true,
                click: (row: Container.ImageInfo) => {
                    onUpdate(row);
                },
            },
            {
                label: i18n.global.t('container.tag'),
                permission: true,
                click: (row: Container.ImageInfo) => {
                    let params = {
                        repos: repos.value,
                        imageID: row.id,
                        tags: row.tags,
                    };
                    dialogTagRef.value!.acceptParams(params);
                },
            },
            {
                label: i18n.global.t('commons.button.delete'),
                permission: true,
                click: async (row: Container.ImageInfo) => {
                    if (row.tags && row.tags.length > 1) {
                        let params = {
                            id: row.id,
                            isUsed: row.isUsed,
                            tags: row.tags,
                        };
                        dialogDeleteRef.value!.acceptParams(params);
                    } else {
                        onDelete(row);
                    }
                },
            },
        ];
        return () =>
            withDirectives(
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
                        loading={unref(loading)}
                        onUpdate:loading={($v) => {
                            loading.value = $v as any;
                        }}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                        onMounted={($event?: any) => {
                            (loadRepos as any)($event);
                        }}
                    />
                    {unref(isExist) ? (
                        <LayoutContent
                            title={$t('container.image', 2)}
                            class={{ mask: !unref(isActive) }}
                            v-slots={{
                                leftToolBar: () => (
                                    <>
                                        {withDirectives(
                                            <ElButton
                                                type="primary"
                                                plain
                                                onClick={($event?: any) => {
                                                    (onOpenPull as any)($event);
                                                }}
                                            >
                                                {$t('container.imagePull')}
                                            </ElButton>,
                                            [[permissionDirective, true]],
                                        )}
                                        {withDirectives(
                                            <ElButton
                                                type="primary"
                                                plain
                                                onClick={($event?: any) => {
                                                    unref(remoteSearchRef).open();
                                                }}
                                            >
                                                {$t('container.imageRemoteSearch')}
                                            </ElButton>,
                                            [[permissionDirective, true]],
                                        )}
                                        {withDirectives(
                                            <ElButton
                                                type="primary"
                                                plain
                                                onClick={($event?: any) => {
                                                    (onOpenLoad as any)($event);
                                                }}
                                            >
                                                {$t('container.importImage')}
                                            </ElButton>,
                                            [[permissionDirective, true]],
                                        )}
                                        {withDirectives(
                                            <ElButton
                                                type="primary"
                                                plain
                                                onClick={($event?: any) => {
                                                    (onOpenBuild as any)($event);
                                                }}
                                            >
                                                {$t('container.imageBuild')}
                                            </ElButton>,
                                            [[permissionDirective, true]],
                                        )}
                                        {withDirectives(
                                            <ElButton
                                                type="primary"
                                                plain
                                                onClick={($event?: any) => {
                                                    onOpenBuildCache();
                                                }}
                                            >
                                                {$t('container.cleanBuildCache')}
                                            </ElButton>,
                                            [[permissionDirective, true]],
                                        )}
                                        {withDirectives(
                                            <ElButton
                                                type="primary"
                                                plain
                                                onClick={($event?: any) => {
                                                    onOpenPrune();
                                                }}
                                            >
                                                {$t('container.imagePrune')}
                                            </ElButton>,
                                            [[permissionDirective, true]],
                                        )}
                                    </>
                                ),
                                rightToolBar: () => (
                                    <>
                                        <TableSearch
                                            onSearch={($event?: any) => {
                                                search();
                                            }}
                                            searchName={paginationConfig.name}
                                            onUpdate:searchName={($v) => {
                                                paginationConfig.name = $v as any;
                                            }}
                                        />
                                        <TableRefresh
                                            onSearch={($event?: any) => {
                                                search();
                                            }}
                                        />
                                        <TableSetting
                                            title="image-refresh"
                                            onSearch={($event?: any) => {
                                                search();
                                            }}
                                        />
                                    </>
                                ),
                                main: () => (
                                    <>
                                        <ComplexTable
                                            cache-pagination={false}
                                            pagination-config={paginationConfig}
                                            data={unref(data)}
                                            onSortChange={($event?: any) => {
                                                (search as any)($event);
                                            }}
                                            columns={unref(columns)}
                                            onSearch={($event?: any) => {
                                                (search as any)($event);
                                            }}
                                            heightDiff={300}
                                        >
                                            <ElTableColumn
                                                label="ID"
                                                prop="id"
                                                width="180"
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>
                                                            <ElText
                                                                type="primary"
                                                                onClick={($event?: any) => {
                                                                    onInspect(row.id);
                                                                }}
                                                                class={'cursor-pointer'}
                                                            >
                                                                {row.id.replaceAll('sha256:', '').substring(0, 12)}
                                                            </ElText>
                                                            <div class={'float-right'}>
                                                                <ElTooltip
                                                                    {...TABLE_TOOLTIP_OPTIONS}
                                                                    content={
                                                                        row.isPinned
                                                                            ? $t('commons.table.unpin')
                                                                            : $t('commons.table.pin')
                                                                    }
                                                                >
                                                                    {withDirectives(
                                                                        <ElButton
                                                                            link
                                                                            size="large"
                                                                            type={row.isPinned ? 'warning' : 'info'}
                                                                            onClick={($event?: any) => {
                                                                                changePinned(row, true);
                                                                            }}
                                                                            class={cn('image-pin-button', {
                                                                                'is-pinned': row.isPinned,
                                                                            })}
                                                                        >
                                                                            <SvgIcon
                                                                                iconName="p-pushpin"
                                                                                className="image-pin-icon"
                                                                            />
                                                                        </ElButton>,
                                                                        [[permissionDirective, true]],
                                                                    )}
                                                                </ElTooltip>
                                                            </div>
                                                        </>
                                                    ),
                                                }}
                                            />
                                            <ElTableColumn
                                                label={$t('commons.table.status')}
                                                prop="isUsed"
                                                width="100"
                                                sortable="custom"
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>
                                                            <Status status={row.isUsed ? 'used' : 'unused'} />
                                                        </>
                                                    ),
                                                }}
                                            />
                                            <ElTableColumn
                                                label={$t('container.tag')}
                                                prop="tags"
                                                sortable="custom"
                                                min-width="160"
                                                width={unref(isMobile) ? 400 : 'auto'}
                                                fix
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>
                                                            {(row.tags || []).map((item, index) => (
                                                                <ElTag
                                                                    title={item}
                                                                    type="info"
                                                                    class={'ml-2.5'}
                                                                    key={index}
                                                                >
                                                                    {item}
                                                                </ElTag>
                                                            ))}
                                                        </>
                                                    ),
                                                }}
                                            />
                                            <ElTableColumn
                                                label={$t('container.size')}
                                                prop="size"
                                                min-width="60"
                                                fix
                                                sortable="custom"
                                                v-slots={{ default: ({ row }) => <>{computeSize2(row.size)}</> }}
                                            />
                                            <ElTableColumn
                                                sortable="custom"
                                                prop="createdAt"
                                                min-width="80"
                                                label={$t('commons.table.date')}
                                                formatter={dateFormat}
                                            />
                                            <FuTableOperations
                                                width="250px"
                                                ellipsis={2}
                                                buttons={buttons}
                                                label={$t('commons.table.operate')}
                                            />
                                        </ComplexTable>
                                    </>
                                ),
                            }}
                        />
                    ) : null}
                    <CodemirrorDrawer ref={myDetail} />
                    <DialogPro
                        modelValue={unref(updateDialogVisible)}
                        onUpdate:modelValue={($v) => {
                            updateDialogVisible.value = $v as any;
                        }}
                        title={$t('commons.button.update')}
                        onClose={($event?: any) => {
                            (handleUpdateDialogClose as any)($event);
                        }}
                        v-slots={{
                            footer: () => (
                                <>
                                    <span class={'dialog-footer'}>
                                        <ElButton
                                            onClick={($event?: any) => {
                                                (handleUpdateDialogClose as any)($event);
                                            }}
                                        >
                                            {$t('commons.button.cancel')}
                                        </ElButton>
                                        {withDirectives(
                                            <ElButton
                                                type="primary"
                                                onClick={($event?: any) => {
                                                    (submitUpdateSelection as any)($event);
                                                }}
                                            >
                                                {$t('commons.button.confirm')}
                                            </ElButton>,
                                            [[permissionDirective, true]],
                                        )}
                                    </span>
                                </>
                            ),
                        }}
                    >
                        <ElForm label-position="top">
                            <ElFormItem label={$t('container.tag')}>
                                <ElCheckbox
                                    model-value={unref(updateCheckAll)}
                                    indeterminate={unref(updateIndeterminate)}
                                    onChange={($event?: any) => {
                                        (onUpdateCheckAllChange as any)($event);
                                    }}
                                    class={'w-full'}
                                >
                                    {$t('commons.table.all')}
                                </ElCheckbox>
                                <ElCheckboxGroup
                                    modelValue={unref(updateSelectedTags)}
                                    onUpdate:modelValue={($v) => {
                                        updateSelectedTags.value = $v as any;
                                    }}
                                >
                                    {(unref(updateTagOptions) || []).map((tag) => (
                                        <ElCheckbox label={tag} key={tag}>
                                            {tag}
                                        </ElCheckbox>
                                    ))}
                                </ElCheckboxGroup>
                                <span class={'input-help'}>{$t('container.imageUpdateHelper')}</span>
                            </ElFormItem>
                        </ElForm>
                    </DialogPro>
                    <OpDialog
                        ref={opRef}
                        onSubmit={($event?: any) => {
                            (onSubmitDelete as any)($event);
                        }}
                    />
                    <Pull
                        ref={dialogPullRef}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    <RemoteSearch
                        ref={remoteSearchRef}
                        onPull={($event?: any) => {
                            (onRemotePull as any)($event);
                        }}
                    />
                    <Tag
                        ref={dialogTagRef}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    <Push
                        ref={dialogPushRef}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    <Save
                        ref={dialogSaveRef}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    <Load
                        ref={dialogLoadRef}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    <Build
                        ref={dialogBuildRef}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    <Delete
                        ref={dialogDeleteRef}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    <Prune
                        ref={dialogPruneRef}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    <TaskLog
                        ref={taskLogRef}
                        width="70%"
                        onClose={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                </div>,
                [[vLoading, unref(loading)]],
            );
    },
    options,
);
