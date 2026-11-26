import { $t } from '@/utils/i18n-t';
interface NginxConfigReq {
    operate: string;
    websiteId?: number;
    scope: string;
    params?: any;
}
import { rpc } from '@/lib/rpc';
import { checkNumberRange, Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { MsgError, MsgSuccess } from '@/utils/message';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'performance',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        let updateReq = ref<NginxConfigReq>({
            scope: 'http-per',
            operate: 'update',
            params: {},
        });
        let data = ref();
        let form = ref({
            server_names_hash_bucket_size: 512,
            client_header_buffer_size: 32,
            client_max_body_size: 50,
            keepalive_timeout: '75s',
            gzip_min_length: 1,
            gzip_comp_level: 2,
            gzip: 'on',
            brotli: 'on',
            brotli_comp_level: 5,
            brotli_min_length: 1,
            proxy_connect_timeout: '60s',
            proxy_send_timeout: '60s',
            proxy_read_timeout: '60s',
        });
        let nginxFormRef = ref();
        let loading = ref(false);
        const loaded = ref(false);
        const sources = ref<Record<string, string>>({});
        const sourceHelp = (name: string) => i18n.global.t('nginx.directiveSourceHelper', [sources.value[name]]);
        const brotliAvailable = ref(false);
        const brotliManagedExternally = ref(false);
        const brotliManagedPending = ref(false);
        const brotliManagedUnavailable = ref(false);
        const timeKeys = ['keepalive_timeout', 'proxy_connect_timeout', 'proxy_send_timeout', 'proxy_read_timeout'];
        const timeDefaults: Record<string, string> = {
            keepalive_timeout: '75s',
            proxy_connect_timeout: '60s',
            proxy_send_timeout: '60s',
            proxy_read_timeout: '60s',
        };
        const baseline: Record<string, string> = { ...timeDefaults };
        const normalizeTime = (value: unknown) =>
            String(value ?? '')
                .trim()
                .split(/\s+/)
                .join(' ');
        const timeUnits = ['y', 'M', 'w', 'd', 'h', 'm', 's', 'ms'];
        const timeUnitMs = [31536000000, 2592000000, 604800000, 86400000, 3600000, 60000, 1000, 1];
        const parseNginxTime = (value: string, wholeSeconds: boolean): number | null => {
            const tokens = value.match(/\d+(ms|[yMwdhms])?/g);
            if (!tokens || tokens.join('') !== value) {
                return null;
            }
            let total = 0;
            let previous = -1;
            for (const token of tokens) {
                const unit = token.replace(/^\d+/, '');
                const digits = token.slice(0, token.length - unit.length);
                if (unit === '') {
                    total += Number(digits) * 1000;
                    continue;
                }
                const index = timeUnits.indexOf(unit);
                if (index <= previous || (wholeSeconds ? unit === 'ms' : index < 2)) {
                    return null;
                }
                previous = index;
                total += Number(digits) * timeUnitMs[index];
            }
            return total;
        };
        const isValidTime = (name: string, value: string) => {
            const parts = value.split(' ');
            if (name === 'keepalive_timeout') {
                // The optional second value is the Keep-Alive response header, in seconds.
                return (
                    parts.length <= 2 &&
                    parseNginxTime(parts[0], false) !== null &&
                    (parts.length === 1 || parseNginxTime(parts[1], true) !== null)
                );
            }
            // Zero would time every request out at once rather than lift the limit.
            return parts.length === 1 && (parseNginxTime(parts[0], false) ?? 0) > 0;
        };
        const checkTime = (name: string): FormItemRule => ({
            trigger: 'blur',
            validator: (_rule, value, callback) => {
                const text = normalizeTime(value);
                if (text === baseline[name] || isValidTime(name, text)) {
                    callback();
                } else {
                    callback(new Error(i18n.global.t('nginx.timeValueError')));
                }
            },
        });
        const variablesRules = reactive({
            server_names_hash_bucket_size: [checkNumberRange(1, 9999)],
            client_header_buffer_size: [checkNumberRange(0, 999999999)],
            client_max_body_size: [checkNumberRange(0, 999999999)],
            keepalive_timeout: [Rules.requiredInput, checkTime('keepalive_timeout')],
            gzip: [Rules.requiredSelect],
            gzip_min_length: [Rules.requiredSelect],
            gzip_comp_level: [checkNumberRange(1, 9)],
            brotli: [Rules.requiredSelect],
            brotli_min_length: [Rules.requiredSelect],
            brotli_comp_level: [checkNumberRange(0, 11)],
            proxy_connect_timeout: [Rules.requiredInput, checkTime('proxy_connect_timeout')],
            proxy_send_timeout: [Rules.requiredInput, checkTime('proxy_send_timeout')],
            proxy_read_timeout: [Rules.requiredInput, checkTime('proxy_read_timeout')],
        });
        const sizeKeys = ['client_header_buffer_size', 'client_max_body_size', 'gzip_min_length', 'brotli_min_length'];
        const units = ref<Record<string, string>>({});
        const parseSizeParam = (name: string, value: string) => {
            const matched = /^(\d+)\s*([kKmMgG]?)$/.exec(value.trim());
            if (!matched) {
                return Number(value.match(/\d+/g)?.[0] ?? 0);
            }
            units.value[name] = matched[2] === '' ? '' : matched[2].toLowerCase();
            return Number(matched[1]);
        };
        const withUnit = (name: string, value: number, defaultUnit: string) => {
            const unit = units.value[name] ?? defaultUnit;
            return String(value) + unit;
        };
        const unitLabel = (name: string, defaultUnit: string) => {
            const unit = units.value[name] ?? defaultUnit;
            return unit === '' ? 'B' : unit.toUpperCase();
        };
        const getParams = async () => {
            loaded.value = false;
            // Reset the unit cache: a directive removed since the last load must not
            // hand its remembered unit to a value that no longer carries one.
            units.value = {};
            const res = await rpc.openresty.getConfigByScope({ scope: 'http-per', websiteId: 0 });
            data.value = res.items;
            const nextSources: Record<string, string> = {};
            for (const param of res.items) {
                if (param.source) {
                    nextSources[param.name] = param.source;
                }
                if (timeKeys.includes(param.name)) {
                    const value = param.params.length > 0 ? param.params.join(' ') : timeDefaults[param.name];
                    form.value[param.name] = value;
                    baseline[param.name] = value;
                    continue;
                }
                if (param.params.length === 0) {
                    continue;
                }
                if (param.name == 'gzip') {
                    form.value.gzip = param.params[0];
                } else if (sizeKeys.includes(param.name)) {
                    form.value[param.name] = parseSizeParam(param.name, param.params[0]);
                } else if (param.name in form.value) {
                    form.value[param.name] = Number(param.params[0].match(/\d+/g)?.[0] ?? 0);
                }
                // Keys the page does not render (gzip_types, gzip_vary, gzip_proxied)
                // are deliberately not stuffed into the form.
            }
            sources.value = nextSources;
            await getBrotliParams();
            loaded.value = true;
        };
        const getBrotliParams = async () => {
            const modules = await rpc.openresty.getModules({});
            const brotli = modules.items.find((item) => item.name === 'ngx_brotli');
            brotliAvailable.value = !!brotli && brotli.enable && brotli.buildStatus === 'ready';
            if (!brotliAvailable.value) {
                return;
            }
            const res = await rpc.openresty.getConfigByScope({ scope: 'brotli', websiteId: 0 });
            brotliManagedExternally.value = res.managedExternally;
            brotliManagedPending.value = res.managedPending;
            brotliManagedUnavailable.value = res.managedUnavailable;
            for (const param of res.items) {
                if (param.params.length === 0) {
                    continue;
                }
                if (param.name === 'brotli') {
                    form.value.brotli = param.params[0];
                } else if (param.name === 'brotli_min_length') {
                    form.value.brotli_min_length = parseSizeParam(param.name, param.params[0]);
                } else if (param.name === 'brotli_comp_level') {
                    form.value.brotli_comp_level = Number(param.params[0].match(/\d+/g)?.[0] ?? 0);
                }
            }
        };
        const submit = async (formEl: FormInstance | undefined) => {
            if (!formEl || !loaded.value) return;
            await formEl.validate((valid) => {
                if (!valid) {
                    return;
                }
                loading.value = true;
                let params: Record<string, string> = {
                    gzip: form.value.gzip,
                    server_names_hash_bucket_size: String(form.value.server_names_hash_bucket_size),
                    client_header_buffer_size: withUnit(
                        'client_header_buffer_size',
                        form.value.client_header_buffer_size,
                        'k',
                    ),
                    client_max_body_size: withUnit('client_max_body_size', form.value.client_max_body_size, 'm'),
                    gzip_min_length: withUnit('gzip_min_length', form.value.gzip_min_length, 'k'),
                    gzip_comp_level: String(form.value.gzip_comp_level),
                };
                for (const name of timeKeys) {
                    const value = normalizeTime(form.value[name]);
                    if (value !== baseline[name]) {
                        params[name] = value;
                    }
                }
                for (const name of Object.keys(sources.value)) {
                    delete params[name];
                }
                updateReq.value.params = params;
                rpc.openresty
                    .updateConfigByScope({
                        scope: updateReq.value.scope,
                        operate: updateReq.value.operate,
                        websiteId: updateReq.value.websiteId ?? 0,
                        paramsJson: updateReq.value.params ? JSON.stringify(updateReq.value.params) : '',
                    })
                    .then(() => {
                        if (!brotliAvailable.value || brotliManagedUnavailable.value) {
                            return;
                        }
                        // brotli_types is managed by the panel and deliberately not
                        // exposed, so it stays aligned with gzip_types.
                        return rpc.openresty
                            .updateConfigByScope({
                                scope: 'brotli',
                                operate: 'update',
                                websiteId: 0,
                                paramsJson: JSON.stringify({
                                    brotli: form.value.brotli,
                                    brotli_comp_level: String(form.value.brotli_comp_level),
                                    brotli_min_length: withUnit('brotli_min_length', form.value.brotli_min_length, 'k'),
                                }),
                            })
                            .catch(() => {
                                // gzip was already saved by the time brotli failed; say so
                                // instead of leaving the user guessing which half applied.
                                MsgError(i18n.global.t('nginx.brotliSaveFailed'));
                                getParams();
                                throw new Error('brotli save failed');
                            });
                    })
                    .then(() => {
                        MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                        getParams();
                    })
                    .catch(() => {})
                    .finally(() => {
                        loading.value = false;
                    });
            });
        };
        onMounted(() => {
            getParams();
        });
        return () => (
            <div>
                {
                    <ElForm
                        model={unref(form)}
                        rules={variablesRules}
                        ref={nginxFormRef}
                        label-position="top"
                        v-loading={unref(loading)}
                    >
                        <ElRow gutter={20}>
                            <ElCol xs={24} sm={24} md={9} lg={9} xl={9}>
                                <ElFormItem label="server_names_hash_bucket_size" prop="server_names_hash_bucket_size">
                                    <ElInput
                                        clearable
                                        type="number"
                                        modelValue={unref(form).server_names_hash_bucket_size}
                                        onUpdate:modelValue={($v) => {
                                            unref(form).server_names_hash_bucket_size = $v === '' ? $v : Number($v);
                                        }}
                                        disabled={!!unref(sources).server_names_hash_bucket_size}
                                    />
                                    <span class={'input-help'}>{$t('nginx.serverNamesHashBucketSizeHelper')}</span>
                                    {unref(sources).server_names_hash_bucket_size ? (
                                        <span class={'input-help'}>{sourceHelp('server_names_hash_bucket_size')}</span>
                                    ) : null}
                                </ElFormItem>
                                <ElFormItem label="client_header_buffer_size" prop="client_header_buffer_size">
                                    <ElInput
                                        clearable
                                        type="number"
                                        modelValue={unref(form).client_header_buffer_size}
                                        onUpdate:modelValue={($v) => {
                                            unref(form).client_header_buffer_size = $v === '' ? $v : Number($v);
                                        }}
                                        disabled={!!unref(sources).client_header_buffer_size}
                                        v-slots={{ append: () => <>{unitLabel('client_header_buffer_size', 'k')}</> }}
                                    />
                                    <span class={'input-help'}>{$t('nginx.clientHeaderBufferSizeHelper')}</span>
                                    {unref(sources).client_header_buffer_size ? (
                                        <span class={'input-help'}>{sourceHelp('client_header_buffer_size')}</span>
                                    ) : null}
                                </ElFormItem>
                                <ElFormItem label="client_max_body_size" prop="client_max_body_size">
                                    <ElInput
                                        clearable
                                        type="number"
                                        modelValue={unref(form).client_max_body_size}
                                        onUpdate:modelValue={($v) => {
                                            unref(form).client_max_body_size = $v === '' ? $v : Number($v);
                                        }}
                                        disabled={!!unref(sources).client_max_body_size}
                                        v-slots={{ append: () => <>{unitLabel('client_max_body_size', 'm')}</> }}
                                    />
                                    <span class={'input-help'}>{$t('nginx.clientMaxBodySizeHelper')}</span>
                                    {unref(sources).client_max_body_size ? (
                                        <span class={'input-help'}>{sourceHelp('client_max_body_size')}</span>
                                    ) : null}
                                </ElFormItem>
                                <ElFormItem label="keepalive_timeout" prop="keepalive_timeout">
                                    <ElInput
                                        clearable
                                        modelValue={unref(form).keepalive_timeout}
                                        onUpdate:modelValue={($v) => {
                                            unref(form).keepalive_timeout = typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                        disabled={!!unref(sources).keepalive_timeout}
                                    />
                                    <span class={'input-help'}>{$t('nginx.keepaliveTimeoutHelper')}</span>
                                    {unref(sources).keepalive_timeout ? (
                                        <span class={'input-help'}>{sourceHelp('keepalive_timeout')}</span>
                                    ) : null}
                                </ElFormItem>
                            </ElCol>
                            <ElCol xs={24} sm={24} md={9} lg={9} xl={9}>
                                <ElFormItem label="gzip" prop="gzip">
                                    <ElSelect v-model={unref(form).gzip} disabled={!!unref(sources).gzip}>
                                        <ElOption label={'on'} value={'on'} />
                                        <ElOption label={'off'} value={'off'} />
                                    </ElSelect>
                                    <span class={'input-help'}>{$t('nginx.gzipHelper')}</span>
                                    {unref(sources).gzip ? (
                                        <span class={'input-help'}>{sourceHelp('gzip')}</span>
                                    ) : null}
                                </ElFormItem>
                                <ElFormItem label="gzip_min_length" prop="gzip_min_length">
                                    <ElInput
                                        clearable
                                        modelValue={unref(form).gzip_min_length}
                                        onUpdate:modelValue={($v) => {
                                            unref(form).gzip_min_length = $v === '' ? $v : Number($v);
                                        }}
                                        disabled={!!unref(sources).gzip_min_length}
                                        v-slots={{ append: () => <>{unitLabel('gzip_min_length', 'k')}</> }}
                                    />
                                    <span class={'input-help'}>{$t('nginx.gzipMinLengthHelper')}</span>
                                    {unref(sources).gzip_min_length ? (
                                        <span class={'input-help'}>{sourceHelp('gzip_min_length')}</span>
                                    ) : null}
                                </ElFormItem>
                                <ElFormItem label="gzip_comp_level" prop="gzip_comp_level">
                                    <ElInput
                                        clearable
                                        modelValue={unref(form).gzip_comp_level}
                                        onUpdate:modelValue={($v) => {
                                            unref(form).gzip_comp_level = $v === '' ? $v : Number($v);
                                        }}
                                        disabled={!!unref(sources).gzip_comp_level}
                                    />
                                    <span class={'input-help'}>{$t('nginx.gzipCompLevelHelper')}</span>
                                    {unref(sources).gzip_comp_level ? (
                                        <span class={'input-help'}>{sourceHelp('gzip_comp_level')}</span>
                                    ) : null}
                                </ElFormItem>
                            </ElCol>
                        </ElRow>
                        <ElRow gutter={20}>
                            <ElCol xs={24} sm={24} md={9} lg={9} xl={9}>
                                <ElFormItem label="proxy_connect_timeout" prop="proxy_connect_timeout">
                                    <ElInput
                                        clearable
                                        modelValue={unref(form).proxy_connect_timeout}
                                        onUpdate:modelValue={($v) => {
                                            unref(form).proxy_connect_timeout = typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                        disabled={!!unref(sources).proxy_connect_timeout}
                                    />
                                    <span class={'input-help'}>{$t('nginx.proxyConnectTimeoutHelper')}</span>
                                    {unref(sources).proxy_connect_timeout ? (
                                        <span class={'input-help'}>{sourceHelp('proxy_connect_timeout')}</span>
                                    ) : null}
                                </ElFormItem>
                                <ElFormItem label="proxy_send_timeout" prop="proxy_send_timeout">
                                    <ElInput
                                        clearable
                                        modelValue={unref(form).proxy_send_timeout}
                                        onUpdate:modelValue={($v) => {
                                            unref(form).proxy_send_timeout = typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                        disabled={!!unref(sources).proxy_send_timeout}
                                    />
                                    <span class={'input-help'}>{$t('nginx.proxySendTimeoutHelper')}</span>
                                    {unref(sources).proxy_send_timeout ? (
                                        <span class={'input-help'}>{sourceHelp('proxy_send_timeout')}</span>
                                    ) : null}
                                </ElFormItem>
                            </ElCol>
                            <ElCol xs={24} sm={24} md={9} lg={9} xl={9}>
                                <ElFormItem label="proxy_read_timeout" prop="proxy_read_timeout">
                                    <ElInput
                                        clearable
                                        modelValue={unref(form).proxy_read_timeout}
                                        onUpdate:modelValue={($v) => {
                                            unref(form).proxy_read_timeout = typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                        disabled={!!unref(sources).proxy_read_timeout}
                                    />
                                    <span class={'input-help'}>{$t('nginx.proxyReadTimeoutHelper')}</span>
                                    {unref(sources).proxy_read_timeout ? (
                                        <span class={'input-help'}>{sourceHelp('proxy_read_timeout')}</span>
                                    ) : null}
                                </ElFormItem>
                            </ElCol>
                        </ElRow>
                        {unref(brotliAvailable) ? (
                            <ElRow gutter={20}>
                                {unref(brotliManagedExternally) ? (
                                    <ElCol span={24}>
                                        <ElAlert type="info" closable={false} class={'mb-2'}>
                                            {$t('nginx.brotliManagedExternallyHelper')}
                                        </ElAlert>
                                    </ElCol>
                                ) : null}
                                {unref(brotliManagedPending) ? (
                                    <ElCol span={24}>
                                        <ElAlert type="info" closable={false} class={'mb-2'}>
                                            {$t('nginx.brotliManagedPendingHelper')}
                                        </ElAlert>
                                    </ElCol>
                                ) : null}
                                {unref(brotliManagedUnavailable) ? (
                                    <ElCol span={24}>
                                        <ElAlert type="warning" closable={false} class={'mb-2'}>
                                            {$t('nginx.brotliManagedUnavailableHelper')}
                                        </ElAlert>
                                    </ElCol>
                                ) : null}
                                <ElCol xs={24} sm={24} md={9} lg={9} xl={9}>
                                    <ElFormItem label="brotli" prop="brotli">
                                        <ElSelect v-model={unref(form).brotli}>
                                            <ElOption label={'on'} value={'on'} />
                                            <ElOption label={'off'} value={'off'} />
                                        </ElSelect>
                                        <span class={'input-help'}>{$t('nginx.brotliHelper')}</span>
                                    </ElFormItem>
                                    <ElFormItem label="brotli_min_length" prop="brotli_min_length">
                                        <ElInput
                                            clearable
                                            modelValue={unref(form).brotli_min_length}
                                            onUpdate:modelValue={($v) => {
                                                unref(form).brotli_min_length = $v === '' ? $v : Number($v);
                                            }}
                                            v-slots={{ append: () => <>{unitLabel('brotli_min_length', 'k')}</> }}
                                        />
                                        <span class={'input-help'}>{$t('nginx.brotliMinLengthHelper')}</span>
                                    </ElFormItem>
                                </ElCol>
                                <ElCol xs={24} sm={24} md={9} lg={9} xl={9}>
                                    <ElFormItem label="brotli_comp_level" prop="brotli_comp_level">
                                        <ElInput
                                            clearable
                                            modelValue={unref(form).brotli_comp_level}
                                            onUpdate:modelValue={($v) => {
                                                unref(form).brotli_comp_level = $v === '' ? $v : Number($v);
                                            }}
                                        />
                                        <span class={'input-help'}>{$t('nginx.brotliCompLevelHelper')}</span>
                                    </ElFormItem>
                                </ElCol>
                            </ElRow>
                        ) : null}
                        <ElFormItem>
                            {
                                <ElButton
                                    type="primary"
                                    disabled={!unref(loaded)}
                                    onClick={($event?: any) => {
                                        submit(unref(nginxFormRef));
                                    }}
                                    v-permission={true}
                                >
                                    {$t('commons.button.save')}
                                </ElButton>
                            }
                        </ElFormItem>
                    </ElForm>
                }
            </div>
        );
    },
    options,
);
