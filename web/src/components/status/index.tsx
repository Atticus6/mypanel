import { $t } from '@/utils/i18n-t';
import { TABLE_TOOLTIP_OPTIONS } from '@/components/table/shared';
import './index.styles.css';
import { cn } from '@/utils/cn';
import { Loading } from '@element-plus/icons-vue';
import SvgIcon from '@/components/svg-icon/svg-icon';

interface CodemodProps {
    [key: string]: any;
    status?: string;
    msg?: string;
    hasIcon?: boolean;
    disabled?: boolean;
    operate?: boolean;
}

const emits = {};

const options = {
    name: 'status',
    props: {
        status: { type: String },
        msg: { type: String },
        hasIcon: { type: Boolean },
        disabled: { type: Boolean },
        operate: {
            type: Boolean,
            default: false,
            required: false,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-32ee14ed',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const permissionDisabled = ref(false);
        const statusItem = computed(() => {
            return __panelSetupProps.status?.toLowerCase() || '';
        });
        const isDisabled = computed(() => {
            return !!__panelSetupProps.disabled || permissionDisabled.value;
        });
        const handlePermissionClick = (event: MouseEvent) => {
            if (!isDisabled.value) {
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
        };
        const getType = (status: string) => {
            if (status.includes('error') || status.includes('err')) {
                return 'danger';
            }
            switch (status) {
                case 'running':
                case 'free':
                case 'success':
                case 'enable':
                case 'done':
                case 'healthy':
                case 'unused':
                case 'executing':
                case 'new':
                    return 'success';
                case 'stopped':
                case 'exceptional':
                case 'disable':
                case 'unhealthy':
                case 'failed':
                case 'crashed':
                case 'lost':
                case 'exited':
                case 'notfound':
                case 'inaccessible':
                    return 'danger';
                case 'paused':
                case 'blocked':
                case 'shutdown':
                case 'pmsuspended':
                case 'dead':
                case 'removing':
                case 'deleted':
                case 'conflict':
                case 'partial':
                case 'degraded':
                    return 'warning';
                case 'duplicate':
                case 'unexecuted':
                case 'canceled':
                case 'inactive':
                case 'unknown':
                    return 'info';
                default:
                    return 'primary';
            }
        };
        const loadingStatus = [
            'installing',
            'building',
            'restarting',
            'upgrading',
            'rebuilding',
            'recreating',
            'creating',
            'starting',
            'shutdown',
            'removing',
            'applying',
            'uninstalling',
            'downloading',
            'packing',
            'sending',
            'waiting',
            'executing',
            'loading',
        ];
        const stopStatus = ['stopped', 'exited', 'disable'];
        const runningStatus = ['running', 'enable'];
        const loadingIcon = (status: string): boolean => {
            return loadingStatus.indexOf(status) > -1;
        };
        const stopIcon = (status: string): boolean => {
            return stopStatus.indexOf(status.toLocaleLowerCase()) > -1;
        };
        const runningIcon = (status: string): boolean => {
            return runningStatus.indexOf(status.toLocaleLowerCase()) > -1;
        };
        ctx.expose({
            setPermissionDisabled: (disabled: boolean) => {
                permissionDisabled.value = disabled;
            },
        });
        return () => (
            <span
                aria-disabled={unref(isDisabled)}
                onClick={($event?: any) => {
                    (handlePermissionClick as any)($event);
                }}
                class={cn('status-wrapper', { 'is-disabled': unref(isDisabled) })}
            >
                {__panelSetupProps.msg && __panelSetupProps.msg != '' ? (
                    <ElTooltip
                        effect="dark"
                        {...TABLE_TOOLTIP_OPTIONS}
                        v-slots={{
                            content: () => (
                                <>
                                    <div class={'content'}>{__panelSetupProps.msg}</div>
                                </>
                            ),
                        }}
                    >
                        <ElTag size="small" type={getType(unref(statusItem))} round effect="light">
                            <span class={'flx-align-center'}>
                                {unref(statusItem) != '' ? (
                                    <span>{$t('commons.status.' + unref(statusItem))}</span>
                                ) : null}
                                {loadingIcon(unref(statusItem)) ? (
                                    <ElIcon class={'is-loading'}>
                                        <Loading />
                                    </ElIcon>
                                ) : null}
                            </span>
                        </ElTag>
                    </ElTooltip>
                ) : (
                    <>
                        {!__panelSetupProps.operate ? (
                            <ElTag size="small" type={getType(unref(statusItem))} round effect="light">
                                <span class={'flx-align-center'}>
                                    {unref(statusItem) != '' ? (
                                        <span>{$t('commons.status.' + unref(statusItem))}</span>
                                    ) : null}
                                    {loadingIcon(unref(statusItem)) ? (
                                        <ElIcon class={'is-loading'}>
                                            <Loading />
                                        </ElIcon>
                                    ) : null}
                                </span>
                            </ElTag>
                        ) : (
                            <ElButton
                                size="small"
                                type={getType(unref(statusItem))}
                                plain
                                round
                                disabled={unref(isDisabled)}
                            >
                                {unref(statusItem) != '' ? (
                                    <span>{$t('commons.status.' + unref(statusItem))}</span>
                                ) : null}
                                {loadingIcon(unref(statusItem)) ? (
                                    <ElIcon class={'is-loading'}>
                                        <Loading />
                                    </ElIcon>
                                ) : null}
                                {stopIcon(unref(statusItem)) ? (
                                    <SvgIcon iconName="p-stop" className="status-icon" />
                                ) : null}
                                {runningIcon(unref(statusItem)) ? (
                                    <SvgIcon iconName="p-start" className="status-icon" />
                                ) : null}
                            </ElButton>
                        )}
                    </>
                )}
            </span>
        );
    },
    options,
);
