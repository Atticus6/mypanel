import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf';
import {
    AntiLeechConfigSchema,
    AuthConfigSchema,
    AuthItemSchema,
    BatchSetHttpsRequestSchema,
    BatchWebsiteGroupRequestSchema,
    BatchWebsiteOperateRequestSchema,
    ChangeDefaultWebsiteRequestSchema,
    ChangeWebsiteDatabaseRequestSchema,
    ChangeWebsitePHPVersionRequestSchema,
    CheckWebsiteRequestSchema,
    CorsConfigSchema,
    CreateDNSAccountRequestSchema,
    CreateDomainsRequestSchema,
    CreateLoadBalanceRequestSchema,
    CreateWebsiteRequestSchema,
    DefaultHtmlSchema,
    DeleteDomainRequestSchema,
    DeleteLoadBalanceRequestSchema,
    DeleteProxyRequestSchema,
    DeleteWebsiteRequestSchema,
    GetAntiLeechRequestSchema,
    GetAuthRequestSchema,
    GetProxiesRequestSchema,
    GetRewriteRequestSchema,
    GetWebsiteLogRequestSchema,
    LoadBalanceSchema,
    LoadBalanceServerSchema,
    NginxParamSchema,
    NginxScopeConfigSchema,
    OperateCrossSiteRequestSchema,
    OperateCustomRewriteRequestSchema,
    OperateWebsiteRequestSchema,
    ProxyCacheSchema,
    RealIPConfigSchema,
    RedirectConfigSchema,
    RewriteConfigSchema,
    SearchWebsitesRequestSchema,
    UpdateAuthRequestSchema,
    UpdateDNSAccountRequestSchema,
    UpdateDefaultHtmlRequestSchema,
    UpdateDomainRequestSchema,
    UpdateLoadBalanceFileRequestSchema,
    UpdatePathAuthRequestSchema,
    UpdateProxyFileRequestSchema,
    UpdateProxyStatusRequestSchema,
    UpdateRedirectFileRequestSchema,
    UpdateRewriteRequestSchema,
    UpdateStreamRequestSchema,
    UpdateWebsiteDirRequestSchema,
    UpdateWebsiteHTTPSRequestSchema,
    UpdateWebsiteNginxFileRequestSchema,
    UpdateWebsitePermissionRequestSchema,
    UpdateWebsiteRequestSchema,
    WebsiteDirConfigSchema,
    WebsiteCheckItemSchema,
    WebsiteDatabaseSchema,
    WebsiteDetailSchema,
    WebsiteDomainSchema,
    WebsiteHTTPSSchema,
    WebsiteLogSchema,
    WebsiteOptionsRequestSchema,
    WebsiteOptionSchema,
    WebsiteProxySchema,
    WebsiteResourceSchema,
    WebsiteSchema,
    ExecComposerRequestSchema,
} from '@/gen/panel/agent/v1/website_pb';
import {
    ACMEAccountSchema,
    CADetailSchema,
    CreateACMEAccountRequestSchema,
    CreateCARequestSchema,
    CreateSSLRequestSchema,
    DNSAccountSchema,
    DNSResolveRecordSchema,
    GetDNSResolveRequestSchema,
    ObtainCARequestSchema,
    PushSSLRequestSchema,
    RenewCARequestSchema,
    UpdateACMEAccountRequestSchema,
    UpdateSSLRequestSchema,
    WebsiteSSLSchema,
} from '@/gen/panel/agent/v1/website_ssl_pb';

type Init<T extends DescMessage> = MessageInitShape<T>;

// 网站域 DTO 由 proto 生成类型派生；模板、预览等纯前端结构没有 proto 对应物，保留为本地类型。
export namespace Website {
    export type Website = Init<typeof WebsiteDetailSchema> & {
        domains: string[];
        appType: string;
        webSiteGroupId: number;
        otherDomains: string;
        autoRenew: boolean;
        appinstall?: NewAppInstall;
        webSiteSSL: SSL;
        runtimeID: number;
        IPV6: boolean;
        dbID: number;
        childSites?: string[];
    };

    export type WebsiteDTO = Website & {
        servers: NginxUpstreamServer[];
    };

    export type WebsiteStreamUpdate = Init<typeof UpdateStreamRequestSchema> & {
        websiteID?: number;
        servers: NginxUpstreamServer[];
    };

    export type WebsiteRes = Init<typeof WebsiteSchema> & { runtimeName: string };

    export interface NewAppInstall {
        name: string;
        appDetailId: number;
        params: any;
    }

    export type WebSiteSearch = Init<typeof SearchWebsitesRequestSchema>;
    export type WebSiteDel = Init<typeof DeleteWebsiteRequestSchema>;

    export type WebSiteCreateReq = Init<typeof CreateWebsiteRequestSchema> & {
        webSiteGroupId?: number;
        taskID?: string;
        templateOutputID?: number;
        SSLID?: number;
        enableSSL?: boolean;
        ftpUser?: string;
        ftpPassword?: string;
        proxyType?: string;
        createDB?: boolean;
        dbName?: string;
        dbPassword?: string;
        dbFormat?: string;
        dbUser?: string;
        dbHost?: string;
        servers: NginxUpstreamServer[];
    };

    export type WebSiteUpdateReq = Init<typeof UpdateWebsiteRequestSchema>;
    export type WebSiteOp = Init<typeof OperateWebsiteRequestSchema>;

    export interface WebSiteOpLog {
        id: number;
        operate: string;
        logType: string;
    }

    export type WebSiteLogReq = Init<typeof GetWebsiteLogRequestSchema>;
    export type OptionReq = Init<typeof WebsiteOptionsRequestSchema>;
    export type WebsiteOption = Init<typeof WebsiteOptionSchema>;
    export type WebSiteLog = Init<typeof WebsiteLogSchema>;

    export type Domain = Init<typeof WebsiteDomainSchema>;
    export type DomainCreate = Init<typeof CreateDomainsRequestSchema> & { websiteID?: number };
    export type DomainUpdate = Init<typeof UpdateDomainRequestSchema>;
    interface SubDomain {
        domain: string;
        port: number;
        ssl: boolean;
    }
    export type DomainDelete = Init<typeof DeleteDomainRequestSchema>;

    export interface NginxConfigReq {
        operate: string;
        websiteId: number;
        scope: string;
        params?: any;
    }

    export interface NginxScopeReq {
        websiteId: number;
        scope: string;
    }

    export type NginxParam = Init<typeof NginxParamSchema>;
    export type NginxScopeConfig = Init<typeof NginxScopeConfigSchema>;

    export type DnsAccount = Init<typeof DNSAccountSchema> & { authorization?: Record<string, string> };
    export type DnsAccountCreate = Init<typeof CreateDNSAccountRequestSchema>;
    export type DnsAccountUpdate = Init<typeof UpdateDNSAccountRequestSchema>;

    export type SSL = Init<typeof WebsiteSSLSchema> & {
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
    export type SSLDTO = SSL & { logPath: string };
    export type SSLCreate = Init<typeof CreateSSLRequestSchema> & {
        id?: number;
        isIP?: boolean;
    };

    export interface SSLApply {
        websiteId: number;
        SSLId: number;
    }
    export interface SSLRenew {
        SSLId: number;
    }
    export type SSLUpdate = Init<typeof UpdateSSLRequestSchema> & {
        pushNode?: boolean;
        nodes?: string;
    };
    export type SSLPush = Init<typeof PushSSLRequestSchema> & { taskID?: string };

    export type AcmeAccount = Init<typeof ACMEAccountSchema>;
    export type AcmeAccountCreate = Init<typeof CreateACMEAccountRequestSchema>;
    export type AcmeAccountUpdate = Init<typeof UpdateACMEAccountRequestSchema>;
    export type DNSResolveReq = Init<typeof GetDNSResolveRequestSchema> & { websiteSSLId?: number };
    export type DNSResolve = Init<typeof DNSResolveRecordSchema>;

    export interface SSLReq {
        name?: string;
        acmeAccountID?: string;
    }

    export type HTTPSReq = Init<typeof UpdateWebsiteHTTPSRequestSchema> & {
        SSLProtocol?: string[];
    };
    export type HTTPSConfig = Init<typeof WebsiteHTTPSSchema> & {
        SSL: SSL;
        SSLProtocol?: string[];
    };
    export type BatchSetHttps = Init<typeof BatchSetHttpsRequestSchema> & {
        SSLId?: number;
        SSLProtocol?: string[];
        websiteSSLId?: number;
        taskID?: string;
    };

    export type CheckReq = Init<typeof CheckWebsiteRequestSchema>;
    export type CheckRes = Init<typeof WebsiteCheckItemSchema>;
    export interface DelReq {
        id: number;
    }
    export type NginxUpdate = Init<typeof UpdateWebsiteNginxFileRequestSchema>;
    export type DefaultServerUpdate = Init<typeof ChangeDefaultWebsiteRequestSchema>;

    export type RewriteReq = Init<typeof GetRewriteRequestSchema> & { websiteID?: number };
    export type RewriteRes = Init<typeof RewriteConfigSchema>;
    export type RewriteUpdate = Init<typeof UpdateRewriteRequestSchema> & { websiteID?: number };
    export type CustomRewrite = Init<typeof OperateCustomRewriteRequestSchema>;

    export type DirUpdate = Init<typeof UpdateWebsiteDirRequestSchema>;
    export type DirPermissionUpdate = Init<typeof UpdateWebsitePermissionRequestSchema>;

    export type ProxyReq = Init<typeof GetProxiesRequestSchema>;
    export type ProxyConfig = Init<typeof WebsiteProxySchema> & {
        operate?: string;
        modifier?: string;
        replaces?: ProxReplace;
        browserCache?: 'enable' | 'disable' | 'noModify';
        cors?: boolean;
        allowOrigins?: string;
        allowMethods?: string;
        allowHeaders?: string;
        allowCredentials?: boolean;
        preflight?: boolean;
        proxyAddress?: string;
        proxyProtocol?: string;
        proxySSLName?: string;
    };
    export type ProxyDel = Init<typeof DeleteProxyRequestSchema>;
    export type ProxyStatusUpdate = Init<typeof UpdateProxyStatusRequestSchema>;
    export interface ProxReplace {
        [key: string]: string;
    }
    export type ProxyFileUpdate = Init<typeof UpdateProxyFileRequestSchema> & { websiteID?: number };

    export type AuthReq = Init<typeof GetAuthRequestSchema> & { websiteID?: number };
    export type NginxAuth = Init<typeof AuthItemSchema>;
    export type AuthConfig = Init<typeof AuthConfigSchema>;
    export type NginxAuthConfig = Init<typeof UpdateAuthRequestSchema> & {
        websiteID?: number;
        scope?: string;
        path?: '';
        name?: '';
    };
    export type NginxPathAuthConfig = Init<typeof UpdatePathAuthRequestSchema> & { websiteID?: number };

    export type LeechConfig = Init<typeof AntiLeechConfigSchema> & { websiteID?: number };
    export type LeechReq = Init<typeof GetAntiLeechRequestSchema> & { websiteID?: number };
    export interface WebsiteReq {
        websiteID: number;
    }

    export type RedirectConfig = Init<typeof RedirectConfigSchema> & {
        operate?: string;
        websiteID?: number;
    };
    export type RedirectFileUpdate = Init<typeof UpdateRedirectFileRequestSchema> & { websiteID?: number };

    export type PHPVersionChange = Init<typeof ChangeWebsitePHPVersionRequestSchema> & {
        websiteID?: number;
        runtimeID?: number;
    };

    export type DirConfig = Init<typeof WebsiteDirConfigSchema> & {
        userGroup?: string;
        msg?: string;
    };

    export interface SSLUpload {
        privateKey: string;
        certificate: string;
        privateKeyPath: string;
        certificatePath: string;
        type: string;
        sslID: number;
        description?: string;
        pushNode?: boolean;
        nodes?: string;
    }
    export interface SSLObtain {
        ID: number;
    }

    export type CA = Init<typeof CADetailSchema>;
    export type CACreate = Init<typeof CreateCARequestSchema>;
    export type CADTO = CA & {
        commonName: string;
        country: string;
        organization: string;
        organizationUint: string;
        province: string;
        city: string;
    };
    export type SSLObtainByCA = Init<typeof ObtainCARequestSchema> & {
        ID?: number;
        SSLId?: number;
    };
    export type RenewSSLByCA = Init<typeof RenewCARequestSchema> & { SSLID?: number };
    export interface SSLDownload {
        id: number;
    }

    export type WebsiteHtml = Init<typeof DefaultHtmlSchema>;
    export type WebsiteHtmlUpdate = Init<typeof UpdateDefaultHtmlRequestSchema>;

    export type NginxUpstream = Init<typeof LoadBalanceSchema> & { websiteID?: number };
    export type NginxUpstreamFile = Init<typeof UpdateLoadBalanceFileRequestSchema> & { websiteID?: number };
    export type LoadBalanceReq = Init<typeof CreateLoadBalanceRequestSchema> & { websiteID?: number };
    type NginxUpstreamServer = Init<typeof LoadBalanceServerSchema>;
    export type LoadBalanceDel = Init<typeof DeleteLoadBalanceRequestSchema> & { websiteID?: number };
    export type WebsiteLBUpdateFile = Init<typeof UpdateLoadBalanceFileRequestSchema> & { websiteID?: number };

    export type WebsiteCacheConfig = Init<typeof ProxyCacheSchema>;
    export type WebsiteRealIPConfig = Init<typeof RealIPConfigSchema>;
    export type WebsiteResource = Init<typeof WebsiteResourceSchema> & {
        resourceID?: number;
        detail?: any;
    };
    export type WebsiteDatabase = Init<typeof WebsiteDatabaseSchema> & {
        databaseID?: number;
        websiteID?: number;
    };
    export type ChangeDatabase = Init<typeof ChangeWebsiteDatabaseRequestSchema> & {
        websiteID?: number;
        databaseID?: number;
        databaseType?: string;
    };
    export type CrossSiteAccessOp = Init<typeof OperateCrossSiteRequestSchema> & { websiteID?: number };
    export type ExecComposer = Init<typeof ExecComposerRequestSchema> & {
        websiteID?: number;
        taskID?: string;
    };
    export type BatchOperate = Init<typeof BatchWebsiteOperateRequestSchema> & { taskID?: string };

    export type CorsConfig = Init<typeof CorsConfigSchema>;
    export type CorsConfigReq = CorsConfig & { websiteID: number };
    export type BatchSetGroup = Init<typeof BatchWebsiteGroupRequestSchema> & { groupID?: number };

    export interface TemplateVariable {
        key: string;
        label: string;
        type: 'text' | 'textarea' | 'number' | 'select' | 'color';
        default: string;
        options: string;
        required: boolean;
    }

    export interface Template {
        id: number;
        createdAt?: string;
        updatedAt?: string;
        name: string;
        type: string;
        content: string;
        filePath: string;
        variables: string;
        remark: string;
    }
    export interface TemplateSearch {
        page: number;
        pageSize: number;
        name: string;
        type: string;
    }
    export interface TemplateCreate {
        name: string;
        type: string;
        content: string;
        filePath: string;
        variables: string;
        remark: string;
    }
    export interface TemplateUpdate {
        id: number;
        name: string;
        type: string;
        content: string;
        filePath: string;
        variables: string;
        remark: string;
    }
    export interface TemplateOutput {
        id: number;
        createdAt?: string;
        updatedAt?: string;
        name: string;
        templateID: number;
        templateType: string;
        variableValues: string;
        outputPath: string;
    }
    export interface TemplateOutputDTO extends TemplateOutput {
        templateName: string;
    }
    export interface TemplateOutputSearch {
        page: number;
        pageSize: number;
        templateID: number;
    }
    export interface TemplateOutputCreate {
        templateID: number;
        name: string;
        variableValues: Record<string, string>;
    }
    export interface PreviewReq {
        templateID: number;
        variableValues: Record<string, string>;
    }
    export interface PreviewDTO {
        html: string;
    }
}
