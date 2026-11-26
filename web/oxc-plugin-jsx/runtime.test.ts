import { describe, expect, test } from 'bun:test';
import { Fragment, KeepAlive } from 'vue';
import { createVNode, isSlot, jsx } from './runtime';

const Comp = { name: 'TestComp', setup: () => () => null };

describe('isSlot', () => {
    test('函数与普通对象是插槽', () => {
        expect(isSlot(() => 1)).toBe(true);
        expect(isSlot({ default: () => 1 })).toBe(true);
    });

    test('字符串与 VNode 不是插槽', () => {
        expect(isSlot('text')).toBe(false);
        expect(isSlot(jsx('div', { children: 'x' }))).toBe(false);
    });
});

describe('createVNode', () => {
    test('v-slots 作为插槽传入且不泄漏到 props', () => {
        const footer = () => 'f';
        const vnode = createVNode(Comp, { class: 'box', 'v-slots': { footer } }, undefined);
        expect(vnode.props).toEqual({ class: 'box' });
        expect((vnode.children as Record<string, () => unknown>).footer()).toEqual(['f']);
    });

    test('v-slots 与普通子节点合并到 default 插槽', () => {
        const vnode = createVNode(Comp, { 'v-slots': { footer: () => 'f' } }, ['row']);
        const children = vnode.children as Record<string, () => unknown>;
        expect(children.default()).toEqual(['row']);
        expect(children.footer()).toEqual(['f']);
    });

    test('v-show 转成指令且不会作为 prop 下发', () => {
        const vnode = createVNode(Comp, { 'v-show': false }, undefined);
        expect(vnode.props).toEqual({});
        expect((vnode as any).props?.['v-show']).toBeUndefined();
    });

    test('v-model 系列不会被当成自定义指令', () => {
        const warnings: string[] = [];
        const original = console.warn;
        console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(' '));
        try {
            createVNode(Comp, { 'v-model': false, 'v-model:title': 'x', 'v-models': [] }, undefined);
        } finally {
            console.warn = original;
        }
        expect(warnings).toEqual([]);
    });

    test('transformOn 风格的对象事件被展开', () => {
        const onClick = () => 1;
        const vnode = createVNode(Comp, { on: { click: onClick } }, undefined);
        expect(vnode.props).toEqual({ onClick });
    });

    test('KeepAlive 使用数组子节点，避免 Transition 克隆后 slots 为空崩溃', () => {
        const vnode = createVNode(KeepAlive, { include: [] }, 'child');
        expect(Array.isArray(vnode.children)).toBe(true);
        expect(vnode.children).toEqual(['child']);
    });

    test('Fragment 子节点过滤条件分支的空值', () => {
        const vnode = createVNode(Fragment, null, ['a', null, 'b', undefined, false]);
        expect(vnode.children).toEqual(['a', 'b']);
    });

    test('jsx 入口透传 key', () => {
        const vnode = jsx(Comp, { class: 'x', children: 'hi' }, 'k');
        expect((vnode as any).key).toBe('k');
        expect((vnode.children as Record<string, () => unknown>).default()).toEqual(['hi']);
    });
});
