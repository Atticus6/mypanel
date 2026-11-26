import { $t } from '@/utils/i18n-t';
import DockerStatus from '@/pages/views/container/docker-status/index';
import { rpc } from '@/lib/rpc';
import { computeSize2 } from '@/utils/size';
import { newUUID } from '@/utils/id';
import TaskLog from '@/components/log/task/index';
import { routerToName } from '@/utils/router';
import i18n from '@/lang';
import { useGlobalStore } from '@/composables/useGlobalStore';
import '@/pages/views/container/dashboard/index.styles.css';
import permissionDirective from '@/directives/modules/permission';
import CardWithHeader from '@/components/card-with-header/index';
import { Position } from '@element-plus/icons-vue';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'dashboard',
    props: {},
    emits: emits,
    __scopeId: 'data-v-901c1de7',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const taskLogRef = ref();
        const { isMobile } = useGlobalStore();
        const loading = ref();
        const usageLoading = ref(false);
        const isActive = ref(false);
        const isExist = ref(false);
        const countItem = reactive({
            created: 0,
            running: 0,
            paused: 0,
            restarting: 0,
            removing: 0,
            exited: 0,
            dead: 0,

            containerCount: 0,
            composeCount: 0,
            composeTemplateCount: 0,
            imageCount: 0,
            networkCount: 0,
            volumeCount: 0,
            repoCount: 0,

            containerUsage: 0,
            containerReclaimable: 0,
            imageUsage: 0,
            imageReclaimable: 0,
            volumeUsage: 0,
            volumeReclaimable: 0,
            buildCacheUsage: 0,
            buildCacheReclaimable: 0,

            mirrors: [],
            sockPath: '',
        });
        const search = () => {
            if (!isActive.value || !isExist.value) {
                return;
            }
            loadContainerCount();
            loadUsage();
            loadContainerSetting();
        };
        const loadContainerCount = async () => {
            await rpc.container.status({}).then((res) => {
                countItem.running = res.running;
                countItem.paused = res.paused;
                countItem.restarting = res.restarting;
                countItem.removing = res.removing;
                countItem.created = res.created;
                countItem.dead = res.dead;
                countItem.exited = res.exited;

                countItem.containerCount = res.containerCount;
                countItem.composeCount = res.composeCount;
                countItem.composeTemplateCount = res.composeTemplateCount;
                countItem.imageCount = res.imageCount;
                countItem.networkCount = res.networkCount;
                countItem.volumeCount = res.volumeCount;
                countItem.repoCount = res.repoCount;
            });
        };
        const loadUsage = async () => {
            usageLoading.value = true;
            await rpc.container
                .getContainerItemStats({ name: 'system' })
                .then((res) => {
                    countItem.containerUsage = Number(res.containerUsage);
                    countItem.containerReclaimable = Number(res.containerReclaimable);
                    countItem.imageUsage = Number(res.imageUsage);
                    countItem.imageReclaimable = Number(res.imageReclaimable);
                    countItem.volumeUsage = Number(res.volumeUsage);
                    countItem.volumeReclaimable = Number(res.volumeReclaimable);
                    countItem.buildCacheUsage = Number(res.buildCacheUsage);
                    countItem.buildCacheReclaimable = Number(res.buildCacheReclaimable);
                })
                .finally(() => {
                    usageLoading.value = false;
                });
        };
        const loadContainerSetting = async () => {
            const res = await rpc.container.getDaemonJson({});
            countItem.mirrors = res.registryMirrors || [];

            const settingRes = await rpc.agentSetting.getInfo({});
            countItem.sockPath = settingRes.dockerSockPath || 'unix:///var/run/docker.sock';
        };
        const onClean = async (type: string, withAll: boolean) => {
            let msg = '';
            switch (type) {
                case 'image':
                    msg = i18n.global.t('container.imageClean');
                    break;
                case 'container':
                    msg = i18n.global.t('container.containerClean');
                    break;
                case 'volume':
                    msg = i18n.global.t('container.volumePruneHelper');
                    break;
                case 'buildcache':
                    msg = i18n.global.t('container.delBuildCacheHelper');
                    break;
            }
            ElMessageBox.confirm(msg, i18n.global.t('container.clean'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
            }).then(async () => {
                loading.value = true;
                let params = {
                    taskID: newUUID(),
                    pruneType: type,
                    withTagAll: withAll,
                };
                await rpc.container
                    .prune(params)
                    .then(() => {
                        loading.value = false;
                        openTaskLog(params.taskID);
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            });
        };
        const openTaskLog = (taskID: string) => {
            taskLogRef.value.openWithTaskID(taskID);
        };
        onMounted(() => {
            search();
        });
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
                    />
                    {unref(isExist) ? (
                        <div class={{ mask: !unref(isActive) }}>
                            <CardWithHeader
                                header={$t('menu.container')}
                                class={'card-interval'}
                                v-slots={{
                                    body: () => (
                                        <>
                                            <span
                                                onClick={($event?: any) => {
                                                    routerToName('ContainerItem');
                                                }}
                                                class={'count'}
                                            >
                                                {countItem.containerCount}
                                            </span>
                                        </>
                                    ),
                                    'header-l': () => (
                                        <>
                                            {countItem.containerCount ? (
                                                <ElTag size="small" effect="plain" class={'ml-5'}>
                                                    {$t('commons.table.all')}
                                                    {' * '}
                                                    {countItem.containerCount}
                                                </ElTag>
                                            ) : null}
                                            {countItem.running ? (
                                                <ElTag size="small" effect="plain" class={'ml-2'}>
                                                    {$t('commons.status.running')}
                                                    {' * '}
                                                    {countItem.running}
                                                </ElTag>
                                            ) : null}
                                            {countItem.created ? (
                                                <ElTag size="small" effect="plain" class={'ml-2'}>
                                                    {$t('commons.status.created')}
                                                    {' * '}
                                                    {countItem.created}
                                                </ElTag>
                                            ) : null}
                                            {countItem.paused ? (
                                                <ElTag size="small" effect="plain" class={'ml-2'}>
                                                    {$t('commons.status.paused')}
                                                    {' * '}
                                                    {countItem.paused}
                                                </ElTag>
                                            ) : null}
                                            {countItem.restarting ? (
                                                <ElTag size="small" effect="plain" class={'ml-2'}>
                                                    {$t('commons.status.restarting')}
                                                    {' * '}
                                                    {countItem.restarting}
                                                </ElTag>
                                            ) : null}
                                            {countItem.removing ? (
                                                <ElTag size="small" effect="plain" class={'ml-2'}>
                                                    {$t('commons.status.removing')}
                                                    {' * '}
                                                    {countItem.removing}
                                                </ElTag>
                                            ) : null}
                                            {countItem.exited ? (
                                                <ElTag size="small" effect="plain" class={'ml-2'}>
                                                    {$t('commons.status.exited')}
                                                    {' * '}
                                                    {countItem.exited}
                                                </ElTag>
                                            ) : null}
                                            {countItem.dead ? (
                                                <ElTag size="small" effect="plain" class={'ml-2'}>
                                                    {$t('commons.status.dead')}
                                                    {' * '}
                                                    {countItem.dead}
                                                </ElTag>
                                            ) : null}
                                        </>
                                    ),
                                }}
                            />
                            <ElRow gutter={7} class={'card-interval container-stat-row'}>
                                <ElCol span={8} xs={24}>
                                    <CardWithHeader
                                        header={$t('container.compose')}
                                        v-slots={{
                                            body: () => (
                                                <>
                                                    <span
                                                        onClick={($event?: any) => {
                                                            routerToName('Compose');
                                                        }}
                                                        class={'count'}
                                                    >
                                                        {countItem.composeCount}
                                                    </span>
                                                </>
                                            ),
                                        }}
                                    />
                                </ElCol>
                                <ElCol span={8} xs={24}>
                                    <CardWithHeader
                                        header={$t('container.composeTemplate')}
                                        v-slots={{
                                            body: () => (
                                                <>
                                                    <span
                                                        onClick={($event?: any) => {
                                                            routerToName('ComposeTemplate');
                                                        }}
                                                        class={'count'}
                                                    >
                                                        {countItem.composeTemplateCount}
                                                    </span>
                                                </>
                                            ),
                                        }}
                                    />
                                </ElCol>
                                <ElCol span={8} xs={24}>
                                    <CardWithHeader
                                        header={$t('container.image')}
                                        v-slots={{
                                            body: () => (
                                                <>
                                                    <span
                                                        onClick={($event?: any) => {
                                                            routerToName('Image');
                                                        }}
                                                        class={'count'}
                                                    >
                                                        {countItem.imageCount}
                                                    </span>
                                                </>
                                            ),
                                        }}
                                    />
                                </ElCol>
                            </ElRow>
                            <ElRow gutter={7} class={'card-interval container-stat-row'}>
                                <ElCol span={8} xs={24}>
                                    <CardWithHeader
                                        header={$t('container.imageRepo')}
                                        v-slots={{
                                            body: () => (
                                                <>
                                                    <span
                                                        onClick={($event?: any) => {
                                                            routerToName('Repo');
                                                        }}
                                                        class={'count'}
                                                    >
                                                        {countItem.repoCount}
                                                    </span>
                                                </>
                                            ),
                                        }}
                                    />
                                </ElCol>
                                <ElCol span={8} xs={24}>
                                    <CardWithHeader
                                        header={$t('container.network')}
                                        v-slots={{
                                            body: () => (
                                                <>
                                                    <span
                                                        onClick={($event?: any) => {
                                                            routerToName('Network');
                                                        }}
                                                        class={'count'}
                                                    >
                                                        {countItem.networkCount}
                                                    </span>
                                                </>
                                            ),
                                        }}
                                    />
                                </ElCol>
                                <ElCol span={8} xs={24}>
                                    <CardWithHeader
                                        header={$t('container.volume')}
                                        v-slots={{
                                            body: () => (
                                                <>
                                                    <span
                                                        onClick={($event?: any) => {
                                                            routerToName('Volume');
                                                        }}
                                                        class={'count'}
                                                    >
                                                        {countItem.volumeCount}
                                                    </span>
                                                </>
                                            ),
                                        }}
                                    />
                                </ElCol>
                            </ElRow>
                            <CardWithHeader
                                header={$t('container.diskUsage')}
                                class={'card-interval'}
                                v-slots={{
                                    body: () => (
                                        <>
                                            {withDirectives(
                                                <ElDescriptions
                                                    direction="vertical"
                                                    align="center"
                                                    column={unref(isMobile) ? 2 : 4}
                                                    label-width={unref(isMobile) ? '50%' : '25%'}
                                                    class={'mt-2'}
                                                >
                                                    <ElDescriptionsItem align="center" label={$t('container.image')}>
                                                        {$t('container.usage', [
                                                            computeSize2(countItem.imageUsage),
                                                            computeSize2(countItem.imageReclaimable),
                                                        ])}
                                                        {countItem.imageReclaimable
                                                            ? withDirectives(
                                                                  <ElButton
                                                                      onClick={($event?: any) => {
                                                                          onClean('image', true);
                                                                      }}
                                                                      link
                                                                      type="primary"
                                                                      class={'-mt-0.5'}
                                                                  >
                                                                      {$t('container.clean')}
                                                                  </ElButton>,
                                                                  [[permissionDirective, true]],
                                                              )
                                                            : null}
                                                    </ElDescriptionsItem>
                                                    <ElDescriptionsItem align="center" label={$t('menu.container')}>
                                                        {$t('container.usage', [
                                                            computeSize2(countItem.containerUsage),
                                                            computeSize2(countItem.containerReclaimable),
                                                        ])}
                                                        {countItem.containerReclaimable
                                                            ? withDirectives(
                                                                  <ElButton
                                                                      onClick={($event?: any) => {
                                                                          onClean('container', false);
                                                                      }}
                                                                      link
                                                                      type="primary"
                                                                      class={'-mt-0.5'}
                                                                  >
                                                                      {$t('container.clean')}
                                                                  </ElButton>,
                                                                  [[permissionDirective, true]],
                                                              )
                                                            : null}
                                                    </ElDescriptionsItem>
                                                    <ElDescriptionsItem
                                                        align="center"
                                                        label={$t('container.localVolume')}
                                                    >
                                                        {$t('container.usage', [
                                                            computeSize2(countItem.volumeUsage),
                                                            computeSize2(countItem.volumeReclaimable),
                                                        ])}
                                                        {countItem.volumeReclaimable
                                                            ? withDirectives(
                                                                  <ElButton
                                                                      onClick={($event?: any) => {
                                                                          onClean('volume', false);
                                                                      }}
                                                                      link
                                                                      type="primary"
                                                                      class={'-mt-0.5'}
                                                                  >
                                                                      {$t('container.clean')}
                                                                  </ElButton>,
                                                                  [[permissionDirective, true]],
                                                              )
                                                            : null}
                                                    </ElDescriptionsItem>
                                                    <ElDescriptionsItem
                                                        align="center"
                                                        label={$t('container.buildCache')}
                                                    >
                                                        {$t('container.usage', [
                                                            computeSize2(countItem.buildCacheUsage),
                                                            computeSize2(countItem.buildCacheUsage),
                                                        ])}
                                                        {countItem.buildCacheUsage
                                                            ? withDirectives(
                                                                  <ElButton
                                                                      onClick={($event?: any) => {
                                                                          onClean('buildcache', false);
                                                                      }}
                                                                      link
                                                                      type="primary"
                                                                      class={'-mt-0.5'}
                                                                  >
                                                                      {$t('container.clean')}
                                                                  </ElButton>,
                                                                  [[permissionDirective, true]],
                                                              )
                                                            : null}
                                                    </ElDescriptionsItem>
                                                </ElDescriptions>,
                                                [[vLoading, unref(usageLoading)]],
                                            )}
                                        </>
                                    ),
                                }}
                            />
                            <CardWithHeader
                                header={$t('container.setting')}
                                class={'card-interval'}
                                v-slots={{
                                    body: () => (
                                        <>
                                            <ElDescriptions column={1} border>
                                                <ElDescriptionsItem label-width="200" label={$t('container.sockPath')}>
                                                    {countItem.sockPath}
                                                </ElDescriptionsItem>
                                                <ElDescriptionsItem label={$t('container.mirrors')}>
                                                    {(countItem.mirrors || []).map((item) => (
                                                        <div value={item} label={item} key={item}>
                                                            <div class={'mt-1'}>
                                                                <ElTag>{item}</ElTag>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </ElDescriptionsItem>
                                            </ElDescriptions>
                                            <ElButton
                                                type="primary"
                                                link
                                                onClick={($event?: any) => {
                                                    routerToName('ContainerSetting');
                                                }}
                                                class={'mt-2'}
                                            >
                                                <ElIcon class={'mr-1'}>
                                                    <Position />
                                                </ElIcon>
                                                {$t('container.goSetting')}
                                            </ElButton>
                                        </>
                                    ),
                                }}
                            />
                        </div>
                    ) : null}
                    <TaskLog
                        ref={taskLogRef}
                        width="70%"
                        onClose={($event?: any) => {
                            (loadUsage as any)($event);
                        }}
                    />
                </div>,
                [[vLoading, unref(loading)]],
            );
    },
    options,
);

definePage({
    name: 'ContainerDashboard',
    props: true,
    meta: {
        activeMenu: '/containers',
        permission: 'container_view',
        parent: 'menu.container',
        title: 'menu.home',
        hidden: true,
    },
});
