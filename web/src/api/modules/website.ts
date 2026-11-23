import http, { type RequestConfig } from '@/api';
import { ReqPage, ResPage } from '../interface';
import { Website } from '../interface/website';
import { File } from '../interface/file';
import { TimeoutEnum } from '@/enums/http-enum';
import { deepCopy } from '@/utils/misc';
import { encodeBase64Fields } from '@/utils/base64';

export const searchWebsites = (req: Website.WebSiteSearch, node?: string) => {
    const params = node ? `?operateNode=${node}` : '';
    return http.post<ResPage<Website.WebsiteRes>>(`/websites/search${params}`, req);
};


export const createWebsite = (req: Website.WebSiteCreateReq) => {
    let request = deepCopy(req) as Website.WebSiteCreateReq;
    encodeBase64Fields(request, ['ftpPassword']);
    return http.post<any>(`/websites`, request, TimeoutEnum.T_10M);
};



export const getWebsiteLog = (req: Website.WebSiteLogReq) => {
    return http.post<Website.WebSiteLog>(`/websites/log/search`, req);
};

export const updateWebsite = (req: Website.WebSiteUpdateReq, node?: string) => {
    const query = node ? `?operateNode=${node}` : '';
    return http.post<any>(`/websites/update${query}`, req);
};



export const getWebsiteConfig = (id: number, type: string) => {
    return http.get<File.File>(`/websites/${id}/config/${type}`);
};

export const deleteWebsite = (req: Website.WebSiteDel) => {
    return http.post<any>(`/websites/del`, req);
};

export const listDomains = (id: number) => {
    return http.get<Website.Domain[]>(`/websites/domains/${id}`);
};




export const getNginxConfig = (req: Website.NginxScopeReq) => {
    return http.post<Website.NginxScopeConfig>(`/websites/config`, req);
};

export const updateNginxConfig = (req: Website.NginxConfigReq) => {
    return http.post<any>(`/websites/config/update`, req);
};

export const searchDnsAccount = (req: ReqPage) => {
    return http.post<ResPage<Website.DnsAccount>>(`/websites/dns/search`, req);
};








export const searchSSL = (req: ReqPage, currentNode?: string) => {
    return http.post<ResPage<Website.SSLDTO>>(
        `/websites/ssl/search`,
        req,
        TimeoutEnum.T_40S,
        currentNode ? { CurrentNode: currentNode } : undefined,
    );
};


export const listLocalNodeSSL = (req: Website.SSLReq, config?: RequestConfig) => {
    return http.postLocalNode<Website.SSLDTO[]>(`/websites/ssl/list`, req, undefined, config);
};








export const getHTTPSConfig = (id: number) => {
    return http.get<Website.HTTPSConfig>(`/websites/${id}/https`);
};

export const updateHTTPSConfig = (req: Website.HTTPSReq) => {
    return http.post<Website.HTTPSConfig>(`/websites/${req.websiteId}/https`, req);
};


export const updateNginxFile = (req: Website.NginxUpdate) => {
    return http.post<any>(`/websites/nginx/update`, req, TimeoutEnum.T_3M);
};

export const changeDefaultServer = (req: Website.DefaultServerUpdate) => {
    return http.post<any>(`/websites/default/server`, req);
};

export const getRewriteConfig = (req: Website.RewriteReq) => {
    return http.post<Website.RewriteRes>(`/websites/rewrite`, req);
};

export const updateRewriteConfig = (req: Website.RewriteUpdate) => {
    return http.post<any>(`/websites/rewrite/update`, req);
};

export const updateWebsiteDir = (req: Website.DirUpdate) => {
    return http.post<any>(`/websites/dir/update`, req);
};

export const updateWebsiteDirPermission = (req: Website.DirPermissionUpdate) => {
    return http.post<any>(`/websites/dir/permission`, req);
};

export const getProxyConfig = (req: Website.ProxyReq) => {
    return http.post<Website.ProxyConfig[]>(`/websites/proxies`, req);
};










export const getAntiLeech = (req: Website.LeechReq) => {
    return http.post<Website.LeechConfig>(`/websites/leech`, req);
};

export const updateAntiLeech = (req: Website.LeechConfig) => {
    return http.post<any>(`/websites/leech/update`, req);
};

export const getRedirectConfig = (req: Website.WebsiteReq) => {
    return http.post<Website.RedirectConfig[]>(`/websites/redirect`, req);
};

export const operateRedirectConfig = (req: Website.WebsiteReq) => {
    return http.post<any>(`/websites/redirect/update`, req);
};



export const getDirConfig = (req: Website.ProxyReq) => {
    return http.post<Website.DirConfig>(`/websites/dir`, req);
};

export const uploadSSL = (req: Website.SSLUpload) => {
    return http.post<any>(`/websites/ssl/upload`, req);
};

export const uploadSSLFile = (params: FormData) => {
    return http.upload<File.File>(`/websites/ssl/upload/file`, params, {});
};



export const obtainSSLByCA = (req: Website.SSLObtainByCA) => {
    return http.post<any>(`/websites/ca/obtain`, req);
};

export const deleteCA = (req: Website.DelReq) => {
    return http.post<any>(`/websites/ca/del`, req);
};

export const renewSSLByCA = (req: Website.RenewSSLByCA) => {
    return http.post<any>(`/websites/ca/renew`, req);
};

export const downloadFile = (params: Website.SSLDownload) => {
    return http.download<BlobPart>(`/websites/ssl/download`, params, {
        responseType: 'blob',
        timeout: TimeoutEnum.T_40S,
    });
};

export const getCA = (id: number) => {
    return http.get<Website.CADTO>(`/websites/ca/${id}`);
};

export const getDefaultHtml = (type: string) => {
    return http.get<Website.WebsiteHtml>(`/websites/default/html/${type}`);
};

export const updateDefaultHtml = (req: Website.WebsiteHtmlUpdate) => {
    return http.post(`/websites/default/html/update`, req);
};

export const downloadCAFile = (params: Website.SSLDownload) => {
    return http.download<BlobPart>(`/websites/ca/download`, params, {
        responseType: 'blob',
        timeout: TimeoutEnum.T_40S,
    });
};

export const getLoadBalances = (id: number) => {
    return http.get<Website.NginxUpstream[]>(`/websites/${id}/lbs`);
};

export const createLoadBalance = (req: Website.LoadBalanceReq) => {
    return http.post(`/websites/lbs/create`, req);
};

export const deleteLoadBalance = (req: Website.LoadBalanceDel) => {
    return http.post(`/websites/lbs/del`, req);
};

export const updateLoadBalance = (req: Website.LoadBalanceReq) => {
    return http.post(`/websites/lbs/update`, req);
};


export const updateCacheConfig = (req: Website.WebsiteCacheConfig) => {
    return http.post(`/websites/proxy/config`, req);
};

export const getCacheConfig = (id: number) => {
    return http.get<Website.WebsiteCacheConfig>(`/websites/proxy/config/${id}`);
};

export const updateRealIPConfig = (req: Website.WebsiteRealIPConfig) => {
    return http.post(`/websites/realip/config`, req);
};

export const getRealIPConfig = (id: number) => {
    return http.get<Website.WebsiteRealIPConfig>(`/websites/realip/config/${id}`);
};







export const execComposer = (req: Website.ExecComposer) => {
    return http.post(`/websites/exec/composer`, req);
};

export const batchOperate = (req: Website.BatchOperate) => {
    return http.post(`/websites/batch/operate`, req);
};



export const batchSetGroup = (req: Website.BatchSetGroup) => {
    return http.post(`/websites/batch/group`, req);
};


export const batchSetHttps = (req: Website.BatchSetHttps) => {
    return http.post(`/websites/batch/ssl`, req);
};

export const searchTemplates = (req: Website.TemplateSearch) => {
    return http.post<ResPage<Website.Template>>(`/websites/templates/search`, req);
};

export const createTemplate = (req: Website.TemplateCreate) => {
    return http.post<any>(`/websites/templates`, req);
};

export const updateTemplate = (req: Website.TemplateUpdate) => {
    return http.post<any>(`/websites/templates/update`, req);
};

export const deleteTemplate = (params: { id: number }) => {
    return http.post<any>(`/websites/templates/del`, params);
};

export const getTemplate = (id: number) => {
    return http.post<Website.Template>(`/websites/templates/get`, { id });
};

export const uploadTemplateZip = (file: globalThis.File) => {
    const formData = new FormData();
    formData.append('file', file);
    return http.post<{ filePath: string; variables: string[] }>(
        `/websites/templates/upload`,
        formData,
        TimeoutEnum.T_5M,
    );
};

export const previewTemplate = (req: Website.PreviewReq) => {
    return http.post<Website.PreviewDTO>(`/websites/templates/preview`, req);
};

export const searchTemplateOutputs = (req: Website.TemplateOutputSearch) => {
    return http.post<ResPage<Website.TemplateOutputDTO>>(`/websites/templates/outputs/search`, req);
};

export const createTemplateOutput = (req: Website.TemplateOutputCreate) => {
    return http.post<any>(`/websites/templates/outputs`, req);
};

export const deleteTemplateOutput = (params: { id: number }) => {
    return http.post<any>(`/websites/templates/outputs/del`, params);
};

export const getTemplateOutput = (id: number) => {
    return http.post<Website.TemplateOutputDTO>(`/websites/templates/outputs/get`, { id });
};

export const uploadCA = (params: FormData) => {
    return http.upload(`/websites/ca/upload`, params);
};

export const importCA = (params: {
    name: string;
    type: 'paste' | 'local';
    certificate?: string;
    privateKey?: string;
    certificatePath?: string;
    privateKeyPath?: string;
}) => {
    return http.post(`/websites/ca/import`, params);
};
