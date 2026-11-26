import { $t } from '@/utils/i18n-t';
import type { Website } from '@/types/website';
import type { AppItem } from '@/gen/panel/agent/v1/app_pb';
import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf';
type Init<T extends DescMessage> = MessageInitShape<T>;
import { WebsiteSSLSchema } from '@/gen/panel/agent/v1/website_ssl_pb';
interface InstallParams {
    labelZh: string;
    labelEn: string;
    value: any;
    edit: boolean;
    key: string;
    rule: string;
    type: string;
    values?: any;
    showValue?: string;
    required?: boolean;
    multiple?: boolean;
    label: Locale;
    showPassword: boolean;
}
interface CommonModel {
    id: number;
    createdAt?: string;
    updatedAt?: string;
}
type SSL = Init<typeof WebsiteSSLSchema> & {
    privateKey?: string;
    pem?: string;
    otherDomains?: string;
    certURL?: string;
    issuerName?: string;
    acmeAccountId?: number;
    websites?: Website.Website[];
    dnsAccountId?: number;
    nameserver1?: string;
    nameserver2?: string;
    disableCNAME?: boolean;
    skipDNS?: boolean;
    execShell?: boolean;
    shell?: string;
    pushNode?: boolean;
    nodes?: string;
    privateKeyPath?: string;
    certPath?: string;
    isIP?: boolean;
};
type SSLDTO = SSL & { logPath: string };
interface TemplateOutput {
    id: number;
    createdAt?: string;
    updatedAt?: string;
    name: string;
    templateID: number;
    templateType: string;
    variableValues: string;
    outputPath: string;
}
interface ReqPage {
    page: number;
    pageSize: number;
}
interface ExtraHost {
    hostname: string;
    ip: string;
}
interface Volume {
    type: string;
    sourceDir: string;
    containerDir: string;
    mode: string;
}
interface Environment {
    key: string;
    value: string;
}
interface ExposedPort {
    hostPort: number;
    containerPort: number;
    hostIP: string;
    protocol: string;
}
interface Runtime extends CommonModel {
    name: string;
    appDetailID: number;
    image: string;
    workDir: string;
    dockerCompose: string;
    env: string;
    params: string;
    type: string;
    resource: string;
    version: string;
    status: string;
    codeDir: string;
    port: string;
    appID: number;
    remark: string;
}
interface RuntimeDTO extends Runtime {
    appParams: InstallParams[];
    appID: number;
    source?: string;
    path?: string;
    exposedPorts?: ExposedPort[];
    environments?: Environment[];
    volumes?: Volume[];
    extraHosts?: ExtraHost[];
    container: string;
}
interface RuntimeReq extends ReqPage {
    name?: string;
    status?: string;
    type?: string;
}
interface TemplateOutputDTO extends TemplateOutput {
    templateName: string;
}
import AppInstallForm from '@/views/app-store/detail/form/index';
import SSLAlert from '@/views/website/website/create/site-alert/index';
import DomainCreate from '@/views/website/website/domain-create/index';
import TaskLog from '@/components/log/task/index';
import Check from '../check/index';
import GroupSelect from '@/views/website/website/components/group/index';
import WebsiteSSL from '@/views/website/website/components/website-ssl/index';
import LoadBalanceForm from '@/views/website/website/config/basic/load-balance/form/index';
import { Rules, checkNumberRange } from '@/global/form-rules';
import i18n from '@/lang';
import { rpc } from '@/lib/rpc';
import { ElForm, FormInstance } from 'element-plus';
import { reactive, ref, watch } from 'vue';
import { MsgError, MsgSuccess } from '@/utils/message';
import { getRandomStr } from '@/utils/id';
import { getRuntimeLabel } from '@/utils/app-store';
import { dateFormatSimple } from '@/utils/date';
import { v4 as uuidv4 } from 'uuid';
import { getAccountName } from '@/utils/ssl';
import { getWebsiteTypes } from '@/global/mimetype';
import { compareVersion } from '@/utils/version';
import type { InstalledApp } from '@/gen/panel/agent/v1/app_pb';
type SSLItem = SSLDTO & {
    organization?: string;
    acmeAccount?: {
        email?: string;
    };
};
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElRadioGroup } from 'element-plus';
import { ElRadioButton } from 'element-plus';
import { ElRadio } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElRow } from 'element-plus';
import { ElCol } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElText } from 'element-plus';
import { ElDivider } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElTag } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElCard } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';
import Status from '@/components/status/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'CreateWebSite',
    props: {},
    emits: emits,
    __scopeId: 'data-v-87c15c65',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const websiteForm = ref<FormInstance>();
        const initData = () => ({
            primaryDomain: '',
            type: 'deployment',
            alias: '',
            remark: '',
            appType: 'installed',
            appInstallId: undefined,
            webSiteGroupId: 0,
            otherDomains: '',
            proxy: '',
            runtimeID: undefined,
            appinstall: {
                appId: 0,
                name: '',
                appDetailId: 0,
                params: {},
                version: '',
                appkey: '',

                advanced: false,
                cpuQuota: 0,
                memoryLimit: 0,
                memoryUnit: 'MB',
                containerName: '',
                allowPort: false,

                format: 'utf8mb4',
                collation: '',
            },
            IPV6: false,
            enableFtp: false,
            ftpUser: '',
            ftpPassword: '',
            proxyType: 'tcp',
            port: 9000,
            proxyProtocol: 'http://',
            proxyAddress: '',
            runtimeType: 'php',
            taskID: '',
            createDb: false,
            dbName: '',
            dbPassword: '',
            dbFormat: 'utf8mb4',
            dbUser: '',
            dbType: 'mysql',
            dbHost: '',
            enableSSL: false,
            websiteSSLID: undefined,
            acmeAccountID: undefined,
            domains: [],
            parentWebsiteID: undefined,
            siteDir: '',
            templateOutputID: undefined,

            streamPorts: '',
            udp: false,
            name: '',
            algorithm: '',
            servers: [],
        });
        const website = ref(initData());
        const rules = ref<any>({
            alias: [Rules.alias],
            type: [Rules.requiredInput],
            webSiteGroupId: [Rules.requiredSelectBusiness],
            appInstallId: [Rules.requiredSelectBusiness],
            appType: [Rules.requiredInput],
            proxyAddress: [Rules.requiredInput],
            runtimeID: [Rules.requiredSelectBusiness],
            appinstall: {
                name: [Rules.appName],
                appId: [Rules.requiredSelectBusiness],
                params: {},
                cpuQuota: [Rules.requiredInput, checkNumberRange(0, 99999)],
                memoryLimit: [Rules.requiredInput, checkNumberRange(0, 9999999999)],
                containerName: [Rules.containerName],
            },
            ftpUser: [Rules.simpleName],
            ftpPassword: [Rules.simplePassword],
            proxyType: [Rules.requiredSelect],
            port: [Rules.port],
            runtimeType: [Rules.requiredInput],
            dbName: [Rules.requiredInput, Rules.dbName],
            dbUser: [Rules.requiredInput, Rules.name],
            dbPassword: [Rules.requiredInput, Rules.paramComplexity],
            dbHost: [Rules.requiredSelect],
            websiteSSLID: [Rules.requiredSelect],
            parentWebsiteID: [Rules.requiredSelect],
            siteDir: [Rules.requiredSelect],
            streamPorts: [Rules.requiredInput],
        });
        const open = ref(false);
        const loading = ref(false);
        const acmeAccounts = ref();
        const appInstalls = ref<InstalledApp[]>([]);
        const appReq = reactive({
            type: 'website',
            page: 1,
            pageSize: 100,
        });
        const apps = ref<AppItem[]>([]);
        const preCheckRef = ref();
        const staticPath = ref('');
        const templateOutputs = ref<TemplateOutputDTO[]>([]);
        const runtimeResource = ref('appstore');
        const initRuntimeReq = () => ({
            page: 1,
            pageSize: 100,
            status: 'Running',
            type: 'php',
        });
        const runtimeReq = ref<RuntimeReq>(initRuntimeReq());
        const runtimes = ref<RuntimeDTO[]>([]);
        const versionExist = ref(true);
        const taskLog = ref();
        const dbServices = ref();
        const ssls = ref<SSLItem[]>([]);
        const websiteSSL = ref<SSLItem | undefined>(undefined);
        const userSelectedSSL = ref(false);
        const parentWebsites = ref();
        const dirs = ref([]);
        const runtimePorts = ref([]);
        const WebsiteTypes = getWebsiteTypes();
        const installFormRef = ref();
        const lbFormRef = ref();
        const versionNotMatch = ref();
        const initLbForm = () => ({
            name: '',
            type: 'stream',
            algorithm: 'default',
            servers: [
                {
                    server: '',
                    weight: undefined,
                    maxFails: undefined,
                    maxConns: undefined,
                    failTimeout: undefined,
                    failTimeoutUnit: 's',
                    flag: '',
                },
            ],
        });
        const steamConfig = ref(initLbForm());
        const handleClose = () => {
            open.value = false;
            ctx.emit('close', false);
        };
        const random = async () => {
            website.value.ftpPassword = getRandomStr(16);
        };
        const randomDbPassword = async () => {
            website.value.dbPassword = getRandomStr(16);
        };
        const changeType = (type: string) => {
            localStorage.setItem('website-type', type);
            switch (type) {
                case 'deployment':
                    website.value.appType = 'installed';
                    searchAppInstalled('website');
                    break;
                case 'runtime':
                    getRuntimes();
                    getAppByService(website.value.dbType);
                    break;
                case 'proxy':
                    website.value.proxyAddress = '';
                    searchAppInstalled('proxy');
                    break;
                case 'subsite':
                    rpc.website.list({});
                    break;
                default:
                    website.value.appInstallId = undefined;
                    break;
            }
            website.value.type = type;
            versionExist.value = true;
        };
        const searchAppInstalled = (appType: string) => {
            rpc.app.searchInstalled({ type: appType, unused: true, all: true, page: 1, pageSize: 100 }).then((res) => {
                appInstalls.value = res.items;
                website.value.appInstallId = undefined;
                if (appType == 'website' && res.items && res.items.length > 0 && res.items[0].status === 'Running') {
                    website.value.appInstallId = res.items[0].id;
                }
            });
        };
        const getAppByService = async (key: string) => {
            const res = await rpc.app.getAppServices({ key });
            dbServices.value = res.items.map((s) => ({ ...s, config: JSON.parse(s.configJson || '{}') }));
        };
        const getProxyTargetFromApp = (app: Pick<InstalledApp, 'httpPort' | 'httpsPort'>) => {
            if ((app.httpPort ?? 0) > 0) {
                return {
                    protocol: 'http://',
                    address: `127.0.0.1:${app.httpPort}`,
                };
            }
            if ((app.httpsPort ?? 0) > 0) {
                return {
                    protocol: 'https://',
                    address: `127.0.0.1:${app.httpsPort}`,
                };
            }
            return {
                protocol: 'http://',
                address: '',
            };
        };
        const isRestrictedDeploymentApp = (appKey?: string) => {
            return appKey === 'openclaw' || appKey === 'copaw' || appKey === 'hermes-agent';
        };
        const changeInstall = () => {
            appInstalls.value.forEach((app) => {
                if (app.id === website.value.appInstallId) {
                    const target = getProxyTargetFromApp(app);
                    website.value.proxyProtocol = target.protocol;
                    website.value.proxyAddress = target.address;
                }
            });
        };
        const searchAppList = () => {
            rpc.app.searchApps(appReq).then((res) => {
                apps.value = res.items;

                const selectableApp = res.items.find((item) => !isRestrictedDeploymentApp(item.key));
                if (selectableApp) {
                    website.value.appinstall.appId = selectableApp.id;
                    website.value.appinstall.appkey = selectableApp.key;
                    changeApp();
                }
            });
        };
        const changeApp = () => {
            apps.value.forEach((app) => {
                if (app.id === website.value.appinstall.appId) {
                    website.value.appinstall.appkey = app.key;
                    installFormRef.value.initForm(app.key);
                }
            });
        };
        const changeRuntimeType = () => {
            runtimeReq.value.type = website.value.runtimeType;
            website.value.appinstall.advanced = false;
            website.value.runtimeID = undefined;
            getRuntimes();
        };
        const changeRuntime = (runID: number) => {
            website.value.port = 0;
            runtimes.value.forEach((item) => {
                if (item.id === runID) {
                    runtimeResource.value = item.resource;
                    if (runtimeResource.value == 'local') {
                        website.value.port = 9000;
                    } else {
                        runtimePorts.value = item.port.split(',').map((port: string) => parseInt(port.trim(), 10));
                        if (runtimePorts.value.length > 0) {
                            website.value.port = runtimePorts.value[0];
                        }
                    }
                }
            });
        };
        const getRuntimes = async () => {
            website.value.port = 0;
            try {
                // 运行时能力已剔除，不再请求 runtime 列表。
                runtimes.value = [];
                if (runtimes.value.length > 0) {
                    const first = runtimes.value[0];
                    website.value.runtimeID = first.id;
                    runtimeResource.value = first.resource;
                    if (first.port != '') {
                        runtimePorts.value = first.port.split(',').map((port: string) => parseInt(port.trim(), 10));
                        if (runtimePorts.value.length > 0) {
                            website.value.port = runtimePorts.value[0];
                        }
                    }
                }
            } catch (error) {}
        };
        const acceptParams = async (openrestyVersion: string) => {
            versionNotMatch.value = false;
            if (!compareVersion(openrestyVersion, '1.27.1.2-3-3-focal')) {
                versionNotMatch.value = true;
            }
            website.value = initData();
            if (websiteForm.value) {
                websiteForm.value.resetFields();
            }
            const websiteType = localStorage.getItem('website-type') || 'deployment';
            website.value.type = websiteType;
            const dirRes = await rpc.agentSetting.getWebsiteDir({});
            staticPath.value = dirRes.path + '/sites/';
            changeType(websiteType);

            runtimeResource.value = 'appstore';
            runtimeReq.value = initRuntimeReq();
            listAcmeAccount();
            listTemplateOutputs();

            steamConfig.value = initLbForm();

            open.value = true;
        };
        const changeAppType = (type: string) => {
            if (type === 'installed') {
                searchAppInstalled('website');
            } else {
                searchAppList();
            }
        };
        const openTaskLog = (taskID: string) => {
            taskLog.value.acceptParams(taskID);
        };
        const listAcmeAccount = () => {
            rpc.ssl.searchACMEAccounts({ page: 1, pageSize: 100 }).then((res) => {
                acmeAccounts.value = (res.items || []) as any;
            });
        };
        const listTemplateOutputs = () => {
            templateOutputs.value = [];
        };
        const changeSSl = (sslid?: number) => {
            if (!sslid) {
                websiteSSL.value = undefined;
                return;
            }
            const selected = ssls.value.find((element) => element.id === sslid);
            websiteSSL.value = selected;
        };
        const applySSLSelection = (sslId: number | undefined, markManual = false) => {
            if (markManual) {
                userSelectedSSL.value = true;
            }
            if (!sslId) {
                website.value.websiteSSLID = undefined;
                websiteSSL.value = undefined;
                return;
            }
            website.value.websiteSSLID = sslId;
            changeSSl(sslId);
        };
        const selectFirstAvailableSSL = () => {
            const fallback = ssls.value.find((item) => item.pem !== '');
            if (fallback) {
                applySSLSelection(fallback.id);
            }
        };
        const normalizeDomain = (domain?: string) => {
            if (!domain) {
                return '';
            }
            return domain.split(':')[0].trim().toLowerCase();
        };
        const wildcardMatches = (pattern: string, target: string) => {
            if (!pattern.startsWith('*.')) {
                return false;
            }
            const suffix = pattern.slice(1);
            if (!suffix) {
                return false;
            }
            if (!target.endsWith(suffix)) {
                return false;
            }
            const suffixLabels = suffix.slice(1).split('.');
            const targetLabels = target.split('.');
            return targetLabels.length > suffixLabels.length;
        };
        const domainMatches = (pattern: string, target: string) => {
            if (!pattern || !target) {
                return false;
            }
            if (pattern === target) {
                return true;
            }
            return wildcardMatches(pattern, target);
        };
        const getWebsiteDomains = (): string[] => {
            const domains = new Set<string>();
            const pushDomain = (value?: string) => {
                const normalized = normalizeDomain(value);
                if (normalized) {
                    domains.add(normalized);
                }
            };
            pushDomain(website.value.primaryDomain);
            if (Array.isArray(website.value.domains)) {
                website.value.domains.forEach((item: any) => {
                    pushDomain(item?.domain);
                });
            }
            return Array.from(domains);
        };
        const getCertificateDomains = (ssl: SSLItem): string[] => {
            const domains = new Set<string>();
            const tokens: string[] = [];
            if (ssl.primaryDomain) {
                tokens.push(ssl.primaryDomain);
            }
            if (ssl.domains) {
                ssl.domains
                    .replace(/\n/g, ',')
                    .split(',')
                    .map((item) => item.trim())
                    .filter((item) => item !== '')
                    .forEach((item) => tokens.push(item));
            }
            tokens.forEach((token) => {
                const normalized = normalizeDomain(token);
                if (normalized) {
                    domains.add(normalized);
                }
            });
            return Array.from(domains);
        };
        const tryAutoSelectSSL = (): boolean => {
            if (!website.value.enableSSL) {
                return false;
            }
            if (userSelectedSSL.value) {
                return false;
            }
            if (!ssls.value.length) {
                return false;
            }

            const siteDomains = getWebsiteDomains();
            if (!siteDomains.length) {
                return false;
            }

            const candidates = ssls.value
                .filter((ssl) => ssl.pem !== '')
                .map((ssl) => {
                    const certDomains = getCertificateDomains(ssl);
                    if (!certDomains.length) {
                        return { ssl, ratio: 0, matchCount: 0 };
                    }
                    const matchCount = certDomains.reduce((count, domain) => {
                        return count + (siteDomains.some((candidate) => domainMatches(domain, candidate)) ? 1 : 0);
                    }, 0);
                    const ratio = certDomains.length > 0 ? matchCount / certDomains.length : 0;
                    return { ssl, ratio, matchCount };
                })
                .filter((item) => item.matchCount > 0 && item.ratio > 0);

            if (!candidates.length) {
                return false;
            }

            candidates.sort((a, b) => {
                if (b.ratio !== a.ratio) {
                    return b.ratio - a.ratio;
                }
                if (b.matchCount !== a.matchCount) {
                    return b.matchCount - a.matchCount;
                }
                return b.ssl.id - a.ssl.id;
            });

            const best = candidates[0];
            if (!best) {
                return false;
            }
            if (website.value.websiteSSLID !== best.ssl.id) {
                applySSLSelection(best.ssl.id);
            } else {
                changeSSl(best.ssl.id);
            }
            return true;
        };
        const handleSSLSelectChange = (sslId: number | undefined) => {
            applySSLSelection(sslId, true);
        };
        const listSSLs = () => {
            rpc.ssl
                .list({
                    acmeAccountId: String(website.value.acmeAccountID),
                })
                .then((res) => {
                    ssls.value = (res.items || []) as any;
                    website.value.websiteSSLID = undefined;
                    websiteSSL.value = undefined;
                    userSelectedSSL.value = false;
                    const autoSelected = tryAutoSelectSSL();
                    if (!autoSelected) {
                        selectFirstAvailableSSL();
                    }
                });
        };
        const submit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            await formEl.validate(async (valid) => {
                if (!valid) {
                    return;
                }
                if (website.value.type == 'deployment' && website.value.appType === 'new') {
                    const isValid = await installFormRef.value?.validate();
                    if (!isValid) return;
                }
                if (
                    website.value.type === 'runtime' &&
                    website.value.runtimeType !== 'php' &&
                    website.value.port == 0
                ) {
                    MsgError(i18n.global.t('website.runtimePortWarn'));
                    return;
                }
                if (website.value.type == 'stream') {
                    const isValid = await lbFormRef.value?.validate();
                    if (!isValid) return;
                }
                loading.value = true;
                try {
                    const res = await rpc.website.check({});
                    if (res.items.length > 0) {
                        preCheckRef.value.acceptParams({ items: res.items });
                    } else {
                        if (website.value.type === 'proxy') {
                            website.value.proxy = website.value.proxyProtocol + website.value.proxyAddress;
                        }
                        if (!website.value.enableFtp) {
                            website.value.ftpUser = '';
                            website.value.ftpPassword = '';
                        }
                        if (website.value.type == 'stream') {
                            website.value.name = steamConfig.value.name;
                            website.value.algorithm = steamConfig.value.algorithm;
                            website.value.servers = steamConfig.value.servers;
                        }
                        if (website.value.type !== 'static' || !website.value.templateOutputID) {
                            website.value.templateOutputID = undefined;
                        }
                        const taskID = uuidv4();
                        website.value.taskID = taskID;
                        const {
                            type,
                            alias,
                            remark,
                            proxy,
                            webSiteGroupID,
                            IPV6,
                            siteDir,
                            appType,
                            appID,
                            appInstallID,
                            parentWebsiteID,
                            domains,
                            streamPorts,
                            name,
                            algorithm,
                            udp,
                            ...rest
                        } = website.value as any;
                        await rpc.website.create({
                            type,
                            alias,
                            remark,
                            proxy,
                            websiteGroupId: webSiteGroupID ?? 0,
                            ipv6: !!IPV6,
                            siteDir,
                            taskId: taskID,
                            appType,
                            appId: appID ?? 0,
                            appInstallId: appInstallID ?? 0,
                            parentWebsiteId: parentWebsiteID ?? 0,
                            domains: (domains ?? []).map((item: any) => ({
                                domain: item.domain,
                                port: Number(item.port) || 0,
                                ssl: !!item.ssl,
                            })),
                            streamPorts,
                            name,
                            algorithm,
                            udp: !!udp,
                            optionsJson: JSON.stringify(rest),
                        });
                        MsgSuccess(i18n.global.t('commons.msg.createSuccess'));
                        handleClose();
                        openTaskLog(taskID);
                    }
                } catch (error) {
                } finally {
                    loading.value = false;
                }
            });
        };
        watch(
            () => website.value.domains,
            () => {
                if (website.value.domains.some((domain: any) => domain.ssl) && !website.value.enableSSL) {
                    website.value.enableSSL = true;
                }
                tryAutoSelectSSL();
            },
            { deep: true },
        );
        watch(
            () => website.value.primaryDomain,
            () => {
                tryAutoSelectSSL();
            },
        );
        watch(
            () => website.value.enableSSL,
            (enabled) => {
                if (!enabled) {
                    website.value.domains.forEach((domain: any) => {
                        domain.ssl = false;
                    });
                    applySSLSelection(undefined);
                    userSelectedSSL.value = false;
                    return;
                }
                tryAutoSelectSSL();
            },
        );
        watch(
            () => website.value.alias,
            (value) => {
                if (website.value.type === 'stream') {
                    steamConfig.value.name = value;
                }
            },
            { deep: true },
        );
        const handleFirstDomainBlur = (index: number) => {
            if (index !== 0) {
                return;
            }
            const firstDomain = website.value.domains?.[0]?.domain || '';
            fillAliasFromDomainIfEmpty(firstDomain);
        };
        const fillAliasFromDomainIfEmpty = (value: string) => {
            if (!value || website.value.alias.trim() !== '') {
                return;
            }
            const domain = value.split(':')[0].trim();
            if (!domain) {
                return;
            }
            website.value.alias = domain;
        };
        const listWebsites = async () => {
            try {
                const res = await rpc.website.options({ types: ['static', 'runtime'] });
                parentWebsites.value = res.items as any;
                if (res.items.length > 0) {
                    website.value.parentWebsiteID = res.items[0].id;
                    getDir(res.items[0].id);
                }
            } catch (error) {}
        };
        const getDir = async (websiteID: number) => {
            try {
                const res = await rpc.website.getSiteDir({ id: websiteID });
                dirs.value = res.dirs;
                if (res.dirs.length > 0) {
                    website.value.siteDir = res.dirs[0];
                }
            } catch (error) {}
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
                header={$t('commons.button.create')}
                size="60%"
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
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
                            <ElButton
                                type="primary"
                                onClick={($event?: any) => {
                                    submit(unref(websiteForm));
                                }}
                                disabled={unref(loading) || (unref(website).type == 'stream' && unref(versionNotMatch))}
                            >
                                {$t('commons.button.confirm')}
                            </ElButton>
                        </>
                    ),
                }}
            >
                {withDirectives(
                    <div class={{ mask: !unref(versionExist) }}>
                        {withDirectives(
                            <ElForm
                                ref={websiteForm}
                                label-position="top"
                                model={unref(website)}
                                label-width="125px"
                                rules={unref(rules)}
                                validate-on-rule-change={false}
                            >
                                <ElFormItem>
                                    <ElRadioGroup
                                        modelValue={unref(website).type}
                                        onUpdate:modelValue={($v) => {
                                            unref(website).type = $v as any;
                                        }}
                                        onChange={($event?: any) => {
                                            (changeType as any)($event);
                                        }}
                                    >
                                        {(WebsiteTypes || []).map((item) => (
                                            <ElRadioButton value={item.value} key={item.value}>
                                                {item.label}
                                            </ElRadioButton>
                                        ))}
                                    </ElRadioGroup>
                                </ElFormItem>
                                <SSLAlert
                                    websiteType={unref(website).type}
                                    versionNotMatch={unref(versionNotMatch)}
                                    class={'mb-2'}
                                />
                                <GroupSelect
                                    modelValue={unref(website).webSiteGroupId}
                                    onUpdate:modelValue={($v) => {
                                        unref(website).webSiteGroupId = $v as any;
                                    }}
                                    prop={'webSiteGroupId'}
                                    groupType={'website'}
                                />
                                {unref(website).type === 'deployment' ? (
                                    <div>
                                        <ElFormItem prop="appType">
                                            <ElRadioGroup
                                                modelValue={unref(website).appType}
                                                onUpdate:modelValue={($v) => {
                                                    unref(website).appType = $v as any;
                                                }}
                                                onChange={($event?: any) => {
                                                    changeAppType(unref(website).appType);
                                                }}
                                            >
                                                <ElRadio label={'installed'} value={'installed'}>
                                                    {$t('website.appInstalled')}
                                                </ElRadio>
                                                <ElRadio label={'new'} value={'new'}>
                                                    {$t('website.appNew')}
                                                </ElRadio>
                                            </ElRadioGroup>
                                        </ElFormItem>
                                        {unref(website).appType == 'installed' ? (
                                            <ElFormItem label={$t('website.appInstalled')} prop="appInstallId">
                                                <ElSelect
                                                    modelValue={unref(website).appInstallId}
                                                    onUpdate:modelValue={($v) => {
                                                        unref(website).appInstallId = $v as any;
                                                    }}
                                                    class={'p-w-300'}
                                                >
                                                    {(unref(appInstalls) || []).map((appInstall, index) => (
                                                        <ElOption
                                                            label={appInstall.name}
                                                            value={appInstall.id}
                                                            disabled={appInstall.status !== 'Running'}
                                                            key={index}
                                                        >
                                                            <div class={'flex justify-between items-center w-full'}>
                                                                <span>{appInstall.name}</span>
                                                                <span>
                                                                    <Status
                                                                        status={appInstall.status}
                                                                        key={appInstall.status}
                                                                    />
                                                                </span>
                                                            </div>
                                                        </ElOption>
                                                    ))}
                                                </ElSelect>
                                            </ElFormItem>
                                        ) : null}
                                        {unref(website).appType == 'new' ? (
                                            <div>
                                                <ElFormItem label={$t('app.app')} prop="appinstall.appId">
                                                    <ElSelect
                                                        modelValue={unref(website).appinstall.appId}
                                                        onUpdate:modelValue={($v) => {
                                                            unref(website).appinstall.appId = $v as any;
                                                        }}
                                                        onChange={($event?: any) => {
                                                            changeApp();
                                                        }}
                                                        filterable
                                                        class={'p-w-300'}
                                                    >
                                                        {(unref(apps) || []).map((app, index) => (
                                                            <ElOption
                                                                label={app.name}
                                                                value={app.id}
                                                                disabled={isRestrictedDeploymentApp(app.key)}
                                                                key={index}
                                                            />
                                                        ))}
                                                    </ElSelect>
                                                </ElFormItem>
                                                <AppInstallForm
                                                    ref={installFormRef}
                                                    modelValue={unref(website).appinstall}
                                                    onUpdate:modelValue={($v) => {
                                                        unref(website).appinstall = $v as any;
                                                    }}
                                                    loading={unref(loading)}
                                                />
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}
                                {unref(website).type === 'subsite' ? (
                                    <div>
                                        <ElFormItem label={$t('website.parentWbeiste')} prop="parentWebsiteID">
                                            <ElSelect
                                                modelValue={unref(website).parentWebsiteID}
                                                onUpdate:modelValue={($v) => {
                                                    unref(website).parentWebsiteID = $v as any;
                                                }}
                                                onChange={($event?: any) => {
                                                    getDir(unref(website).parentWebsiteID);
                                                }}
                                            >
                                                {(unref(parentWebsites) || []).map((site, index) => (
                                                    <ElOption label={site.primaryDomain} value={site.id} key={index} />
                                                ))}
                                            </ElSelect>
                                        </ElFormItem>
                                        <ElFormItem label={$t('website.runDir')} prop="siteDir">
                                            <ElSelect
                                                modelValue={unref(website).siteDir}
                                                onUpdate:modelValue={($v) => {
                                                    unref(website).siteDir = $v as any;
                                                }}
                                                filterable
                                                class={'p-w-200'}
                                            >
                                                {(unref(dirs) || []).map((item, index) => (
                                                    <ElOption label={item} value={item} key={index} />
                                                ))}
                                            </ElSelect>
                                        </ElFormItem>
                                    </div>
                                ) : null}
                                {unref(website).type === 'runtime' ? (
                                    <div>
                                        <ElRow gutter={20}>
                                            <ElCol span={8}>
                                                <ElFormItem label={$t('commons.table.type')} prop="runtimeType">
                                                    <ElSelect
                                                        modelValue={unref(website).runtimeType}
                                                        onUpdate:modelValue={($v) => {
                                                            unref(website).runtimeType = $v as any;
                                                        }}
                                                        onChange={($event?: any) => {
                                                            changeRuntimeType();
                                                        }}
                                                    >
                                                        <ElOption label="PHP" value="php" />
                                                        <ElOption label="Node.js" value="node" />
                                                        <ElOption label="Java" value="java" />
                                                        <ElOption label="Go" value="go" />
                                                        <ElOption label="Python" value="python" />
                                                        <ElOption label=".NET" value="dotnet" />
                                                    </ElSelect>
                                                </ElFormItem>
                                            </ElCol>
                                            <ElCol span={16}>
                                                <ElFormItem label={$t('runtime.runtime')} prop="runtimeID">
                                                    <ElSelect
                                                        modelValue={unref(website).runtimeID}
                                                        onUpdate:modelValue={($v) => {
                                                            unref(website).runtimeID = $v as any;
                                                        }}
                                                        onChange={($event?: any) => {
                                                            changeRuntime(unref(website).runtimeID);
                                                        }}
                                                        filterable
                                                    >
                                                        {(unref(runtimes) || []).map((run) => (
                                                            <ElOption
                                                                label={
                                                                    run.name +
                                                                    ' [' +
                                                                    getRuntimeLabel(run.resource) +
                                                                    ']'
                                                                }
                                                                value={run.id}
                                                                key={run.name}
                                                            >
                                                                <ElRow>
                                                                    <ElCol span={14}>
                                                                        <span class={'runtimeName'}>{run.name}</span>
                                                                    </ElCol>
                                                                    <ElCol span={10}>
                                                                        {' [' + getRuntimeLabel(run.resource) + ']'}
                                                                    </ElCol>
                                                                </ElRow>
                                                            </ElOption>
                                                        ))}
                                                    </ElSelect>
                                                </ElFormItem>
                                            </ElCol>
                                        </ElRow>
                                        {unref(website).runtimeType === 'php' && unref(runtimeResource) === 'local' ? (
                                            <div>
                                                <ElFormItem label={$t('website.proxyType')} prop="proxyType">
                                                    <ElSelect
                                                        modelValue={unref(website).proxyType}
                                                        onUpdate:modelValue={($v) => {
                                                            unref(website).proxyType = $v as any;
                                                        }}
                                                    >
                                                        <ElOption label={$t('website.tcp')} value={'tcp'} />
                                                        <ElOption label={$t('website.unix')} value={'unix'} />
                                                    </ElSelect>
                                                </ElFormItem>
                                                {unref(website).proxyType === 'tcp' ? (
                                                    <ElFormItem label={$t('commons.table.port')} prop="port">
                                                        <ElInput
                                                            modelValue={unref(website).port}
                                                            onUpdate:modelValue={($v) => {
                                                                unref(website).port = $v === '' ? $v : Number($v);
                                                            }}
                                                        />
                                                    </ElFormItem>
                                                ) : null}
                                            </div>
                                        ) : null}
                                        {unref(website).runtimeType !== 'php' && unref(runtimePorts).length > 1 ? (
                                            <ElFormItem label={$t('setting.proxyPort')} prop="port">
                                                <ElSelect
                                                    modelValue={unref(website).port}
                                                    onUpdate:modelValue={($v) => {
                                                        unref(website).port = $v as any;
                                                    }}
                                                >
                                                    {(unref(runtimePorts) || []).map((port, index) => (
                                                        <ElOption label={port} value={port} key={index} />
                                                    ))}
                                                </ElSelect>
                                                <span class={'input-help'}>{$t('website.runtimePortHelper')}</span>
                                            </ElFormItem>
                                        ) : null}
                                        {unref(runtimes).length > 0 &&
                                        unref(website).type === 'runtime' &&
                                        unref(website).runtimeType !== 'php' &&
                                        unref(website).port == 0 ? (
                                            <ElText type="danger">{$t('website.runtimePortWarn')}</ElText>
                                        ) : null}
                                    </div>
                                ) : null}
                                {unref(website).type !== 'stream' ? (
                                    <ElDivider content-position="left">
                                        <ElText type="info" size="small">
                                            {$t('website.domain')}
                                        </ElText>
                                    </ElDivider>
                                ) : null}
                                {unref(website).type === 'stream' ? (
                                    <div>
                                        <ElFormItem label={$t('website.streamPorts')} prop="streamPorts">
                                            <ElInput
                                                modelValue={unref(website).streamPorts}
                                                onUpdate:modelValue={($v) => {
                                                    unref(website).streamPorts = $v as any;
                                                }}
                                                placeholder={$t('website.streamPortsHelper')}
                                            />
                                        </ElFormItem>
                                        <ElFormItem prop="udp">
                                            <ElCheckbox
                                                modelValue={unref(website).udp}
                                                onUpdate:modelValue={($v) => {
                                                    unref(website).udp = $v as any;
                                                }}
                                                label={$t('website.udp')}
                                                size="large"
                                            />
                                        </ElFormItem>
                                    </div>
                                ) : (
                                    <div>
                                        <DomainCreate
                                            form={unref(website)}
                                            onUpdate:form={($v) => {
                                                website.value = $v as any;
                                            }}
                                            onGengerate={($event?: any) => {
                                                unref(websiteForm).clearValidate();
                                            }}
                                            onDomainBlur={($event?: any) => {
                                                (handleFirstDomainBlur as any)($event);
                                            }}
                                        />
                                    </div>
                                )}
                                <ElDivider content-position="left">
                                    <ElText type="info" size="small">
                                        {$t('website.advancedSettings')}
                                    </ElText>
                                </ElDivider>
                                <ElFormItem label={$t('website.alias')} prop="alias" class={'mt-2'}>
                                    <ElInput
                                        modelValue={unref(website).alias}
                                        onUpdate:modelValue={($v) => {
                                            unref(website).alias = typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                        placeholder={$t('website.aliasHelper')}
                                    />
                                    <div>
                                        <span class={'input-help'}>
                                            <span>
                                                {$t('website.staticPath') + unref(staticPath) + unref(website).alias}
                                            </span>
                                            {unref(website).type === 'static' && unref(website).alias != '' ? (
                                                <span>{'/index'}</span>
                                            ) : null}
                                        </span>
                                    </div>
                                </ElFormItem>
                                <ElFormItem prop="IPV6">
                                    <ElCheckbox
                                        modelValue={unref(website).IPV6}
                                        onUpdate:modelValue={($v) => {
                                            unref(website).IPV6 = $v as any;
                                        }}
                                        label={$t('website.ipv6')}
                                        size="large"
                                    />
                                </ElFormItem>
                                {unref(website).type == 'stream' ? (
                                    <div>
                                        <LoadBalanceForm
                                            ref={lbFormRef}
                                            modelValue={unref(steamConfig)}
                                            onUpdate:modelValue={($v) => {
                                                steamConfig.value = $v as any;
                                            }}
                                            disabled={true}
                                            type="stream"
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <ElFormItem prop="enableSSL">
                                            <ElCheckbox
                                                modelValue={unref(website).enableSSL}
                                                onUpdate:modelValue={($v) => {
                                                    unref(website).enableSSL = $v as any;
                                                }}
                                                label={$t('website.enableHTTPS')}
                                                size="large"
                                            />
                                            <span class={'input-help'}>{$t('website.enableSSLHelper')}</span>
                                        </ElFormItem>
                                        {unref(website).enableSSL ? (
                                            <div>
                                                <ElFormItem
                                                    label={$t('website.acmeAccountManage')}
                                                    prop="acmeAccountID"
                                                >
                                                    <ElSelect
                                                        modelValue={unref(website).acmeAccountID}
                                                        onUpdate:modelValue={($v) => {
                                                            unref(website).acmeAccountID = $v as any;
                                                        }}
                                                        placeholder={$t('website.selectAcme')}
                                                        onChange={($event?: any) => {
                                                            (listSSLs as any)($event);
                                                        }}
                                                    >
                                                        <ElOption label={$t('website.imported')} value={0} key={0} />
                                                        {(unref(acmeAccounts) || []).map((acme, index) => (
                                                            <ElOption label={acme.email} value={acme.id} key={index}>
                                                                <span>
                                                                    {acme.email}
                                                                    <ElTag class={'ml-5'}>
                                                                        {getAccountName(acme.type)}
                                                                    </ElTag>
                                                                </span>
                                                            </ElOption>
                                                        ))}
                                                    </ElSelect>
                                                </ElFormItem>
                                                <ElFormItem
                                                    label={$t('website.ssl')}
                                                    prop="websiteSSLID"
                                                    hide-required-asterisk={true}
                                                >
                                                    <ElSelect
                                                        modelValue={unref(website).websiteSSLID}
                                                        onUpdate:modelValue={($v) => {
                                                            unref(website).websiteSSLID = $v as any;
                                                        }}
                                                        placeholder={$t('website.selectSSL')}
                                                        onChange={($event?: any) => {
                                                            (handleSSLSelectChange as any)($event);
                                                        }}
                                                    >
                                                        {(unref(ssls) || []).map((ssl, index) => (
                                                            <ElOption
                                                                label={ssl.primaryDomain}
                                                                value={ssl.id}
                                                                disabled={ssl.pem == ''}
                                                                key={index}
                                                            >
                                                                <span>{ssl.primaryDomain}</span>
                                                                {ssl.expireDate ? (
                                                                    <ElTag class={'tagClass'}>
                                                                        {dateFormatSimple(ssl.expireDate)}
                                                                    </ElTag>
                                                                ) : null}
                                                                {ssl.organization ? (
                                                                    <ElTag class={'tagClass'}>{ssl.organization}</ElTag>
                                                                ) : null}
                                                            </ElOption>
                                                        ))}
                                                    </ElSelect>
                                                </ElFormItem>
                                                {unref(websiteSSL) && unref(websiteSSL).id > 0 ? (
                                                    <ElFormItem label={' '}>
                                                        <WebsiteSSL websiteSSL={unref(websiteSSL)} />
                                                    </ElFormItem>
                                                ) : null}
                                            </div>
                                        ) : null}
                                    </div>
                                )}
                                {unref(website).type === 'static' ? (
                                    <ElFormItem label={$t('template.importButton')} prop="templateOutputID">
                                        <ElSelect
                                            modelValue={unref(website).templateOutputID}
                                            onUpdate:modelValue={($v) => {
                                                unref(website).templateOutputID = $v as any;
                                            }}
                                            clearable
                                            class={'p-w-200'}
                                        >
                                            {(unref(templateOutputs) || []).map((output) => (
                                                <ElOption
                                                    label={output.name + ' (' + output.templateName + ')'}
                                                    value={output.id}
                                                    key={output.id}
                                                />
                                            ))}
                                        </ElSelect>
                                    </ElFormItem>
                                ) : null}
                                {unref(website).type === 'static' || unref(website).type === 'runtime' ? (
                                    <ElFormItem prop="enableFtp">
                                        <ElCheckbox
                                            onChange={($event?: any) => {
                                                (random as any)($event);
                                            }}
                                            modelValue={unref(website).enableFtp}
                                            onUpdate:modelValue={($v) => {
                                                unref(website).enableFtp = $v as any;
                                            }}
                                            label={$t('commons.button.create') + ' FTP'}
                                            size="large"
                                        />
                                        <span class={'input-help'}>{$t('website.ftpHelper')}</span>
                                    </ElFormItem>
                                ) : null}
                                {unref(website).enableFtp ? (
                                    <ElRow gutter={20}>
                                        <ElCol span={12}>
                                            <ElFormItem prop="ftpUser" label={$t('website.ftpUser')}>
                                                <ElInput
                                                    modelValue={unref(website).ftpUser}
                                                    onUpdate:modelValue={($v) => {
                                                        unref(website).ftpUser = $v as any;
                                                    }}
                                                />
                                            </ElFormItem>
                                        </ElCol>
                                        <ElCol span={12}>
                                            <ElFormItem prop="ftpPassword" label={$t('website.ftpPassword')}>
                                                <ElInput
                                                    type="password"
                                                    clearable
                                                    modelValue={unref(website).ftpPassword}
                                                    onUpdate:modelValue={($v) => {
                                                        unref(website).ftpPassword = $v as any;
                                                    }}
                                                    show-password
                                                    v-slots={{
                                                        append: () => (
                                                            <>
                                                                <ElButton
                                                                    onClick={($event?: any) => {
                                                                        (random as any)($event);
                                                                    }}
                                                                >
                                                                    {$t('commons.button.random')}
                                                                </ElButton>
                                                            </>
                                                        ),
                                                    }}
                                                />
                                            </ElFormItem>
                                        </ElCol>
                                    </ElRow>
                                ) : null}
                                {unref(website).type === 'proxy' ? (
                                    <ElRow gutter={20}>
                                        <ElCol span={12}>
                                            <ElFormItem label={$t('website.proxyAddress')} prop="proxyAddress">
                                                <ElInput
                                                    modelValue={unref(website).proxyAddress}
                                                    onUpdate:modelValue={($v) => {
                                                        unref(website).proxyAddress = $v as any;
                                                    }}
                                                    placeholder={$t('website.proxyHelper')}
                                                    v-slots={{
                                                        prepend: () => (
                                                            <>
                                                                <ElSelect
                                                                    modelValue={unref(website).proxyProtocol}
                                                                    onUpdate:modelValue={($v) => {
                                                                        unref(website).proxyProtocol = $v as any;
                                                                    }}
                                                                    class={'pre-select'}
                                                                >
                                                                    <ElOption label="http" value="http://" />
                                                                    <ElOption label="https" value="https://" />
                                                                    <ElOption label={$t('website.other')} value />
                                                                </ElSelect>
                                                            </>
                                                        ),
                                                    }}
                                                />
                                            </ElFormItem>
                                        </ElCol>
                                        <ElCol span={12}>
                                            <ElFormItem label={$t('app.app')}>
                                                <ElSelect
                                                    modelValue={unref(website).appInstallId}
                                                    onUpdate:modelValue={($v) => {
                                                        unref(website).appInstallId = $v as any;
                                                    }}
                                                    filterable
                                                    onChange={($event?: any) => {
                                                        (changeInstall as any)($event);
                                                    }}
                                                    class={'p-w-200'}
                                                >
                                                    {(unref(appInstalls) || []).map((appInstall, index) => (
                                                        <ElOption
                                                            label={appInstall.name}
                                                            value={appInstall.id}
                                                            key={index}
                                                        />
                                                    ))}
                                                </ElSelect>
                                            </ElFormItem>
                                        </ElCol>
                                    </ElRow>
                                ) : null}
                                {unref(website).type === 'runtime' ? (
                                    <ElFormItem prop="createDb">
                                        <ElCheckbox
                                            onChange={($event?: any) => {
                                                (randomDbPassword as any)($event);
                                            }}
                                            modelValue={unref(website).createDb}
                                            onUpdate:modelValue={($v) => {
                                                unref(website).createDb = $v as any;
                                            }}
                                            label={$t('website.createDb')}
                                            size="large"
                                        />
                                    </ElFormItem>
                                ) : null}
                                {unref(website).type === 'runtime' && unref(website).createDb ? (
                                    <ElRow gutter={20}>
                                        <ElCol span={24}>
                                            <ElFormItem label={$t('menu.database')} prop="dbHost">
                                                <ElRow gutter={20}>
                                                    <ElCol span={12}>
                                                        <ElSelect
                                                            modelValue={unref(website).dbType}
                                                            onUpdate:modelValue={($v) => {
                                                                unref(website).dbType = $v as any;
                                                            }}
                                                            onChange={($event?: any) => {
                                                                getAppByService(unref(website).dbType);
                                                            }}
                                                            class={'p-w-200'}
                                                        >
                                                            <ElOption label="MySQL" value="mysql" />
                                                            <ElOption label="MariaDB" value="mariadb" />
                                                            <ElOption label="PostgreSQL" value="postgresql" />
                                                        </ElSelect>
                                                    </ElCol>
                                                    <ElCol span={12}>
                                                        <ElSelect
                                                            modelValue={unref(website).dbHost}
                                                            onUpdate:modelValue={($v) => {
                                                                unref(website).dbHost = $v as any;
                                                            }}
                                                            class={'p-w-200'}
                                                        >
                                                            {(unref(dbServices) || []).map((service, index) => (
                                                                <ElOption
                                                                    label={service.label}
                                                                    value={service.value}
                                                                    key={index}
                                                                />
                                                            ))}
                                                        </ElSelect>
                                                    </ElCol>
                                                </ElRow>
                                            </ElFormItem>
                                        </ElCol>
                                        <ElCol span={24}>
                                            <ElFormItem label={$t('commons.table.name')} prop="dbName">
                                                <ElInput
                                                    clearable
                                                    modelValue={unref(website).dbName}
                                                    onUpdate:modelValue={($v) => {
                                                        unref(website).dbName = typeof $v === 'string' ? $v.trim() : $v;
                                                    }}
                                                    onInput={($event?: any) => {
                                                        unref(unref(website)).dbUser = unref(website).dbName;
                                                    }}
                                                    v-slots={{
                                                        append: () => (
                                                            <>
                                                                <ElSelect
                                                                    modelValue={unref(website).dbFormat}
                                                                    onUpdate:modelValue={($v) => {
                                                                        unref(website).dbFormat = $v as any;
                                                                    }}
                                                                    class={'p-w-100'}
                                                                >
                                                                    <ElOption label="utf8mb4" value="utf8mb4" />
                                                                    <ElOption label="utf-8" value="utf8" />
                                                                    <ElOption label="gbk" value="gbk" />
                                                                    <ElOption label="big5" value="big5" />
                                                                </ElSelect>
                                                            </>
                                                        ),
                                                    }}
                                                />
                                            </ElFormItem>
                                        </ElCol>
                                        <ElCol span={12}>
                                            <ElFormItem label={$t('commons.login.username')} prop="dbUser">
                                                <ElInput
                                                    clearable
                                                    modelValue={unref(website).dbUser}
                                                    onUpdate:modelValue={($v) => {
                                                        unref(website).dbUser = typeof $v === 'string' ? $v.trim() : $v;
                                                    }}
                                                />
                                            </ElFormItem>
                                        </ElCol>
                                        <ElCol span={12}>
                                            <ElFormItem label={$t('commons.login.password')} prop="dbPassword">
                                                <ElInput
                                                    type="dbPassword"
                                                    clearable
                                                    show-password
                                                    modelValue={unref(website).dbPassword}
                                                    onUpdate:modelValue={($v) => {
                                                        unref(website).dbPassword =
                                                            typeof $v === 'string' ? $v.trim() : $v;
                                                    }}
                                                    v-slots={{
                                                        append: () => (
                                                            <>
                                                                <ElButton
                                                                    onClick={($event?: any) => {
                                                                        (randomDbPassword as any)($event);
                                                                    }}
                                                                >
                                                                    {$t('commons.button.random')}
                                                                </ElButton>
                                                            </>
                                                        ),
                                                    }}
                                                />
                                            </ElFormItem>
                                        </ElCol>
                                    </ElRow>
                                ) : null}
                                <ElDivider content-position="left">
                                    <ElText type="info" size="small">
                                        {$t('commons.table.description')}
                                    </ElText>
                                </ElDivider>
                                <ElFormItem label={$t('website.remark')} prop="remark">
                                    <ElInput
                                        type="textarea"
                                        rows={3}
                                        clearable
                                        modelValue={unref(website).remark}
                                        onUpdate:modelValue={($v) => {
                                            unref(website).remark = $v as any;
                                        }}
                                    />
                                </ElFormItem>
                            </ElForm>,
                            [[vLoading, unref(loading)]],
                        )}
                    </div>,
                    [[vLoading, unref(loading)]],
                )}
                <Check ref={preCheckRef} />
                {!unref(versionExist) ? (
                    <ElCard width="30%" class={'mask-prompt'}>
                        <span>{$t('runtime.openrestyWarn')}</span>
                    </ElCard>
                ) : null}
                <TaskLog ref={taskLog} />
            </DrawerPro>
        );
    },
    options,
);
