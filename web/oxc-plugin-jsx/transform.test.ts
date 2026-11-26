import { describe, expect, test } from 'bun:test';
import { resolveOptions } from './options';
import { transformVueJSX } from './transform';

const run = (code: string, options = {}) => transformVueJSX(code, resolveOptions(options));

describe('transformVueJSX', () => {
    test('普通 JSX 原样返回', () => {
        const code = 'export const A = () => <div class="box">hi</div>;';
        expect(run(code)).toBe(code);
    });

    test('v-slots 保留给运行时处理', () => {
        const code = 'export const A = () => <Comp v-slots={{ a: () => 1 }} />;';
        expect(run(code)).toBe(code);
    });

    test('v-html / v-text 改写成 Vue 属性', () => {
        expect(run('<div v-html={html} />')).toBe('<div innerHTML={html} />');
        expect(run('<div v-text={text} />')).toBe('<div textContent={text} />');
    });

    test('xlink 前缀改为冒号命名', () => {
        expect(run('<use xlinkHref="#id" />')).toBe('<use xlink:href="#id" />');
    });

    test('v-model 展开为绑定值与更新回调', () => {
        const result = run('<Comp v-model={form.name} />');
        expect(result).toContain('modelValue={form.name}');
        expect(result).toContain('onUpdate:modelValue={$event => { form.name = $event }}');
    });

    test('组件插槽内的 v-model 同样展开', () => {
        const result = run('<ElFormItem><ElCheckbox v-model={form.agree} /></ElFormItem>');
        expect(result).toContain('modelValue={form.agree}');
        expect(result).toContain('onUpdate:modelValue={$event => { form.agree = $event }}');
        expect(result).not.toContain('v-model=');
    });

    test('多层嵌套插槽内的 v-model 与惰性插槽同时生效', () => {
        const result = run(
            '<ElForm><ElFormItem><ElInput v-model={form.name} /><ElCheckbox v-model={form.agree} /></ElFormItem></ElForm>',
        );
        expect(result).toBe(
            '<ElForm>{() => [<ElFormItem>{() => [<ElInput modelValue={form.name} onUpdate:modelValue={$event => { form.name = $event }} />, <ElCheckbox modelValue={form.agree} onUpdate:modelValue={$event => { form.agree = $event }} />]}</ElFormItem>]}</ElForm>',
        );
    });

    test('插槽内表达式里的 JSX 也能展开 v-model', () => {
        const result = run('<Comp>{ok && <ElInput v-model={form.name} />}</Comp>');
        expect(result).toContain('modelValue={form.name}');
        expect(result).toContain('onUpdate:modelValue={$event => { form.name = $event }}');
    });

    test('v-model 支持参数与修饰符', () => {
        const result = run('<Comp v-model:title_trim={title} />');
        expect(result).toContain('title={title}');
        expect(result).toContain('onUpdate:title={$event => { title = $event }}');
        expect(result).toContain('titleModifiers={{"trim": true}}');
    });

    test('v-models 展开所有绑定', () => {
        const result = run('<Comp v-models={[[a], [b, "title"]]} />');
        expect(result).toContain('"modelValue": a');
        expect(result).toContain('"title": b');
        expect(result).toContain('"onUpdate:modelValue": $event => { a = $event }');
    });

    test('组件子节点被包成惰性插槽函数', () => {
        const result = run('<Comp>{a}{b}</Comp>');
        expect(result).toBe('<Comp>{() => [a, b]}</Comp>');
    });

    test('原生元素子节点不包成函数', () => {
        expect(run('<div>{a}</div>')).toBe('<div>{a}</div>');
    });

    test('已经包过的子节点不会被重复包装', () => {
        const code = '<Comp>{() => [a]}</Comp>';
        expect(run(code)).toBe(code);
    });

    test('多处改写按 span 精确应用', () => {
        const result = run('<div v-html={h} title="v-model={x}"><span v-text={t} /></div>');
        expect(result).toContain('<div innerHTML={h} title="v-model={x}">');
        expect(result).toContain('<span textContent={t} />');
    });
});
