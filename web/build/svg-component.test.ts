import { describe, expect, test } from 'bun:test';
import { parseSvg } from './svg-component';

describe('parseSvg', () => {
    test('提取根节点属性并保留内部内容', () => {
        const info = parseSvg('<svg width="33" height="33" fill="currentColor"><path d="M0 0"/></svg>');
        expect(info.attrs).toEqual({ width: '33', height: '33', fill: 'currentColor' });
        expect(info.innerHTML).toBe('<path d="M0 0"/>');
    });

    test('单引号属性与命名空间属性也能识别', () => {
        const info = parseSvg("<svg xmlns:xlink='x' viewBox='0 0 10 10'><g/></svg>");
        expect(info.attrs['xmlns:xlink']).toBe('x');
        expect(info.attrs.viewBox).toBe('0 0 10 10');
    });

    test('缺少根节点时报错', () => {
        expect(() => parseSvg('<div/>')).toThrow('missing <svg> root');
    });
});
