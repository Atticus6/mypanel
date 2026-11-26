import { encodeBase64 } from '../utils/base64';

/** 登录类接口需要携带安全入口，其余接口按普通请求处理。 */
const entrancePaths = [
    '/core/auth/login',
    '/core/auth/mfalogin',
    '/core/auth/passkey/begin',
    '/core/auth/passkey/finish',
    '/core/auth/oidc/begin',
    '/core/auth/oidc/finish',
    '/core/auth/saml2/begin',
    '/core/auth/saml2/finish',
];

/** 读取类方法不需要 CSRF 令牌，与后端拦截器保持一致。 */
const safeMethods = ['GET', 'HEAD', 'OPTIONS', 'TRACE'];

/** 旧 REST 通道的请求配置，字段与业务代码沿用的历史配置保持兼容。 */
export interface RequestConfig {
    url?: string;
    method?: string;
    baseURL?: string;
    params?: Record<string, unknown>;
    data?: any;
    headers?: Record<string, unknown>;
    timeout?: number;
    responseType?: 'json' | 'text' | 'blob' | 'arraybuffer';
    withCredentials?: boolean;
    signal?: AbortSignal;
    onUploadProgress?: (event: { loaded: number; total?: number }) => void;
    skipErrorMessage?: boolean;
    errorMessageMode?: 'default' | 'manual';
}

/** 构造请求头所需的全局状态，由调用方注入，便于纯函数测试。 */
export interface HeaderContext {
    language: string;
    currentNode: string;
    entrance: string;
    csrfToken?: string;
}

/** 拼接 baseURL、路径与查询参数；绝对 URL 原样保留。 */
export function buildUrl(baseURL: string | undefined, url: string, params?: Record<string, unknown>): string {
    let result: string;
    if (!baseURL || /^https?:\/\//i.test(url)) {
        result = url;
    } else {
        result = `${baseURL.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
    }
    if (!params) return result;

    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (Array.isArray(value)) {
            value.forEach((item) => search.append(key, String(item)));
        } else {
            search.append(key, String(value));
        }
    });
    const query = search.toString();
    return query ? `${result}${result.includes('?') ? '&' : '?'}${query}` : result;
}

/** 根据请求配置与全局状态生成最终请求头。 */
export function buildRequestHeaders(config: RequestConfig, ctx: HeaderContext): Record<string, string> {
    const method = (config.method || 'get').toUpperCase();
    const headers: Record<string, string> = {
        'Accept-Language': ctx.language,
        ...(config.headers as Record<string, string> | undefined),
    };

    headers.CurrentNode =
        headers.CurrentNode === undefined
            ? encodeURIComponent(ctx.currentNode)
            : encodeURIComponent(headers.CurrentNode);

    if (config.url && entrancePaths.includes(config.url)) {
        headers.EntranceCode = encodeBase64(ctx.entrance);
    }
    if (!safeMethods.includes(method) && ctx.csrfToken) {
        headers['X-CSRF-Token'] = ctx.csrfToken;
    }
    return headers;
}

/** 把响应文本解析为 JSON；解析失败时保留原文，让上层按字符串处理。 */
export function parseJsonResponse(text: string): unknown {
    if (!text) return undefined;
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

/** CSRF 拒绝的响应体特征，命中时不应再弹通用错误提示。 */
export const isCsrfForbidden = (data: unknown): boolean => {
    const message = (data as { message?: unknown } | undefined)?.message;
    return typeof message === 'string' && message.toLowerCase().includes('csrf token invalid');
};

/** 统一承载 HTTP 层错误，供页面按状态码与响应体区分处理。 */
export class HttpError extends Error {
    status: number;
    data: unknown;

    constructor(message: string, status: number, data?: unknown) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
        this.data = data;
    }
}

/** 判断错误是否来自 HTTP 请求层。 */
export const isHttpError = (error: unknown): error is HttpError =>
    error instanceof HttpError ||
    (typeof error === 'object' && error !== null && (error as Error).name === 'HttpError');

/** 从 HTTP 错误里取出后端返回的 message，供页面提示使用。 */
export const getHttpResponseMessage = (error: unknown): string | undefined => {
    if (!isHttpError(error)) return undefined;
    const message = (error.data as { message?: unknown } | undefined)?.message;
    return typeof message === 'string' ? message : undefined;
};
