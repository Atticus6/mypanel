import { describe, expect, test } from 'bun:test';
import { injectHmr } from './hmr';

describe('injectHmr', () => {
    test('export default defineComponent 被改成具名局部量并注册 HMR', () => {
        const code = 'export default defineComponent({ setup() { return () => <div /> } });';
        const result = injectHmr(code, '/src/A.tsx');
        expect(result).toContain('const __default__ = defineComponent(');
        expect(result).toContain('__VUE_HMR_RUNTIME__.createRecord(');
        expect(result).toContain('import.meta.hot.accept(({ default: __default }) => {');
        expect(result).toContain('export default __default__;');
    });

    test('export const 声明的组件也注册 HMR', () => {
        const code = 'export const Foo = defineComponent({ setup() { return () => <div /> } });';
        const result = injectHmr(code, '/src/Foo.tsx');
        expect(result).toContain('Foo.__hmrId =');
        expect(result).toContain('import.meta.hot.accept(({ Foo: __Foo }) => {');
    });

    test('带泛型参数的 defineComponent 正确识别', () => {
        const code = 'export default defineComponent<Props, unknown, unknown>({ setup() { return () => <div /> } });';
        const result = injectHmr(code, '/src/A.tsx');
        expect(result).toContain('const __default__ = defineComponent<Props, unknown, unknown>(');
        expect(result).toContain('__default__.__hmrId =');
        expect(result).not.toContain('defineComponent.__hmrId');
    });

    test('没有组件时原样返回', () => {
        const code = 'export const value = 1;';
        expect(injectHmr(code, '/src/x.ts')).toBe(code);
    });

    test('自定义 defineComponent 名称可用', () => {
        const code = 'export default defineFoo({ setup() { return () => <div /> } });';
        expect(injectHmr(code, '/src/A.tsx', 'defineFoo')).toContain('const __default__ = defineFoo(');
    });
});
