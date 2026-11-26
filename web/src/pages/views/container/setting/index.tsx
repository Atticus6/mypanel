import { $t } from '@/utils/i18n-t';
import CodemirrorPro from '@/components/codemirror-pro/index';
import Mirror from '@/pages/views/container/setting/mirror/index';
import Registry from '@/pages/views/container/setting/registry/index';
import LogOption from '@/pages/views/container/setting/log/index';
import Ipv6Option from '@/pages/views/container/setting/ipv6/index';
import SockPath from '@/pages/views/container/setting/sock-path/index';
import ConfirmDialog from '@/components/confirm-dialog/index';
import DockerStatus from '@/pages/views/container/docker-status/index';
import i18n from '@/lang';
import { loadDaemonJsonFile } from '@/api/modules/container';
import { rpc } from '@/lib/rpc';
import { MsgSuccess } from '@/utils/message';
import { checkNumberRange } from '@/global/form-rules';
import { useGlobalStore } from '@/composables/useGlobalStore';
import permissionDirective from '@/directives/modules/permission';
import Status from '@/components/status/index';
import LayoutContent from '@/components/layout-content/index';
import DialogPro from '@/components/dialog-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'setting',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { docsUrl, isMobile, openMenuTabs } = useGlobalStore();
        const unset = ref(i18n.global.t('setting.unSetting'));
        const submitInput = ref();
        const isActive = ref(false);
        const isExist = ref(false);
        const loading = ref(false);
        const showDaemonJsonAlert = ref(false);
        const confShowType = ref('base');
        const logOptionRef = ref();
        const ipv6OptionRef = ref();
        const confirmDialogRefLog = ref();
        const mirrorRef = ref();
        const registriesRef = ref();
        const confirmDialogRefLive = ref();
        const confirmDialogRefNVIDIA = ref();
        const confirmDialogRefCgroup = ref();
        const confirmDialogRefIptable = ref();
        const confirmDialogRefIpv6 = ref();
        const logOptionShow = ref();
        const ipv6OptionShow = ref();
        const sockPathRef = ref();
        const form = reactive({
            isSwarm: false,
            isActive: false,
            version: '',
            mirrors: '',
            registries: '',
            liveRestore: false,
            nvidia: false,
            nvidiaSupported: false,
            iptables: true,
            cgroupDriver: '',

            ipv6: false,
            fixedCidrV6: '',
            ip6Tables: false,
            experimental: false,

            logOptionShow: false,
            logMaxSize: '',
            logMaxFile: 3,

            dockerSockPath: '',
        });
        const rules = reactive({
            logMaxSize: [checkNumberRange(1, 1024000)],
            logMaxFile: [checkNumberRange(1, 100)],
        });
        const formRef = ref<FormInstance>();
        const dockerConf = ref();
        const confirmDialogRefFile = ref();
        const open = ref();
        const onSaveFile = async () => {
            let params = {
                header: i18n.global.t('database.confChange'),
                operationInfo: i18n.global.t('container.restartHelper'),
                submitInputInfo: i18n.global.t('database.restartNow'),
            };
            confirmDialogRefFile.value!.acceptParams(params);
        };
        const loadHeight = () => {
            return openMenuTabs.value ? 450 : 430;
        };
        const onChangeMirrors = () => {
            mirrorRef.value.acceptParams({ mirrors: form.mirrors });
        };
        const onChangeRegistries = () => {
            registriesRef.value.acceptParams({ registries: form.registries });
        };
        const onChangeSockPath = () => {
            sockPathRef.value.acceptParams({ dockerSockPath: form.dockerSockPath });
        };
        const handleIPv6 = async () => {
            if (form.ipv6) {
                ipv6OptionRef.value.acceptParams({
                    fixedCidrV6: form.fixedCidrV6,
                    ip6Tables: form.ip6Tables,
                    experimental: form.experimental,
                });
                return;
            }
            let params = {
                header: i18n.global.t('database.confChange'),
                operationInfo: i18n.global.t('container.restartHelper'),
                submitInputInfo: i18n.global.t('database.restartNow'),
            };
            confirmDialogRefIpv6.value!.acceptParams(params);
        };
        const onSaveIPv6 = () => {
            save('Ipv6', 'disable');
        };
        const handleLogOption = async () => {
            if (form.logOptionShow) {
                logOptionRef.value.acceptParams({ logMaxSize: form.logMaxSize, logMaxFile: form.logMaxFile });
                return;
            }
            let params = {
                header: i18n.global.t('database.confChange'),
                operationInfo: i18n.global.t('container.restartHelper'),
                submitInputInfo: i18n.global.t('database.restartNow'),
            };
            confirmDialogRefLog.value!.acceptParams(params);
        };
        const onSubmitSaveLog = async () => {
            save('LogOption', 'disable');
        };
        const handleIptables = () => {
            if (form.iptables) {
                let params = {
                    header: i18n.global.t('database.confChange'),
                    operationInfo: i18n.global.t('container.restartHelper'),
                    submitInputInfo: i18n.global.t('database.restartNow'),
                };
                confirmDialogRefIptable.value!.acceptParams(params);
                return;
            } else {
                open.value = true;
            }
        };
        const onSubmitCloseIPtable = () => {
            save('IPtables', 'disable');
            open.value = false;
        };
        const onSubmitOpenIPtable = () => {
            save('IPtables', 'enable');
        };
        const handleNVIDIA = () => {
            confirmDialogRefNVIDIA.value.acceptParams({
                header: i18n.global.t('database.confChange'),
                operationInfo: form.nvidia
                    ? i18n.global.t('container.restartHelper')
                    : `${i18n.global.t('container.nvidiaChangeHelper')} ${i18n.global.t('container.restartHelper')}`,
                submitInputInfo: i18n.global.t('database.restartNow'),
            });
        };
        const onSubmitSaveNVIDIA = () => {
            save('NVIDIA', form.nvidia ? 'enable' : 'disable');
        };
        const handleLive = async () => {
            let params = {
                header: i18n.global.t('database.confChange'),
                operationInfo: i18n.global.t('container.restartHelper'),
                submitInputInfo: i18n.global.t('database.restartNow'),
            };
            confirmDialogRefLive.value!.acceptParams(params);
        };
        const onSubmitSaveLive = () => {
            save('LiveRestore', form.liveRestore ? 'enable' : 'disable');
        };
        const handleCgroup = async () => {
            let params = {
                header: i18n.global.t('database.confChange'),
                operationInfo: i18n.global.t('container.restartHelper'),
                submitInputInfo: i18n.global.t('database.restartNow'),
            };
            confirmDialogRefCgroup.value!.acceptParams(params);
        };
        const onSubmitSaveCgroup = () => {
            save('Driver', form.cgroupDriver);
        };
        const save = async (key: string, value: string) => {
            loading.value = true;
            await rpc.container
                .updateDaemonJson({ key, value })
                .then(() => {
                    loading.value = false;
                    search();
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                })
                .catch(() => {
                    search();
                    loading.value = false;
                });
        };
        const toDoc = () => {
            window.open(docsUrl.value + '/user_manual/containers/setting/', '_blank', 'noopener,noreferrer');
        };
        const onOperator = async (operation: string) => {
            ElMessageBox.confirm(
                i18n.global.t('container.operatorStatusHelper', [i18n.global.t('commons.button.' + operation)]),
                i18n.global.t('commons.table.operate'),
                {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                    type: 'info',
                },
            ).then(async () => {
                loading.value = true;
                await rpc.container
                    .operateDocker({ operation })
                    .then(() => {
                        loading.value = false;
                        window.location.reload();
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            });
        };
        const onSubmitSaveFile = async () => {
            let param = { file: dockerConf.value };
            loading.value = true;
            await rpc.container
                .updateDaemonJsonByFile(param as any)
                .then(() => {
                    loading.value = false;
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                })
                .catch(() => {
                    loading.value = false;
                });
            return;
        };
        const loadDockerConf = async () => {
            const res = await loadDaemonJsonFile();
            if (res.data === 'daemon.json is not find in path') {
                showDaemonJsonAlert.value = true;
            } else {
                dockerConf.value = res.data;
            }
        };
        const changeMode = async () => {
            if (confShowType.value === 'all') {
                loadDockerConf();
            } else {
                showDaemonJsonAlert.value = false;
                search();
            }
        };
        const search = async () => {
            const res = await rpc.container.getDaemonJson({});
            form.isSwarm = res.isSwarm;
            form.version = res.version;
            form.cgroupDriver = res.cgroupDriver || 'cgroupfs';
            form.liveRestore = res.liveRestore;
            form.nvidia = res.nvidia;
            form.nvidiaSupported = res.nvidiaSupported;
            form.iptables = res.iptables;
            form.mirrors = res.registryMirrors ? res.registryMirrors.join('\n') : '';
            form.registries = res.insecureRegistries ? res.insecureRegistries.join('\n') : '';
            if (res.logMaxFile || res.logMaxSize) {
                form.logOptionShow = true;
                logOptionShow.value = true;
                form.logMaxFile = Number(res.logMaxFile);
                form.logMaxSize = res.logMaxSize;
            } else {
                form.logOptionShow = false;
                logOptionShow.value = false;
            }
            form.ipv6 = res.ipv6;
            ipv6OptionShow.value = form.ipv6;
            form.fixedCidrV6 = res.fixedCidrV6;
            form.ip6Tables = res.ip6Tables;
            form.experimental = res.experimental;

            const settingRes = await rpc.agentSetting.getInfo({});
            form.dockerSockPath = settingRes.dockerSockPath || 'unix:///var/run/docker.sock';
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
                        is-hide={true}
                        loading={unref(loading)}
                        onUpdate:loading={($v) => {
                            loading.value = $v as any;
                        }}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    {unref(isExist) ? (
                        <div class={'app-status card-interval'}>
                            <ElCard>
                                <div class={'flex w-full flex-col gap-4 md:flex-row'}>
                                    <div class={'ml-3 flex flex-wrap gap-4'}>
                                        <ElTag effect="dark" type="success" class={'float-left'}>
                                            {'Docker'}
                                        </ElTag>
                                        <Status status={unref(isActive) ? 'enable' : 'disable'} class={'mt-0.5'} />
                                        <ElTag>
                                            {$t('app.version')}
                                            {': '}
                                            {form.version}
                                        </ElTag>
                                    </div>
                                    <div class={'mt-0.5'}>
                                        {unref(isActive)
                                            ? withDirectives(
                                                  <ElButton
                                                      type="primary"
                                                      onClick={($event?: any) => {
                                                          onOperator('stop');
                                                      }}
                                                      link
                                                  >
                                                      {$t('commons.operate.stop')}
                                                  </ElButton>,
                                                  [[permissionDirective, true]],
                                              )
                                            : null}
                                        {!unref(isActive)
                                            ? withDirectives(
                                                  <ElButton
                                                      type="primary"
                                                      onClick={($event?: any) => {
                                                          onOperator('start');
                                                      }}
                                                      link
                                                  >
                                                      {$t('commons.operate.start')}
                                                  </ElButton>,
                                                  [[permissionDirective, true]],
                                              )
                                            : null}
                                        <ElDivider direction="vertical" />
                                        {withDirectives(
                                            <ElButton
                                                type="primary"
                                                onClick={($event?: any) => {
                                                    onOperator('restart');
                                                }}
                                                link
                                            >
                                                {$t('commons.button.restart')}
                                            </ElButton>,
                                            [[permissionDirective, true]],
                                        )}
                                    </div>
                                </div>
                            </ElCard>
                        </div>
                    ) : null}
                    {unref(isExist) ? (
                        <LayoutContent
                            title={$t('container.setting', 2)}
                            class={'card-interval'}
                            v-slots={{
                                main: () => (
                                    <>
                                        <ElRadioGroup
                                            modelValue={unref(confShowType)}
                                            onUpdate:modelValue={($v) => {
                                                confShowType.value = $v as any;
                                            }}
                                            onChange={($event?: any) => {
                                                (changeMode as any)($event);
                                            }}
                                        >
                                            <ElRadioButton value="base">{$t('database.baseConf')}</ElRadioButton>
                                            <ElRadioButton value="all">{$t('database.allConf')}</ElRadioButton>
                                        </ElRadioGroup>
                                        {unref(confShowType) === 'base' ? (
                                            <ElRow class={'p-mt-20'}>
                                                <ElCol span={1}>
                                                    <br />
                                                </ElCol>
                                                <ElCol xs={24} sm={24} md={15} lg={12} xl={10}>
                                                    <ElForm
                                                        model={form}
                                                        label-position={unref(isMobile) ? 'top' : 'left'}
                                                        rules={rules}
                                                        ref={formRef}
                                                        label-width="auto"
                                                    >
                                                        <ElFormItem label={$t('container.mirrors')} prop="mirrors">
                                                            {form.mirrors ? (
                                                                <div
                                                                    class={
                                                                        'flex w-full min-w-0 flex-col items-start gap-2 md:flex-row md:gap-0'
                                                                    }
                                                                >
                                                                    <ElInput
                                                                        type="textarea"
                                                                        rows={5}
                                                                        disabled
                                                                        modelValue={form.mirrors}
                                                                        onUpdate:modelValue={($v) => {
                                                                            form.mirrors = $v as any;
                                                                        }}
                                                                        class={'w-full min-w-0 md:flex-1'}
                                                                    />
                                                                    {withDirectives(
                                                                        <ElButton
                                                                            onClick={($event?: any) => {
                                                                                (onChangeMirrors as any)($event);
                                                                            }}
                                                                            icon="Setting"
                                                                            class={
                                                                                'custom-input-textarea w-full md:w-auto'
                                                                            }
                                                                        >
                                                                            {$t('commons.button.set')}
                                                                        </ElButton>,
                                                                        [[permissionDirective, true]],
                                                                    )}
                                                                </div>
                                                            ) : null}
                                                            {!form.mirrors ? (
                                                                <ElInput
                                                                    disabled
                                                                    modelValue={unref(unset)}
                                                                    onUpdate:modelValue={($v) => {
                                                                        unset.value = $v as any;
                                                                    }}
                                                                    v-slots={{
                                                                        append: () => (
                                                                            <>
                                                                                {withDirectives(
                                                                                    <ElButton
                                                                                        onClick={($event?: any) => {
                                                                                            (onChangeMirrors as any)(
                                                                                                $event,
                                                                                            );
                                                                                        }}
                                                                                        icon="Setting"
                                                                                    >
                                                                                        {$t('commons.button.set')}
                                                                                    </ElButton>,
                                                                                    [[permissionDirective, true]],
                                                                                )}
                                                                            </>
                                                                        ),
                                                                    }}
                                                                />
                                                            ) : null}
                                                            <span class={'input-help'}>
                                                                {$t('container.mirrorsHelper')}
                                                            </span>
                                                            <span
                                                                class={
                                                                    'input-help flx-align-center flex min-w-0 flex-wrap'
                                                                }
                                                            >
                                                                {$t('container.mirrorsHelper2')}
                                                                <ElLink
                                                                    icon="Position"
                                                                    onClick={($event?: any) => {
                                                                        toDoc();
                                                                    }}
                                                                    type="primary"
                                                                    class={'p-ml-5 text-xs'}
                                                                >
                                                                    {$t('firewall.quickJump')}
                                                                </ElLink>
                                                            </span>
                                                        </ElFormItem>
                                                        <ElFormItem
                                                            label={$t('container.registries')}
                                                            prop="registries"
                                                        >
                                                            {form.registries ? (
                                                                <div
                                                                    class={
                                                                        'flex w-full min-w-0 flex-col items-start gap-2 md:flex-row md:gap-0'
                                                                    }
                                                                >
                                                                    <ElInput
                                                                        type="textarea"
                                                                        rows={5}
                                                                        disabled
                                                                        modelValue={form.registries}
                                                                        onUpdate:modelValue={($v) => {
                                                                            form.registries = $v as any;
                                                                        }}
                                                                        class={'w-full min-w-0 md:flex-1'}
                                                                    />
                                                                    {withDirectives(
                                                                        <ElButton
                                                                            onClick={($event?: any) => {
                                                                                (onChangeRegistries as any)($event);
                                                                            }}
                                                                            icon="Setting"
                                                                            class={'w-full md:w-auto'}
                                                                        >
                                                                            {$t('commons.button.set')}
                                                                        </ElButton>,
                                                                        [[permissionDirective, true]],
                                                                    )}
                                                                </div>
                                                            ) : null}
                                                            {!form.registries ? (
                                                                <ElInput
                                                                    disabled
                                                                    modelValue={unref(unset)}
                                                                    onUpdate:modelValue={($v) => {
                                                                        unset.value = $v as any;
                                                                    }}
                                                                    v-slots={{
                                                                        append: () => (
                                                                            <>
                                                                                {withDirectives(
                                                                                    <ElButton
                                                                                        onClick={($event?: any) => {
                                                                                            (onChangeRegistries as any)(
                                                                                                $event,
                                                                                            );
                                                                                        }}
                                                                                        icon="Setting"
                                                                                    >
                                                                                        {$t('commons.button.set')}
                                                                                    </ElButton>,
                                                                                    [[permissionDirective, true]],
                                                                                )}
                                                                            </>
                                                                        ),
                                                                    }}
                                                                />
                                                            ) : null}
                                                        </ElFormItem>
                                                        <ElFormItem label="IPv6" prop="ipv6">
                                                            {withDirectives(
                                                                <ElSwitch
                                                                    modelValue={form.ipv6}
                                                                    onUpdate:modelValue={($v) => {
                                                                        form.ipv6 = $v as any;
                                                                    }}
                                                                    onChange={($event?: any) => {
                                                                        (handleIPv6 as any)($event);
                                                                    }}
                                                                />,
                                                                [[permissionDirective, true]],
                                                            )}
                                                            <span class={'input-help'} />
                                                            {unref(ipv6OptionShow) ? (
                                                                <div>
                                                                    <ElTag>
                                                                        {$t('container.subnet')}
                                                                        {': '}
                                                                        {form.fixedCidrV6}
                                                                    </ElTag>
                                                                    <div>
                                                                        <ElButton
                                                                            onClick={($event?: any) => {
                                                                                (handleIPv6 as any)($event);
                                                                            }}
                                                                            type="primary"
                                                                            link
                                                                        >
                                                                            {$t('commons.button.view')}
                                                                        </ElButton>
                                                                    </div>
                                                                </div>
                                                            ) : null}
                                                        </ElFormItem>
                                                        <ElFormItem label={$t('container.cutLog')} prop="hasLogOption">
                                                            {withDirectives(
                                                                <ElSwitch
                                                                    modelValue={form.logOptionShow}
                                                                    onUpdate:modelValue={($v) => {
                                                                        form.logOptionShow = $v as any;
                                                                    }}
                                                                    onChange={($event?: any) => {
                                                                        (handleLogOption as any)($event);
                                                                    }}
                                                                />,
                                                                [[permissionDirective, true]],
                                                            )}
                                                            <span class={'input-help'} />
                                                            {unref(logOptionShow) ? (
                                                                <div>
                                                                    <ElTag>
                                                                        {$t('container.maxSize')}
                                                                        {': '}
                                                                        {form.logMaxSize}
                                                                    </ElTag>
                                                                    <ElTag class={'p-ml-5'}>
                                                                        {$t('container.maxFile')}
                                                                        {': '}
                                                                        {form.logMaxFile}
                                                                    </ElTag>
                                                                    <div>
                                                                        <ElButton
                                                                            onClick={($event?: any) => {
                                                                                (handleLogOption as any)($event);
                                                                            }}
                                                                            type="primary"
                                                                            link
                                                                        >
                                                                            {$t('commons.button.view')}
                                                                        </ElButton>
                                                                    </div>
                                                                </div>
                                                            ) : null}
                                                        </ElFormItem>
                                                        <ElFormItem label="iptables" prop="iptables">
                                                            {withDirectives(
                                                                <ElSwitch
                                                                    modelValue={form.iptables}
                                                                    onUpdate:modelValue={($v) => {
                                                                        form.iptables = $v as any;
                                                                    }}
                                                                    onChange={($event?: any) => {
                                                                        (handleIptables as any)($event);
                                                                    }}
                                                                />,
                                                                [[permissionDirective, true]],
                                                            )}
                                                            <span class={'input-help'}>
                                                                {$t('container.iptablesHelper1')}
                                                            </span>
                                                        </ElFormItem>
                                                        <ElFormItem label={$t('container.nvidiaSupport')} prop="nvidia">
                                                            {withDirectives(
                                                                <ElSwitch
                                                                    modelValue={form.nvidia}
                                                                    onUpdate:modelValue={($v) => {
                                                                        form.nvidia = $v as any;
                                                                    }}
                                                                    disabled={!form.nvidiaSupported}
                                                                    onChange={($event?: any) => {
                                                                        (handleNVIDIA as any)($event);
                                                                    }}
                                                                />,
                                                                [[permissionDirective, true]],
                                                            )}
                                                            <span class={'input-help'}>
                                                                {$t('container.nvidiaHelper')}
                                                            </span>
                                                            {!form.nvidiaSupported ? (
                                                                <span class={'input-help'}>
                                                                    {$t('container.nvidiaLocalOnly')}
                                                                </span>
                                                            ) : null}
                                                        </ElFormItem>
                                                        <ElFormItem label="Live restore" prop="liveRestore">
                                                            {withDirectives(
                                                                <ElSwitch
                                                                    disabled={form.isSwarm}
                                                                    modelValue={form.liveRestore}
                                                                    onUpdate:modelValue={($v) => {
                                                                        form.liveRestore = $v as any;
                                                                    }}
                                                                    onChange={($event?: any) => {
                                                                        (handleLive as any)($event);
                                                                    }}
                                                                />,
                                                                [[permissionDirective, true]],
                                                            )}
                                                            <span class={'input-help'}>
                                                                {$t('container.liveHelper')}
                                                            </span>
                                                            {form.isSwarm ? (
                                                                <span class={'input-help'}>
                                                                    {$t('container.liveWithSwarmHelper')}
                                                                </span>
                                                            ) : null}
                                                        </ElFormItem>
                                                        <ElFormItem label="Cgroup Driver" prop="cgroupDriver">
                                                            {withDirectives(
                                                                <ElRadioGroup
                                                                    modelValue={form.cgroupDriver}
                                                                    onUpdate:modelValue={($v) => {
                                                                        form.cgroupDriver = $v as any;
                                                                    }}
                                                                    onChange={($event?: any) => {
                                                                        (handleCgroup as any)($event);
                                                                    }}
                                                                >
                                                                    <ElRadio value="cgroupfs">{'cgroupfs'}</ElRadio>
                                                                    <ElRadio value="systemd">{'systemd'}</ElRadio>
                                                                </ElRadioGroup>,
                                                                [[permissionDirective, true]],
                                                            )}
                                                        </ElFormItem>
                                                        <ElFormItem
                                                            label={$t('container.sockPath')}
                                                            prop="dockerSockPath"
                                                        >
                                                            <ElInput
                                                                disabled
                                                                modelValue={form.dockerSockPath}
                                                                onUpdate:modelValue={($v) => {
                                                                    form.dockerSockPath = $v as any;
                                                                }}
                                                                v-slots={{
                                                                    append: () => (
                                                                        <>
                                                                            {withDirectives(
                                                                                <ElButton
                                                                                    onClick={($event?: any) => {
                                                                                        (onChangeSockPath as any)(
                                                                                            $event,
                                                                                        );
                                                                                    }}
                                                                                    icon="Setting"
                                                                                >
                                                                                    {$t('commons.button.set')}
                                                                                </ElButton>,
                                                                                [[permissionDirective, true]],
                                                                            )}
                                                                        </>
                                                                    ),
                                                                }}
                                                            />
                                                            <span class={'input-help'}>
                                                                {$t('container.sockPathHelper')}
                                                            </span>
                                                        </ElFormItem>
                                                    </ElForm>
                                                </ElCol>
                                            </ElRow>
                                        ) : null}
                                        {unref(confShowType) === 'all' ? (
                                            <div>
                                                <CodemirrorPro
                                                    heightDiff={loadHeight()}
                                                    minHeight={350}
                                                    modelValue={unref(dockerConf)}
                                                    onUpdate:modelValue={($v) => {
                                                        dockerConf.value = $v as any;
                                                    }}
                                                    mode="json"
                                                    placeholder="# The Docker configuration file does not exist or is empty"
                                                    class={'mt-5'}
                                                />
                                                {withDirectives(
                                                    <ElButton
                                                        disabled={unref(loading)}
                                                        type="primary"
                                                        onClick={($event?: any) => {
                                                            (onSaveFile as any)($event);
                                                        }}
                                                        class={'mt-2.5'}
                                                    >
                                                        {$t('commons.button.save')}
                                                    </ElButton>,
                                                    [[permissionDirective, true]],
                                                )}
                                            </div>
                                        ) : null}
                                    </>
                                ),
                            }}
                        />
                    ) : null}
                    <DialogPro
                        modelValue={unref(open)}
                        onUpdate:modelValue={($v) => {
                            open.value = $v as any;
                        }}
                        title={$t('container.iptablesDisable')}
                        size="small"
                        v-slots={{
                            footer: () => (
                                <>
                                    <span class={'dialog-footer'}>
                                        <ElButton
                                            onClick={($event?: any) => {
                                                open.value = false;
                                                search();
                                            }}
                                        >
                                            {$t('commons.button.cancel')}
                                        </ElButton>
                                        {withDirectives(
                                            <ElButton
                                                disabled={unref(submitInput) !== $t('database.restartNow')}
                                                type="primary"
                                                onClick={($event?: any) => {
                                                    (onSubmitCloseIPtable as any)($event);
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
                        <div class={'mt-2.5'}>
                            <span class={'text-rose-500'}>{$t('container.iptablesHelper2')}</span>
                            <div class={'mt-2.5'}>
                                <span class={'text-xs'}>{$t('container.restartHelper')}</span>
                            </div>
                            <div class={'mt-2.5'}>
                                <span class={'text-xs'}>{$t('commons.msg.operateConfirm')}</span>
                                <span class={'text-xs font-medium text-rose-500'}>
                                    {"'"}
                                    {$t('database.restartNow')}
                                    {"'"}
                                </span>
                            </div>
                            <ElInput
                                modelValue={unref(submitInput)}
                                onUpdate:modelValue={($v) => {
                                    submitInput.value = $v as any;
                                }}
                                class={'mt-2.5'}
                            />
                        </div>
                    </DialogPro>
                    <Mirror
                        ref={mirrorRef}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    <Registry
                        ref={registriesRef}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    <LogOption
                        ref={logOptionRef}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    <Ipv6Option
                        ref={ipv6OptionRef}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    <SockPath
                        ref={sockPathRef}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    <ConfirmDialog
                        ref={confirmDialogRefIpv6}
                        onConfirm={($event?: any) => {
                            (onSaveIPv6 as any)($event);
                        }}
                        onCancel={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    <ConfirmDialog
                        ref={confirmDialogRefIptable}
                        onConfirm={($event?: any) => {
                            (onSubmitOpenIPtable as any)($event);
                        }}
                        onCancel={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    <ConfirmDialog
                        ref={confirmDialogRefLog}
                        onConfirm={($event?: any) => {
                            (onSubmitSaveLog as any)($event);
                        }}
                        onCancel={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    <ConfirmDialog
                        ref={confirmDialogRefNVIDIA}
                        onConfirm={($event?: any) => {
                            (onSubmitSaveNVIDIA as any)($event);
                        }}
                        onCancel={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    <ConfirmDialog
                        ref={confirmDialogRefLive}
                        onConfirm={($event?: any) => {
                            (onSubmitSaveLive as any)($event);
                        }}
                        onCancel={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    <ConfirmDialog
                        ref={confirmDialogRefCgroup}
                        onConfirm={($event?: any) => {
                            (onSubmitSaveCgroup as any)($event);
                        }}
                        onCancel={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    <ConfirmDialog
                        ref={confirmDialogRefFile}
                        onConfirm={($event?: any) => {
                            (onSubmitSaveFile as any)($event);
                        }}
                        onCancel={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                </div>,
                [[vLoading, unref(loading)]],
            );
    },
    options,
);
