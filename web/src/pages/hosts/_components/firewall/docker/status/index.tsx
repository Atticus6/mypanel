import { $t } from '@/utils/i18n-t';
import { Firewall } from '@/types/firewall';
import NoSuchService from '@/components/layout-content/no-such-service';
import FamilyIssues from '@/pages/hosts/_components/firewall/components/family-issues';
import i18n from '@/lang';
import { routerToName, routerToNameWithQuery } from '@/utils/router';
import { dockerGuardFamilyStatusMessage } from '@/pages/hosts/_components/firewall/docker/model';
import permissionDirective from '@/directives/modules/permission';
import { nodeAdminDirective } from '@/directives/modules/permission';
import { I18nT } from 'vue-i18n';

interface CodemodProps {
    [key: string]: any;
    base?: Firewall.DockerGuardBase;
}

const emits = {
    operate: (arg0?: 'initialize' | 'bind' | 'unbind') => true,
    cleanup: () => true,
    refresh: () => true,
};

const options = {
    name: 'status',
    props: {
        base: { type: null },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const backendName = computed(() => __panelSetupProps.base.backend || __panelSetupProps.base.name);
        const goToFirewallSetting = () => routerToName('FirewallSetting');
        const goToScriptLibrary = () => routerToNameWithQuery('Library', { uncached: 'true' });
        const familyStatuses = computed(() =>
            (
                [
                    { family: 'IPv4', status: __panelSetupProps.base.ipv4 },
                    { family: 'IPv6', status: __panelSetupProps.base.ipv6 },
                ] as const
            ).filter((item) => item.family === 'IPv4' || __panelSetupProps.base.ipv6Enabled !== false),
        );
        const availableFamilies = computed(() =>
            familyStatuses.value.filter((item) => item.status.reason !== 'command_missing'),
        );
        const anyFamilyInitialized = computed(() => availableFamilies.value.some((item) => item.status.initialized));
        const anyFamilyBound = computed(() => availableFamilies.value.some((item) => item.status.bound));
        const familyIssues = computed(() => {
            if (!anyFamilyInitialized.value && !familyStatuses.value.some((item) => item.status.partial)) return [];
            return familyStatuses.value.filter((item) => !item.status.effective);
        });
        const familyActions = computed(() =>
            familyIssues.value.map((issue) => {
                const status = issue.status;
                let action: 'initialize' | 'repair' | 'bind' | undefined;
                if (!['command_missing', 'docker_chain_missing', 'inspect_failed'].includes(status.reason || '')) {
                    action = status.partial
                        ? 'repair'
                        : !status.initialized
                          ? 'initialize'
                          : status.reason === 'jump_missing'
                            ? 'bind'
                            : 'repair';
                }
                return {
                    family: issue.family === 'IPv6' ? ('ipv6' as const) : ('ipv4' as const),
                    message: status.partial
                        ? i18n.global.t('firewall.familyIncomplete', [issue.family])
                        : dockerGuardFamilyStatusMessage(__panelSetupProps.base, issue.family, status),
                    action,
                };
            }),
        );
        return () => (
            <>
                {__panelSetupProps.base.isExist ? (
                    <div class={'app-status card-interval'}>
                        <ElCard>
                            <div class={'flex w-full flex-col gap-4 md:flex-row'}>
                                <div class={'ml-3 flex flex-wrap gap-4'}>
                                    <ElTag effect="dark" type="success">
                                        {__panelSetupProps.base.name}
                                    </ElTag>
                                    <ElTag>
                                        {$t('app.version')}
                                        {': '}
                                        {__panelSetupProps.base.version || '-'}
                                    </ElTag>
                                    <FamilyIssues
                                        subsystem="docker"
                                        backend={unref(backendName) as Firewall.Provider}
                                        issues={unref(familyActions)}
                                        onComplete={($event?: any) => {
                                            ctx.emit('refresh');
                                        }}
                                    />
                                </div>
                                <div class={'mt-0.5 flex items-center'}>
                                    {unref(anyFamilyBound) ? <ElDivider direction="vertical" /> : null}
                                    {!unref(anyFamilyInitialized)
                                        ? withDirectives(
                                              <ElButton
                                                  type="primary"
                                                  link
                                                  onClick={($event?: any) => {
                                                      ctx.emit('operate', 'initialize');
                                                  }}
                                              >
                                                  {$t('commons.button.init')}
                                              </ElButton>,
                                              [
                                                  [permissionDirective, true],
                                                  [nodeAdminDirective, true],
                                              ],
                                          )
                                        : !unref(anyFamilyBound)
                                          ? withDirectives(
                                                <ElButton
                                                    type="primary"
                                                    link
                                                    onClick={($event?: any) => {
                                                        ctx.emit('operate', 'bind');
                                                    }}
                                                >
                                                    {$t('commons.button.bind')}
                                                </ElButton>,
                                                [
                                                    [permissionDirective, true],
                                                    [nodeAdminDirective, true],
                                                ],
                                            )
                                          : withDirectives(
                                                <ElButton
                                                    type="primary"
                                                    link
                                                    onClick={($event?: any) => {
                                                        ctx.emit('operate', 'unbind');
                                                    }}
                                                >
                                                    {$t('commons.button.unbind')}
                                                </ElButton>,
                                                [
                                                    [permissionDirective, true],
                                                    [nodeAdminDirective, true],
                                                ],
                                            )}
                                    {unref(anyFamilyInitialized) ? (
                                        <>
                                            <ElDivider direction="vertical" />
                                            {withDirectives(
                                                <ElButton
                                                    type="primary"
                                                    link
                                                    onClick={($event?: any) => {
                                                        ctx.emit('cleanup');
                                                    }}
                                                >
                                                    {$t('commons.button.reset')}
                                                </ElButton>,
                                                [
                                                    [permissionDirective, true],
                                                    [nodeAdminDirective, true],
                                                ],
                                            )}
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        </ElCard>
                    </div>
                ) : (
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
                )}
            </>
        );
    },
    options,
);
