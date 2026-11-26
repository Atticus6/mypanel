import { $t } from '@/utils/i18n-t';
import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf';
type Init<T extends DescMessage> = MessageInitShape<T>;
import { AppServiceItemSchema } from '@/gen/panel/agent/v1/app_pb';
import type { App } from '@/types/app';
type AppService = Init<typeof AppServiceItemSchema> & { config?: object };
interface FromFieldChild extends FromField {
    services: App.AppService[];
}
interface ServiceParam {
    label: '';
    value: '';
    from?: '';
}
interface FromField {
    type: string;
    labelZh: string;
    labelEn: string;
    required: boolean;
    default: any;
    envKey: string;
    key?: string;
    values?: ServiceParam[];
    child?: FromFieldChild;
    params?: FromParam[];
    multiple?: boolean;
    allowCreate?: boolean;
    label: Locale;
    description: Locale;
}
interface FromParam {
    type: string;
    key: string;
    value: string;
    envKey: string;
}
import { computed, onMounted, reactive, ref } from 'vue';
import { getRandomStr } from '@/utils/id';
import { Rules } from '@/global/form-rules';
import { getDBName, getLabel, getDescription } from '@/utils/app-store';
import { rpc } from '@/lib/rpc';
interface ParamObj extends FromField {
    services: AppService[];
    prop: string;
    disabled: false;
    childProp: string;
}
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElFormItem } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElLink } from 'element-plus';
import { ElRow } from 'element-plus';
import { ElCol } from 'element-plus';
import { ElTag } from 'element-plus';
import Status from '@/components/status/index';

interface CodemodProps {
    [key: string]: any;
    form?: Record<string, any>;
    params?: Record<string, any>;
    rules?: Record<string, any>;
    propStart?: string;
}

const emits = {
    'update:form': (...args: unknown[]) => true,
    'update:rules': (...args: unknown[]) => true,
};

const options = {
    name: 'params',
    props: {
        form: {
            type: Object,
            default: function () {
                return {};
            },
        },
        params: {
            type: Object,
            default: function () {
                return {};
            },
        },
        rules: {
            type: Object,
            default: function () {
                return {};
            },
        },
        propStart: {
            type: String,
            default: '',
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-1744fd36',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const form = reactive({
            format: '',
            collation: '',
        });
        let rules = reactive({});
        const params = computed({
            get() {
                return __panelSetupProps.params;
            },
            set() {},
        });
        const propStart = computed({
            get() {
                return __panelSetupProps.propStart;
            },
            set() {},
        });
        const paramObjs = ref<ParamObj[]>([]);
        const updateParam = () => {
            ctx.emit('update:form', form);
        };
        const isMysql = (form: object, envKey: string) => {
            return form['PANEL_DB_HOST'] != undefined && (form[envKey] == 'mysql' || form[envKey] == 'mariadb');
        };
        const handleParams = () => {
            rules = __panelSetupProps.rules;
            if (params.value != undefined && params.value.formFields != undefined) {
                for (const p of params.value.formFields) {
                    const pObj = p;
                    pObj.prop = propStart.value + p.envKey;
                    pObj.disabled = p.disabled;
                    paramObjs.value.push(pObj);
                    if (p.random) {
                        if (p.envKey === 'PANEL_DB_NAME') {
                            form[p.envKey] = p.default + '_' + getDBName(6);
                        } else {
                            form[p.envKey] = p.default + '_' + getRandomStr(6);
                        }
                    } else {
                        form[p.envKey] = p.default;
                    }
                    if (p.type == 'text' && p.envKey == 'WEBSITE_DIR') {
                        rpc.agentSetting.getWebsiteDir({}).then((res) => {
                            form[p.envKey] = res.path;
                        });
                    }
                    if (p.required) {
                        if (p.type === 'service' || p.type === 'apps') {
                            rules[p.envKey] = [Rules.requiredSelect];
                            if (p.child) {
                                p.childProp = propStart.value + p.child.envKey;
                                if (p.child.type === 'service') {
                                    rules[p.child.envKey] = [Rules.requiredSelect];
                                }
                            }
                        } else {
                            rules[p.envKey] = [Rules.requiredInput];
                        }
                        if (p.rule && p.rule != '') {
                            rules[p.envKey].push(Rules[p.rule]);
                        }
                    } else {
                        delete rules[p.envKey];
                    }
                    if (p.type === 'apps') {
                        getServices(p.child.envKey, p.default, p);
                        p.child.services = [];
                        form[p.child.envKey] = '';
                    }
                    if (p.type === 'service') {
                        getServices(p.envKey, p.key, p);
                        p.services = [];
                        form[p.envKey] = '';
                    }
                    ctx.emit('update:rules', rules);
                    updateParam();
                }
            }
        };
        const getServices = async (childKey: string, key: string | undefined, pObj: ParamObj | undefined) => {
            pObj.services = [];
            appKey.value = key || '';
            if (appKey.value == 'mysql' || appKey.value == 'mariadb') {
                form.format = 'utf8mb4';
            }
            const res = await rpc.app.getAppServices({ key: key ?? '' });
            pObj.services = res.items.map((s) => ({ ...s, config: JSON.parse(s.configJson || '{}') }));
            form[childKey] = '';
            if (pObj.services.length > 0) {
                form[childKey] = pObj.services[0].value;
                if (pObj.params) {
                    pObj.params.forEach((param: FromParam) => {
                        if (param.key === key) {
                            form[param.envKey] = param.value;
                        }
                    });
                }
                changeService(form[childKey], pObj.services);
            }
        };
        const changeService = (value: string, services: AppService[]) => {
            services.forEach((item) => {
                if (item.value === value && item.config) {
                    Object.entries(item.config).forEach(([k, v]) => {
                        if (form.hasOwnProperty(k)) {
                            form[k] = v;
                        }
                    });
                }
            });
            if (appKey.value == 'mysql' || appKey.value == 'mariadb') {
                loadOptions(value);
            }
            updateParam();
        };
        const toPage = (key: string) => {
            window.location.href = '/apps/all?install=' + key;
        };
        const formatOptions = ref();
        const collationOptions = ref();
        const appKey = ref('');
        const loadOptions = async (_database: string) => {
            // 数据库模块已剔除，格式选项退回内置列表，不再请求后端。
            formatOptions.value = [{ format: 'utf8mb4' }, { format: 'utf8mb3' }, { format: 'gbk' }, { format: 'big5' }];
            loadCollations();
        };
        const loadCollations = async () => {
            collationOptions.value = formatOptions.value?.find((item) => item.format === form.format)?.collations || [];
        };
        onMounted(() => {
            handleParams();
        });
        return () =>
            (unref(paramObjs) || []).map((p, index) => (
                <div key={index}>
                    <ElFormItem label={getLabel(p)} prop={p.prop}>
                        {p.type == 'text' ? (
                            <ElInput
                                modelValue={__panelSetupProps.form[p.envKey]}
                                onUpdate:modelValue={($v) => {
                                    __panelSetupProps.form[p.envKey] = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                                type={p.type}
                                onChange={($event?: any) => {
                                    (updateParam as any)($event);
                                }}
                                disabled={p.disabled}
                            />
                        ) : null}
                        {p.type == 'number' ? (
                            <ElInput
                                modelValue={__panelSetupProps.form[p.envKey]}
                                onUpdate:modelValue={($v) => {
                                    __panelSetupProps.form[p.envKey] = $v === '' ? $v : Number($v);
                                }}
                                onBlur={($event?: any) => {
                                    __panelSetupProps.form[p.envKey] = Number(__panelSetupProps.form[p.envKey]);
                                }}
                                maxlength="15"
                                onChange={($event?: any) => {
                                    (updateParam as any)($event);
                                }}
                                disabled={p.disabled}
                            />
                        ) : null}
                        {p.type == 'password' ? (
                            <ElInput
                                modelValue={__panelSetupProps.form[p.envKey]}
                                onUpdate:modelValue={($v) => {
                                    __panelSetupProps.form[p.envKey] = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                                type={p.type}
                                show-password
                                clearable
                                onChange={($event?: any) => {
                                    (updateParam as any)($event);
                                }}
                            />
                        ) : null}
                        {p.type == 'service' ? (
                            <div class={'service-param-row'}>
                                <ElSelect
                                    modelValue={__panelSetupProps.form[p.envKey]}
                                    onUpdate:modelValue={($v) => {
                                        __panelSetupProps.form[p.envKey] = $v as any;
                                    }}
                                    onChange={($event?: any) => {
                                        changeService(__panelSetupProps.form[p.envKey], p.services);
                                    }}
                                    class={'service-param-select p-w-200'}
                                >
                                    {(p.services || []).map((service) => (
                                        <ElOption value={service.value} label={service.label} key={service.label} />
                                    ))}
                                </ElSelect>
                                {p.services.length === 0 ? (
                                    <span class={'service-install-link'}>
                                        <ElLink
                                            type="primary"
                                            underline="never"
                                            onClick={($event?: any) => {
                                                toPage(p.key);
                                            }}
                                            class={'service-install-link__text'}
                                        >
                                            {$t('app.toInstall')}
                                        </ElLink>
                                    </span>
                                ) : null}
                            </div>
                        ) : null}
                        {p.type == 'select' ? (
                            <ElSelect
                                modelValue={__panelSetupProps.form[p.envKey]}
                                onUpdate:modelValue={($v) => {
                                    __panelSetupProps.form[p.envKey] = $v as any;
                                }}
                                multiple={p.multiple}
                                allowCreate={p.allowCreate}
                                filterable
                            >
                                {(p.values || []).map((service) => (
                                    <ElOption value={service.value} label={service.label} key={service.label} />
                                ))}
                            </ElSelect>
                        ) : null}
                        {p.type == 'apps' ? (
                            <div class={'app-service-row'}>
                                <div class={'app-service-row__app'}>
                                    <ElFormItem prop={p.prop}>
                                        <ElSelect
                                            modelValue={__panelSetupProps.form[p.envKey]}
                                            onUpdate:modelValue={($v) => {
                                                __panelSetupProps.form[p.envKey] = $v as any;
                                            }}
                                            onChange={($event?: any) => {
                                                getServices(p.child.envKey, __panelSetupProps.form[p.envKey], p);
                                            }}
                                            class={'app-service-row__select p-w-200'}
                                        >
                                            {(p.values || []).map((service) => (
                                                <ElOption
                                                    label={service.label}
                                                    value={service.value}
                                                    key={service.value}
                                                />
                                            ))}
                                        </ElSelect>
                                    </ElFormItem>
                                </div>
                                <div class={'app-service-row__service'}>
                                    <ElFormItem prop={p.childProp}>
                                        {p.child.type == 'service' ? (
                                            <ElSelect
                                                modelValue={__panelSetupProps.form[p.child.envKey]}
                                                onUpdate:modelValue={($v) => {
                                                    __panelSetupProps.form[p.child.envKey] = $v as any;
                                                }}
                                                onChange={($event?: any) => {
                                                    changeService(__panelSetupProps.form[p.child.envKey], p.services);
                                                }}
                                                class={'app-service-row__select p-w-300'}
                                            >
                                                {(p.services || []).map((service) => (
                                                    <ElOption
                                                        value={service.value}
                                                        label={service.label}
                                                        disabled={service.status != 'Running'}
                                                        key={service.label}
                                                    >
                                                        <ElRow gutter={5}>
                                                            <ElCol span={14}>
                                                                <span>{service.label}</span>
                                                            </ElCol>
                                                            <ElCol span={6}>
                                                                {service.from != '' ? (
                                                                    <span>
                                                                        {service.from === 'local' ? (
                                                                            <ElTag>{$t('commons.table.local')}</ElTag>
                                                                        ) : (
                                                                            <ElTag type="success">
                                                                                {$t('database.remote')}
                                                                            </ElTag>
                                                                        )}
                                                                        <Status
                                                                            status={service.status}
                                                                            class={'ml-2'}
                                                                            key={service.status}
                                                                        />
                                                                    </span>
                                                                ) : null}
                                                            </ElCol>
                                                        </ElRow>
                                                    </ElOption>
                                                ))}
                                            </ElSelect>
                                        ) : null}
                                    </ElFormItem>
                                </div>
                                {p.child.type === 'service' && p.services.length === 0 ? (
                                    <span class={'service-install-link'}>
                                        <ElLink
                                            type="primary"
                                            underline="never"
                                            onClick={($event?: any) => {
                                                toPage(__panelSetupProps.form[p.envKey]);
                                            }}
                                            class={'service-install-link__text'}
                                        >
                                            {$t('app.toInstall')}
                                        </ElLink>
                                    </span>
                                ) : null}
                            </div>
                        ) : null}
                        {p.description ? <span class={'input-help'}>{getDescription(p)}</span> : null}
                    </ElFormItem>
                    {isMysql(__panelSetupProps.form, p.envKey) ? (
                        <ElFormItem label={$t('database.format')} prop="format">
                            <ElSelect
                                filterable
                                modelValue={__panelSetupProps.form.format}
                                onUpdate:modelValue={($v) => {
                                    __panelSetupProps.form.format = $v as any;
                                }}
                                onChange={($event?: any) => {
                                    loadCollations();
                                }}
                            >
                                {(unref(formatOptions) || []).map((item) => (
                                    <ElOption label={item.format} value={item.format} key={item.format} />
                                ))}
                            </ElSelect>
                        </ElFormItem>
                    ) : null}
                    {isMysql(__panelSetupProps.form, p.envKey) ? (
                        <ElFormItem label={$t('database.collation')} prop="collation">
                            <ElSelect
                                filterable
                                modelValue={__panelSetupProps.form.collation}
                                onUpdate:modelValue={($v) => {
                                    __panelSetupProps.form.collation = $v as any;
                                }}
                            >
                                {(unref(collationOptions) || []).map((item) => (
                                    <ElOption label={item} value={item} key={item} />
                                ))}
                            </ElSelect>
                            <span class={'input-help'}>
                                {$t('database.collationHelper', [__panelSetupProps.form.format])}
                            </span>
                        </ElFormItem>
                    ) : null}
                </div>
            ));
    },
    options,
);
