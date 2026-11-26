import { $t } from '@/utils/i18n-t';
import { TABLE_OVERFLOW_TOOLTIP_OPTIONS } from '@/components/table/shared';
import { getAppIconUrl } from '@/api/modules/app';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { jumpToInstall } from '@/utils/app';
import { routerToName, routerToNameWithQuery } from '@/utils/router';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { isRemoteAppIcon } from '@/utils/app-icon';
import { rpc } from '@/lib/rpc';
import './index.styles.css';
import permissionDirective from '@/directives/modules/permission';
import CardWithHeader from '@/components/card-with-header/index';
import SvgIcon from '@/components/svg-icon/svg-icon';
import { ArrowDown } from '@element-plus/icons-vue';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'app',
    props: {},
    emits: emits,
    __scopeId: 'data-v-0de83fcd',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isMobile, isAdminOrNodeAdmin } = useGlobalStore();
        let loading = ref(false);
        let apps = ref([]);
        const options = ref([]);
        const filter = ref();
        const acceptParams = (): void => {
            search();
            loadOption();
        };
        const goInstall = (key: string, type: string) => {
            if (!jumpToInstall(type, key)) {
                routerToNameWithQuery('AppAll', { install: key });
            }
        };
        const search = async () => {
            loading.value = true;
            await rpc.dashboard
                .getAppLauncher({})
                .then((res) => {
                    loading.value = false;
                    apps.value = res.items.map((item) => {
                        // detailJson 可能为空或序列化成 "null"，JSON.parse 后不是数组，
                        // 直接取 detail[0] 会抛异常导致整页应用快捷入口消失。
                        let detail: any[] = [];
                        try {
                            const parsed = JSON.parse(item.detailJson || '[]');
                            if (Array.isArray(parsed)) detail = parsed;
                        } catch {
                            detail = [];
                        }
                        return { ...item, detail, currentRow: detail[0] };
                    });
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        const onChangeStatus = async (row: any) => {
            loading.value = true;
            await rpc.dashboard
                .setLauncherShow({ key: row.key, value: row.isShow ? 'Enable' : 'Disable' })
                .then(() => {
                    loading.value = false;
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    search();
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const onOperate = async (operation: string, row: any) => {
            ElMessageBox.confirm(
                i18n.global.t('app.operatorHelper', [i18n.global.t('commons.button.' + operation)]),
                i18n.global.t('commons.button.' + operation),
                {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                    type: 'info',
                },
            ).then(async () => {
                loading.value = true;
                await rpc.app
                    .operate({
                        installId: row.installID,
                        operate: operation,
                        detailId: row.detailID,
                    })
                    .then(() => {
                        loading.value = false;
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        search();
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            });
        };
        const loadOption = async () => {
            const res = await rpc.dashboard.getLauncherOptions({ filter: filter.value || '' });
            options.value = res.items || [];
        };
        const getAppIconSrc = (app: any) => {
            const icon = app?.icon || '';
            if (isRemoteAppIcon(icon) || icon.startsWith('app_') || icon === '') {
                return getAppIconUrl(app.key, undefined, icon);
            }
            return `data:image/png;base64,${icon}`;
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <div class={'app-launcher'}>
                {withDirectives(
                    <CardWithHeader
                        header={$t('app.app')}
                        fill
                        class={'card-interval'}
                        v-slots={{
                            'header-r': () => (
                                <>
                                    <ElPopover
                                        placement="left"
                                        width={226}
                                        trigger="click"
                                        v-slots={{
                                            reference: () => (
                                                <>
                                                    <ElButton
                                                        disabled={!unref(isAdminOrNodeAdmin)}
                                                        link
                                                        icon="Setting"
                                                        class={'h-button-setting'}
                                                    />
                                                </>
                                            ),
                                        }}
                                    >
                                        <ElInput
                                            size="small"
                                            modelValue={unref(filter)}
                                            onUpdate:modelValue={($v) => {
                                                filter.value = $v as any;
                                            }}
                                            clearable
                                            onInput={($event?: any) => {
                                                loadOption();
                                            }}
                                        />
                                        <ElTable
                                            tooltip-options={TABLE_OVERFLOW_TOOLTIP_OPTIONS}
                                            show-header={false}
                                            data={unref(options)}
                                            max-height="150px"
                                        >
                                            <ElTableColumn prop="key" width="120" show-overflow-tooltip />
                                            <ElTableColumn
                                                prop="name"
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>
                                                            <ElSwitch
                                                                onChange={($event?: any) => {
                                                                    onChangeStatus(row);
                                                                }}
                                                                size="small"
                                                                modelValue={row.isShow}
                                                                onUpdate:modelValue={($v) => {
                                                                    row.isShow = $v as any;
                                                                }}
                                                                class={'float-right'}
                                                            />
                                                        </>
                                                    ),
                                                }}
                                            />
                                        </ElTable>
                                    </ElPopover>
                                </>
                            ),
                            body: () => (
                                <>
                                    <ElScrollbar class={'app-scrollbar moz-height'}>
                                        {(unref(apps) || []).map((app, index) => (
                                            <div class={'h-app-card'} key={index}>
                                                <ElRow gutter={5}>
                                                    <ElCol span={5} class={'h-app-media-col'}>
                                                        <div class={'h-app-media'}>
                                                            <ElAvatar shape="square" size={55} src={getAppIconSrc(app)}>
                                                                <SvgIcon iconName="p-appstore" />
                                                            </ElAvatar>
                                                        </div>
                                                    </ElCol>
                                                    <ElCol span={16} class={'h-app-main-col'}>
                                                        {!app.currentRow ? (
                                                            <div class={'h-app-content'}>
                                                                <div class={'h-app-heading'}>
                                                                    <span class={'h-app-title'}>{app.name}</span>
                                                                    <SvgIcon iconName="p-huobao1" class={'svg-icon'} />
                                                                </div>
                                                                <div class={'h-app-desc'}>
                                                                    <span>{app.description}</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div class={'h-app-content'}>
                                                                <div class={'h-app-heading'}>
                                                                    <ElDropdown
                                                                        trigger="hover"
                                                                        v-slots={{
                                                                            dropdown: () => (
                                                                                <>
                                                                                    <ElDropdownMenu>
                                                                                        {(app.detail || []).map(
                                                                                            (detailItem, index2) => (
                                                                                                <ElDropdownItem
                                                                                                    onClick={(
                                                                                                        $event?: any,
                                                                                                    ) => {
                                                                                                        app.currentRow =
                                                                                                            detailItem;
                                                                                                    }}
                                                                                                    key={index2}
                                                                                                >
                                                                                                    {detailItem.name +
                                                                                                        ' - ' +
                                                                                                        detailItem.version}
                                                                                                </ElDropdownItem>
                                                                                            ),
                                                                                        )}
                                                                                    </ElDropdownMenu>
                                                                                </>
                                                                            ),
                                                                        }}
                                                                    >
                                                                        <ElButton
                                                                            type="primary"
                                                                            plain
                                                                            size="small"
                                                                            link
                                                                            class={'h-app-dropdown'}
                                                                        >
                                                                            {app.currentRow.name}
                                                                            <ElIcon class={'el-icon--right'}>
                                                                                <ArrowDown />
                                                                            </ElIcon>
                                                                        </ElButton>
                                                                    </ElDropdown>
                                                                </div>
                                                                <div class={'h-app-meta'}>
                                                                    <ElButton
                                                                        plain
                                                                        size="small"
                                                                        link
                                                                        class={'h-app-desc'}
                                                                    >
                                                                        {$t('app.version') +
                                                                            ': ' +
                                                                            app.currentRow.version}
                                                                    </ElButton>
                                                                </div>
                                                                <div class={'h-app-actions'}>
                                                                    {app.currentRow.status !== 'Running'
                                                                        ? withDirectives(
                                                                              <ElButton
                                                                                  size="small"
                                                                                  type="primary"
                                                                                  link
                                                                                  onClick={($event?: any) => {
                                                                                      onOperate(
                                                                                          'start',
                                                                                          app.currentRow,
                                                                                      );
                                                                                  }}
                                                                              >
                                                                                  {$t('commons.button.start')}
                                                                              </ElButton>,
                                                                              [[permissionDirective, 'app_manage']],
                                                                          )
                                                                        : withDirectives(
                                                                              <ElButton
                                                                                  size="small"
                                                                                  type="primary"
                                                                                  link
                                                                                  onClick={($event?: any) => {
                                                                                      onOperate('stop', app.currentRow);
                                                                                  }}
                                                                                  style={
                                                                                      unref(isMobile)
                                                                                          ? 'margin-left: -1px'
                                                                                          : ''
                                                                                  }
                                                                              >
                                                                                  {$t('commons.button.stop')}
                                                                              </ElButton>,
                                                                              [[permissionDirective, 'app_manage']],
                                                                          )}
                                                                    {withDirectives(
                                                                        <ElButton
                                                                            size="small"
                                                                            type="primary"
                                                                            link
                                                                            onClick={($event?: any) => {
                                                                                onOperate('restart', app.currentRow);
                                                                            }}
                                                                            style={
                                                                                unref(isMobile)
                                                                                    ? 'margin-left: -1px'
                                                                                    : ''
                                                                            }
                                                                        >
                                                                            {$t('commons.button.restart')}
                                                                        </ElButton>,
                                                                        [[permissionDirective, 'app_manage']],
                                                                    )}
                                                                    {withDirectives(
                                                                        <ElButton
                                                                            size="small"
                                                                            type="primary"
                                                                            link
                                                                            onClick={($event?: any) => {
                                                                                routerToName('AppInstalled');
                                                                            }}
                                                                            style={
                                                                                unref(isMobile)
                                                                                    ? 'margin-left: -1px'
                                                                                    : ''
                                                                            }
                                                                        >
                                                                            {$t('tabs.more')}
                                                                        </ElButton>,
                                                                        [[permissionDirective, 'app_manage']],
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </ElCol>
                                                    <ElCol span={3} class={'h-app-side-col'}>
                                                        {withDirectives(
                                                            <ElButton
                                                                type="primary"
                                                                plain
                                                                round
                                                                size="small"
                                                                disabled={
                                                                    app.limit == 1 &&
                                                                    app.detail &&
                                                                    app.detail.length !== 0
                                                                }
                                                                onClick={($event?: any) => {
                                                                    goInstall(app.key, app.type);
                                                                }}
                                                                class={'h-app-button'}
                                                            >
                                                                {$t('commons.button.install')}
                                                            </ElButton>,
                                                            [[permissionDirective, 'app_manage']],
                                                        )}
                                                    </ElCol>
                                                </ElRow>
                                            </div>
                                        ))}
                                    </ElScrollbar>
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
