import { $t } from '@/utils/i18n-t';
import { Firewall } from '@/types/firewall';
import FireRouter from '@/pages/views/host/firewall/index';
import WhiteList from '@/pages/views/host/firewall/setting/white-list/index';
import { useGlobalStore } from '@/composables/useGlobalStore';
import i18n from '@/lang';
import { MsgError, MsgSuccess } from '@/utils/message';
import { Check } from '@element-plus/icons-vue';
import TaskLog from '@/components/log/task/index';
import { rpc } from '@/lib/rpc';
interface BackendInitializationState {
    label: string;
    type: 'success' | 'info';
}
import '@/pages/views/host/firewall/setting/index.styles.css';
import permissionDirective from '@/directives/modules/permission';
import { nodeAdminDirective } from '@/directives/modules/permission';
import LayoutContent from '@/components/layout-content/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'firewall.setting',
    props: {},
    emits: emits,
    __scopeId: 'data-v-778b2729',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isMobile } = useGlobalStore();
        const loading = ref(false);
        const ipv6Updating = ref(false);
        const ipv6TaskRef = ref<InstanceType<typeof TaskLog>>();
        const settings = ref<Firewall.Settings>();
        const savedBackends = ref<Record<Firewall.BackendSubsystem, string>>({
            system: '',
            forwarding: '',
            docker: '',
        });
        const pingStatus = ref('Disable');
        const oldPingStatus = ref('Disable');
        const whiteListRef = ref<InstanceType<typeof WhiteList>>();
        const openWhitelist = () => {
            whiteListRef.value?.acceptParams();
            load();
        };
        const providerOrder: Record<Firewall.Provider, number> = {
            iptables: 0,
            nftables: 1,
            firewalld: 2,
            ufw: 3,
        };
        const isServiceBackend = (provider: Firewall.Provider) => {
            return provider === 'firewalld' || provider === 'ufw';
        };
        const isDockerNftablesOption = (subsystem: Firewall.BackendSubsystem, option: Firewall.BackendOption) =>
            subsystem === 'docker' && option.name === 'nftables';
        const backendOptionLabel = (subsystem: Firewall.BackendSubsystem, option: Firewall.BackendOption) => {
            if (!isDockerNftablesOption(subsystem, option)) {
                return option.name;
            }
            return `${option.name}（${i18n.global.t('firewall.dockerNftablesRequirement')}）`;
        };
        const backendInitializationState = (option: Firewall.BackendOption): BackendInitializationState => {
            const availableFamilies = (
                settings.value?.ipv6Enabled === false ? [option.ipv4] : [option.ipv4, option.ipv6]
            ).filter((status) => status.available);
            if (availableFamilies.length === 0) {
                return option.initialized
                    ? { label: 'firewall.initializedStatus', type: 'success' }
                    : { label: 'firewall.notInitialized', type: 'info' };
            }
            const initializedFamilies = availableFamilies.filter((status) => status.initialized).length;
            if (initializedFamilies === 0) {
                return { label: 'firewall.notInitialized', type: 'info' };
            }
            if (initializedFamilies === availableFamilies.length) {
                return { label: 'firewall.initializedStatus', type: 'success' };
            }
            return { label: 'firewall.partiallyInitialized', type: 'info' };
        };
        const groups = computed(() => {
            if (!settings.value) return [];
            return [
                {
                    subsystem: 'system' as const,
                    label: i18n.global.t('firewall.systemFirewall'),
                    helper: `${i18n.global.t('firewall.systemFirewallHelper')} ${i18n.global.t(
                        'firewall.backendRecommendation',
                    )}`,
                    group: settings.value.system,
                },
                {
                    subsystem: 'docker' as const,
                    label: i18n.global.t('firewall.dockerGuard'),
                    helper: i18n.global.t('firewall.dockerFirewallHelper'),
                    group: settings.value.docker,
                },
                {
                    subsystem: 'forwarding' as const,
                    label: i18n.global.t('firewall.forwardRule', 2),
                    helper: i18n.global.t('firewall.forwardingHelper'),
                    group: settings.value.forwarding,
                },
            ];
        });
        const whiteListCount = computed(() => settings.value?.portWhiteList?.length || 0);
        const sortedOptions = (group: Firewall.BackendGroup) => {
            return [...group.options].sort(
                (left, right) =>
                    providerOrder[left.name as Firewall.Provider] - providerOrder[right.name as Firewall.Provider],
            );
        };
        const load = async () => {
            loading.value = true;
            try {
                const res = await rpc.firewall.getSettings({});
                settings.value = res as any;
                savedBackends.value = {
                    system: res.system?.selected || '',
                    forwarding: res.forwarding?.selected || '',
                    docker: res.docker?.selected || '',
                };
                pingStatus.value = res.pingStatus;
                oldPingStatus.value = pingStatus.value;
            } catch (error) {
                settings.value = undefined;
                throw error;
            } finally {
                loading.value = false;
            }
        };
        const changeBackend = async (subsystem: Firewall.BackendSubsystem, group: Firewall.BackendGroup) => {
            const backend = group.selected;
            const previous = savedBackends.value[subsystem];
            const previousOption = group.options.find((option) => option.name === previous);
            const previousInitialized =
                previousOption?.initialized || previousOption?.ipv4.initialized || previousOption?.ipv6.initialized;
            if (previous && previous !== backend && previousInitialized) {
                group.selected = previous;
                await ElMessageBox.alert(
                    i18n.global.t('firewall.cleanupBeforeBackendSwitch', [previous, backend]),
                    i18n.global.t('commons.button.reset'),
                    { type: 'warning' },
                );
                return;
            }
            try {
                await ElMessageBox.confirm(
                    i18n.global.t(
                        subsystem === 'docker' ? 'firewall.switchDockerBackendHelper' : 'firewall.switchBackendHelper',
                        [backend],
                    ),
                    i18n.global.t('commons.button.confirm'),
                    {
                        confirmButtonText: i18n.global.t('commons.button.confirm'),
                        cancelButtonText: i18n.global.t('commons.button.cancel'),
                        type: 'info',
                    },
                );
                loading.value = true;
                await rpc.firewall.operateBackend({
                    subsystem,
                    backend: backend as Firewall.Provider,
                    operation: 'select',
                });
                await load();
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            } catch (error) {
                const result = error as { errorCode?: string; message?: string };
                if (result?.errorCode === 'FW_BACKEND_CLEANUP_REQUIRED') {
                    await ElMessageBox.alert(
                        i18n.global.t('firewall.cleanupBeforeBackendSwitch', [previous, backend]),
                        i18n.global.t('commons.button.reset'),
                        { type: 'warning' },
                    );
                } else if (result?.message) {
                    MsgError(result.message);
                }
                if (savedBackends.value[subsystem] !== backend) {
                    group.selected = savedBackends.value[subsystem];
                }
            } finally {
                loading.value = false;
            }
        };
        const finishIPv6Operation = async () => {
            ipv6Updating.value = false;
            await load();
        };
        const changeIPv6 = async (value: string | number | boolean) => {
            if (ipv6Updating.value || loading.value) return;
            const enabled = value === true;
            if (!enabled) {
                const confirmed = await ElMessageBox.confirm(
                    h(
                        'ul',
                        { class: 'list-disc pl-4 space-y-2' },
                        ['Rules', 'Container', 'Whitelist', 'Network', 'Effect'].map((item) =>
                            h('li', i18n.global.t(`firewall.ipv6Disable${item}Helper`)),
                        ),
                    ),
                    i18n.global.t('commons.msg.infoTitle'),
                    {
                        confirmButtonText: i18n.global.t('commons.button.confirm'),
                        cancelButtonText: i18n.global.t('commons.button.cancel'),
                    },
                )
                    .then(() => true)
                    .catch(() => false);
                if (!confirmed) return;
            }
            ipv6Updating.value = true;
            try {
                const data = await rpc.firewall.operateIPv6({ status: enabled ? 'Enable' : 'Disable' });
                if (data.queued && data.taskId) {
                    ipv6TaskRef.value?.openWithTaskID(data.taskId, true);
                } else {
                    await finishIPv6Operation();
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                }
            } catch (error) {
                await finishIPv6Operation();
                throw error;
            }
        };
        const changePing = async (value: string | number | boolean) => {
            const next = String(value);
            try {
                await rpc.firewall.operate({ operation: next === 'Enable' ? 'enableBanPing' : 'disableBanPing' });
                oldPingStatus.value = next;
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            } catch {
                pingStatus.value = oldPingStatus.value;
            }
        };
        load();
        return () =>
            withDirectives(
                <div>
                    <FireRouter />
                    <LayoutContent
                        title={$t('commons.button.set')}
                        v-slots={{
                            prompt: () => (
                                <>
                                    <ElAlert
                                        type="info"
                                        show-icon
                                        closable={false}
                                        title={$t('firewall.backendSwitchNotice')}
                                    />
                                </>
                            ),
                            main: () => (
                                <>
                                    <ElForm label-position={unref(isMobile) ? 'top' : 'left'} label-width="150px">
                                        <ElRow>
                                            <ElCol span={1}>
                                                <br />
                                            </ElCol>
                                            <ElCol xs={24} sm={20} md={15} lg={12} xl={12}>
                                                {(unref(groups) || []).map((item) => (
                                                    <ElFormItem label={item.label} key={item.subsystem}>
                                                        {withDirectives(
                                                            <ElSelect
                                                                modelValue={item.group.selected}
                                                                onUpdate:modelValue={($v) => {
                                                                    item.group.selected = $v as any;
                                                                }}
                                                                onChange={($event?: any) => {
                                                                    changeBackend(item.subsystem, item.group);
                                                                }}
                                                                class={'!w-full sm:!w-2/3'}
                                                            >
                                                                {(sortedOptions(item.group) || []).map((option) => (
                                                                    <ElOption
                                                                        label={backendOptionLabel(
                                                                            item.subsystem,
                                                                            option,
                                                                        )}
                                                                        value={option.name}
                                                                        disabled={
                                                                            !option.installed || !option.supported
                                                                        }
                                                                        key={option.name}
                                                                    >
                                                                        <div class={'option-row'}>
                                                                            <span class={'option-name'}>
                                                                                {backendOptionLabel(
                                                                                    item.subsystem,
                                                                                    option,
                                                                                )}
                                                                                {option.name === item.group.selected ? (
                                                                                    <ElIcon class={'selected-icon'}>
                                                                                        <Check />
                                                                                    </ElIcon>
                                                                                ) : null}
                                                                            </span>
                                                                            <div class={'option-status'}>
                                                                                {!option.installed ? (
                                                                                    <ElTag size="small" type="info">
                                                                                        {$t(
                                                                                            'firewall.uninstalledStatus',
                                                                                        )}
                                                                                    </ElTag>
                                                                                ) : !option.supported &&
                                                                                  option.supportReason !==
                                                                                      'docker_version_unsupported' ? (
                                                                                    <ElTag size="small" type="warning">
                                                                                        {' Docker: '}
                                                                                        {$t(
                                                                                            'firewall.uninstalledStatus',
                                                                                        )}
                                                                                    </ElTag>
                                                                                ) : option.supported &&
                                                                                  (option.name !==
                                                                                      item.group.selected ||
                                                                                      isServiceBackend(
                                                                                          option.name as Firewall.Provider,
                                                                                      )) ? (
                                                                                    <ElTag size="small" type="success">
                                                                                        {$t('app.installed')}
                                                                                    </ElTag>
                                                                                ) : option.supported ? (
                                                                                    <ElTag
                                                                                        size="small"
                                                                                        type={
                                                                                            backendInitializationState(
                                                                                                option,
                                                                                            ).type
                                                                                        }
                                                                                    >
                                                                                        {$t(
                                                                                            backendInitializationState(
                                                                                                option,
                                                                                            ).label,
                                                                                        )}
                                                                                    </ElTag>
                                                                                ) : null}
                                                                            </div>
                                                                        </div>
                                                                    </ElOption>
                                                                ))}
                                                            </ElSelect>,
                                                            [
                                                                [permissionDirective, true],
                                                                [nodeAdminDirective, true],
                                                            ],
                                                        )}
                                                        <span class={'input-help'}>{item.helper}</span>
                                                    </ElFormItem>
                                                ))}
                                                <ElFormItem label={$t('firewall.ipv6Support')}>
                                                    {withDirectives(
                                                        <ElSwitch
                                                            model-value={unref(settings)?.ipv6Enabled !== false}
                                                            disabled={!unref(settings)}
                                                            onChange={($event?: any) => {
                                                                (changeIPv6 as any)($event);
                                                            }}
                                                        />,
                                                        [
                                                            [permissionDirective, true],
                                                            [nodeAdminDirective, true],
                                                        ],
                                                    )}
                                                    <span class={'input-help'}>{$t('firewall.ipv6SupportHelper')}</span>
                                                </ElFormItem>
                                                <ElFormItem label={$t('firewall.noPing')}>
                                                    <ElRadioGroup
                                                        modelValue={unref(pingStatus)}
                                                        onUpdate:modelValue={($v) => {
                                                            pingStatus.value = $v as any;
                                                        }}
                                                        onChange={($event?: any) => {
                                                            (changePing as any)($event);
                                                        }}
                                                    >
                                                        {withDirectives(
                                                            <ElRadioButton value="Enable">
                                                                {$t('commons.button.enable')}
                                                            </ElRadioButton>,
                                                            [
                                                                [permissionDirective, true],
                                                                [nodeAdminDirective, true],
                                                            ],
                                                        )}
                                                        {withDirectives(
                                                            <ElRadioButton value="Disable">
                                                                {$t('commons.button.disable')}
                                                            </ElRadioButton>,
                                                            [
                                                                [permissionDirective, true],
                                                                [nodeAdminDirective, true],
                                                            ],
                                                        )}
                                                    </ElRadioGroup>
                                                </ElFormItem>
                                                <ElFormItem label={$t('firewall.portWhiteList')}>
                                                    <div class={'flex items-center gap-3'}>
                                                        {withDirectives(
                                                            <ElButton
                                                                icon="Setting"
                                                                onClick={($event?: any) => {
                                                                    (openWhitelist as any)($event);
                                                                }}
                                                            >
                                                                {$t('commons.button.set')}
                                                            </ElButton>,
                                                            [
                                                                [permissionDirective, true],
                                                                [nodeAdminDirective, true],
                                                            ],
                                                        )}
                                                        <span class={'input-help !mt-0'}>
                                                            {$t('firewall.configuredRules', [unref(whiteListCount)])}
                                                        </span>
                                                    </div>
                                                </ElFormItem>
                                            </ElCol>
                                        </ElRow>
                                    </ElForm>
                                </>
                            ),
                        }}
                    />
                    <WhiteList
                        ref={whiteListRef}
                        rules={unref(settings)?.portWhiteList as Firewall.PortWhitelist[] | undefined}
                        ipv6-enabled={unref(settings)?.ipv6Enabled !== false}
                        panel-port={unref(settings)?.panelPort}
                        ssh-port={unref(settings)?.sshPort}
                        loading={unref(loading)}
                        onSaved={($event?: any) => {
                            (load as any)($event);
                        }}
                    />
                    <TaskLog
                        ref={ipv6TaskRef}
                        onClose={($event?: any) => {
                            (finishIPv6Operation as any)($event);
                        }}
                    />
                </div>,
                [[vLoading, unref(loading) || unref(ipv6Updating)]],
            );
    },
    options,
);

definePage({
    name: 'FirewallSetting',
    meta: {
        activeMenu: '/hosts/firewall/rules',
        parent: 'menu.firewall',
        title: 'commons.button.set',
        permission: 'host_firewall_view',
        hidden: true,
    },
});
