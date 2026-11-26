import { $t } from '@/utils/i18n-t';
import { Website } from '@/types/website';
import { Rules, checkMaxLength, checkNumberRange } from '@/global/form-rules';
import FileList from '@/components/file-list/index';
import i18n from '@/lang';
import { FormInstance } from 'element-plus';
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { MsgSuccess } from '@/utils/message';
import { KeyTypes } from '@/global/mimetype';
import { getDNSName, getAccountName } from '@/utils/ssl';
import { defineAsyncComponent } from 'vue';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { rpc } from '@/lib/rpc';
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import permissionDirective from '@/directives/modules/permission';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElRadioGroup } from 'element-plus';
import { ElRadioButton } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElRow } from 'element-plus';
import { ElCol } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElTag } from 'element-plus';
import { ElRadio } from 'element-plus';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
    id?: number;
}

const emits = {
    close: (...args: unknown[]) => true,
    submit: (...args: unknown[]) => true,
};

const options = {
    name: 'create',
    props: {
        id: {
            type: Number,
            default: 0,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-ec4e8289',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isMaster, isXpackOrEE } = useGlobalStore();
        const PushToNode = defineAsyncComponent(async () => {
            const modules = import.meta.glob('@/xpack/views/ssl/index.vue');
            const loader = modules['/src/xpack/views/ssl/index.vue'];
            if (loader) {
                return ((await loader()) as any).default;
            }
            return { template: '<div></div>' };
        });
        const id = computed(() => {
            return __panelSetupProps.id;
        });
        const open = ref(false);
        const fileRef = ref();
        const loading = ref(false);
        const dnsReq = reactive({
            page: 1,
            pageSize: 20,
        });
        const acmeReq = reactive({
            page: 1,
            pageSize: 20,
        });
        const dnsAccounts = ref<Website.DnsAccount[]>();
        const acmeAccounts = ref<Website.AcmeAccount[]>();
        const sslForm = ref<FormInstance>();
        const websites = ref();
        const certificateType = ref('acme');
        const cas = ref<Website.CA[]>([]);
        const caLoading = ref(false);
        let caRequestVersion = 0;
        const rules = computed(() => ({
            caId: [Rules.requiredSelectBusiness],
            time: [Rules.requiredInput, Rules.integerNumber, checkNumberRange(1, 10000)],
            domains: [Rules.requiredInput],
            primaryDomain: [Rules.requiredInput, Rules.domainOrIP],
            acmeAccountId: [Rules.requiredSelectBusiness],
            dnsAccountId: [Rules.requiredSelectBusiness],
            provider: [Rules.requiredInput],
            autoRenew: [Rules.requiredInput],
            keyType: [Rules.requiredInput],
            dir: [Rules.requiredInput],
            nameserver1: [Rules.ipv4],
            nameserver2: [Rules.ipv4],
            shell: [Rules.requiredInput],
            description: [checkMaxLength(128)],
            pushNodes: [Rules.requiredSelect],
        }));
        const websiteID = ref();
        const initData = () => ({
            domains: '',
            caId: undefined as number | undefined,
            time: 10,
            unit: 'year',
            id: 0,
            primaryDomain: '',
            otherDomains: '',
            provider: 'dnsAccount',
            websiteId: 0,
            acmeAccountId: undefined,
            dnsAccountId: undefined,
            autoRenew: true,
            keyType: 'EC256',
            pushDir: false,
            dir: '',
            description: '',
            disableCNAME: false,
            skipDNS: false,
            nameserver1: '',
            nameserver2: '',
            execShell: false,
            shell: '',
            pushNode: false,
            pushNodes: [],
            nodes: '',
            isIP: false,
        });
        const ssl = ref(initData());
        const operate = ref('create');
        watch([() => ssl.value.acmeAccountId, acmeAccounts], () => {
            if (operate.value !== 'create' || ssl.value.provider === 'selfSigned') {
                return;
            }
            const account = acmeAccounts.value?.find((item) => item.id === ssl.value.acmeAccountId);
            if (account?.keyType) {
                ssl.value.keyType = account.keyType;
            }
        });
        const dnsResolve = ref<Website.DNSResolve[]>([]);
        const handleClose = () => {
            resetForm();
            open.value = false;
            ctx.emit('close', false);
        };
        const resetForm = () => {
            sslForm.value?.resetFields();
            dnsResolve.value = [];
            ssl.value = initData();
            websiteID.value = undefined;
            certificateType.value = 'acme';
            cas.value = [];
            caRequestVersion++;
            caLoading.value = false;
        };
        const changeIP = () => {
            if (ssl.value.isIP) {
                ssl.value.provider = 'http';
                for (const acmeAccount of acmeAccounts.value!) {
                    if (acmeAccount.type == 'letsencrypt') {
                        ssl.value.acmeAccountId = acmeAccount.id;
                        break;
                    }
                }
            } else {
                ssl.value.provider = 'dnsAccount';
            }
        };
        const acceptParams = (op: string, websiteSSL?: Website.SSLDTO) => {
            operate.value = op;
            if (op == 'create') {
                resetForm();
            }
            if (op == 'edit' && websiteSSL) {
                ssl.value.acmeAccountId = websiteSSL.acmeAccountId;
                if (websiteSSL.dnsAccountId > 0) {
                    ssl.value.dnsAccountId = websiteSSL.dnsAccountId;
                }
                ssl.value.primaryDomain = websiteSSL.primaryDomain;
                ssl.value.pushDir = websiteSSL.pushDir;
                ssl.value.dir = websiteSSL.dir;
                ssl.value.otherDomains = websiteSSL.domains?.replace(/,/g, '\n');
                ssl.value.autoRenew = websiteSSL.autoRenew;
                ssl.value.description = websiteSSL.description;
                ssl.value.id = websiteSSL.id;
                ssl.value.provider = websiteSSL.provider;
                ssl.value.domains = [websiteSSL.primaryDomain, ...(websiteSSL.domains || '').split(',')]
                    .filter(Boolean)
                    .join('\n');
                ssl.value.skipDNS = websiteSSL.skipDNS;
                ssl.value.disableCNAME = websiteSSL.disableCNAME;
                ssl.value.nameserver1 = websiteSSL.nameserver1;
                ssl.value.nameserver2 = websiteSSL.nameserver2;
                ssl.value.keyType = websiteSSL.keyType;
                ssl.value.execShell = websiteSSL.execShell;
                ssl.value.shell = websiteSSL.shell;
                ssl.value.pushNode = websiteSSL.pushNode;
                if (websiteSSL.nodes != '') {
                    ssl.value.pushNodes = websiteSSL.nodes
                        .split(',')
                        .map((item) => item.trim())
                        .filter((item) => item !== '');
                }
                ssl.value.isIP = websiteSSL.isIP;
            }
            ssl.value.websiteId = Number(id.value);
            getAcmeAccounts();
            getDnsAccounts();
            getwebsites();
            open.value = true;
        };
        const changeCertificateType = async () => {
            ssl.value.provider = certificateType.value === 'selfSigned' ? 'selfSigned' : 'dnsAccount';
            ssl.value.isIP = false;
            await nextTick();
            sslForm.value?.clearValidate();
            if (certificateType.value !== 'selfSigned' || cas.value.length || caLoading.value) return;
            caLoading.value = true;
            const requestVersion = ++caRequestVersion;
            try {
                const items: Website.CA[] = [];
                let page = 1;
                while (true) {
                    const res = await rpc.ssl.searchCA({ page, pageSize: 100 });
                    if (requestVersion !== caRequestVersion) return;
                    const batch = (res.items || []) as any[];
                    items.push(...batch);
                    if (!batch.length || items.length >= Number(res.total)) break;
                    page++;
                }
                if (!open.value) return;
                cas.value = items;
                ssl.value.caId = items[0]?.id;
            } finally {
                if (requestVersion === caRequestVersion) caLoading.value = false;
            }
        };
        const getPath = (dirs: string[]) => {
            ssl.value.dir = dirs.join('\n');
        };
        const getAcmeAccounts = async () => {
            const res = await rpc.ssl.searchACMEAccounts(acmeReq);
            acmeAccounts.value = (res.items || []) as any;
            if (acmeAccounts.value.length > 0 && ssl.value.acmeAccountId == undefined) {
                ssl.value.acmeAccountId = (res.items || [])[0].id;
            }
        };
        const getDnsAccounts = async () => {
            const res = await rpc.ssl.searchDNSAccounts({ page: dnsReq.page, pageSize: dnsReq.pageSize });
            dnsAccounts.value = (res.items || []) as any;
            if (dnsAccounts.value.length > 0 && ssl.value.dnsAccountId == undefined) {
                ssl.value.dnsAccountId = res.items[0].id;
            }
        };
        const changeProvider = () => {
            dnsResolve.value = [];
        };
        const getwebsites = async () => {
            const res = await rpc.website.list({});
            websites.value = res.items as any;
        };
        const changeWebsite = () => {
            if (websiteID.value > 0) {
                const selectedWebsite = websites.value.find((website) => website.id == websiteID.value);

                if (selectedWebsite && selectedWebsite.domains && selectedWebsite.domains.length > 0) {
                    const primaryDomain = selectedWebsite.domains[0].domain;
                    const otherDomains = selectedWebsite.domains
                        .slice(1)
                        .map((domain) => domain.domain)
                        .join('\n');

                    ssl.value.primaryDomain = primaryDomain;
                    ssl.value.otherDomains = otherDomains;
                }
            }
        };
        const submit = async (formEl: FormInstance | undefined) => {
            if (!formEl || loading.value) return;
            await formEl.validate((valid) => {
                if (!valid || loading.value) {
                    return;
                }
                let nodes = '';
                if (ssl.value.pushNode) {
                    nodes = ssl.value.pushNodes.join(',');
                }
                loading.value = true;
                if (operate.value == 'create') {
                    ssl.value.nodes = nodes;
                    if (ssl.value.provider === 'selfSigned') {
                        rpc.ssl
                            .obtainCA({
                                id: ssl.value.caId!,
                                domains: ssl.value.domains
                                    .split('\n')
                                    .map((domain) => domain.trim())
                                    .filter(Boolean)
                                    .join('\n'),
                                keyType: ssl.value.keyType,
                                time: ssl.value.time,
                                unit: ssl.value.unit,
                                autoRenew: ssl.value.autoRenew,
                                description: ssl.value.description,
                                pushDir: ssl.value.pushDir,
                                dir: ssl.value.dir,
                                execShell: ssl.value.execShell,
                                shell: ssl.value.shell,
                            })
                            .then(() => {
                                handleClose();
                                MsgSuccess(i18n.global.t('commons.msg.createSuccess'));
                            })
                            .finally(() => {
                                loading.value = false;
                            });
                        return;
                    }
                    rpc.ssl
                        .create(ssl.value as any)
                        .then((res) => {
                            if (ssl.value.provider != 'dnsManual') {
                                ctx.emit('submit', res.id);
                            }
                            handleClose();
                            MsgSuccess(i18n.global.t('commons.msg.createSuccess'));
                        })
                        .finally(() => {
                            loading.value = false;
                        });
                }
                if (operate.value == 'edit') {
                    if (ssl.value.provider === 'selfSigned') {
                        const domains = ssl.value.domains
                            .split('\n')
                            .map((domain) => domain.trim())
                            .filter(Boolean);
                        ssl.value.primaryDomain = domains[0];
                        ssl.value.otherDomains = domains.slice(1).join('\n');
                    }
                    const sslUpdate = {
                        id: ssl.value.id,
                        primaryDomain: ssl.value.primaryDomain,
                        otherDomains: ssl.value.otherDomains,
                        acmeAccountId: ssl.value.acmeAccountId,
                        dnsAccountId: ssl.value.dnsAccountId,
                        autoRenew: ssl.value.autoRenew,
                        keyType: ssl.value.keyType,
                        pushDir: ssl.value.pushDir,
                        dir: ssl.value.dir,
                        description: ssl.value.description,
                        provider: ssl.value.provider,
                        disableCNAME: ssl.value.disableCNAME,
                        skipDNS: ssl.value.skipDNS,
                        nameserver1: ssl.value.nameserver1,
                        nameserver2: ssl.value.nameserver2,
                        execShell: ssl.value.execShell,
                        shell: ssl.value.shell,
                        pushNode: ssl.value.pushNode,
                        nodes: nodes,
                        isIP: ssl.value.isIP,
                    };
                    rpc.ssl
                        .update(sslUpdate as any)
                        .then(() => {
                            handleClose();
                            MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                        })
                        .finally(() => {
                            loading.value = false;
                        });
                }
            });
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <>
                <DrawerPro
                    modelValue={unref(open)}
                    onUpdate:modelValue={($v) => {
                        open.value = $v as any;
                    }}
                    header={$t('ssl.' + unref(operate))}
                    size="large"
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                    v-slots={{
                        footer: () => (
                            <>
                                <span class={'dialog-footer'}>
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
                                                submit(unref(sslForm));
                                            }}
                                            disabled={unref(loading)}
                                        >
                                            {$t('commons.button.confirm')}
                                        </ElButton>,
                                        [[permissionDirective, 'website_cert_manage']],
                                    )}
                                </span>
                            </>
                        ),
                    }}
                >
                    {withDirectives(
                        <ElForm
                            ref={sslForm}
                            label-position="top"
                            model={unref(ssl)}
                            label-width="100px"
                            rules={unref(rules)}
                            disabled={unref(loading)}
                        >
                            {unref(operate) === 'create' ? (
                                <ElFormItem label={$t('commons.table.type')}>
                                    <ElRadioGroup
                                        modelValue={unref(certificateType)}
                                        onUpdate:modelValue={($v) => {
                                            certificateType.value = $v as any;
                                        }}
                                        onChange={($event?: any) => {
                                            (changeCertificateType as any)($event);
                                        }}
                                    >
                                        <ElRadioButton value="acme">{'ACME'}</ElRadioButton>
                                        <ElRadioButton value="selfSigned">{$t('ssl.selfSigned')}</ElRadioButton>
                                    </ElRadioGroup>
                                </ElFormItem>
                            ) : null}
                            {unref(ssl).provider === 'selfSigned' && unref(operate) === 'create' ? (
                                <ElFormItem label={$t('ssl.ca')} prop="caId">
                                    <ElSelect
                                        modelValue={unref(ssl).caId}
                                        onUpdate:modelValue={($v) => {
                                            unref(ssl).caId = $v as any;
                                        }}
                                        filterable
                                        loading={unref(caLoading)}
                                    >
                                        {(unref(cas) || []).map((ca) => (
                                            <ElOption label={ca.name} value={ca.id} key={ca.id} />
                                        ))}
                                    </ElSelect>
                                </ElFormItem>
                            ) : null}
                            {unref(ssl).provider === 'selfSigned' ? (
                                <ElFormItem label={$t('website.domain')} prop="domains">
                                    <ElInput
                                        modelValue={unref(ssl).domains}
                                        onUpdate:modelValue={($v) => {
                                            unref(ssl).domains = $v as any;
                                        }}
                                        type="textarea"
                                        rows={4}
                                        placeholder={$t('ssl.domainHelper')}
                                    />
                                </ElFormItem>
                            ) : (
                                <ElRow gutter={20}>
                                    <ElCol span={12}>
                                        <ElFormItem label={$t('website.primaryDomain')} prop="primaryDomain">
                                            <ElInput
                                                modelValue={unref(ssl).primaryDomain}
                                                onUpdate:modelValue={($v) => {
                                                    unref(ssl).primaryDomain = typeof $v === 'string' ? $v.trim() : $v;
                                                }}
                                            />
                                        </ElFormItem>
                                    </ElCol>
                                    <ElCol span={12}>
                                        <ElFormItem label={$t('ssl.fromWebsite')}>
                                            <ElSelect
                                                modelValue={unref(websiteID)}
                                                onUpdate:modelValue={($v) => {
                                                    websiteID.value = $v as any;
                                                }}
                                                onChange={($event?: any) => {
                                                    (changeWebsite as any)($event);
                                                }}
                                            >
                                                {(unref(websites) || []).map((site, key) => (
                                                    <ElOption value={site.id} label={site.primaryDomain} key={key} />
                                                ))}
                                            </ElSelect>
                                        </ElFormItem>
                                    </ElCol>
                                </ElRow>
                            )}
                            {unref(ssl).provider !== 'selfSigned' ? (
                                <ElFormItem label={''} prop="isIP">
                                    <ElCheckbox
                                        modelValue={unref(ssl).isIP}
                                        onUpdate:modelValue={($v) => {
                                            unref(ssl).isIP = $v as any;
                                        }}
                                        label={$t('ssl.isIP')}
                                        onChange={($event?: any) => {
                                            (changeIP as any)($event);
                                        }}
                                    />
                                </ElFormItem>
                            ) : null}
                            {unref(ssl).provider !== 'selfSigned' && !unref(ssl).isIP ? (
                                <ElFormItem label={$t('website.otherDomains')} prop="otherDomains">
                                    <ElInput
                                        type="textarea"
                                        rows={3}
                                        modelValue={unref(ssl).otherDomains}
                                        onUpdate:modelValue={($v) => {
                                            unref(ssl).otherDomains = $v as any;
                                        }}
                                    />
                                </ElFormItem>
                            ) : null}
                            <ElFormItem label={$t('website.remark')} prop="description">
                                <ElInput
                                    modelValue={unref(ssl).description}
                                    onUpdate:modelValue={($v) => {
                                        unref(ssl).description = $v as any;
                                    }}
                                />
                            </ElFormItem>
                            {unref(ssl).provider != 'selfSigned' ? (
                                <ElFormItem label={$t('website.acmeAccount')} prop="acmeAccountId">
                                    <ElSelect
                                        modelValue={unref(ssl).acmeAccountId}
                                        onUpdate:modelValue={($v) => {
                                            unref(ssl).acmeAccountId = $v as any;
                                        }}
                                    >
                                        {(unref(acmeAccounts) || []).map((acme, index) => (
                                            <ElOption
                                                label={acme.email + ' [' + getAccountName(acme.type) + '] '}
                                                value={acme.id}
                                                disabled={unref(ssl).isIP && acme.type !== 'letsencrypt'}
                                                key={index}
                                            >
                                                <ElRow>
                                                    <ElCol span={20}>
                                                        <span class={'dns-name'}>{acme.email}</span>
                                                    </ElCol>
                                                    <ElCol span={4}>
                                                        <span>
                                                            <ElTag type="success">{getAccountName(acme.type)}</ElTag>
                                                        </span>
                                                    </ElCol>
                                                </ElRow>
                                            </ElOption>
                                        ))}
                                    </ElSelect>
                                </ElFormItem>
                            ) : null}
                            <ElFormItem label={$t('website.keyType')} prop="keyType">
                                <ElSelect
                                    modelValue={unref(ssl).keyType}
                                    onUpdate:modelValue={($v) => {
                                        unref(ssl).keyType = $v as any;
                                    }}
                                    disabled={unref(operate) == 'edit'}
                                >
                                    {(KeyTypes || []).map((keyType, index) => (
                                        <ElOption label={keyType.label} value={keyType.value} key={index} />
                                    ))}
                                </ElSelect>
                            </ElFormItem>
                            {unref(ssl).provider === 'selfSigned' && unref(operate) === 'create' ? (
                                <ElFormItem label={$t('ssl.days')} prop="time">
                                    <ElInput
                                        type="number"
                                        modelValue={unref(ssl).time}
                                        onUpdate:modelValue={($v) => {
                                            unref(ssl).time = $v === '' ? $v : Number($v);
                                        }}
                                        v-slots={{
                                            append: () => (
                                                <>
                                                    <ElSelect
                                                        modelValue={unref(ssl).unit}
                                                        onUpdate:modelValue={($v) => {
                                                            unref(ssl).unit = $v as any;
                                                        }}
                                                        style={'width: 100px'}
                                                    >
                                                        <ElOption label={$t('commons.units.day')} value="day" />
                                                        <ElOption label={$t('commons.units.year')} value="year" />
                                                    </ElSelect>
                                                </>
                                            ),
                                        }}
                                    />
                                </ElFormItem>
                            ) : null}
                            {unref(ssl).provider != 'selfSigned' ? (
                                <ElFormItem label={$t('website.provider')} prop="provider">
                                    <ElRadioGroup
                                        modelValue={unref(ssl).provider}
                                        onUpdate:modelValue={($v) => {
                                            unref(ssl).provider = $v as any;
                                        }}
                                        onChange={($event?: any) => {
                                            changeProvider();
                                        }}
                                    >
                                        <ElRadio value="dnsAccount" disabled={unref(ssl).isIP}>
                                            {$t('website.dnsAccount')}
                                        </ElRadio>
                                        <ElRadio value="dnsManual" disabled={unref(ssl).isIP}>
                                            {$t('website.dnsManual')}
                                        </ElRadio>
                                        <ElRadio value="http">{'HTTP'}</ElRadio>
                                    </ElRadioGroup>
                                    {unref(ssl).provider === 'dnsManual' ? (
                                        <span class={'input-help'}>{$t('ssl.dnsMauanlHelper')}</span>
                                    ) : null}
                                    {unref(ssl).provider === 'http' ? (
                                        <span class={'input-help ssl-http-helper'}>{$t('ssl.httpHelper')}</span>
                                    ) : null}
                                </ElFormItem>
                            ) : null}
                            {unref(ssl).provider === 'dnsAccount' ? (
                                <ElFormItem label={$t('website.dnsAccount')} prop="dnsAccountId">
                                    <ElSelect
                                        modelValue={unref(ssl).dnsAccountId}
                                        onUpdate:modelValue={($v) => {
                                            unref(ssl).dnsAccountId = $v as any;
                                        }}
                                    >
                                        {(unref(dnsAccounts) || []).map((dns, index) => (
                                            <ElOption
                                                label={dns.name + ' [' + getDNSName(dns.type) + '] '}
                                                value={dns.id}
                                                key={index}
                                            >
                                                <ElRow>
                                                    <ElCol span={20}>
                                                        <span class={'dns-name'}>{dns.name}</span>
                                                    </ElCol>
                                                    <ElCol span={4}>
                                                        <span>
                                                            <ElTag type="success">{getDNSName(dns.type)}</ElTag>
                                                        </span>
                                                    </ElCol>
                                                </ElRow>
                                            </ElOption>
                                        ))}
                                    </ElSelect>
                                </ElFormItem>
                            ) : null}
                            {unref(ssl).provider !== 'dnsManual' ? (
                                <ElFormItem label={''} prop="autoRenew">
                                    <ElCheckbox
                                        modelValue={unref(ssl).autoRenew}
                                        onUpdate:modelValue={($v) => {
                                            unref(ssl).autoRenew = $v as any;
                                        }}
                                        label={$t('ssl.autoRenew')}
                                    />
                                </ElFormItem>
                            ) : null}
                            {unref(ssl).provider != 'selfSigned' ? (
                                <div>
                                    <ElFormItem label={''} prop="disableCNAME">
                                        <ElCheckbox
                                            modelValue={unref(ssl).disableCNAME}
                                            onUpdate:modelValue={($v) => {
                                                unref(ssl).disableCNAME = $v as any;
                                            }}
                                            label={$t('ssl.disableCNAME')}
                                        />
                                        <span class={'input-help'}>{$t('ssl.disableCNAMEHelper')}</span>
                                    </ElFormItem>
                                    <ElFormItem label={''} prop="skipDNS">
                                        <ElCheckbox
                                            modelValue={unref(ssl).skipDNS}
                                            onUpdate:modelValue={($v) => {
                                                unref(ssl).skipDNS = $v as any;
                                            }}
                                            label={$t('ssl.skipDNSCheck')}
                                        />
                                        <span class={'input-help'}>{$t('ssl.skipDNSCheckHelper')}</span>
                                    </ElFormItem>
                                    <ElFormItem label={$t('ssl.nameserver') + '1'} prop="nameserver1">
                                        <ElInput
                                            modelValue={unref(ssl).nameserver1}
                                            onUpdate:modelValue={($v) => {
                                                unref(ssl).nameserver1 = typeof $v === 'string' ? $v.trim() : $v;
                                            }}
                                        />
                                        <span class={'input-help'}>{$t('ssl.nameserverHelper')}</span>
                                    </ElFormItem>
                                    <ElFormItem label={$t('ssl.nameserver') + '2'} prop="nameserver1">
                                        <ElInput
                                            modelValue={unref(ssl).nameserver2}
                                            onUpdate:modelValue={($v) => {
                                                unref(ssl).nameserver2 = typeof $v === 'string' ? $v.trim() : $v;
                                            }}
                                        />
                                        <span class={'input-help'}>{$t('ssl.nameserverHelper')}</span>
                                    </ElFormItem>
                                </div>
                            ) : null}
                            {unref(ssl).provider !== 'selfSigned' || unref(operate) === 'create' ? (
                                <div>
                                    <ElFormItem label={''} prop="pushDir">
                                        <ElCheckbox
                                            modelValue={unref(ssl).pushDir}
                                            onUpdate:modelValue={($v) => {
                                                unref(ssl).pushDir = $v as any;
                                            }}
                                            label={$t('ssl.pushDir')}
                                        />
                                    </ElFormItem>
                                    {unref(ssl).pushDir ? (
                                        <ElFormItem label={$t('ssl.dir')} prop="dir">
                                            <ElButton
                                                icon="Folder"
                                                onClick={($event?: any) => {
                                                    unref(fileRef).acceptParams({
                                                        path: unref(ssl).dir.split('\n')[0],
                                                        dir: true,
                                                        multiple: true,
                                                        selectedPaths: unref(ssl).dir.split('\n').filter(Boolean),
                                                    });
                                                }}
                                                class={'mb-2'}
                                            >
                                                {$t('ssl.dir')}
                                            </ElButton>
                                            <ElInput
                                                modelValue={unref(ssl).dir}
                                                onUpdate:modelValue={($v) => {
                                                    unref(ssl).dir = typeof $v === 'string' ? $v.trim() : $v;
                                                }}
                                                type="textarea"
                                                rows={3}
                                            />
                                            <span class={'input-help'}>{$t('ssl.pushDirHelper')}</span>
                                        </ElFormItem>
                                    ) : null}
                                    <ElFormItem label={''} prop="execShell">
                                        <ElCheckbox
                                            modelValue={unref(ssl).execShell}
                                            onUpdate:modelValue={($v) => {
                                                unref(ssl).execShell = $v as any;
                                            }}
                                            label={$t('ssl.execShell')}
                                        />
                                    </ElFormItem>
                                    {unref(ssl).execShell ? (
                                        <ElFormItem label={$t('ssl.shell')} prop="shell">
                                            <ElInput
                                                type="textarea"
                                                rows={4}
                                                modelValue={unref(ssl).shell}
                                                onUpdate:modelValue={($v) => {
                                                    unref(ssl).shell = $v as any;
                                                }}
                                            />
                                            <span class={'input-help'}>{$t('ssl.shellHelper')}</span>
                                        </ElFormItem>
                                    ) : null}
                                    {unref(isMaster) && unref(isXpackOrEE) ? (
                                        <PushToNode
                                            push-node={unref(ssl).pushNode}
                                            nodes={unref(ssl).pushNodes}
                                            type="ssl"
                                            onUpdate:push-node={($event?: any) => {
                                                unref(unref(ssl)).pushNode = $event;
                                            }}
                                            onUpdate:nodes={($event?: any) => {
                                                unref(unref(ssl)).pushNodes = $event;
                                            }}
                                        />
                                    ) : null}
                                </div>
                            ) : null}
                        </ElForm>,
                        [[vLoading, unref(loading)]],
                    )}
                </DrawerPro>
                <FileList
                    ref={fileRef}
                    onChoose={($event?: any) => {
                        (getPath as any)($event);
                    }}
                />
            </>
        );
    },
    options,
);
