import { $t } from '@/utils/i18n-t';
import { Firewall } from '@/types/firewall';
import i18n from '@/lang';
import NoSuchService from '@/components/layout-content/no-such-service';
import DialogPro from '@/components/dialog-pro/index';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
import { Document } from '@element-plus/icons-vue';
import { routerToName, routerToNameWithQuery } from '@/utils/router';
import TaskLog from '@/components/log/task/index';
import FamilyIssues from '@/pages/hosts/_components/firewall/components/family-issues';
import { toFirewallSubsystem } from '@/pages/hosts/_components/firewall/utils/subsystem';
import RuleInitialize from '@/pages/hosts/_components/firewall/components/rule-initialize';
import { newUUID } from '@/utils/id';
import { useGlobalStore } from '@/composables/useGlobalStore';
interface FamilyIssue extends Firewall.BackendFamilyStatus {
    family: 'IPv4' | 'IPv6';
}
import { I18nT } from 'vue-i18n';
import Status from '@/components/status/index';

interface CodemodProps {
    [key: string]: any;
    currentTab?: string;
}

const emits = {
    search: (...args: unknown[]) => true,
    'update:isActive': (...args: unknown[]) => true,
    'update:isBind': (...args: unknown[]) => true,
    'update:isInit': (...args: unknown[]) => true,
    'update:loading': (...args: unknown[]) => true,
    'update:name': (...args: unknown[]) => true,
    'update:version': (...args: unknown[]) => true,
};

type SlotsShape = {
    actions: (arg?: unknown) => VNode[];
};

const options = {
    name: 'status',
    props: {
        currentTab: { type: String },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        const { docsUrl, isIntl } = useGlobalStore();
        const goToFirewallSetting = () => routerToName('FirewallSetting');
        const goToScriptLibrary = () => routerToNameWithQuery('Library', { uncached: 'true' });
        const baseInfo = ref<Firewall.FirewallBase>({
            isActive: false,
            isExist: true,
            isInit: false,
            isBind: false,
            name: '',
            backend: '',
            conflictBackend: '',
            version: '',
            pingStatus: '',
            reason: '',
            ipv4: { available: false, initialized: false, bound: false },
            ipv6: { available: false, initialized: false, bound: false },
        });
        const operationVisible = ref(false);
        const operation = ref('restart');
        const restoreBackupFile = ref('');
        const dockerStatus = ref();
        const withDockerRestart = ref(false);
        const taskLogRef = ref();
        const lifecycleSubmitting = ref(false);
        const lifecycleBusy = computed(() => lifecycleSubmitting.value || !!baseInfo.value.lifecycleTaskID);
        let disposed = false;
        let baseInfoRequestID = 0;
        const backendName = computed(() => baseInfo.value.backend || baseInfo.value.name);
        const backendUnavailable = computed(
            () => baseInfo.value.reason === 'backend_not_installed' || !baseInfo.value.isExist,
        );
        const isServiceBackend = computed(() => backendName.value === 'firewalld' || backendName.value === 'ufw');
        const isDirectBase = computed(
            () =>
                __panelSetupProps.currentTab === 'base' &&
                (backendName.value === 'iptables' || backendName.value === 'nftables'),
        );
        const isDirectForward = computed(
            () =>
                __panelSetupProps.currentTab === 'forward' &&
                (backendName.value === 'iptables' || backendName.value === 'nftables'),
        );
        const isDirectManaged = computed(() => isDirectBase.value || isDirectForward.value);
        const familyStatuses = computed(() =>
            (
                [
                    { family: 'IPv4', status: baseInfo.value.ipv4 },
                    { family: 'IPv6', status: baseInfo.value.ipv6 },
                ] as const
            ).filter((item) => item.family === 'IPv4' || baseInfo.value.ipv6Enabled !== false),
        );
        const availableFamilies = computed(() => familyStatuses.value.filter((item) => item.status.available));
        const anyFamilyInitialized = computed(() => availableFamilies.value.some((item) => item.status.initialized));
        const allAvailableFamiliesInitialized = computed(
            () =>
                availableFamilies.value.length > 0 && availableFamilies.value.every((item) => item.status.initialized),
        );
        const anyFamilyBound = computed(() => availableFamilies.value.some((item) => item.status.bound));
        const managedChainName = computed(() =>
            __panelSetupProps.currentTab === 'forward' ? '1PANEL_FORWARD' : '1PANEL_BASIC',
        );
        const familyIssues = computed<FamilyIssue[]>(() => {
            if (!isDirectManaged.value) return [];
            if (!anyFamilyInitialized.value && !familyStatuses.value.some((item) => item.status.partial)) return [];
            if (isDirectForward.value) {
                if (familyStatuses.value.every((item) => item.status.bound && !item.status.reason)) return [];
                return familyStatuses.value
                    .filter(
                        (item) =>
                            !item.status.available ||
                            !item.status.initialized ||
                            !item.status.bound ||
                            item.status.reason,
                    )
                    .map((item) => ({ family: item.family, ...item.status }));
            }
            return familyStatuses.value
                .filter((item) => !item.status.available || !item.status.initialized || !item.status.bound)
                .map((item) => ({
                    family: item.family,
                    available: item.status.available,
                    initialized: item.status.initialized,
                    partial: item.status.partial,
                    bound: item.status.bound,
                }));
        });
        const familyActions = computed(() =>
            familyIssues.value.map((issue) => {
                let action: 'initialize' | 'repair' | 'bind' | undefined;
                if (
                    issue.available &&
                    (!issue.reason || issue.reason === 'ipv6_forwarding_not_enabled') &&
                    !issue.bound
                ) {
                    action = issue.partial ? 'repair' : !issue.initialized ? 'initialize' : 'bind';
                }
                return {
                    family: issue.family === 'IPv6' ? ('ipv6' as const) : ('ipv4' as const),
                    message: familyIssueText(issue),
                    helpUrl:
                        issue.available && issue.reason === 'ipv6_ra_required'
                            ? `${docsUrl.value}/user_manual/${isIntl.value ? 'system' : 'hosts'}/firewall`
                            : undefined,
                    action,
                };
            }),
        );
        const familyIssueText = (issue: FamilyIssue) => {
            if (!issue.available) return i18n.global.t('firewall.familyUnsupported', [issue.family]);
            if (issue.reason === 'ipv6_ra_required') {
                return i18n.global.t('firewall.ipv6RARisk');
            }
            if (issue.reason === 'ipv6_ra_check_failed') return i18n.global.t('firewall.ipv6RACheckFailed');
            if (issue.partial) return i18n.global.t('firewall.familyIncomplete', [issue.family]);
            if (issue.reason === 'ipv6_forwarding_not_enabled') return i18n.global.t('firewall.ipv6ForwardingOnDemand');
            const status = i18n.global.t(
                !issue.initialized
                    ? 'firewall.notInitialized'
                    : issue.bound
                      ? 'commons.status.bound'
                      : 'commons.status.unbind',
            );
            return i18n.global.t('firewall.familyChainIssue', [issue.family, managedChainName.value, status]);
        };
        const initActionHelper = computed(() => {
            if (__panelSetupProps.currentTab === 'forward' && baseInfo.value.isInit && !baseInfo.value.isBind) {
                return `${baseInfo.value.name || backendName.value}: ${i18n.global.t('commons.status.unbind')}`;
            }
            return `${baseInfo.value.name || backendName.value}: ${i18n.global.t('firewall.notInitialized')}`;
        });
        const acceptParams = (): void => {
            loadBaseInfo();
            loadDocker();
        };
        const loadBaseInfo = async () => {
            if (disposed) return;
            const requestID = ++baseInfoRequestID;
            try {
                // forward 子系统的接口尚未迁移，继续走旧 REST；system/docker 走 RPC。
                const raw: any =
                    __panelSetupProps.currentTab === 'forward'
                        ? await rpc.firewall.getForwardBase({})
                        : await rpc.firewall.baseInfo({ name: toFirewallSubsystem(__panelSetupProps.currentTab) });
                if (disposed || requestID !== baseInfoRequestID) return;
                baseInfo.value = {
                    ...raw,
                    ipv4: raw.ipv4 || { available: true, initialized: raw.isInit, bound: raw.isBind },
                    ipv6: raw.ipv6 || { available: false, initialized: false, bound: false },
                };
                if (backendUnavailable.value) {
                    ctx.emit('update:name', '-');
                    ctx.emit('update:isActive', false);
                    ctx.emit('update:isInit', false);
                    ctx.emit('update:isBind', false);
                    ctx.emit('update:version', '');
                    ctx.emit('update:loading', false);
                    return;
                }
                ctx.emit('update:name', backendName.value);
                ctx.emit('update:isActive', baseInfo.value.isActive);
                ctx.emit('update:isInit', isDirectManaged.value ? anyFamilyInitialized.value : baseInfo.value.isInit);
                ctx.emit('update:isBind', isDirectManaged.value ? anyFamilyBound.value : baseInfo.value.isBind);
                ctx.emit('update:version', baseInfo.value.version);

                if (!baseInfo.value.lifecycleTaskID) {
                    await nextTick();
                    ctx.emit('search');
                } else {
                    ctx.emit('update:loading', false);
                }
            } catch {
                if (disposed || requestID !== baseInfoRequestID) return;
                ctx.emit('update:loading', false);
                ctx.emit('update:isInit', false);
                ctx.emit('update:name', '-');
                ctx.emit('update:version', '');
            }
        };
        const loadDocker = async () => {
            const res = await rpc.container.getDockerStatus({});
            dockerStatus.value = res.isActive;
        };
        const initializeRef = ref<InstanceType<typeof RuleInitialize>>();
        const onInit = async () => {
            if (lifecycleBusy.value) return;
            if (isServiceBackend.value) withDockerRestart.value = !!dockerStatus.value;
            const name = baseInfo.value.name || backendName.value;
            const message = isServiceBackend.value
                ? i18n.global.t('firewall.startWithBackupHelper')
                : __panelSetupProps.currentTab === 'base' && baseInfo.value.conflictBackend
                  ? i18n.global.t('firewall.initDirectBackendConflictMsg', [name, baseInfo.value.conflictBackend])
                  : i18n.global.t('firewall.initMsg', [name]);
            await initializeRef.value?.acceptParams(
                message,
                true,
                __panelSetupProps.currentTab === 'forward' ? 'forwarding' : 'system',
                isServiceBackend.value,
            );
        };
        const initializeOnly = async () => {
            if (__panelSetupProps.currentTab === 'base' && !isDirectBase.value) {
                await onOperate('start');
                return;
            }
            const result =
                __panelSetupProps.currentTab === 'base'
                    ? await rpc.firewall.operateFilterChain({ name: '1PANEL_BASIC', operate: 'init-base' })
                    : await rpc.firewall.enableForwarding({ taskId: newUUID() });
            if (result.queued && result.taskId) {
                taskLogRef.value?.openWithTaskID(result.taskId, true);
                return;
            }
            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            await loadBaseInfo();
        };
        const handleInitializationTaskClose = () => {
            loadBaseInfo();
        };
        const onBind = async () => {
            try {
                await ElMessageBox.confirm(i18n.global.t('firewall.bindHelper'), i18n.global.t('commons.button.bind'), {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                });
            } catch {
                return;
            }
            await rpc.firewall.operateFilterChain({ name: '1PANEL_BASIC', operate: 'bind-base' });
            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            await loadBaseInfo();
        };
        const onUnBind = async () => {
            try {
                await ElMessageBox.confirm(
                    i18n.global.t('firewall.unbindHelper'),
                    i18n.global.t('commons.button.unbind'),
                    {
                        confirmButtonText: i18n.global.t('commons.button.confirm'),
                        cancelButtonText: i18n.global.t('commons.button.cancel'),
                    },
                );
            } catch {
                return;
            }
            await rpc.firewall.operateFilterChain({ name: '1PANEL_BASIC', operate: 'unbind-base' });
            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            await loadBaseInfo();
        };
        const onOperate = async (op: string, backupFile = '') => {
            if (lifecycleBusy.value) return;
            operation.value = op;
            restoreBackupFile.value = backupFile;
            if (op === 'start') {
                await submitLifecycleOperation(!!dockerStatus.value && withDockerRestart.value);
            } else if (backendName.value === 'iptables' || backendName.value === 'nftables' || !dockerStatus.value) {
                await submitLifecycleOperation(false);
            } else {
                withDockerRestart.value = true;
                operationVisible.value = true;
            }
        };
        const onSubmit = async () => {
            operationVisible.value = false;
            await submitLifecycleOperation(withDockerRestart.value);
        };
        const openLifecycleTask = () => {
            if (baseInfo.value.lifecycleTaskID) {
                taskLogRef.value?.openWithTaskID(baseInfo.value.lifecycleTaskID, true);
            }
        };
        const submitLifecycleOperation = async (restartDocker: boolean) => {
            if (lifecycleBusy.value) return;
            lifecycleSubmitting.value = true;
            ctx.emit('update:loading', true);
            try {
                const result = await rpc.firewall.operate({
                    operation: operation.value,
                    withDockerRestart: restartDocker,
                    backupFile: restoreBackupFile.value || '',
                } as any);
                if (disposed) return;
                if (result?.queued && result.taskId) {
                    baseInfo.value.lifecycleTaskID = result.taskId;
                    ctx.emit('update:loading', false);
                    openLifecycleTask();
                    return;
                }
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                await loadBaseInfo();
            } catch {
                if (!disposed) await loadBaseInfo();
            } finally {
                lifecycleSubmitting.value = false;
            }
        };
        onBeforeUnmount(() => {
            disposed = true;
        });
        ctx.expose({
            acceptParams,
            openInitialization: onInit,
        });
        return () => (
            <div>
                {unref(backendUnavailable) ? (
                    <NoSuchService name={unref(backendName)}>
                        <I18nT
                            keypath="firewall.selectedBackendNotInstalled"
                            tag="span"
                            v-slots={{
                                backend: () => <>{unref(backendName)}</>,
                                library: () => (
                                    <>
                                        <button
                                            type="button"
                                            onClick={($event?: any) => {
                                                (goToScriptLibrary as any)($event);
                                            }}
                                            class={'firewall-backend-link'}
                                        >
                                            {$t('cronjob.library.library')}
                                        </button>
                                    </>
                                ),
                                settings: () => (
                                    <>
                                        <button
                                            type="button"
                                            onClick={($event?: any) => {
                                                (goToFirewallSetting as any)($event);
                                            }}
                                            class={'firewall-backend-link'}
                                        >
                                            {$t('commons.button.set')}
                                        </button>
                                    </>
                                ),
                            }}
                        />
                    </NoSuchService>
                ) : unref(baseInfo).isExist ? (
                    <div class={'app-status card-interval'}>
                        <ElCard>
                            <div class={'flex w-full flex-col gap-4 md:flex-row'}>
                                <div class={'ml-3 flex flex-wrap gap-4'}>
                                    <ElTag effect="dark" type="success">
                                        {unref(baseInfo).name}
                                    </ElTag>
                                    {unref(isServiceBackend) ? (
                                        <Status
                                            status={unref(baseInfo).isActive ? 'enable' : 'disable'}
                                            class={'mt-0.5'}
                                        />
                                    ) : null}
                                    <ElTag>
                                        {$t('app.version')}
                                        {': '}
                                        {unref(baseInfo).version}
                                    </ElTag>
                                    <FamilyIssues
                                        subsystem={unref(isDirectForward) ? 'forwarding' : 'system'}
                                        backend={unref(backendName) as Firewall.Provider}
                                        issues={unref(familyActions)}
                                        disabled={unref(lifecycleBusy)}
                                        onComplete={($event?: any) => {
                                            (loadBaseInfo as any)($event);
                                        }}
                                    />
                                </div>
                                <div class={'mt-0.5'}>
                                    {unref(isServiceBackend) ? (
                                        <>
                                            {unref(baseInfo).isActive ? (
                                                <ElButton
                                                    type="primary"
                                                    disabled={unref(lifecycleBusy)}
                                                    onClick={($event?: any) => {
                                                        onOperate('stop');
                                                    }}
                                                    link
                                                    v-permission={true}
                                                    v-node-admin={true}
                                                >
                                                    {$t('commons.button.stop')}
                                                </ElButton>
                                            ) : null}
                                            {!unref(baseInfo).isActive ? (
                                                <ElTooltip content={$t('firewall.firewallNotStart')} placement="bottom">
                                                    {
                                                        <ElButton
                                                            type="primary"
                                                            disabled={unref(lifecycleBusy)}
                                                            onClick={($event?: any) => {
                                                                (onInit as any)($event);
                                                            }}
                                                            link
                                                            v-permission={true}
                                                            v-node-admin={true}
                                                        >
                                                            {$t('commons.button.start')}
                                                        </ElButton>
                                                    }
                                                </ElTooltip>
                                            ) : null}
                                            <ElDivider direction="vertical" />
                                            {
                                                <ElButton
                                                    type="primary"
                                                    disabled={unref(lifecycleBusy)}
                                                    onClick={($event?: any) => {
                                                        onOperate('restart');
                                                    }}
                                                    link
                                                    v-permission={true}
                                                    v-node-admin={true}
                                                >
                                                    {$t('commons.button.restart')}
                                                </ElButton>
                                            }
                                            {unref(baseInfo).lifecycleTaskID ? (
                                                <>
                                                    <ElDivider direction="vertical" />
                                                    <ElButton
                                                        type="primary"
                                                        link
                                                        onClick={($event?: any) => {
                                                            (openLifecycleTask as any)($event);
                                                        }}
                                                    >
                                                        {$t('commons.status.executing')}
                                                        <ElIcon class={'ml-1'}>
                                                            <Document />
                                                        </ElIcon>
                                                    </ElButton>
                                                </>
                                            ) : null}
                                        </>
                                    ) : null}
                                    {unref(isDirectManaged) ? (
                                        <>
                                            {(
                                                unref(isDirectBase)
                                                    ? unref(anyFamilyBound) ||
                                                      unref(allAvailableFamiliesInitialized) ||
                                                      !unref(anyFamilyInitialized)
                                                    : !unref(anyFamilyBound)
                                            ) ? (
                                                <ElDivider direction="vertical" />
                                            ) : null}
                                            {unref(isDirectBase) ? (
                                                <>
                                                    {unref(anyFamilyBound) ? (
                                                        <ElButton
                                                            type="primary"
                                                            link
                                                            onClick={($event?: any) => {
                                                                (onUnBind as any)($event);
                                                            }}
                                                            v-permission={true}
                                                            v-node-admin={true}
                                                        >
                                                            {$t('commons.button.unbind')}
                                                        </ElButton>
                                                    ) : unref(allAvailableFamiliesInitialized) ? (
                                                        <ElButton
                                                            type="primary"
                                                            link
                                                            onClick={($event?: any) => {
                                                                (onBind as any)($event);
                                                            }}
                                                            v-permission={true}
                                                            v-node-admin={true}
                                                        >
                                                            {$t('commons.button.bind')}
                                                        </ElButton>
                                                    ) : !unref(anyFamilyInitialized) ? (
                                                        <ElTooltip content={unref(initActionHelper)} placement="bottom">
                                                            {
                                                                <ElButton
                                                                    type="primary"
                                                                    link
                                                                    onClick={($event?: any) => {
                                                                        (onInit as any)($event);
                                                                    }}
                                                                    v-permission={true}
                                                                    v-node-admin={true}
                                                                >
                                                                    {$t('commons.button.init')}
                                                                </ElButton>
                                                            }
                                                        </ElTooltip>
                                                    ) : null}
                                                </>
                                            ) : unref(isDirectForward) && !unref(anyFamilyBound) ? (
                                                <ElTooltip content={unref(initActionHelper)} placement="bottom">
                                                    {
                                                        <ElButton
                                                            type="primary"
                                                            link
                                                            onClick={($event?: any) => {
                                                                (onInit as any)($event);
                                                            }}
                                                            v-permission={true}
                                                            v-node-admin={true}
                                                        >
                                                            {$t('commons.button.init')}
                                                        </ElButton>
                                                    }
                                                </ElTooltip>
                                            ) : null}
                                        </>
                                    ) : null}
                                    {ctx.slots['actions']?.(undefined)}
                                </div>
                            </div>
                        </ElCard>
                        {__panelSetupProps.currentTab === 'base' && unref(baseInfo).conflictBackend ? (
                            <ElAlert
                                type="warning"
                                show-icon
                                closable={false}
                                title={$t('firewall.directBackendConflictWarning', [
                                    unref(backendName),
                                    unref(baseInfo).conflictBackend,
                                ])}
                                class={'mt-3'}
                            />
                        ) : null}
                    </div>
                ) : null}
                <DialogPro
                    v-model={operationVisible.value}
                    title={$t('firewall.firewallHelper', [$t('commons.button.' + unref(operation))])}
                    class={'firewall-rule-dialog firewall-lifecycle-dialog'}
                    v-slots={{
                        content: () => (
                            <>
                                <ElForm
                                    label-position="top"
                                    onSubmit={($event?: any) => {
                                        $event.preventDefault();
                                    }}
                                    class={'firewall-rule-dialog__docker'}
                                >
                                    <ElFormItem label={$t('firewall.dockerRestart')}>
                                        <ElRadioGroup v-model={withDockerRestart.value}>
                                            <ElRadio value={true}>{$t('setting.restartNow')}</ElRadio>
                                            <ElRadio value={false}>{$t('setting.restartLater')}</ElRadio>
                                        </ElRadioGroup>
                                        <p class={'firewall-rule-dialog__docker-helper'}>
                                            {$t(
                                                unref(withDockerRestart)
                                                    ? 'xpack.node.syncProxyHelper1'
                                                    : 'xpack.node.syncProxyHelper2',
                                            )}
                                        </p>
                                    </ElFormItem>
                                </ElForm>
                            </>
                        ),
                        footer: () => (
                            <>
                                <div class={'firewall-rule-dialog__confirmation'}>
                                    <span>{$t('firewall.' + unref(operation) + 'FirewallHelper')}</span>
                                </div>
                                <ElButton
                                    onClick={($event?: any) => {
                                        operationVisible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    type="primary"
                                    onClick={($event?: any) => {
                                        (onSubmit as any)($event);
                                    }}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </>
                        ),
                    }}
                />
                <TaskLog
                    ref={taskLogRef}
                    onClose={($event?: any) => {
                        (handleInitializationTaskClose as any)($event);
                    }}
                />
                <RuleInitialize
                    ref={initializeRef}
                    onInitialize={($event?: any) => {
                        (initializeOnly as any)($event);
                    }}
                    onRestore={($event?: any) => {
                        onOperate('start', $event);
                    }}
                    onComplete={($event?: any) => {
                        (loadBaseInfo as any)($event);
                    }}
                    v-slots={{
                        'before-options': () => (
                            <>
                                <ElForm
                                    label-position="top"
                                    onSubmit={($event?: any) => {
                                        $event.preventDefault();
                                    }}
                                    class={'firewall-rule-dialog__docker'}
                                >
                                    <ElFormItem label={$t('firewall.dockerRestart')}>
                                        <ElRadioGroup v-model={withDockerRestart.value}>
                                            <ElRadio value={true}>{$t('setting.restartNow')}</ElRadio>
                                            <ElRadio value={false}>{$t('setting.restartLater')}</ElRadio>
                                        </ElRadioGroup>
                                        <p class={'firewall-rule-dialog__docker-helper'}>
                                            {$t(
                                                unref(withDockerRestart)
                                                    ? 'xpack.node.syncProxyHelper1'
                                                    : 'xpack.node.syncProxyHelper2',
                                            )}
                                        </p>
                                    </ElFormItem>
                                </ElForm>
                            </>
                        ),
                        confirmation: () => (
                            <>
                                <div class={'firewall-rule-dialog__confirmation'}>
                                    <span>{$t('firewall.startFirewallHelper')}</span>
                                </div>
                            </>
                        ),
                    }}
                />
            </div>
        );
    },
    options,
);
