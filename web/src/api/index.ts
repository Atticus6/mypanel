import { ResultData } from '@/types';
import { ResultEnum } from '@/enums/http-enum';
import { checkStatus } from './helper/check-status';
import router from '@/routers';
import { MsgError } from '@/utils/message';
import i18n from '@/lang';
import { changeToLocal } from '@/utils/node';
import { getCookie } from '@/utils/auth';
import { handleAuthResponseCode } from '@/utils/auth-response';
import { GlobalStore } from '@/store';
import { getOperateNodeOverride } from '@/utils/operate-node';
import {
    buildRequestHeaders,
    buildUrl,
    HttpError,
    isCsrfForbidden,
    isHttpError,
    parseJsonResponse,
    type RequestConfig,
} from './http-core';

export type { RequestConfig } from './http-core';

const config: RequestConfig = {
    baseURL: import.meta.env.VITE_API_URL as string,
    timeout: ResultEnum.TIMEOUT as number,
    withCredentials: true,
};

/** 原生 fetch 没有上传进度事件，只有请求显式需要进度时才退回到 XHR。 */
const requestWithUploadProgress = <T>(
    url: string,
    request: RequestConfig,
    headers: Record<string, string>,
): Promise<T> =>
    new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(request.method || 'POST', url, true);
        xhr.withCredentials = request.withCredentials ?? true;
        Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
        if (request.timeout && request.timeout > 0) xhr.timeout = request.timeout;
        xhr.upload.onprogress = (event) => {
            request.onUploadProgress?.({
                loaded: event.loaded,
                total: event.lengthComputable ? event.total : undefined,
            });
        };
        xhr.onload = () => {
            const data = parseJsonResponse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(data as T);
            } else {
                reject(new HttpError(`HTTP ${xhr.status}`, xhr.status, data));
            }
        };
        xhr.onerror = () => reject(new HttpError('Network Error', 0));
        xhr.ontimeout = () => reject(new HttpError('timeout', 0));
        xhr.onabort = () => reject(new HttpError('aborted', 0));
        request.signal?.addEventListener('abort', () => xhr.abort(), { once: true });
        xhr.send(request.data);
    });

const buildBody = (request: RequestConfig, headers: Record<string, string>): BodyInit | undefined => {
    const method = (request.method || 'get').toUpperCase();
    if (['GET', 'HEAD'].includes(method) || request.data === undefined) return undefined;
    const data = request.data;
    if (
        data instanceof FormData ||
        data instanceof Blob ||
        data instanceof URLSearchParams ||
        data instanceof ArrayBuffer ||
        typeof data === 'string'
    ) {
        return data;
    }
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    return JSON.stringify(data);
};

class RequestHttp {
    public constructor(_config: RequestConfig) {}

    private async request<T>(request: RequestConfig): Promise<ResultData<T>> {
        const merged: RequestConfig = { ...config, ...request };
        const url = buildUrl(merged.baseURL, merged.url || '', merged.params);
        const method = (merged.method || 'GET').toUpperCase();
        const globalStore = GlobalStore();
        const csrfToken = getCookie('pcsrftoken');
        if (csrfToken) globalStore.csrfToken = csrfToken;

        const headers = buildRequestHeaders(merged, {
            language: globalStore.language,
            currentNode: getOperateNodeOverride() || globalStore.currentNode,
            entrance: globalStore.entrance,
            csrfToken: csrfToken || undefined,
        });
        const body = buildBody(merged, headers);

        const controller = new AbortController();
        const onAbort = () => controller.abort();
        merged.signal?.addEventListener('abort', onAbort, { once: true });
        let timedOut = false;
        const timer =
            merged.timeout && merged.timeout > 0
                ? setTimeout(() => {
                      timedOut = true;
                      controller.abort();
                  }, merged.timeout)
                : undefined;

        let data: any;
        try {
            if (merged.onUploadProgress) {
                data = await requestWithUploadProgress<T>(url, merged, headers);
            } else {
                let response: Response;
                try {
                    response = await fetch(url, {
                        method,
                        headers,
                        body,
                        credentials: 'include',
                        signal: controller.signal,
                    });
                } catch (error) {
                    throw new HttpError(error instanceof Error ? error.message : 'Network Error', 0);
                }
                if (!response.ok) {
                    const text = await response.text();
                    throw new HttpError(`HTTP ${response.status}`, response.status, parseJsonResponse(text));
                }
                if (merged.responseType === 'blob') {
                    data = await response.blob();
                } else if (merged.responseType === 'arraybuffer') {
                    data = await response.arrayBuffer();
                } else {
                    data = parseJsonResponse(await response.text());
                }
            }
        } catch (error) {
            if (timedOut && isHttpError(error) && error.status === 0) {
                throw new HttpError('timeout', 0);
            }
            throw error;
        } finally {
            if (timer) clearTimeout(timer);
            merged.signal?.removeEventListener('abort', onAbort);
        }

        // 二进制产物直接返回，不进入业务错误码处理。
        if (merged.responseType === 'blob' || merged.responseType === 'arraybuffer') {
            return data as ResultData<T>;
        }

        try {
            const manualErrorMessage = merged.errorMessageMode === 'manual';
            const authResult = handleAuthResponseCode(data, { showRBACMessage: !manualErrorMessage });
            if (authResult.handled) {
                if (authResult.action === 'return') {
                    return undefined as unknown as ResultData<T>;
                }
                return Promise.reject(data);
            }
            if (data.code == ResultEnum.ERR_XPACK) {
                globalStore.isProductPro = false;
                window.location.reload();
                return Promise.reject(data);
            }
            if (data.code == ResultEnum.ERR_ENTERPRISE) {
                // 本构建没有企业版许可证页，标记状态后直接中断请求。
                globalStore.isEnterpriseLicensed = false;
                return Promise.reject(data);
            }
            if (data.code == ResultEnum.NODE_UNBIND) {
                await changeToLocal();
                window.location.reload();
                return Promise.reject(data);
            }
            if (data.code == ResultEnum.ERR_GLOBAL_LOADING) {
                globalStore.isLoading = true;
                globalStore.loadingText = data.message;
                return undefined as unknown as ResultData<T>;
            }
            if (globalStore.isLoading) {
                globalStore.isLoading = false;
            }
            if (data.code == ResultEnum.ERR_AUTH) {
                return data;
            }
            if (data.code && data.code !== ResultEnum.SUCCESS) {
                if (!manualErrorMessage) {
                    if (data.message.toLowerCase().indexOf('operation not permitted') !== -1) {
                        MsgError(i18n.global.t('license.tamperHelper'));
                        return Promise.reject(data);
                    }
                    if (!merged.skipErrorMessage) {
                        MsgError(data.message);
                    }
                }
                return Promise.reject(data);
            }
            return data;
        } catch (error) {
            if (!isHttpError(error)) {
                if (!window.navigator.onLine) router.replace({ path: '/500' });
                return Promise.reject(error);
            }
            const manualErrorMessage = merged.errorMessageMode === 'manual';
            if (!manualErrorMessage && error.message.includes('timeout')) {
                MsgError(i18n.global.t('commons.msg.requestTimeout'));
            }
            switch (error.status) {
                case ResultEnum.EXPIRED:
                    router.push({ name: 'Expired' });
                    return undefined as unknown as ResultData<T>;
                case ResultEnum.FORBIDDEN:
                    if (isCsrfForbidden(error.data)) {
                        return Promise.reject(error);
                    }
                    if (!manualErrorMessage) {
                        MsgError(
                            (error.data as { message?: string } | undefined)?.message ||
                                i18n.global.t('commons.res.forbidden'),
                        );
                    }
                    return Promise.reject(error);
                case 500:
                case 502:
                case 524:
                case 407:
                    if (!manualErrorMessage) {
                        checkStatus(error.status, (error.data as { message?: string } | undefined)?.message || '');
                    }
                    return Promise.reject(error);
                default:
                    return Promise.reject(error);
            }
        }
    }

    get<T>(url: string, params?: object, _object: RequestConfig = {}): Promise<ResultData<T>> {
        return this.request<T>({ ..._object, url, method: 'GET', params: params as Record<string, unknown> });
    }

    post<T>(url: string, params?: object, timeout?: number, headers?: object): Promise<ResultData<T>> {
        return this.request<T>({
            url,
            method: 'POST',
            data: params,
            timeout: timeout || (ResultEnum.TIMEOUT as number),
            headers: headers as Record<string, unknown>,
        });
    }

    postWithConfig<T>(url: string, params?: object, requestConfig?: RequestConfig): Promise<ResultData<T>> {
        return this.request<T>({ url, method: 'POST', data: params, ...requestConfig });
    }

    postLocalNode<T>(
        url: string,
        params?: object,
        timeout?: number,
        requestConfig?: RequestConfig,
    ): Promise<ResultData<T>> {
        return this.request<T>({
            url,
            method: 'POST',
            data: params,
            timeout: timeout || (ResultEnum.TIMEOUT as number),
            ...requestConfig,
            headers: { ...requestConfig?.headers, CurrentNode: 'local' },
        });
    }

    put<T>(url: string, params?: object, _object: RequestConfig = {}): Promise<ResultData<T>> {
        return this.request<T>({ ..._object, url, method: 'PUT', data: params });
    }

    delete<T>(url: string, params?: any, _object: RequestConfig = {}): Promise<ResultData<T>> {
        return this.request<T>({ ..._object, url, method: 'DELETE', params });
    }

    download<BlobPart>(url: string, params?: object, _object: RequestConfig = {}): Promise<BlobPart> {
        return this.request<BlobPart>({
            ..._object,
            url,
            method: 'POST',
            data: params,
            responseType: 'blob',
        }) as unknown as Promise<BlobPart>;
    }

    upload<T>(url: string, params: object = {}, requestConfig?: RequestConfig): Promise<ResultData<T>> {
        return this.request<T>({ ...requestConfig, url, method: 'POST', data: params });
    }
}

export default new RequestHttp(config);
