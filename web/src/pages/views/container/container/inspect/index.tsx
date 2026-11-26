import { $t } from '@/utils/i18n-t';
import { TABLE_OVERFLOW_TOOLTIP_OPTIONS } from '@/components/table/shared';
import CodemirrorPro from '@/components/codemirror-pro/index';
import { routerToFileWithPath } from '@/utils/router';
import { copyText } from '@/utils/clipboard';
import i18n from '@/lang';
interface DialogProps {
    data: any;
    ports: string[];
}
import './index.styles.css';
import DrawerPro from '@/components/drawer-pro/index';
import CopyButton from '@/components/copy-button/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'inspect',
    props: {},
    emits: emits,
    __scopeId: 'data-v-21cabfc3',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const visible = ref(false);
        const activeTab = ref('overview');
        const inspectData = ref<any>(null);
        const rawJson = ref('');
        const showRawJson = ref(false);
        const ports = ref([]);
        const acceptParams = (__panelSetupProps: DialogProps): void => {
            visible.value = true;
            activeTab.value = 'overview';
            showRawJson.value = false;
            ports.value = __panelSetupProps.ports || [];

            try {
                if (typeof __panelSetupProps.data === 'string') {
                    inspectData.value = JSON.parse(__panelSetupProps.data);
                } else {
                    inspectData.value = __panelSetupProps.data;
                }
                rawJson.value = JSON.stringify(inspectData.value, null, 2);
            } catch (e) {
                console.error('Failed to parse inspect data:', e);
            }
        };
        const handleClose = () => {
            visible.value = false;
            inspectData.value = null;
            rawJson.value = '';
        };
        const getStatusType = (status: string): string => {
            const statusMap: Record<string, string> = {
                running: 'success',
                paused: 'warning',
                restarting: 'warning',
                exited: 'info',
                dead: 'danger',
            };
            return statusMap[status?.toLowerCase()] || 'info';
        };
        const formatDate = (dateStr: string): string => {
            if (!dateStr || dateStr === '0001-01-01T00:00:00Z') {
                return '-';
            }
            try {
                const date = new Date(dateStr);
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const d = String(date.getDate()).padStart(2, '0');
                const h = String(date.getHours()).padStart(2, '0');
                const minute = String(date.getMinutes()).padStart(2, '0');
                const second = String(date.getSeconds()).padStart(2, '0');
                return `${y}-${m}-${d} ${h}:${minute}:${second}`;
            } catch {
                return dateStr;
            }
        };
        const getEnvKey = (env: string): string => {
            const index = env.indexOf('=');
            return index > 0 ? env.substring(0, index) : env;
        };
        const getEnvValue = (env: string): string => {
            const index = env.indexOf('=');
            return index > 0 ? env.substring(index + 1) : '';
        };
        const getRestartPolicy = () => {
            switch (inspectData.value?.HostConfig?.RestartPolicy?.Name) {
                case 'no':
                    return i18n.global.t('container.no');
                case 'always':
                    return i18n.global.t('container.always');
                case 'on-failure':
                    return i18n.global.t('container.onFailure');
                case 'unless-stopped':
                    return i18n.global.t('container.unlessStopped');
                default:
                    return '-';
            }
        };
        const handleJumpToFile = (path: string) => {
            if (path) {
                routerToFileWithPath(path);
            }
        };
        const handleCopyRawJson = () => {
            copyText(rawJson.value);
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                modelValue={unref(visible)}
                onUpdate:modelValue={($v) => {
                    visible.value = $v as any;
                }}
                header={$t('commons.button.view')}
                size="large"
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        visible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            >
                <ElTabs
                    modelValue={unref(activeTab)}
                    onUpdate:modelValue={($v) => {
                        activeTab.value = $v as any;
                    }}
                    type="border-card"
                >
                    <ElTabPane label={$t('menu.container')} name="overview">
                        <ElDescriptions column={1} border title={$t('home.baseInfo')}>
                            <ElDescriptionsItem label={$t('commons.table.name')}>
                                <ElText>{unref(inspectData)?.Name?.substring(1) || '-'}</ElText>
                                <CopyButton content={unref(inspectData)?.Name || ''} />
                            </ElDescriptionsItem>
                            <ElDescriptionsItem label="ID">
                                <ElText class={'text-xs'}>{unref(inspectData)?.Id?.substring(0, 12)}</ElText>
                                <CopyButton content={unref(inspectData)?.Id || ''} />
                            </ElDescriptionsItem>
                            <ElDescriptionsItem label="PID">{unref(inspectData)?.State?.Pid}</ElDescriptionsItem>
                            <ElDescriptionsItem label={$t('container.image')}>
                                {unref(inspectData)?.Config?.Image}
                                <CopyButton content={unref(inspectData)?.Config?.Image || ''} />
                            </ElDescriptionsItem>
                            <ElDescriptionsItem label={$t('commons.table.createdAt')}>
                                {formatDate(unref(inspectData)?.Created)}
                            </ElDescriptionsItem>
                            <ElDescriptionsItem label={$t('process.startTime')}>
                                {formatDate(unref(inspectData)?.State?.StartedAt)}
                            </ElDescriptionsItem>
                            <ElDescriptionsItem label={$t('container.finishTime')}>
                                {formatDate(unref(inspectData)?.State?.FinishedAt)}
                            </ElDescriptionsItem>
                            <ElDescriptionsItem label={$t('container.restartPolicy')}>
                                {getRestartPolicy()}
                            </ElDescriptionsItem>
                            <ElDescriptionsItem label={$t('commons.table.status')}>
                                <ElTag type={getStatusType(unref(inspectData)?.State?.Status)}>
                                    {unref(inspectData)?.State?.Status}
                                    {unref(inspectData)?.State?.Health?.Status
                                        ? '(' + unref(inspectData)?.State?.Health?.Status + ')'
                                        : ''}
                                </ElTag>
                            </ElDescriptionsItem>
                        </ElDescriptions>
                        <ElDescriptions column={1} border title={$t('container.command')} class={'mt-4'}>
                            <ElDescriptionsItem label={$t('container.command')}>
                                {unref(inspectData)?.Config?.Cmd?.length ? (
                                    <div class={'tag-list'}>
                                        {(unref(inspectData)?.Config?.Cmd || []).map((entry, index) => (
                                            <ElTag type="info" key={index}>
                                                {entry}
                                            </ElTag>
                                        ))}
                                    </div>
                                ) : (
                                    <span>{'-'}</span>
                                )}
                            </ElDescriptionsItem>
                            <ElDescriptionsItem label="ENTRYPONT">
                                {unref(inspectData)?.Config?.Entrypoint?.length ? (
                                    <div class={'tag-list'}>
                                        {(unref(inspectData)?.Config?.Entrypoint || []).map((entry, index) => (
                                            <ElTag type="info" key={index}>
                                                {entry}
                                            </ElTag>
                                        ))}
                                    </div>
                                ) : (
                                    <span>{'-'}</span>
                                )}
                            </ElDescriptionsItem>
                            <ElDescriptionsItem label={$t('container.workingDir')}>
                                {unref(inspectData)?.Config?.WorkingDir || '-'}
                            </ElDescriptionsItem>
                        </ElDescriptions>
                        <span class={'envTitle'}>{$t('container.env')}</span>
                        {unref(inspectData)?.Config?.Env?.length ? (
                            <ElCollapse accordion class={'env-list'}>
                                {(unref(inspectData)?.Config?.Env || []).map((env, index) => (
                                    <ElCollapseItem
                                        name={index}
                                        key={index}
                                        v-slots={{
                                            title: () => (
                                                <>
                                                    <ElText class={'env-key text-sm'}>{getEnvKey(env)}</ElText>
                                                </>
                                            ),
                                        }}
                                    >
                                        <div class={'env-value'}>
                                            <ElText class={'text-xs'}>{getEnvValue(env)}</ElText>
                                            <CopyButton content={getEnvValue(env)} />
                                        </div>
                                    </ElCollapseItem>
                                ))}
                            </ElCollapse>
                        ) : (
                            <ElEmpty description={$t('commons.msg.noneData')} />
                        )}
                    </ElTabPane>
                    <ElTabPane label={$t('container.network')} name="network">
                        <ElDescriptions column={1} border title={$t('home.baseInfo')}>
                            <ElDescriptionsItem label={$t('container.networkName')}>
                                {unref(inspectData)?.HostConfig?.NetworkMode}
                            </ElDescriptionsItem>
                            <ElDescriptionsItem label={$t('home.hostname')}>
                                {unref(inspectData)?.Config?.Hostname}
                            </ElDescriptionsItem>
                            <ElDescriptionsItem label="Domain">
                                {unref(inspectData)?.Config?.Domainname || '-'}
                            </ElDescriptionsItem>
                            <ElDescriptionsItem label={$t('commons.table.port')}>
                                {(unref(ports) || []).map((item) => (
                                    <div key={item}>
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </ElDescriptionsItem>
                        </ElDescriptions>
                        {(unref(inspectData)?.NetworkSettings?.Networks || []).map((network, name) => (
                            <div class={'mt-4 mb-4'} key={name}>
                                <ElDescriptions column={2} border title={name}>
                                    <ElDescriptionsItem label="Network ID">
                                        <ElText class={'text-xs'}>{network?.NetworkID?.substring(0, 12)}</ElText>
                                    </ElDescriptionsItem>
                                    <ElDescriptionsItem label="Endpoint ID">
                                        <ElText class={'text-xs'}>{network?.EndpointID?.substring(0, 12)}</ElText>
                                    </ElDescriptionsItem>
                                    <ElDescriptionsItem label="IPv4">{network?.IPAddress || '-'}</ElDescriptionsItem>
                                    <ElDescriptionsItem label="IPv4 Gateway">
                                        {network?.Gateway || '-'}
                                    </ElDescriptionsItem>
                                    <ElDescriptionsItem label="MAC">{network?.MacAddress || '-'}</ElDescriptionsItem>
                                    <ElDescriptionsItem label="IPv6 Gateway">
                                        {network?.IPv6Gateway || '-'}
                                    </ElDescriptionsItem>
                                </ElDescriptions>
                            </div>
                        ))}
                    </ElTabPane>
                    <ElTabPane label={$t('container.volume')} name="storage">
                        <ElTable
                            tooltip-options={TABLE_OVERFLOW_TOOLTIP_OPTIONS}
                            data={unref(inspectData)?.Mounts}
                            border
                        >
                            <ElTableColumn
                                label={$t('commons.table.type')}
                                width="100"
                                v-slots={{
                                    default: ({ row }) => (
                                        <>
                                            <ElTag size="small">
                                                {row.Type === 'bind'
                                                    ? $t('container.volumeOption')
                                                    : $t('container.hostOption')}
                                            </ElTag>
                                        </>
                                    ),
                                }}
                            />
                            <ElTableColumn
                                label={$t('container.hostOption')}
                                show-overflow-tooltip
                                v-slots={{
                                    default: ({ row }) => (
                                        <>
                                            {row.Source ? (
                                                <ElText
                                                    type="primary"
                                                    onClick={($event?: any) => {
                                                        handleJumpToFile(row.Source);
                                                    }}
                                                    class={'cursor-pointer'}
                                                >
                                                    {row.Source}
                                                </ElText>
                                            ) : (
                                                <span>{'-'}</span>
                                            )}
                                        </>
                                    ),
                                }}
                            />
                            <ElTableColumn
                                label={$t('container.volumeOption')}
                                prop="Destination"
                                show-overflow-tooltip
                            />
                            <ElTableColumn
                                label={$t('container.tag')}
                                width="80"
                                align="center"
                                v-slots={{
                                    default: ({ row }) => (
                                        <>{row.RW ? $t('container.modeRW') : $t('container.modeR')}</>
                                    ),
                                }}
                            />
                        </ElTable>
                    </ElTabPane>
                    <ElTabPane label={$t('commons.button.view')} name="view">
                        <div class={'mb-2 flex justify-start'}>
                            <ElButton
                                type="primary"
                                onClick={($event?: any) => {
                                    (handleCopyRawJson as any)($event);
                                }}
                                icon="DocumentCopy"
                                size="default"
                            >
                                {$t('commons.button.copy')}
                            </ElButton>
                        </div>
                        <CodemirrorPro
                            modelValue={unref(rawJson)}
                            onUpdate:modelValue={($v) => {
                                rawJson.value = $v as any;
                            }}
                            height-diff={270}
                            readonly={true}
                            mode="json"
                        />
                    </ElTabPane>
                </ElTabs>
            </DrawerPro>
        );
    },
    options,
);
