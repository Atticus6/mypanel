import { $t } from '@/utils/i18n-t';
import { checkNumberRange, Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { MsgError, MsgSuccess } from '@/utils/message';
import { Website } from '@/types/website';
import { Units } from '@/global/mimetype';
import { isDomain } from '@/utils/validate';
import { Delete, Plus } from '@element-plus/icons-vue';
import CorsSetting from '@/pages/views/website/website/cors/index';
import { rpc } from '@/lib/rpc';
import permissionDirective from '@/directives/modules/permission';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'create',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const proxyForm = ref<FormInstance>();
        const rules = ref({
            name: [Rules.requiredInput, Rules.appName],
            match: [Rules.requiredInput],
            cacheTime: [Rules.requiredInput, checkNumberRange(1, 65535)],
            proxyPass: [Rules.requiredInput],
            proxyHost: [Rules.requiredInput],
            proxyAddress: [Rules.requiredInput],
            allowOrigins: [Rules.requiredInput],
        });
        const open = ref(false);
        const loading = ref(false);
        const activeTab = ref('basic');
        const shouldAutoEnableSNI = ref(false);
        const sniTouched = ref(false);
        const initData = (): Website.ProxyConfig => ({
            id: 0,
            operate: 'create',
            enable: true,
            cache: false,
            cacheTime: 0,
            cacheUnit: '',
            name: '',
            modifier: '',
            match: '/',
            proxyPass: 'http://127.0.0.1:8080',
            proxyHost: '$host',
            filePath: '',
            replaces: {},
            proxyAddress: '',
            proxyProtocol: 'http://',
            sni: false,
            proxySSLName: '',
            sslVerify: false,
            serverCacheTime: 10,
            serverCacheUnit: 'm',
            browserCache: 'noModify',
            cors: false,
            allowOrigins: '*',
            allowMethods: 'GET,POST,OPTIONS,PUT,DELETE',
            allowHeaders: '',
            allowCredentials: false,
            preflight: true,
        });
        let proxy = ref(initData());
        const replaces = ref<any>([]);
        const handleClose = () => {
            proxyForm.value?.resetFields();
            open.value = false;
            ctx.emit('close', false);
        };
        const acceptParams = (proxyParam: Website.ProxyConfig) => {
            replaces.value = [];
            proxy.value = proxyParam;
            activeTab.value = 'basic';
            shouldAutoEnableSNI.value = proxy.value.operate === 'create';
            sniTouched.value = false;

            // Initialize browserCache based on cacheTime value
            if (proxy.value.cacheTime > 0) {
                proxy.value.browserCache = 'enable';
            } else if (proxy.value.cacheTime === 0) {
                proxy.value.browserCache = 'noModify';
            } else {
                proxy.value.browserCache = 'disable';
            }

            const res = getProtocolAndHost(proxyParam.proxyPass);
            if (res != null) {
                proxy.value.proxyProtocol = res.protocol;
                proxy.value.proxyAddress = res.host;
            } else {
                proxy.value.proxyProtocol = 'http://';
            }

            open.value = true;
            if (proxy.value.replaces) {
                for (const key in proxy.value.replaces) {
                    replaces.value.push({ key: key, value: proxy.value.replaces[key] });
                }
            }
        };
        const changeServerCache = (cache: boolean) => {
            proxy.value.cache = cache;
            if (cache) {
                proxy.value.serverCacheTime = 10;
                proxy.value.serverCacheUnit = 'm';
            } else {
                proxy.value.serverCacheTime = 0;
                proxy.value.serverCacheUnit = '';
            }
        };
        const changeBrowserCache = (mode: 'enable' | 'disable' | 'noModify') => {
            proxy.value.browserCache = mode;
            if (mode === 'enable') {
                proxy.value.cacheTime = 4;
                proxy.value.cacheUnit = 'h';
            } else if (mode === 'disable') {
                proxy.value.cacheTime = -1;
                proxy.value.cacheUnit = '';
            } else {
                proxy.value.cacheTime = 0;
                proxy.value.cacheUnit = '';
            }
        };
        const addReplaces = () => {
            replaces.value.push({ key: '', value: '' });
        };
        const removeReplace = (index: number) => {
            replaces.value.splice(index, 1);
        };
        const handleSNIChange = () => {
            sniTouched.value = true;
        };
        const getProxyHost = () => {
            if (isDomain(proxy.value.proxyAddress)) {
                proxy.value.proxyHost = proxy.value.proxyAddress;
            } else {
                proxy.value.proxyHost = '$host';
            }
        };
        const updateCorsConfig = (config: any) => {
            proxy.value.allowOrigins = config.allowOrigins;
            proxy.value.allowMethods = config.allowMethods;
            proxy.value.allowHeaders = config.allowHeaders;
            proxy.value.allowCredentials = config.allowCredentials;
            proxy.value.preflight = config.preflight;
        };
        const submit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            await formEl.validate((valid) => {
                if (!valid) {
                    return;
                }

                proxy.value.replaces = {};
                if (replaces.value.length > 0) {
                    let keyMap = new Map();
                    for (const rep of replaces.value) {
                        if (keyMap.get(rep.key) != undefined) {
                            MsgError(i18n.global.t('website.replacedErr2'));
                            return;
                        }
                        keyMap.set(rep.key, '');
                        if (rep.key === '') {
                            MsgError(i18n.global.t('website.replacedErr'));
                            return;
                        }
                        proxy.value.replaces[rep.key] = rep.value;
                    }
                }
                loading.value = true;
                proxy.value.proxyPass = proxy.value.proxyProtocol + proxy.value.proxyAddress;
                rpc.website
                    .updateProxy(proxy.value as any)
                    .then(() => {
                        if (proxy.value.operate == 'create') {
                            MsgSuccess(i18n.global.t('commons.msg.createSuccess'));
                        } else {
                            MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                        }
                        handleClose();
                    })
                    .finally(() => {
                        loading.value = false;
                    });
            });
        };
        const getProtocolAndHost = (url: string): { protocol: string; host: string } | null => {
            if (url.startsWith('https://')) {
                return { protocol: 'https://', host: url.replaceAll('https://', '') };
            }
            if (url.startsWith('http://')) {
                return { protocol: 'http://', host: url.replaceAll('http://', '') };
            }
            return { protocol: '', host: url };
        };
        watch(
            () => proxy.value.proxyProtocol,
            (protocol) => {
                if (proxy.value.operate !== 'create' || sniTouched.value || !shouldAutoEnableSNI.value) {
                    return;
                }
                proxy.value.sni = protocol === 'https://';
            },
        );
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
                header={$t('commons.button.' + unref(proxy).operate)}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="normal"
                v-slots={{
                    footer: () => (
                        <>
                            <ElButton
                                onClick={($event?: any) => {
                                    (handleClose as any)($event);
                                }}
                                disabled={unref(loading)}
                            >
                                {$t('commons.button.cancel')}
                            </ElButton>
                            {withDirectives(
                                <ElButton
                                    type="primary"
                                    onClick={($event?: any) => {
                                        submit(unref(proxyForm));
                                    }}
                                    disabled={unref(loading)}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>,
                                [[permissionDirective, true]],
                            )}
                        </>
                    ),
                }}
            >
                {withDirectives(
                    <ElForm ref={proxyForm} label-position="top" model={unref(proxy)} rules={unref(rules)}>
                        <ElTabs
                            modelValue={unref(activeTab)}
                            onUpdate:modelValue={($v) => {
                                activeTab.value = $v as any;
                            }}
                            type="border-card"
                        >
                            <ElTabPane label={$t('website.proxySettings')} name="basic">
                                <ElDivider content-position="left">{$t('website.proxy')}</ElDivider>
                                <ElFormItem label={$t('commons.table.name')} prop="name">
                                    <ElInput
                                        modelValue={unref(proxy).name}
                                        onUpdate:modelValue={($v) => {
                                            unref(proxy).name = typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                        disabled={unref(proxy).operate === 'edit'}
                                    />
                                </ElFormItem>
                                <ElRow gutter={16}>
                                    <ElCol span={12}>
                                        <ElFormItem label={$t('website.modifier')} prop="modifier">
                                            <ElInput
                                                modelValue={unref(proxy).modifier}
                                                onUpdate:modelValue={($v) => {
                                                    unref(proxy).modifier = typeof $v === 'string' ? $v.trim() : $v;
                                                }}
                                            />
                                            <span class={'input-help'}>{$t('website.modifierHelper')}</span>
                                        </ElFormItem>
                                    </ElCol>
                                    <ElCol span={12}>
                                        <ElFormItem label={$t('website.proxyPath')} prop="match">
                                            <ElInput
                                                modelValue={unref(proxy).match}
                                                onUpdate:modelValue={($v) => {
                                                    unref(proxy).match = typeof $v === 'string' ? $v.trim() : $v;
                                                }}
                                            />
                                        </ElFormItem>
                                    </ElCol>
                                </ElRow>
                                <ElRow gutter={16}>
                                    <ElCol span={12}>
                                        <ElFormItem label={$t('website.proxyPass')} prop="proxyAddress">
                                            <ElInput
                                                modelValue={unref(proxy).proxyAddress}
                                                onUpdate:modelValue={($v) => {
                                                    unref(proxy).proxyAddress = typeof $v === 'string' ? $v.trim() : $v;
                                                }}
                                                placeholder={$t('website.proxyHelper')}
                                                onBlur={($event?: any) => {
                                                    (getProxyHost as any)($event);
                                                }}
                                                v-slots={{
                                                    prepend: () => (
                                                        <>
                                                            <ElSelect
                                                                modelValue={unref(proxy).proxyProtocol}
                                                                onUpdate:modelValue={($v) => {
                                                                    unref(proxy).proxyProtocol = $v as any;
                                                                }}
                                                                class={'!w-24'}
                                                            >
                                                                <ElOption label="http" value="http://" />
                                                                <ElOption label="https" value="https://" />
                                                            </ElSelect>
                                                        </>
                                                    ),
                                                }}
                                            />
                                            <span class={'input-help'}>{$t('website.proxyPassHelper')}</span>
                                        </ElFormItem>
                                    </ElCol>
                                    <ElCol span={12}>
                                        <ElFormItem label={$t('website.proxyHost')} prop="proxyHost">
                                            <ElInput
                                                modelValue={unref(proxy).proxyHost}
                                                onUpdate:modelValue={($v) => {
                                                    unref(proxy).proxyHost = typeof $v === 'string' ? $v.trim() : $v;
                                                }}
                                            />
                                            <span class={'input-help'}>{$t('website.proxyHostHelper')}</span>
                                        </ElFormItem>
                                    </ElCol>
                                </ElRow>
                                {unref(proxy).proxyProtocol === 'https://' ? (
                                    <>
                                        <ElDivider content-position="left">{$t('website.sniSettings')}</ElDivider>
                                        <div class={'flex items-center justify-between py-3'}>
                                            <div class={'flex flex-col gap-1'}>
                                                <span class={'font-medium'}>{$t('website.sni')}</span>
                                                <span class={'input-help'}>{$t('website.sniHelper')}</span>
                                            </div>
                                            <ElSwitch
                                                modelValue={unref(proxy).sni}
                                                onUpdate:modelValue={($v) => {
                                                    unref(proxy).sni = $v as any;
                                                }}
                                                size="large"
                                                onChange={($event?: any) => {
                                                    (handleSNIChange as any)($event);
                                                }}
                                            />
                                        </div>
                                        {unref(proxy).sni ? (
                                            <ElFormItem
                                                label={$t('website.proxySslName')}
                                                prop="proxySSLName"
                                                class={'mt-4'}
                                            >
                                                <ElInput
                                                    modelValue={unref(proxy).proxySSLName}
                                                    onUpdate:modelValue={($v) => {
                                                        unref(proxy).proxySSLName =
                                                            typeof $v === 'string' ? $v.trim() : $v;
                                                    }}
                                                />
                                            </ElFormItem>
                                        ) : null}
                                        <div class={'flex items-center justify-between py-3'}>
                                            <div class={'flex flex-col gap-1'}>
                                                <span class={'font-medium'}>{$t('website.proxySslVerify')}</span>
                                                <span class={'input-help'}>{$t('website.proxySslVerifyHelper')}</span>
                                            </div>
                                            <ElSwitch
                                                modelValue={unref(proxy).sslVerify}
                                                onUpdate:modelValue={($v) => {
                                                    unref(proxy).sslVerify = $v as any;
                                                }}
                                                size="large"
                                            />
                                        </div>
                                    </>
                                ) : null}
                            </ElTabPane>
                            <ElTabPane label={$t('website.advancedSettings')} name="advanced">
                                <ElDivider content-position="left">{$t('website.cacheSettings')}</ElDivider>
                                <div class={'flex items-center justify-between py-3'}>
                                    <div class={'flex flex-col gap-1'}>
                                        <span class={'font-medium'}>{$t('website.serverCache')}</span>
                                    </div>
                                    <ElButtonGroup>
                                        <ElButton
                                            type={unref(proxy).cache ? 'primary' : 'default'}
                                            onClick={($event?: any) => {
                                                changeServerCache(true);
                                            }}
                                            size="small"
                                        >
                                            {$t('commons.button.enable')}
                                        </ElButton>
                                        <ElButton
                                            type={!unref(proxy).cache ? 'primary' : 'default'}
                                            onClick={($event?: any) => {
                                                changeServerCache(false);
                                            }}
                                            size="small"
                                        >
                                            {$t('commons.button.disable')}
                                        </ElButton>
                                    </ElButtonGroup>
                                </div>
                                <ElCollapseTransition>
                                    {unref(proxy).cache ? (
                                        <div class={'mt-4 mb-6'}>
                                            <ElFormItem label={$t('website.serverCacheTime')} prop="serverCacheTime">
                                                <ElInput
                                                    modelValue={unref(proxy).serverCacheTime}
                                                    onUpdate:modelValue={($v) => {
                                                        unref(proxy).serverCacheTime = $v === '' ? $v : Number($v);
                                                    }}
                                                    maxlength="15"
                                                    class={'!w-64'}
                                                    v-slots={{
                                                        append: () => (
                                                            <>
                                                                <ElSelect
                                                                    modelValue={unref(proxy).serverCacheUnit}
                                                                    onUpdate:modelValue={($v) => {
                                                                        unref(proxy).serverCacheUnit = $v as any;
                                                                    }}
                                                                    class={'!w-24'}
                                                                >
                                                                    {(Units || []).map((unit, index) => (
                                                                        <ElOption
                                                                            label={unit.label}
                                                                            value={unit.value}
                                                                            key={index}
                                                                        />
                                                                    ))}
                                                                </ElSelect>
                                                            </>
                                                        ),
                                                    }}
                                                />
                                                <span class={'input-help'}>{$t('website.serverCacheTimeHelper')}</span>
                                            </ElFormItem>
                                        </div>
                                    ) : null}
                                </ElCollapseTransition>
                                <div class={'flex items-center justify-between py-3'}>
                                    <div class={'flex flex-col gap-1'}>
                                        <span class={'font-medium'}>{$t('website.browserCache')}</span>
                                    </div>
                                    <ElButtonGroup>
                                        <ElButton
                                            type={unref(proxy).browserCache === 'enable' ? 'primary' : 'default'}
                                            onClick={($event?: any) => {
                                                changeBrowserCache('enable');
                                            }}
                                            size="small"
                                        >
                                            {$t('commons.button.enable')}
                                        </ElButton>
                                        <ElButton
                                            type={unref(proxy).browserCache === 'disable' ? 'primary' : 'default'}
                                            onClick={($event?: any) => {
                                                changeBrowserCache('disable');
                                            }}
                                            size="small"
                                        >
                                            {$t('commons.button.disable')}
                                        </ElButton>
                                        <ElButton
                                            type={unref(proxy).browserCache === 'noModify' ? 'primary' : 'default'}
                                            onClick={($event?: any) => {
                                                changeBrowserCache('noModify');
                                            }}
                                            size="small"
                                        >
                                            {$t('website.noModify')}
                                        </ElButton>
                                    </ElButtonGroup>
                                </div>
                                <ElCollapseTransition>
                                    {unref(proxy).browserCache === 'enable' ? (
                                        <div class={'mt-4 mb-6'}>
                                            <ElFormItem label={$t('website.browserCacheTime')} prop="cacheTime">
                                                <ElInput
                                                    modelValue={unref(proxy).cacheTime}
                                                    onUpdate:modelValue={($v) => {
                                                        unref(proxy).cacheTime = $v === '' ? $v : Number($v);
                                                    }}
                                                    maxlength="15"
                                                    class={'!w-64'}
                                                    v-slots={{
                                                        append: () => (
                                                            <>
                                                                <ElSelect
                                                                    modelValue={unref(proxy).cacheUnit}
                                                                    onUpdate:modelValue={($v) => {
                                                                        unref(proxy).cacheUnit = $v as any;
                                                                    }}
                                                                    class={'!w-24'}
                                                                >
                                                                    {(Units || []).map((unit, index) => (
                                                                        <ElOption
                                                                            label={unit.label}
                                                                            value={unit.value}
                                                                            key={index}
                                                                        />
                                                                    ))}
                                                                </ElSelect>
                                                            </>
                                                        ),
                                                    }}
                                                />
                                                <span class={'input-help'}>{$t('website.browserCacheTimeHelper')}</span>
                                            </ElFormItem>
                                        </div>
                                    ) : null}
                                </ElCollapseTransition>
                                <ElDivider content-position="left">{$t('website.cors')}</ElDivider>
                                <CorsSetting
                                    modelValue={unref(proxy).cors}
                                    onUpdate:modelValue={($v) => {
                                        unref(proxy).cors = $v as any;
                                    }}
                                    config={{
                                        allowOrigins: unref(proxy).allowOrigins,
                                        allowMethods: unref(proxy).allowMethods,
                                        allowHeaders: unref(proxy).allowHeaders,
                                        allowCredentials: unref(proxy).allowCredentials,
                                        preflight: unref(proxy).preflight,
                                    }}
                                    enable-size="large"
                                    onUpdate:config={($event?: any) => {
                                        (updateCorsConfig as any)($event);
                                    }}
                                />
                                <ElDivider content-position="left">{$t('website.replace')}</ElDivider>
                                <div>
                                    {(unref(replaces) || []).map((replace, index) => (
                                        <div class={'mb-3'} key={index}>
                                            <ElRow gutter={16}>
                                                <ElCol span={10}>
                                                    <ElInput
                                                        modelValue={replace.key}
                                                        onUpdate:modelValue={($v) => {
                                                            replace.key = typeof $v === 'string' ? $v.trim() : $v;
                                                        }}
                                                        placeholder={$t('website.replaced')}
                                                        size="default"
                                                    />
                                                </ElCol>
                                                <ElCol span={10}>
                                                    <ElInput
                                                        modelValue={replace.value}
                                                        onUpdate:modelValue={($v) => {
                                                            replace.value = typeof $v === 'string' ? $v.trim() : $v;
                                                        }}
                                                        placeholder={$t('website.replaceText')}
                                                        size="default"
                                                    />
                                                </ElCol>
                                                <ElCol span={2}>
                                                    <ElButton
                                                        onClick={($event?: any) => {
                                                            removeReplace(Number(index));
                                                        }}
                                                        type="danger"
                                                        link
                                                        size="small"
                                                        class={'mt-1'}
                                                    >
                                                        <ElIcon>
                                                            <Delete />
                                                        </ElIcon>
                                                        {$t('commons.button.delete')}
                                                    </ElButton>
                                                </ElCol>
                                            </ElRow>
                                        </div>
                                    ))}
                                    <div class={'mt-4'}>
                                        {withDirectives(
                                            <ElButton
                                                type="primary"
                                                onClick={($event?: any) => {
                                                    (addReplaces as any)($event);
                                                }}
                                                icon={Plus}
                                            >
                                                {$t('website.addReplace')}
                                            </ElButton>,
                                            [[permissionDirective, true]],
                                        )}
                                        <span class={'input-help mt-4'}>{$t('website.replaceHelper')}</span>
                                    </div>
                                </div>
                            </ElTabPane>
                        </ElTabs>
                    </ElForm>,
                    [[vLoading, unref(loading)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
