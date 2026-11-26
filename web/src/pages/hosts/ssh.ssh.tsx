import { $t } from '@/utils/i18n-t';
import FireRouter from '@/pages/views/host/ssh/index';
import AuthKeys from '@/pages/views/host/ssh/ssh/auth-keys/index';
import Cert from '@/pages/views/host/ssh/ssh/certification/index';
import Root from '@/pages/views/host/ssh/ssh/root/index';
import Port from '@/pages/views/host/ssh/ssh/port/index';
import Address from '@/pages/views/host/ssh/ssh/address/index';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import CodemirrorPro from '@/components/codemirror-pro/index';
import { rpc } from '@/lib/rpc';
import permissionDirective from '@/directives/modules/permission';
import { nodeAdminDirective } from '@/directives/modules/permission';
import Status from '@/components/status/index';
import LayoutContent from '@/components/layout-content/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'ssh.ssh',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref(false);
        const formRef = ref();
        const confShowType = ref('base');
        const pubKeyRef = ref();
        const portRef = ref();
        const addressRef = ref();
        const rootsRef = ref();
        const authKeyRef = ref();
        const autoStart = ref('enable');
        const allConfMode = ref('');
        const sshConfPath = ref('');
        const sshConfOptions = ref<Array<{ value: string; label: string }>>([]);
        const allConfContent = computed({
            get: () => sshConfPath.value,
            set: (value: string) => {
                sshConfPath.value = value;
            },
        });
        const form = reactive({
            isActive: false,
            message: '',
            port: '22',
            listenAddress: '',
            listenAddressItem: '',
            passwordAuthentication: 'yes',
            pubkeyAuthentication: 'yes',
            encryptionMode: '',
            primaryKey: '',
            permitRootLogin: 'yes',
            permitRootLoginItem: 'yes',
            useDNS: 'no',
            currentUser: 'root',
        });
        const onSaveFile = async () => {
            ElMessageBox.confirm(i18n.global.t('ssh.sshFileChangeHelper'), i18n.global.t('ssh.sshChange'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
                type: 'info',
            }).then(async () => {
                loading.value = true;
                if (!allConfMode.value) {
                    loading.value = false;
                    return;
                }
                await rpc.ssh
                    .updateFile({ key: 'sshdConfPath', path: sshConfPath.value, value: allConfMode.value })
                    .then(() => {
                        loading.value = false;
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            });
        };
        const onOpenDrawer = () => {
            pubKeyRef.value.acceptParams(form.currentUser);
        };
        const onOpenAuthKeys = () => {
            authKeyRef.value.acceptParams();
        };
        const onChangePort = () => {
            portRef.value.acceptParams({ port: form.port });
        };
        const onChangeRoot = () => {
            rootsRef.value.acceptParams({ permitRootLogin: form.permitRootLogin });
        };
        const onChangeAddress = () => {
            addressRef.value.acceptParams({ address: form.listenAddress, port: loadPrimarySSHPort(form.port) });
        };
        const onOperate = async (operation: string) => {
            let msg = operation === 'enable' || operation === 'disable' ? 'ssh.' : 'commons.button.';
            ElMessageBox.confirm(i18n.global.t('ssh.sshOperate', [i18n.global.t(msg + operation)]), 'SSH', {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
                type: 'info',
            })
                .then(async () => {
                    loading.value = true;
                    await rpc.ssh
                        .operate({ operation })
                        .then(() => {
                            loading.value = false;
                            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                            search();
                        })
                        .catch(() => {
                            autoStart.value = operation === 'enable' ? 'disable' : 'enable';
                            loading.value = false;
                        });
                })
                .catch(() => {
                    search();
                });
        };
        const onSave = async (formEl: FormInstance | undefined, key: string, value: string) => {
            if (!formEl) return;
            let itemKey = key.replace(key[0], key[0].toLowerCase());
            const result = await formEl.validateField(itemKey, callback);
            if (!result) {
                return;
            }

            ElMessageBox.confirm(
                i18n.global.t('ssh.sshChangeHelper', [i18n.global.t('ssh.' + itemKey), changeI18n(value)]),
                i18n.global.t('ssh.sshChange'),
                {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                    type: 'info',
                },
            )
                .then(async () => {
                    let params = {
                        key: key,
                        newValue: value,
                    };
                    loading.value = true;
                    await rpc.ssh
                        .update(params as any)
                        .then(() => {
                            loading.value = false;
                            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        })
                        .catch(() => {
                            loading.value = false;
                        });
                })
                .catch(() => {
                    search();
                });
        };
        function callback(error: any) {
            if (error) {
                return error.message;
            } else {
                return;
            }
        }
        const changeI18n = (value: string) => {
            switch (value) {
                case 'yes':
                    return i18n.global.t('commons.button.enable');
                case 'no':
                    return i18n.global.t('commons.button.disable');
                default:
                    return value;
            }
        };
        const loadSSHConf = async () => {
            const optionsRes = await rpc.ssh.loadFile({ name: 'sshdConfOptions' });
            let options: Array<{ path: string; priority: number }> = [];
            try {
                options = JSON.parse(optionsRes.content || '[]');
            } catch {
                options = [];
            }
            const fileOptions = options.map((item) => ({
                value: item.path,
                label: i18n.global.t('ssh.confFileOrderLabel', [item.path, item.priority]),
            }));
            sshConfOptions.value = fileOptions;
            if (!fileOptions.find((item) => item.value === allConfMode.value)) {
                allConfMode.value = fileOptions.length > 0 ? fileOptions[0].value : '';
            }
            if (allConfMode.value) {
                const fileRes = await rpc.ssh.loadFile({ name: `sshdConfPath:${allConfMode.value}` });
                sshConfPath.value = fileRes.content || '';
            } else {
                sshConfPath.value = '';
            }
        };
        const changeMode = async () => {
            if (confShowType.value === 'all') {
                loadSSHConf();
            } else {
                search();
            }
        };
        const search = async () => {
            const res = await rpc.ssh.getInfo({});
            form.isActive = res.isActive;
            form.port = res.port || '22';
            autoStart.value = res.autoStart ? 'enable' : 'disable';
            form.listenAddress = res.listenAddress;
            form.listenAddressItem =
                form.listenAddress === '' || form.listenAddress === '0.0.0.0,::'
                    ? i18n.global.t('ssh.allV4V6', [form.port])
                    : form.listenAddress;
            form.passwordAuthentication = res.passwordAuthentication;
            form.pubkeyAuthentication = res.pubkeyAuthentication;
            form.permitRootLogin = res.permitRootLogin;
            form.permitRootLoginItem = loadPermitLabel(res.permitRootLogin);
            form.useDNS = res.useDns;
            form.currentUser = res.currentUser;
        };
        const changeAllConfMode = async () => {
            if (allConfMode.value) {
                const res = await rpc.ssh.loadFile({ name: `sshdConfPath:${allConfMode.value}` });
                sshConfPath.value = res.content || '';
            } else {
                sshConfPath.value = '';
            }
        };
        const loadPermitLabel = (value: string) => {
            switch (value) {
                case 'yes':
                    return i18n.global.t('ssh.rootHelper1');
                case 'no':
                    return i18n.global.t('ssh.rootHelper2');
                case 'without-password':
                    return i18n.global.t('ssh.rootHelper3');
                case 'forced-commands-only':
                    return i18n.global.t('ssh.rootHelper4');
            }
        };
        const loadPrimarySSHPort = (port: string) => {
            const firstPort = port.split(',')[0] || '22';
            const portNumber = Number(firstPort);
            return Number.isNaN(portNumber) ? 22 : portNumber;
        };
        onMounted(() => {
            search();
        });
        return () =>
            withDirectives(
                <div>
                    <FireRouter />
                    <div class={'app-status card-interval'}>
                        <ElCard>
                            <div class={'flex w-full flex-col gap-4 md:flex-row'}>
                                <div class={'ml-3 flex flex-wrap gap-4'}>
                                    <ElTag effect="dark" type="success" class={'float-left'}>
                                        {'SSH'}
                                    </ElTag>
                                    <Status
                                        status={form.isActive ? 'enable' : 'disable'}
                                        msg={form.message}
                                        class={'mt-0.5'}
                                    />
                                </div>
                                <div class={'mt-0.5'}>
                                    {form.isActive
                                        ? withDirectives(
                                              <ElButton
                                                  type="primary"
                                                  onClick={($event?: any) => {
                                                      onOperate('stop');
                                                  }}
                                                  link
                                              >
                                                  {$t('commons.button.stop')}
                                              </ElButton>,
                                              [
                                                  [permissionDirective, true],
                                                  [nodeAdminDirective, true],
                                              ],
                                          )
                                        : null}
                                    {!form.isActive
                                        ? withDirectives(
                                              <ElButton
                                                  type="primary"
                                                  onClick={($event?: any) => {
                                                      onOperate('start');
                                                  }}
                                                  link
                                              >
                                                  {$t('commons.button.start')}
                                              </ElButton>,
                                              [
                                                  [permissionDirective, true],
                                                  [nodeAdminDirective, true],
                                              ],
                                          )
                                        : null}
                                    <ElDivider direction="vertical" />
                                    {withDirectives(
                                        <ElButton
                                            type="primary"
                                            onClick={($event?: any) => {
                                                onOperate('restart');
                                            }}
                                            link
                                        >
                                            {$t('commons.button.restart')}
                                        </ElButton>,
                                        [
                                            [permissionDirective, true],
                                            [nodeAdminDirective, true],
                                        ],
                                    )}
                                    <ElDivider direction="vertical" />
                                    <ElButton type="primary" link>
                                        {$t('ssh.autoStart')}
                                    </ElButton>
                                    {withDirectives(
                                        <ElSwitch
                                            size="small"
                                            inactive-value="disable"
                                            active-value="enable"
                                            onChange={($event?: any) => {
                                                onOperate(unref(autoStart));
                                            }}
                                            modelValue={unref(autoStart)}
                                            onUpdate:modelValue={($v) => {
                                                autoStart.value = $v as any;
                                            }}
                                            class={'ml-2'}
                                        />,
                                        [
                                            [permissionDirective, true],
                                            [nodeAdminDirective, true],
                                        ],
                                    )}
                                </div>
                            </div>
                        </ElCard>
                    </div>
                    <LayoutContent
                        v-slots={{
                            leftToolBar: () => (
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
                                    {withDirectives(
                                        <ElButton
                                            onClick={($event?: any) => {
                                                (onOpenDrawer as any)($event);
                                            }}
                                        >
                                            {$t('ssh.pubkey')}
                                        </ElButton>,
                                        [
                                            [permissionDirective, true],
                                            [nodeAdminDirective, true],
                                        ],
                                    )}
                                    {withDirectives(
                                        <ElButton
                                            onClick={($event?: any) => {
                                                (onOpenAuthKeys as any)($event);
                                            }}
                                        >
                                            {$t('ssh.authKeys')}
                                        </ElButton>,
                                        [
                                            [permissionDirective, true],
                                            [nodeAdminDirective, true],
                                        ],
                                    )}
                                </>
                            ),
                            main: () => (
                                <>
                                    {unref(confShowType) === 'base' ? (
                                        <ElRow class={'mt-10'}>
                                            <ElCol xs={24} sm={20} md={20} lg={10} xl={10}>
                                                <ElForm
                                                    model={form}
                                                    label-position="right"
                                                    ref={formRef}
                                                    label-width="120px"
                                                >
                                                    <ElFormItem label={$t('ssh.port')} prop="port">
                                                        <ElInput
                                                            disabled
                                                            modelValue={form.port}
                                                            onUpdate:modelValue={($v) => {
                                                                form.port = $v as any;
                                                            }}
                                                            v-slots={{
                                                                append: () => (
                                                                    <>
                                                                        {withDirectives(
                                                                            <ElButton
                                                                                onClick={($event?: any) => {
                                                                                    (onChangePort as any)($event);
                                                                                }}
                                                                                icon="Setting"
                                                                            >
                                                                                {$t('commons.button.set')}
                                                                            </ElButton>,
                                                                            [
                                                                                [permissionDirective, true],
                                                                                [nodeAdminDirective, true],
                                                                            ],
                                                                        )}
                                                                    </>
                                                                ),
                                                            }}
                                                        />
                                                        <span class={'input-help'}>{$t('ssh.portHelper')}</span>
                                                    </ElFormItem>
                                                    <ElFormItem label={$t('ssh.listenAddress')} prop="listenAddress">
                                                        <ElInput
                                                            disabled
                                                            modelValue={form.listenAddressItem}
                                                            onUpdate:modelValue={($v) => {
                                                                form.listenAddressItem = $v as any;
                                                            }}
                                                            v-slots={{
                                                                append: () => (
                                                                    <>
                                                                        {withDirectives(
                                                                            <ElButton
                                                                                onClick={($event?: any) => {
                                                                                    (onChangeAddress as any)($event);
                                                                                }}
                                                                                icon="Setting"
                                                                            >
                                                                                {$t('commons.button.set')}
                                                                            </ElButton>,
                                                                            [
                                                                                [permissionDirective, true],
                                                                                [nodeAdminDirective, true],
                                                                            ],
                                                                        )}
                                                                    </>
                                                                ),
                                                            }}
                                                        />
                                                        <span class={'input-help'}>{$t('ssh.addressHelper')}</span>
                                                    </ElFormItem>
                                                    <ElFormItem
                                                        label={$t('ssh.permitRootLogin')}
                                                        prop="permitRootLoginItem"
                                                    >
                                                        <ElInput
                                                            disabled
                                                            modelValue={form.permitRootLoginItem}
                                                            onUpdate:modelValue={($v) => {
                                                                form.permitRootLoginItem = $v as any;
                                                            }}
                                                            v-slots={{
                                                                append: () => (
                                                                    <>
                                                                        {withDirectives(
                                                                            <ElButton
                                                                                onClick={($event?: any) => {
                                                                                    (onChangeRoot as any)($event);
                                                                                }}
                                                                                icon="Setting"
                                                                            >
                                                                                {$t('commons.button.set')}
                                                                            </ElButton>,
                                                                            [
                                                                                [permissionDirective, true],
                                                                                [nodeAdminDirective, true],
                                                                            ],
                                                                        )}
                                                                    </>
                                                                ),
                                                            }}
                                                        />
                                                        <span class={'input-help'}>{$t('ssh.rootSettingHelper')}</span>
                                                    </ElFormItem>
                                                    <ElFormItem
                                                        label={$t('ssh.passwordAuthentication')}
                                                        prop="passwordAuthentication"
                                                    >
                                                        {withDirectives(
                                                            <ElSwitch
                                                                active-value="yes"
                                                                inactive-value="no"
                                                                onChange={($event?: any) => {
                                                                    onSave(
                                                                        unref(formRef),
                                                                        'PasswordAuthentication',
                                                                        form.passwordAuthentication,
                                                                    );
                                                                }}
                                                                modelValue={form.passwordAuthentication}
                                                                onUpdate:modelValue={($v) => {
                                                                    form.passwordAuthentication = $v as any;
                                                                }}
                                                            />,
                                                            [
                                                                [permissionDirective, true],
                                                                [nodeAdminDirective, true],
                                                            ],
                                                        )}
                                                        <span class={'input-help'}>{$t('ssh.pwdAuthHelper')}</span>
                                                    </ElFormItem>
                                                    <ElFormItem
                                                        label={$t('ssh.pubkeyAuthentication')}
                                                        prop="pubkeyAuthentication"
                                                    >
                                                        {withDirectives(
                                                            <ElSwitch
                                                                active-value="yes"
                                                                inactive-value="no"
                                                                onChange={($event?: any) => {
                                                                    onSave(
                                                                        unref(formRef),
                                                                        'PubkeyAuthentication',
                                                                        form.pubkeyAuthentication,
                                                                    );
                                                                }}
                                                                modelValue={form.pubkeyAuthentication}
                                                                onUpdate:modelValue={($v) => {
                                                                    form.pubkeyAuthentication = $v as any;
                                                                }}
                                                            />,
                                                            [
                                                                [permissionDirective, true],
                                                                [nodeAdminDirective, true],
                                                            ],
                                                        )}
                                                        <span class={'input-help'}>{$t('ssh.keyAuthHelper')}</span>
                                                    </ElFormItem>
                                                    <ElFormItem label={$t('ssh.useDNS')} prop="useDNS">
                                                        {withDirectives(
                                                            <ElSwitch
                                                                active-value="yes"
                                                                inactive-value="no"
                                                                onChange={($event?: any) => {
                                                                    onSave(unref(formRef), 'UseDNS', form.useDNS);
                                                                }}
                                                                modelValue={form.useDNS}
                                                                onUpdate:modelValue={($v) => {
                                                                    form.useDNS = $v as any;
                                                                }}
                                                            />,
                                                            [
                                                                [permissionDirective, true],
                                                                [nodeAdminDirective, true],
                                                            ],
                                                        )}
                                                        <span class={'input-help'}>{$t('ssh.dnsHelper')}</span>
                                                    </ElFormItem>
                                                </ElForm>
                                            </ElCol>
                                        </ElRow>
                                    ) : null}
                                    {unref(confShowType) === 'all' ? (
                                        <div>
                                            <ElAlert
                                                type="info"
                                                closable={false}
                                                title={$t('ssh.confFileOrderHelper')}
                                            />
                                            <ElSelect
                                                modelValue={unref(allConfMode)}
                                                onUpdate:modelValue={($v) => {
                                                    allConfMode.value = $v as any;
                                                }}
                                                onChange={($event?: any) => {
                                                    (changeAllConfMode as any)($event);
                                                }}
                                                class={'mini-form-item mt-2'}
                                            >
                                                {(unref(sshConfOptions) || []).map((item) => (
                                                    <ElOption value={item.value} label={item.label} key={item.value} />
                                                ))}
                                            </ElSelect>
                                            <CodemirrorPro
                                                heightDiff={459}
                                                minHeight={350}
                                                modelValue={unref(allConfContent)}
                                                onUpdate:modelValue={($v) => {
                                                    allConfContent.value = $v as any;
                                                }}
                                                mode="nginx"
                                                placeholder="# The SSH configuration file does not exist or is empty (/etc/ssh/sshd_config)"
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
                                                [
                                                    [permissionDirective, true],
                                                    [nodeAdminDirective, true],
                                                ],
                                            )}
                                        </div>
                                    ) : null}
                                </>
                            ),
                        }}
                    />
                    <AuthKeys ref={authKeyRef} />
                    <Cert
                        ref={pubKeyRef}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    <Port
                        ref={portRef}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    <Address
                        ref={addressRef}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    <Root
                        ref={rootsRef}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                </div>,
                [[vLoading, unref(loading)]],
            );
    },
    options,
);

definePage({
    name: 'SSH',
    meta: {
        icon: 'p-ssh-menu',
        title: 'menu.ssh',
        detail: 'menu.config',
        activeMenu: '/hosts/ssh/ssh',
        permission: 'host_ssh_view',
    },
});
