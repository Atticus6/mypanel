import { describe, expect, test } from 'bun:test';
import {
    HttpError,
    buildRequestHeaders,
    buildUrl,
    getHttpResponseMessage,
    isCsrfForbidden,
    isHttpError,
    parseJsonResponse,
    type HeaderContext,
} from './http-core';

const ctx: HeaderContext = {
    language: 'zh',
    currentNode: '节点/1',
    entrance: 'abc123',
    csrfToken: 'token-1',
};

describe('buildUrl', () => {
    test('拼接 baseURL 与相对路径，并去掉重复斜杠', () => {
        expect(buildUrl('/api/v2/', '/files/list', { page: 1 })).toBe('/api/v2/files/list?page=1');
    });

    test('没有 baseURL 时直接返回相对路径', () => {
        expect(buildUrl('', '/files/list')).toBe('/files/list');
    });

    test('绝对 URL 不被 baseURL 改写', () => {
        expect(buildUrl('/api/v2', 'https://example.com/x', { a: 1 })).toBe('https://example.com/x?a=1');
    });

    test('数组参数展开为重复键，空值被忽略', () => {
        expect(buildUrl('/api', '/x', { id: [1, 2], skip: null, empty: undefined, q: 'a b' })).toBe(
            '/api/x?id=1&id=2&q=a+b',
        );
    });

    test('已有查询串时用 & 追加', () => {
        expect(buildUrl('', '/x?existing=1', { a: 2 })).toBe('/x?existing=1&a=2');
    });
});

describe('buildRequestHeaders', () => {
    test('注入语言与编码后的当前节点', () => {
        const headers = buildRequestHeaders({ method: 'GET', url: '/files' }, ctx);
        expect(headers['Accept-Language']).toBe('zh');
        expect(headers.CurrentNode).toBe(encodeURIComponent('节点/1'));
    });

    test('显式传入的 CurrentNode 也会被编码', () => {
        const headers = buildRequestHeaders({ method: 'GET', url: '/files', headers: { CurrentNode: 'local' } }, ctx);
        expect(headers.CurrentNode).toBe('local');
    });

    test('登录类接口注入安全入口，普通接口不注入', () => {
        const login = buildRequestHeaders({ method: 'POST', url: '/core/auth/login' }, ctx);
        expect(login.EntranceCode).toBe(btoa('abc123'));
        const normal = buildRequestHeaders({ method: 'POST', url: '/files/upload' }, ctx);
        expect(normal.EntranceCode).toBeUndefined();
    });

    test('非幂等方法注入 CSRF，读取方法不注入', () => {
        expect(buildRequestHeaders({ method: 'POST', url: '/files/upload' }, ctx)['X-CSRF-Token']).toBe('token-1');
        expect(buildRequestHeaders({ method: 'PUT', url: '/files/1' }, ctx)['X-CSRF-Token']).toBe('token-1');
        expect(buildRequestHeaders({ method: 'GET', url: '/files' }, ctx)['X-CSRF-Token']).toBeUndefined();
        expect(buildRequestHeaders({ method: 'DELETE', url: '/files/1' }, ctx)['X-CSRF-Token']).toBe('token-1');
    });

    test('没有 CSRF Cookie 时不写入该请求头', () => {
        const headers = buildRequestHeaders({ method: 'POST', url: '/x' }, { ...ctx, csrfToken: undefined });
        expect(headers['X-CSRF-Token']).toBeUndefined();
    });

    test('自定义请求头会覆盖默认值中的同名字段', () => {
        const headers = buildRequestHeaders({ method: 'GET', url: '/x', headers: { 'Accept-Language': 'en' } }, ctx);
        expect(headers['Accept-Language']).toBe('en');
    });
});

describe('parseJsonResponse', () => {
    test('JSON 文本解析为对象', () => {
        expect(parseJsonResponse('{"code":200,"data":{"id":1}}')).toEqual({ code: 200, data: { id: 1 } });
    });

    test('非 JSON 文本原样返回', () => {
        expect(parseJsonResponse('plain text')).toBe('plain text');
    });

    test('空响应返回 undefined', () => {
        expect(parseJsonResponse('')).toBeUndefined();
    });
});

describe('isCsrfForbidden', () => {
    test('识别 CSRF 错误文案（忽略大小写）', () => {
        expect(isCsrfForbidden({ message: 'CSRF Token Invalid' })).toBe(true);
    });

    test('其他消息与非对象返回 false', () => {
        expect(isCsrfForbidden({ message: 'forbidden' })).toBe(false);
        expect(isCsrfForbidden(undefined)).toBe(false);
    });
});

describe('HttpError', () => {
    test('携带状态码与响应体，并可被识别', () => {
        const error = new HttpError('boom', 500, { message: '服务器错误' });
        expect(isHttpError(error)).toBe(true);
        expect(error.status).toBe(500);
        expect(error.data).toEqual({ message: '服务器错误' });
        expect(getHttpResponseMessage(error)).toBe('服务器错误');
    });

    test('非 HTTP 错误返回 undefined', () => {
        expect(isHttpError(new Error('boom'))).toBe(false);
        expect(getHttpResponseMessage(new Error('boom'))).toBeUndefined();
    });

    test('响应体没有 message 时返回 undefined', () => {
        expect(getHttpResponseMessage(new HttpError('boom', 400, { code: 1 }))).toBeUndefined();
    });
});
