import { $t } from '@/utils/i18n-t';
import PortSetting from '@/pages/settings/_components/safe/port/index';
import BindSetting from '@/pages/settings/_components/safe/bind/index';
import ResponseSetting from '@/pages/settings/_components/safe/response/index';
import SSLSetting from '@/pages/settings/_components/safe/ssl/index';
import ExpirationSetting from '@/pages/settings/_components/safe/expiration/index';
import EntranceSetting from '@/pages/settings/_components/safe/entrance/index';
import DomainSetting from '@/pages/settings/_components/safe/domain/index';
import AllowIPsSetting from '@/pages/settings/_components/safe/allowips/index';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { Setting } from '@/types/setting';
import { useGlobalStore } from '@/composables/useGlobalStore';
import '@/pages/settings/_components/safe/index.styles.css';
import LayoutContent from '@/components/layout-content/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'safe',
    props: {},
    emits: emits,
    __scopeId: 'data-v-cd40fe86',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { entrance, isLogin, isMobile } = useGlobalStore();
        const loading = ref(false);
        const entranceRef = ref();
        const portRef = ref();
        const bindRef = ref();
        const expirationRef = ref();
        const responseRef = ref();
        const sslRef = ref();
        const lastSSL = ref('Disable');
        const sslInfo = ref<{ domain: string; timeout: string; rootPath: string; cert: string; key: string }>();
        const domainRef = ref();
        const allowIPsRef = ref();
        const form = reactive({
            serverPort: 9999,
            ipv6: 'Disable',
            bindAddress: '',
            ssl: 'Disable',
            sslItem: 'Disable',
            sslType: 'self',
            securityEntrance: '',
            expirationDays: 0,
            complexityVerification: 'Disable',
            allowIPs: '',
            allowIPTrustedProxies: '',
            bindDomain: '',
            noAuthSetting: '200 - ' + i18n.global.t('setting.help200'),
            noAuthSettingValue: '200',
        });
        const unset = ref(i18n.global.t('setting.unSetting'));
        const search = async () => {
            const res = await rpc.core.setting.getInfo({});
            form.serverPort = Number(res.serverPort);
            form.ipv6 = res.ipv6;
            form.bindAddress = res.bindAddress;
            form.ssl = res.ssl;
            form.sslItem = res.ssl === 'Disable' ? 'Disable' : 'Enable';
            lastSSL.value = form.ssl;
            form.sslType = res.sslType;
            if (form.ssl !== 'Disable') {
                loadInfo();
            }
            form.securityEntrance = res.securityEntrance;
            form.expirationDays = Number(res.expirationDays);
            form.complexityVerification = res.complexityVerification;
            form.allowIPs = res.allowIps.replaceAll(',', '\n');
            form.allowIPTrustedProxies = res.allowIpTrustedProxies || '';
            form.bindDomain = res.bindDomain;
            form.noAuthSettingValue = res.noAuthSetting;
            if (res.noAuthSetting !== '200') {
                form.noAuthSetting = res.noAuthSetting + ' - ' + i18n.global.t('setting.error' + res.noAuthSetting);
            } else {
                form.noAuthSetting = res.noAuthSetting + ' - ' + i18n.global.t('setting.help200');
            }
        };
        const onSaveComplexity = async () => {
            let param = {
                key: 'ComplexityVerification',
                value: form.complexityVerification,
            };
            loading.value = true;
            await rpc.core.setting
                .updateSetting(param)
                .then(() => {
                    loading.value = false;
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    search();
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const onChangeEntrance = () => {
            entranceRef.value.acceptParams({ securityEntrance: form.securityEntrance });
        };
        const onChangePort = () => {
            portRef.value.acceptParams({ serverPort: form.serverPort });
        };
        const onChangeBind = () => {
            bindRef.value.acceptParams({ ipv6: form.ipv6, bindAddress: form.bindAddress });
        };
        const onChangeResponse = () => {
            responseRef.value.acceptParams({ noAuthSetting: form.noAuthSettingValue });
        };
        const onChangeBindDomain = () => {
            domainRef.value.acceptParams({ bindDomain: form.bindDomain });
        };
        const onChangeAllowIPs = () => {
            allowIPsRef.value.acceptParams({
                allowIPs: form.allowIPs,
                allowIPTrustedProxies: form.allowIPTrustedProxies,
            });
        };
        const onChangeExpirationDays = async () => {
            expirationRef.value.acceptParams({ expirationDays: form.expirationDays });
        };
        const handleSSL = async () => {
            if (form.sslItem !== 'Disable') {
                let params = {
                    ssl: form.ssl,
                    sslType: form.sslType,
                    sslInfo: sslInfo.value,
                };
                sslRef.value!.acceptParams(params);
                return;
            }
            ElMessageBox.confirm(i18n.global.t('setting.sslDisableHelper'), i18n.global.t('setting.sslDisable'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
                type: 'info',
            })
                .then(async () => {
                    await rpc.core.setting.updateSSL({
                        ssl: 'Disable',
                        domain: '',
                        sslType: form.sslType,
                        key: '',
                        cert: '',
                        sslId: 0,
                    });
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    lastSSL.value = 'Disable';
                    let href = window.location.href;
                    isLogin.value = false;
                    let address = href.split('://')[1];
                    if (entrance.value) {
                        address = address.replaceAll('settings/safe', entrance.value);
                    } else {
                        address = address.replaceAll('settings/safe', 'login');
                    }
                    setTimeout(() => {
                        window.location.href = `http://${address}`;
                    }, 1000);
                })
                .catch(() => {
                    form.ssl = lastSSL.value;
                    form.sslItem = lastSSL.value === 'Disable' ? 'Disable' : 'Enable';
                });
        };
        const loadInfo = async () => {
            await rpc.core.setting.getSSLInfo({}).then(async (res) => {
                sslInfo.value = res;
            });
        };
        onMounted(() => {
            search();
            rpc.core.setting.getSystemAvailable({});
        });
        return () => (
            <div>
                {
                    <LayoutContent
                        title={$t('setting.safe')}
                        divider={true}
                        v-slots={{
                            main: () => (
                                <>
                                    {
                                        <ElForm
                                            model={form}
                                            label-position={unref(isMobile) ? 'top' : 'left'}
                                            label-width="150px"
                                            v-loading={unref(loading)}
                                        >
                                            <ElRow>
                                                <ElCol span={1}>
                                                    <br />
                                                </ElCol>
                                                <ElCol xs={24} sm={20} md={15} lg={12} xl={12}>
                                                    <ElFormItem label={$t('setting.panelPort')} prop="serverPort">
                                                        <ElInput
                                                            disabled
                                                            modelValue={form.serverPort}
                                                            onUpdate:modelValue={($v) => {
                                                                form.serverPort = $v === '' ? $v : Number($v);
                                                            }}
                                                            v-slots={{
                                                                append: () => (
                                                                    <>
                                                                        <ElButton
                                                                            onClick={($event?: any) => {
                                                                                (onChangePort as any)($event);
                                                                            }}
                                                                            icon="Setting"
                                                                        >
                                                                            {$t('commons.button.set')}
                                                                        </ElButton>
                                                                    </>
                                                                ),
                                                            }}
                                                        />
                                                    </ElFormItem>
                                                    <ElFormItem label={$t('setting.bindInfo')} prop="bindAddress">
                                                        <ElInput
                                                            disabled
                                                            v-model={form.bindAddress}
                                                            v-slots={{
                                                                append: () => (
                                                                    <>
                                                                        <ElButton
                                                                            onClick={($event?: any) => {
                                                                                (onChangeBind as any)($event);
                                                                            }}
                                                                            icon="Setting"
                                                                        >
                                                                            {$t('commons.button.set')}
                                                                        </ElButton>
                                                                    </>
                                                                ),
                                                            }}
                                                        />
                                                    </ElFormItem>
                                                    <ElFormItem label={$t('setting.entrance')}>
                                                        {form.securityEntrance ? (
                                                            <ElInput
                                                                type="password"
                                                                disabled
                                                                v-model={form.securityEntrance}
                                                                v-slots={{
                                                                    append: () => (
                                                                        <>
                                                                            <ElButton
                                                                                onClick={($event?: any) => {
                                                                                    (onChangeEntrance as any)($event);
                                                                                }}
                                                                                icon="Setting"
                                                                            >
                                                                                {$t('commons.button.set')}
                                                                            </ElButton>
                                                                        </>
                                                                    ),
                                                                }}
                                                            />
                                                        ) : null}
                                                        {!form.securityEntrance ? (
                                                            <ElInput
                                                                disabled
                                                                v-model={unset.value}
                                                                v-slots={{
                                                                    append: () => (
                                                                        <>
                                                                            <ElButton
                                                                                onClick={($event?: any) => {
                                                                                    (onChangeEntrance as any)($event);
                                                                                }}
                                                                                icon="Setting"
                                                                            >
                                                                                {$t('commons.button.set')}
                                                                            </ElButton>
                                                                        </>
                                                                    ),
                                                                }}
                                                            />
                                                        ) : null}
                                                        <span class={'input-help'}>{$t('setting.entranceHelper')}</span>
                                                    </ElFormItem>
                                                    <ElFormItem label={$t('setting.noAuthSetting')}>
                                                        <ElInput
                                                            disabled
                                                            v-model={form.noAuthSetting}
                                                            v-slots={{
                                                                append: () => (
                                                                    <>
                                                                        <ElButton
                                                                            onClick={($event?: any) => {
                                                                                (onChangeResponse as any)($event);
                                                                            }}
                                                                            icon="Setting"
                                                                        >
                                                                            {$t('commons.button.set')}
                                                                        </ElButton>
                                                                    </>
                                                                ),
                                                            }}
                                                        />
                                                    </ElFormItem>
                                                    <ElFormItem label={$t('setting.allowIPs')}>
                                                        {form.allowIPs ? (
                                                            <div style={'width: 100%'}>
                                                                <ElInput
                                                                    type="textarea"
                                                                    rows={3}
                                                                    disabled
                                                                    v-model={form.allowIPs}
                                                                    style={'width: calc(100% - 80px)'}
                                                                />
                                                                <ElButton
                                                                    onClick={($event?: any) => {
                                                                        (onChangeAllowIPs as any)($event);
                                                                    }}
                                                                    icon="Setting"
                                                                    class={'append-button'}
                                                                >
                                                                    {$t('commons.button.set')}
                                                                </ElButton>
                                                            </div>
                                                        ) : null}
                                                        {!form.allowIPs ? (
                                                            <ElInput
                                                                disabled
                                                                v-model={unset.value}
                                                                v-slots={{
                                                                    append: () => (
                                                                        <>
                                                                            <ElButton
                                                                                onClick={($event?: any) => {
                                                                                    (onChangeAllowIPs as any)($event);
                                                                                }}
                                                                                icon="Setting"
                                                                            >
                                                                                {$t('commons.button.set')}
                                                                            </ElButton>
                                                                        </>
                                                                    ),
                                                                }}
                                                            />
                                                        ) : null}
                                                        <span class={'input-help'}>{$t('setting.allowIPsHelper')}</span>
                                                    </ElFormItem>
                                                    <ElFormItem label={$t('setting.bindDomain')}>
                                                        {form.bindDomain ? (
                                                            <ElInput
                                                                disabled
                                                                v-model={form.bindDomain}
                                                                v-slots={{
                                                                    append: () => (
                                                                        <>
                                                                            <ElButton
                                                                                onClick={($event?: any) => {
                                                                                    (onChangeBindDomain as any)($event);
                                                                                }}
                                                                                icon="Setting"
                                                                            >
                                                                                {$t('commons.button.set')}
                                                                            </ElButton>
                                                                        </>
                                                                    ),
                                                                }}
                                                            />
                                                        ) : null}
                                                        {!form.bindDomain ? (
                                                            <ElInput
                                                                disabled
                                                                v-model={unset.value}
                                                                v-slots={{
                                                                    append: () => (
                                                                        <>
                                                                            <ElButton
                                                                                onClick={($event?: any) => {
                                                                                    (onChangeBindDomain as any)($event);
                                                                                }}
                                                                                icon="Setting"
                                                                            >
                                                                                {$t('commons.button.set')}
                                                                            </ElButton>
                                                                        </>
                                                                    ),
                                                                }}
                                                            />
                                                        ) : null}
                                                        <span class={'input-help'}>
                                                            {$t('setting.bindDomainHelper')}
                                                        </span>
                                                    </ElFormItem>
                                                    <ElFormItem label={$t('setting.panelSSL')} prop="ssl">
                                                        <ElSwitch
                                                            onChange={($event?: any) => {
                                                                (handleSSL as any)($event);
                                                            }}
                                                            v-model={form.sslItem}
                                                            active-value="Enable"
                                                            inactive-value="Disable"
                                                        />
                                                        <span class={'input-help'}>{$t('setting.https')}</span>
                                                        {form.ssl !== 'Disable' && unref(sslInfo) ? (
                                                            <div>
                                                                <ElTag>
                                                                    {$t('setting.domainOrIP')}
                                                                    {unref(sslInfo).domain}
                                                                </ElTag>
                                                                <ElTag style={'margin-left: 5px'}>
                                                                    {$t('setting.timeOut')}
                                                                    {unref(sslInfo).timeout}
                                                                </ElTag>
                                                                <div>
                                                                    <ElButton
                                                                        link
                                                                        type="primary"
                                                                        onClick={($event?: any) => {
                                                                            (handleSSL as any)($event);
                                                                        }}
                                                                    >
                                                                        {$t('commons.button.view')}
                                                                    </ElButton>
                                                                </div>
                                                            </div>
                                                        ) : null}
                                                    </ElFormItem>
                                                    <ElFormItem
                                                        label={$t('setting.expirationTime')}
                                                        prop="expirationDays"
                                                    >
                                                        <ElInput
                                                            disabled
                                                            v-model={form.expirationDays}
                                                            v-slots={{
                                                                append: () => (
                                                                    <>
                                                                        <ElButton
                                                                            onClick={($event?: any) => {
                                                                                (onChangeExpirationDays as any)($event);
                                                                            }}
                                                                            icon="Setting"
                                                                        >
                                                                            {$t('commons.button.set')}
                                                                        </ElButton>
                                                                    </>
                                                                ),
                                                            }}
                                                        />
                                                        <span class={'input-help'}>
                                                            {form.expirationDays === 0
                                                                ? $t('setting.noneSetting')
                                                                : $t('setting.expirationHelper')}
                                                        </span>
                                                    </ElFormItem>
                                                    <ElFormItem
                                                        label={$t('setting.complexity')}
                                                        prop="complexityVerification"
                                                    >
                                                        <ElSwitch
                                                            onChange={($event?: any) => {
                                                                (onSaveComplexity as any)($event);
                                                            }}
                                                            v-model={form.complexityVerification}
                                                            active-value="Enable"
                                                            inactive-value="Disable"
                                                        />
                                                        <span class={'input-help'}>
                                                            {$t('setting.complexityHelper')}
                                                        </span>
                                                    </ElFormItem>
                                                </ElCol>
                                            </ElRow>
                                        </ElForm>
                                    }
                                </>
                            ),
                        }}
                        v-loading={unref(loading)}
                    />
                }
                <PortSetting ref={portRef} />
                <BindSetting ref={bindRef} />
                <SSLSetting
                    ref={sslRef}
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <EntranceSetting
                    ref={entranceRef}
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <DomainSetting
                    ref={domainRef}
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <AllowIPsSetting
                    ref={allowIPsRef}
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <ExpirationSetting
                    ref={expirationRef}
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <ResponseSetting
                    ref={responseRef}
                    onSearch={($event?: any) => {
                        search();
                    }}
                />
            </div>
        );
    },
    options,
);

definePage({
    name: 'Safe',
    meta: { parent: 'menu.settings', activeMenu: '/settings', title: 'setting.safe', adminOnly: true, hidden: true },
});
