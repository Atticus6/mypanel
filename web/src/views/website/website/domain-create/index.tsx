import { $t } from '@/utils/i18n-t';
import { Rules, checkNumberRange } from '@/global/form-rules';
import { MsgError } from '@/utils/message';
import { toASCII } from 'punycode';
import { ref, onMounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { rpc } from '@/lib/rpc';
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import permissionDirective from '@/directives/modules/permission';
import { ElRow } from 'element-plus';
import { ElCol } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElIcon } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { Delete } from '@element-plus/icons-vue';
import DialogPro from '@/components/dialog-pro/index';

interface CodemodProps {
    [key: string]: any;
    form?: Record<string, any>;
}

const emits = {
    gengerate: (...args: unknown[]) => true,
    'domain-blur': (...args: unknown[]) => true,
};

const options = {
    name: 'domain-create',
    props: {
        form: {
            type: Object,
            default: function () {
                return {};
            },
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-c9044d06',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const i18n = useI18n();
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const ipv6Regex =
            /^(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?:(?::[0-9a-fA-F]{1,4}){1,6})|:(?:(?::[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(?::[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(?:ffff(?::0{1,4}){0,1}:){0,1}(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
        const singleDomainRegex = /^(?:\*|[\w\u4e00-\u9fa5-]{1,63})(?:\.(?:\*|[\w\u4e00-\u9fa5-]{1,63}))*$/;
        const FQDNDomainRegex =
            /^(?:\*\.)?(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}(?::(6553[0-5]|655[0-2]\d|65[0-4]\d{2}|6[0-4]\d{3}|[1-5]?\d{1,4}))?$/;
        const isIPv4 = (str: string): boolean => {
            return ipv4Regex.test(str);
        };
        const isIPv6 = (str: string): boolean => {
            const cleanStr = str.replace(/^\[|\]$/g, '');
            return ipv6Regex.test(cleanStr);
        };
        const isFQDN = (domain: string): boolean => {
            if (!domain) return true;
            return FQDNDomainRegex.test(domain);
        };
        function toPunycode(hostname: string): string {
            try {
                if (isIPv4(hostname) || isIPv6(hostname.replace(/^\[|\]$/g, ''))) {
                    return hostname;
                }

                const convertLabels = (value: string): string => {
                    return value
                        .split('.')
                        .map((label) => (label === '*' || label === '' ? label : toASCII(label)))
                        .join('.');
                };

                if (hostname.startsWith('*.')) {
                    const domainPart = hostname.substring(2);
                    return `*.${convertLabels(domainPart)}`;
                }
                if (hostname.endsWith('.*')) {
                    const domainPart = hostname.slice(0, -2);
                    return `${convertLabels(domainPart)}.*`;
                }
                return convertLabels(hostname);
            } catch {
                return hostname;
            }
        }
        const handleDomainBlur = (index: number) => {
            const originalDomain = create.value.domains[index].domain;
            if (!originalDomain) {
                create.value.domains[index].host = '';
                domainWarnings.value[index] = false;
                ctx.emit('domain-blur', index);
                return;
            }

            const cleanDomain = originalDomain.replace(/^\[|\]$/g, '');
            if (isIPv4(cleanDomain) || isIPv6(cleanDomain)) {
                create.value.domains[index].host = originalDomain;
                create.value.domains[index].domain = originalDomain;
                domainWarnings.value[index] = false;
                ctx.emit('domain-blur', index);
                return;
            }

            let singleRegexChecked = singleDomainRegex.test(originalDomain);
            if (!singleRegexChecked) {
                domainWarnings.value[index] = false;
                ctx.emit('domain-blur', index);
                return;
            }

            const punycoded = toPunycode(originalDomain);
            if (punycoded !== originalDomain) {
                create.value.domains[index].host = originalDomain;
                create.value.domains[index].domain = punycoded;
            } else {
                create.value.domains[index].host = originalDomain;
            }

            if (singleRegexChecked) {
                domainWarnings.value[index] = !isFQDN(create.value.domains[index].domain);
            } else {
                domainWarnings.value[index] = false;
            }
            ctx.emit('domain-blur', index);
        };
        const validateSingleDomain = (_rule: any, value: string, callback: (error?: Error) => void) => {
            if (!value) {
                return callback();
            }

            const cleanValue = value.replace(/^\[|\]$/g, '');

            if (isIPv4(cleanValue) || isIPv6(cleanValue) || singleDomainRegex.test(value)) {
                return callback();
            }

            callback(new Error(i18n.t('website.domainInvalid')));
        };
        const rules = ref({
            port: [Rules.requiredInput, Rules.paramPort, checkNumberRange(1, 65535)],
            domain: [Rules.requiredInput, { validator: validateSingleDomain, trigger: 'blur' }],
            domains: {
                type: Array,
            },
        });
        const defaultPort = ref(80);
        const batchDialogVisible = ref(false);
        const domainWarnings = ref<{ [key: number]: boolean }>({});
        const initDomain = () => ({
            domain: '',
            host: '',
            port: defaultPort.value,
            ssl: false,
        });
        const create = ref({
            websiteID: 0,
            domains: [initDomain()],
            domainStr: '',
        });
        const domainToString = (domain: { domain: string; port: number; ssl: boolean }): string => {
            if (!domain.domain) return '';
            let str = domain.domain;

            if (domain.port && domain.port !== 80 && isIPv6(str.replace(/^\[|\]$/g, ''))) {
                if (!str.startsWith('[')) {
                    str = `[${str}]`;
                }
            }

            if (domain.port && domain.port !== 80) {
                str += `:${domain.port}`;
            }
            return str;
        };
        const stringToDomain = (line: string): { domain: string; host: string; port: number; ssl: boolean } | null => {
            if (!line.trim()) return null;

            let ssl = false;
            let str = line.trim();
            let domainRaw = '';
            let portStr = '';

            const ipv6Match = str.match(/^\[([^\]]+)\](?::(\d+))?$/);
            if (ipv6Match) {
                domainRaw = ipv6Match[1];
                portStr = ipv6Match[2] || '';
            } else {
                const parts = str.split(':');
                if (parts.length === 2) {
                    domainRaw = parts[0];
                    portStr = parts[1];
                } else if (parts.length === 1) {
                    domainRaw = parts[0];
                } else {
                    if (isIPv6(str)) {
                        domainRaw = str;
                    } else {
                        return null;
                    }
                }
            }

            if (!domainRaw) return null;

            const cleanDomain = domainRaw.replace(/^\[|\]$/g, '');
            let domain: string;
            let host: string;

            if (isIPv4(cleanDomain) || isIPv6(cleanDomain)) {
                domain = domainRaw;
                host = domainRaw;
            } else {
                domain = toPunycode(domainRaw);
                host = domain !== domainRaw ? domainRaw : domain;
            }

            const port = portStr ? Number(portStr) : defaultPort.value;

            if (port === 443) {
                ssl = true;
            } else if (port === 80) {
                ssl = false;
            }

            return { domain, host, port, ssl };
        };
        const openBatchDialog = () => {
            const lines = create.value.domains.map(domainToString).filter((line) => line !== '');
            create.value.domainStr = lines.join('\n');
            batchDialogVisible.value = true;
        };
        const addDomain = () => {
            create.value.domains.push(initDomain());
        };
        const removeDomain = (index: number) => {
            create.value.domains.splice(index, 1);
        };
        const saveBatchInput = () => {
            if (create.value.domainStr.trim() === '') {
                return true;
            }
            const lines = create.value.domainStr.split(/\r?\n/);
            const newDomains: { domain: string; host: string; port: number; ssl: boolean }[] = [];
            let hasError = false;

            const isFirstBatchInput = create.value.domains.length === 1 && !create.value.domains[0].domain;

            lines.forEach((line, index) => {
                const parsed = stringToDomain(line);
                if (!parsed) return;

                const { domain, host, port, ssl } = parsed;
                const cleanDomain = domain.replace(/^\[|\]$/g, '');

                if (
                    !domain.trim() ||
                    (!isIPv4(cleanDomain) && !isIPv6(cleanDomain) && !singleDomainRegex.test(domain))
                ) {
                    MsgError(line + ' ' + i18n.t('website.domainInvalid'));
                    hasError = true;
                    return;
                }

                if (!newDomains.some((d) => d.domain === domain && d.port === port)) {
                    newDomains.push({ domain, host, port, ssl });
                }

                if (isFirstBatchInput && index === 0) {
                    const alias = domain.split(':')[0].replace(/^\[|\]$/g, '');
                    if (__panelSetupProps.form.alias !== undefined) {
                        __panelSetupProps.form.alias = alias;
                    }
                }
            });

            if (hasError) return false;

            if (newDomains.length > 0) {
                create.value.domains = newDomains;
            } else {
                create.value.domains = [initDomain()];
            }

            handleParams();
            nextTick(() => ctx.emit('gengerate'));

            batchDialogVisible.value = false;
            return true;
        };
        const handleParams = () => {
            __panelSetupProps.form.domains = create.value.domains;
        };
        const getOprensty = async () => {
            try {
                await rpc.app
                    .checkInstalled({ key: 'openresty', name: '' })
                    .then((res) => {
                        defaultPort.value = res.httpPort || 80;
                        create.value.domains[0].port = defaultPort.value;
                    })
                    .catch(() => {});
            } catch (error) {}
        };
        onMounted(() => {
            getOprensty();
            handleParams();
        });
        return () => (
            <div>
                {(unref(create).domains || []).map((domain, index) => (
                    <ElRow gutter={22} class={'domain-create-row'} key={index}>
                        <ElCol span={6} xs={24} class={'domain-create-field domain-create-domain'}>
                            <ElFormItem
                                label={index == 0 ? $t('website.domain') : ''}
                                prop={`domains.${index}.domain`}
                                rules={unref(rules).domain}
                            >
                                <ElInput
                                    type="string"
                                    modelValue={unref(create).domains[index].domain}
                                    onUpdate:modelValue={($v) => {
                                        unref(create).domains[index].domain = $v as any;
                                    }}
                                    placeholder={index > 0 ? $t('website.domain') : ''}
                                    onBlur={($event?: any) => {
                                        handleDomainBlur(index);
                                    }}
                                />
                                {unref(domainWarnings)[index] ? (
                                    <span class={'input-help'}>{$t('website.domainNotFQDN')}</span>
                                ) : null}
                            </ElFormItem>
                        </ElCol>
                        <ElCol span={6} xs={24} class={'domain-create-field domain-create-host'}>
                            <ElFormItem label={index == 0 ? $t('toolbox.device.hostname') : ''}>
                                <ElInput
                                    type="string"
                                    model-value={unref(create).domains[index].host}
                                    placeholder={index > 0 ? $t('toolbox.device.hostname') : ''}
                                    disabled
                                />
                            </ElFormItem>
                        </ElCol>
                        <ElCol span={4} xs={12} class={'domain-create-field domain-create-port'}>
                            <ElFormItem
                                label={index == 0 ? $t('commons.table.port') : ''}
                                prop={`domains.${index}.port`}
                                rules={unref(rules).port}
                            >
                                <ElInput
                                    type="number"
                                    modelValue={unref(create).domains[index].port}
                                    onUpdate:modelValue={($v) => {
                                        unref(create).domains[index].port = $v === '' ? $v : Number($v);
                                    }}
                                />
                            </ElFormItem>
                        </ElCol>
                        <ElCol span={2} xs={6} class={'domain-create-field domain-create-ssl'}>
                            <ElFormItem label={index == 0 ? 'SSL' : ''} prop={`domains.${index}.ssl`}>
                                <ElCheckbox
                                    modelValue={unref(create).domains[index].ssl}
                                    onUpdate:modelValue={($v) => {
                                        unref(create).domains[index].ssl = $v as any;
                                    }}
                                    disabled={unref(create).domains[index].port == 80}
                                    class={'domain-create-ssl-control'}
                                />
                            </ElFormItem>
                        </ElCol>
                        {index == 0 ? (
                            <ElCol span={4} xs={6} class={'domain-create-field domain-create-operation'}>
                                <ElFormItem label={$t('commons.table.operate')}>
                                    {withDirectives(
                                        <ElButton
                                            aria-label={$t('commons.button.add')}
                                            onClick={($event?: any) => {
                                                (addDomain as any)($event);
                                            }}
                                        >
                                            <ElIcon>
                                                <Plus />
                                            </ElIcon>
                                        </ElButton>,
                                        [[permissionDirective, true]],
                                    )}
                                </ElFormItem>
                            </ElCol>
                        ) : (
                            <ElCol span={4} xs={6} class={'domain-create-field domain-create-operation'}>
                                <ElFormItem>
                                    {withDirectives(
                                        <ElButton
                                            aria-label={$t('commons.button.delete')}
                                            onClick={($event?: any) => {
                                                removeDomain(index);
                                            }}
                                        >
                                            <ElIcon>
                                                <Delete />
                                            </ElIcon>
                                        </ElButton>,
                                        [[permissionDirective, true]],
                                    )}
                                </ElFormItem>
                            </ElCol>
                        )}
                    </ElRow>
                ))}
                {withDirectives(
                    <ElButton
                        onClick={($event?: any) => {
                            (openBatchDialog as any)($event);
                        }}
                        type="primary"
                        plain
                    >
                        {$t('website.batchInput')}
                    </ElButton>,
                    [[permissionDirective, true]],
                )}
                <DialogPro
                    modelValue={unref(batchDialogVisible)}
                    onUpdate:modelValue={($v) => {
                        batchDialogVisible.value = $v as any;
                    }}
                    title={$t('website.batchAdd')}
                    size="large"
                    v-slots={{
                        footer: () => (
                            <>
                                <ElButton
                                    onClick={($event?: any) => {
                                        batchDialogVisible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                {withDirectives(
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            (saveBatchInput as any)($event);
                                        }}
                                        disabled={unref(create).domainStr == ''}
                                    >
                                        {$t('commons.button.confirm')}
                                    </ElButton>,
                                    [[permissionDirective, true]],
                                )}
                            </>
                        ),
                    }}
                >
                    <ElInput
                        type="textarea"
                        rows={8}
                        modelValue={unref(create).domainStr}
                        onUpdate:modelValue={($v) => {
                            unref(create).domainStr = $v as any;
                        }}
                        placeholder={$t('website.domainBatchHelper')}
                    />
                </DialogPro>
            </div>
        );
    },
    options,
);
