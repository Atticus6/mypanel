import { $t } from '@/utils/i18n-t';
import { App } from '@/types/app';
import { useGlobalStore } from '@/composables/useGlobalStore';
interface Props {
    installed: App.AppInstalled;
    mode: string;
    sortMode?: boolean;
}
import './header.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import permissionDirective from '@/directives/modules/permission';
import { ElTooltip } from 'element-plus';
import { ElPopover } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElIcon } from 'element-plus';
import Status from '@/components/status/index';
import { Warning } from '@element-plus/icons-vue';
import { Tickets } from '@element-plus/icons-vue';
import SvgIcon from '@/components/svg-icon/svg-icon';

interface CodemodProps {
    [key: string]: any;
    installed?: App.AppInstalled;
    mode?: string;
    sortMode?: boolean;
}

const emits = {
    toFolder: (...args: unknown[]) => true,
    openLog: (...args: unknown[]) => true,
    openTerminal: (...args: unknown[]) => true,
    toContainer: (...args: unknown[]) => true,
    openBackups: (...args: unknown[]) => true,
    openOperate: (...args: unknown[]) => true,
    ignoreApp: (...args: unknown[]) => true,
    openUploads: (...args: unknown[]) => true,
    favoriteInstall: (...args: unknown[]) => true,
};

const options = {
    name: 'header',
    props: {
        installed: { type: null },
        mode: String,
        sortMode: Boolean,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-afaf0aa9',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isAdminOrNodeAdmin } = useGlobalStore();
        const options = {
            modifiers: [
                {
                    name: 'flip',
                    options: {
                        padding: 5,
                        fallbackPlacements: ['bottom-start', 'top-start', 'right', 'left'],
                    },
                },
            ],
        };
        const isAppErr = (row: any) => {
            return row.status.includes('Err') || row.status.includes('Error') || row.status.includes('UnHealthy');
        };
        return () => (
            <div class={'d-name'}>
                <div class={'d-name-row flex items-center justify-between'}>
                    <div class={'name-actions flex items-center justify-start gap-1'}>
                        <div class={'name-wrap'}>
                            <ElTooltip content={__panelSetupProps.installed.name} placement="top">
                                <span class={'name'}>{__panelSetupProps.installed.name}</span>
                            </ElTooltip>
                        </div>
                        <span class={'status'}>
                            <Status
                                status={__panelSetupProps.installed.status}
                                key={__panelSetupProps.installed.status}
                            />
                        </span>
                        <span class={'msg'}>
                            {isAppErr(__panelSetupProps.installed) ? (
                                <ElPopover
                                    placement="bottom"
                                    width={400}
                                    trigger="hover"
                                    content={__panelSetupProps.installed.message}
                                    popper-options={options}
                                    v-slots={{
                                        reference: () => (
                                            <>
                                                <ElButton link type="danger">
                                                    <ElIcon>
                                                        <Warning />
                                                    </ElIcon>
                                                </ElButton>
                                            </>
                                        ),
                                    }}
                                >
                                    <div class={'app-error'}>{__panelSetupProps.installed.message}</div>
                                </ElPopover>
                            ) : null}
                        </span>
                        <span class={'ml-1'}>
                            <ElTooltip effect="dark" content={$t('app.toFolder')} placement="top">
                                {withDirectives(
                                    <ElButton
                                        type="primary"
                                        link
                                        onClick={($event?: any) => {
                                            ctx.emit('toFolder');
                                        }}
                                        icon="FolderOpened"
                                    />,
                                    [[permissionDirective, 'host_file_view']],
                                )}
                            </ElTooltip>
                        </span>
                        <span class={'ml-1'}>
                            {__panelSetupProps.mode !== 'upgrade' ? (
                                <ElTooltip effect="dark" content={$t('commons.button.log')} placement="top">
                                    <ElButton
                                        type="primary"
                                        link
                                        onClick={($event?: any) => {
                                            ctx.emit('openLog');
                                        }}
                                        disabled={__panelSetupProps.installed.status === 'DownloadErr'}
                                    >
                                        <ElIcon>
                                            <Tickets />
                                        </ElIcon>
                                    </ElButton>
                                </ElTooltip>
                            ) : null}
                        </span>
                        <span class={'ml-1'}>
                            {__panelSetupProps.mode !== 'upgrade' ? (
                                <ElTooltip effect="dark" content={$t('menu.terminal')} placement="top">
                                    <ElButton
                                        type="primary"
                                        link
                                        onClick={($event?: any) => {
                                            ctx.emit('openTerminal');
                                        }}
                                        disabled={
                                            __panelSetupProps.installed.status !== 'Running' ||
                                            !unref(isAdminOrNodeAdmin)
                                        }
                                    >
                                        <ElIcon>
                                            <SvgIcon iconName="p-terminal2" />
                                        </ElIcon>
                                    </ElButton>
                                </ElTooltip>
                            ) : null}
                        </span>
                        <span class={'ml-1'}>
                            {__panelSetupProps.mode !== 'upgrade' ? (
                                <ElTooltip effect="dark" content={$t('menu.container')} placement="top">
                                    <ElButton
                                        type="primary"
                                        link
                                        onClick={($event?: any) => {
                                            ctx.emit('toContainer');
                                        }}
                                    >
                                        <ElIcon>
                                            <SvgIcon iconName="p-docker" />
                                        </ElIcon>
                                    </ElButton>
                                </ElTooltip>
                            ) : null}
                        </span>
                        {__panelSetupProps.mode === 'installed' ? (
                            <span class={'ml-1'}>
                                <ElTooltip
                                    effect="dark"
                                    content={
                                        __panelSetupProps.installed.favorite
                                            ? $t('commons.table.unpin')
                                            : $t('commons.table.pin')
                                    }
                                    placement="top-start"
                                >
                                    {withDirectives(
                                        <ElButton
                                            link
                                            size="large"
                                            type={__panelSetupProps.installed.favorite ? 'warning' : 'info'}
                                            disabled={__panelSetupProps.sortMode}
                                            onClick={($event?: any) => {
                                                ctx.emit('favoriteInstall');
                                            }}
                                        >
                                            <ElIcon>
                                                <SvgIcon iconName="p-pushpin" />
                                            </ElIcon>
                                        </ElButton>,
                                        [[permissionDirective, true]],
                                    )}
                                </ElTooltip>
                            </span>
                        ) : null}
                    </div>
                    <div class={'operate-actions flex flex-wrap items-center justify-end gap-1'}>
                        {__panelSetupProps.mode === 'installed'
                            ? withDirectives(
                                  <ElButton
                                      plain
                                      round
                                      size="small"
                                      onClick={($event?: any) => {
                                          ctx.emit('openUploads');
                                      }}
                                      class={'h-button'}
                                  >
                                      {$t('database.loadBackup')}
                                  </ElButton>,
                                  [[permissionDirective, true]],
                              )
                            : null}
                        {__panelSetupProps.mode === 'installed'
                            ? withDirectives(
                                  <ElButton
                                      plain
                                      round
                                      size="small"
                                      onClick={($event?: any) => {
                                          ctx.emit('openBackups');
                                      }}
                                      class={'h-button'}
                                  >
                                      {$t('commons.button.backup')}
                                  </ElButton>,
                                  [[permissionDirective, true]],
                              )
                            : null}
                        {__panelSetupProps.mode === 'upgrade'
                            ? withDirectives(
                                  <ElButton
                                      plain
                                      round
                                      size="small"
                                      disabled={__panelSetupProps.installed.status === 'Upgrading'}
                                      onClick={($event?: any) => {
                                          ctx.emit('ignoreApp');
                                      }}
                                      class={'h-button'}
                                  >
                                      {$t('commons.button.ignore')}
                                  </ElButton>,
                                  [[permissionDirective, true]],
                              )
                            : null}
                        {__panelSetupProps.mode === 'upgrade'
                            ? withDirectives(
                                  <ElButton
                                      plain
                                      round
                                      size="small"
                                      disabled={
                                          (__panelSetupProps.installed.status !== 'Running' &&
                                              __panelSetupProps.installed.status !== 'UpgradeErr') ||
                                          __panelSetupProps.installed.appStatus === 'TakeDown'
                                      }
                                      onClick={($event?: any) => {
                                          ctx.emit('openOperate');
                                      }}
                                      class={'h-button'}
                                  >
                                      {$t('commons.button.upgrade')}
                                  </ElButton>,
                                  [[permissionDirective, true]],
                              )
                            : null}
                    </div>
                </div>
            </div>
        );
    },
    options,
);
