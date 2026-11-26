import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import { Rules, checkNumberRange } from '@/global/form-rules';
import { Units } from '@/global/mimetype';
import { MsgSuccess, MsgError } from '@/utils/message';
import i18n from '@/lang';
import { Plus, Delete } from '@element-plus/icons-vue';
import permissionDirective from '@/directives/modules/permission';

interface CodemodProps {
    [key: string]: any;
    id?: number;
}

const emits = {};

const options = {
    name: 'anti-Leech',
    props: {
        id: {
            type: Number,
            default: 0,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref(false);
        const id = computed(() => {
            return __panelSetupProps.id;
        });
        const leechRef = ref<FormInstance>();
        const resData = ref({
            enable: false,
        });
        const returnOptions = [
            { label: '400 Bad Request', value: '400' },
            { label: '403 Forbidden', value: '403' },
            { label: '404 Not Found', value: '404' },
        ];
        const domainList = ref(['']);
        const form = reactive({
            enable: false,
            cache: false,
            cacheTime: 30,
            cacheUint: 'd',
            extends: 'js,css,png,jpg,jpeg,gif,webp,webm,avif,ico,bmp,swf,eot,svg,ttf,woff,woff2',
            return: '404',
            domains: '',
            noneRef: true,
            logEnable: false,
            blocked: false,
            serverNames: [],
            websiteID: 0,
        });
        const rules = ref({
            extends: [Rules.requiredInput, Rules.leechExts],
            cacheTime: [Rules.requiredInput, checkNumberRange(1, 65535)],
            return: [Rules.requiredInput],
            domains: [Rules.requiredInput],
        });
        const addDomain = () => {
            domainList.value.push('');
        };
        const removeDomain = (index: number) => {
            domainList.value.splice(index, 1);
            updateDomainsString();
        };
        const updateDomainsString = () => {
            form.domains = domainList.value.filter((domain) => domain.trim() !== '').join('\n');
        };
        const initDomainList = (domainsStr: string) => {
            if (domainsStr) {
                domainList.value = domainsStr.split('\n').filter((domain) => domain.trim() !== '');
                domainList.value = Array.from(new Set(domainList.value));
                if (domainList.value.length === 0) {
                    domainList.value = [''];
                }
            } else {
                domainList.value = [''];
            }
        };
        const changeEnable = (enable: boolean) => {
            if (enable) {
                rpc.website
                    .listDomains({ websiteId: id.value })
                    .then((res) => {
                        const domains = res.items || [];
                        let serverNameStr = '';
                        for (const param of domains) {
                            serverNameStr = serverNameStr + param.domain + '\n';
                        }
                        form.domains = serverNameStr;
                        initDomainList(serverNameStr);
                    })
                    .finally(() => {});
            }
        };
        const search = async () => {
            loading.value = true;
            const res = await rpc.website.getAntiLeech({ websiteId: id.value });
            loading.value = false;
            if (!res.enable && !res.cache) {
                return;
            }
            resData.value = res;
            form.blocked = res.blocked;
            form.cache = res.cache;
            form.enable = res.enable;
            if (res.cache) {
                form.cacheTime = res.cacheTime;
                form.cacheUint = res.cacheUint;
            }
            form.extends = res.extends;
            form.return = res.return;
            form.logEnable = res.logEnable;
            form.noneRef = res.noneRef;

            const serverNames = res.serverNames;
            let serverNameStr = '';
            for (const param of serverNames) {
                serverNameStr = serverNameStr + param + '\n';
            }
            form.domains = serverNameStr;
            initDomainList(serverNameStr);
        };
        const submit = async (formEl: FormInstance | undefined, enable: boolean) => {
            if (!formEl) return;
            await formEl.validate((valid) => {
                if (!valid) {
                    return;
                }
                update(enable);
            });
        };
        const update = async (enable: boolean) => {
            if (enable) {
                updateDomainsString();
                form.serverNames = form.domains.split('\n');
                if (!checkReturn()) {
                    return;
                }
            }
            form.enable = enable;
            loading.value = true;
            form.websiteID = id.value;
            await rpc.website
                .updateAntiLeech({
                    websiteId: id.value,
                    enable: form.enable,
                    extends: form.extends,
                    return: form.return,
                    serverNames: form.serverNames,
                    cache: form.cache,
                    cacheTime: form.cacheTime,
                    cacheUint: form.cacheUint,
                    noneRef: form.noneRef,
                    logEnable: form.logEnable,
                    blocked: form.blocked,
                })
                .then(() => {
                    MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                    search();
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        const checkReturn = (): boolean => {
            let returns = form.return.split(' ');
            if (returns[0]) {
                if (isHttpStatusCode(returns[0])) {
                    return true;
                } else {
                    MsgError(i18n.global.t('website.leechReturnError'));
                    return false;
                }
            } else {
                return false;
            }
        };
        function isHttpStatusCode(input: string): boolean {
            const statusCodeRegex = /^[1-5][0-9]{2}$/;
            return statusCodeRegex.test(input);
        }
        onMounted(() => {
            search();
        });
        return () =>
            withDirectives(
                <ElRow gutter={20}>
                    <ElCol xs={24} sm={18} md={18} lg={14} xl={14}>
                        <ElForm
                            model={form}
                            rules={unref(rules)}
                            ref={leechRef}
                            label-position="right"
                            label-width="150px"
                            class={'moblie-form'}
                        >
                            <ElFormItem label={$t('website.extends')} prop="extends" class={'mt-2'}>
                                <ElInput
                                    modelValue={form.extends}
                                    onUpdate:modelValue={($v) => {
                                        form.extends = $v as any;
                                    }}
                                    class={'p-w-600'}
                                />
                            </ElFormItem>
                            <ElDivider content-position="left">{$t('website.antiLeech')}</ElDivider>
                            <ElFormItem label={$t('website.enableOrNot')} prop="enable">
                                {withDirectives(
                                    <ElSwitch
                                        modelValue={form.enable}
                                        onUpdate:modelValue={($v) => {
                                            form.enable = $v as any;
                                        }}
                                        onChange={($event?: any) => {
                                            (changeEnable as any)($event);
                                        }}
                                    />,
                                    [[permissionDirective, true]],
                                )}
                            </ElFormItem>
                            {form.enable ? (
                                <>
                                    <ElFormItem label={$t('website.accessDomain')} prop="domains">
                                        <div class={'domain-list-container'}>
                                            {(unref(domainList) || []).map((_, index) => (
                                                <div class={'mb-2 flex items-center'} key={index}>
                                                    <ElInput
                                                        modelValue={unref(domainList)[index]}
                                                        onUpdate:modelValue={($v) => {
                                                            unref(domainList)[index] = $v as any;
                                                        }}
                                                        onInput={($event?: any) => {
                                                            (updateDomainsString as any)($event);
                                                        }}
                                                        class={'mr-2 flex-1'}
                                                    />
                                                    {unref(domainList).length > 1
                                                        ? withDirectives(
                                                              <ElButton
                                                                  type="danger"
                                                                  size="small"
                                                                  icon={Delete}
                                                                  onClick={($event?: any) => {
                                                                      removeDomain(index);
                                                                  }}
                                                              />,
                                                              [[permissionDirective, true]],
                                                          )
                                                        : null}
                                                </div>
                                            ))}
                                            {withDirectives(
                                                <ElButton
                                                    type="primary"
                                                    size="small"
                                                    icon={Plus}
                                                    onClick={($event?: any) => {
                                                        (addDomain as any)($event);
                                                    }}
                                                    plain
                                                >
                                                    {$t('commons.button.add')}
                                                </ElButton>,
                                                [[permissionDirective, true]],
                                            )}
                                        </div>
                                    </ElFormItem>
                                    <ElRow gutter={15}>
                                        <ElCol>
                                            <ElFormItem label={$t('website.noneRef')} prop="noneRef">
                                                <ElSwitch
                                                    modelValue={form.noneRef}
                                                    onUpdate:modelValue={($v) => {
                                                        form.noneRef = $v as any;
                                                    }}
                                                />
                                            </ElFormItem>
                                        </ElCol>
                                        <ElCol>
                                            <ElFormItem label={$t('website.blockedRef')} prop="blocked">
                                                <ElSwitch
                                                    modelValue={form.blocked}
                                                    onUpdate:modelValue={($v) => {
                                                        form.blocked = $v as any;
                                                    }}
                                                />
                                                <span class={'input-help'}>
                                                    {$t('website.leechSpecialValidHelper')}
                                                </span>
                                            </ElFormItem>
                                        </ElCol>
                                    </ElRow>
                                    <ElFormItem label={$t('website.leechReturn')} prop="return">
                                        <ElSelect
                                            modelValue={form.return}
                                            onUpdate:modelValue={($v) => {
                                                form.return = $v as any;
                                            }}
                                            class={'p-w-200'}
                                        >
                                            {(returnOptions || []).map((option) => (
                                                <ElOption
                                                    label={option.label}
                                                    value={option.value}
                                                    key={option.value}
                                                />
                                            ))}
                                        </ElSelect>
                                        <span class={'input-help'}>{$t('website.leechInvalidReturnHelper')}</span>
                                    </ElFormItem>
                                </>
                            ) : null}
                            <ElDivider content-position="left">{$t('website.leechcacheControl')}</ElDivider>
                            <ElFormItem label={$t('website.browserCache')} prop="cache">
                                <ElSwitch
                                    modelValue={form.cache}
                                    onUpdate:modelValue={($v) => {
                                        form.cache = $v as any;
                                    }}
                                />
                            </ElFormItem>
                            {form.cache ? (
                                <ElFormItem label={$t('website.cacheTime')} prop="cacheTime">
                                    <ElInput
                                        modelValue={form.cacheTime}
                                        onUpdate:modelValue={($v) => {
                                            form.cacheTime = $v === '' ? $v : Number($v);
                                        }}
                                        maxlength="15"
                                        class={'p-w-300'}
                                        v-slots={{
                                            append: () => (
                                                <>
                                                    <ElSelect
                                                        modelValue={form.cacheUint}
                                                        onUpdate:modelValue={($v) => {
                                                            form.cacheUint = $v as any;
                                                        }}
                                                        class={'w-s-button p-w-100'}
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
                            ) : null}
                            {form.cache || form.enable ? (
                                <ElFormItem label={$t('website.logEnableControl')} prop="logEnable">
                                    <ElSwitch
                                        modelValue={form.logEnable}
                                        onUpdate:modelValue={($v) => {
                                            form.logEnable = $v as any;
                                        }}
                                    />
                                    <span class={'input-help'}>{$t('website.leechlogControlHelper')}</span>
                                </ElFormItem>
                            ) : null}
                            <div class={'mt-2 flex items-center gap-4'}>
                                {withDirectives(
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            submit(unref(leechRef), form.enable);
                                        }}
                                        disabled={unref(loading)}
                                    >
                                        {$t('commons.button.save')}
                                    </ElButton>,
                                    [[permissionDirective, true]],
                                )}
                            </div>
                        </ElForm>
                    </ElCol>
                </ElRow>,
                [[vLoading, unref(loading)]],
            );
    },
    options,
);
