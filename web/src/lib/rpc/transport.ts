import { Code, ConnectError, type Interceptor } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';

/**
 * 读取 Cookie。
 *
 * 认证信息全部由同源 Cookie 承载，前端不保存 Token，
 * 因此这里只需要读 CSRF Token。
 */
function readCookie(name: string): string {
    const target = `${name}=`;
    for (const part of document.cookie.split(';')) {
        const item = part.trim();
        if (item.startsWith(target)) {
            return decodeURIComponent(item.slice(target.length));
        }
    }
    return '';
}

/**
 * 语言拦截器：把界面语言带给服务端，用于错误文案本地化。
 */
const localeInterceptor: Interceptor = (next) => async (request) => {
    const language = document.documentElement.lang || 'zh';
    request.header.set('Accept-Language', language);
    return next(request);
};

/**
 * CSRF 拦截器：Connect 全部是 POST，服务端按 proto 策略决定是否校验。
 *
 * 这里无条件带上 Token，公开接口（登录、验证码）由服务端豁免。
 */
const csrfInterceptor: Interceptor = (next) => async (request) => {
    const token = readCookie('pcsrftoken');
    if (token) {
        request.header.set('X-CSRF-Token', token);
    }
    return next(request);
};

/**
 * 错误拦截器：把未认证错误统一转成可识别的标记，供全局守卫处理。
 *
 * 不在这里跳转路由：拦截器不知道当前是否已经在登录页，
 * 交给 `auth-response` 之类的上层逻辑处理更安全。
 */
const errorInterceptor: Interceptor = (next) => async (request) => {
    try {
        return await next(request);
    } catch (error) {
        const connectError = ConnectError.from(error);
        if (connectError.code === Code.Unauthenticated) {
            connectError.metadata.set('panel-unauthenticated', '1');
        }
        throw connectError;
    }
};

/**
 * Connect 传输层。
 *
 * 同源部署，不需要 CORS；显式声明 credentials 是为了在将来切换
 * 凭据策略（例如独立域名）时不会静默丢掉 Cookie。
 */
export const transport = createConnectTransport({
    // 用相对路径：生产同源，开发期由 vite proxy 把 /rpc 转到 master。
    baseUrl: '/rpc',
    fetch: (input, init) => fetch(input, { ...init, credentials: 'include' }),
    interceptors: [localeInterceptor, csrfInterceptor, errorInterceptor],
});
