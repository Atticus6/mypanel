import { parseSync, Visitor } from 'rolldown/utils';
import type { ResolvedOptions } from './options';

/** 属性级改写（v-model / v-html / v-text / xlink），替换属性自身。 */
interface AttrEdit {
    kind: 'attr';
    start: number;
    end: number;
    text: string;
}

/**
 * 子节点惰性插槽改写，替换开标签与闭标签之间的区域。
 *
 * 保留子节点 AST 而不是直接拼好字符串：子节点里可能还有 v-model 等待改写的属性，
 * 只有真正渲染这一层时才知道内层改写的最终文本。
 */
interface SlotEdit {
    kind: 'slot';
    start: number;
    end: number;
    children: any[];
}

type Edit = AttrEdit | SlotEdit;

interface AttributeInfo {
    name: string;
    start: number;
    end: number;
    valueStart: number;
    valueEnd: number;
    expressionNode: any;
}

interface ElementInfo {
    tag: string;
    openEnd: number;
    closeStart: number;
    children: any[];
}

/** 收集组件标签的子节点位置，用于编译期生成惰性插槽函数。 */
function collectElements(code: string): ElementInfo[] {
    const result = parseSync('vue-jsx.tsx', code, { lang: 'tsx' });
    if (result.errors.length) return [];
    const elements: ElementInfo[] = [];
    const visitor = new Visitor({
        JSXElement(node) {
            elements.push({
                tag: code.slice(node.openingElement.name.start, node.openingElement.name.end),
                openEnd: node.openingElement.end,
                closeStart: node.closingElement?.start ?? -1,
                children: node.children,
            });
        },
    });
    visitor.visit(result.program);
    return elements;
}

/** 仅 v-model 系列需要在编译期保留左值，其余 Vue 特性交给运行时处理。 */
const modelAttribute = /^v-model(?::([^\s.]+))?(\.[^\s]+)?$/;
const xlinkAttribute = /^xlink([A-Z])(.*)$/;

/** 从源码里取出 JSX 属性的名字与表达式范围。 */
function collectAttributes(code: string): AttributeInfo[] {
    const result = parseSync('vue-jsx.tsx', code, { lang: 'tsx' });
    if (result.errors.length) return [];

    const attributes: AttributeInfo[] = [];
    const visitor = new Visitor({
        JSXAttribute(node) {
            const name = code.slice(node.name.start, node.name.end);
            const value = node.value;
            const expression = value?.type === 'JSXExpressionContainer' ? value.expression : null;
            if (expression?.type === 'JSXEmptyExpression') return;
            attributes.push({
                name,
                start: node.start,
                end: node.end,
                valueStart: expression?.start ?? -1,
                valueEnd: expression?.end ?? -1,
                expressionNode: expression,
            });
        },
    });
    visitor.visit(result.program);
    return attributes;
}

/** 解析 v-model 的参数与修饰符。 */
function parseModelName(name: string): { arg: string; modifiers: string[] } {
    let rest = name.startsWith('v-model:') ? name.slice('v-model:'.length) : name.slice('v-model'.length);
    const modifiers: string[] = [];
    const underscore = rest.indexOf('_');
    if (underscore >= 0) {
        modifiers.push(
            ...rest
                .slice(underscore + 1)
                .split('_')
                .filter(Boolean),
        );
        rest = rest.slice(0, underscore);
    }
    const segments = rest.split('.').filter(Boolean);
    return { arg: segments[0] || 'modelValue', modifiers: [...modifiers, ...segments.slice(1)] };
}

/** 从 v-model 的值里取出左值、参数与修饰符（支持数组形式）。 */
function parseModelValue(attr: AttributeInfo, code: string): { expression: string; arg: string; modifiers: string[] } {
    const node = attr.expressionNode;
    let expression = code.slice(attr.valueStart, attr.valueEnd);
    const { arg, modifiers } = parseModelName(attr.name);

    if (node?.type === 'ArrayExpression' && node.elements?.length) {
        expression = code.slice(node.elements[0].start, node.elements[0].end);
        const second = node.elements[1];
        if (second) {
            if (second.type === 'ArrayExpression') {
                return {
                    expression,
                    arg,
                    modifiers: second.elements.map((m: any) => String(m.value)),
                };
            }
            const arrayArg = second.type === 'Literal' ? String(second.value) : code.slice(second.start, second.end);
            const third = node.elements[2];
            return {
                expression,
                arg: arrayArg,
                modifiers: third?.elements?.map((m: any) => String(m.value)) || [],
            };
        }
    }
    return { expression, arg, modifiers };
}

/** 生成 v-model 对应的 value / update 两个属性。 */
function rewriteModel(attr: AttributeInfo, code: string): string {
    const { expression, arg, modifiers } = parseModelValue(attr, code);
    const isDynamic = arg.startsWith('[') && arg.endsWith(']');

    if (isDynamic) {
        const name = arg.slice(1, -1);
        return `{...{ [${name}]: ${expression}, ['onUpdate:' + ${name}]: $event => { ${expression} = $event } }}`;
    }
    const parts = [`${arg}={${expression}}`, `onUpdate:${arg}={$event => { ${expression} = $event }}`];
    if (modifiers.length) {
        parts.push(`${arg}Modifiers={{${modifiers.map((m) => `${JSON.stringify(m)}: true`).join(', ')}}}`);
    }
    return parts.join(' ');
}

/** 生成 v-models 多绑定属性，保留每个绑定的左值表达式。 */
function rewriteModels(attr: AttributeInfo, code: string): string {
    const entries = attr.expressionNode.elements || [];
    const props: string[] = [];
    for (const entry of entries) {
        const parts = entry.elements || [];
        if (!parts.length) continue;
        const expression = code.slice(parts[0].start, parts[0].end);
        const argNode = parts[1];
        let arg = 'modelValue';
        if (argNode) {
            arg = argNode.type === 'Literal' ? String(argNode.value) : code.slice(argNode.start, argNode.end);
        }
        const isDynamic = arg.startsWith('[') && arg.endsWith(']');
        const name = isDynamic ? arg.slice(1, -1) : arg;
        const key = isDynamic ? `[${name}]` : JSON.stringify(name);
        const updateKey = isDynamic ? `['onUpdate:' + ${name}]` : JSON.stringify(`onUpdate:${name}`);
        props.push(`${key}: ${expression}`, `${updateKey}: $event => { ${expression} = $event }`);

        const modifiers = parts[2]?.elements || [];
        if (modifiers.length) {
            const modifierKey = isDynamic ? `[${name} + 'Modifiers']` : JSON.stringify(`${name}Modifiers`);
            const values = modifiers.map((m: any) => `${JSON.stringify(String(m.value))}: true`).join(', ');
            props.push(`${modifierKey}: {${values}}`);
        }
    }
    return `{...{${props.join(', ')}}}`;
}

/** 判断 span 是否被另一个 span 严格包含（相等不算）。 */
function isInside(outer: Edit, inner: Edit): boolean {
    return outer.start <= inner.start && outer.end >= inner.end && (outer.start < inner.start || outer.end > inner.end);
}

/** 渲染一段源码，并应用完全落在该范围内的改写。 */
function renderRange(code: string, start: number, end: number, edits: Edit[], skip?: Edit): string {
    // skip 是当前正在渲染的插槽改写自身：它与唯一子节点的 span 可能完全重合，
    // 不排除就会在 renderRange -> renderChildren 之间无限递归。
    const contained = edits.filter((edit) => edit !== skip && edit.start >= start && edit.end <= end);
    if (!contained.length) return code.slice(start, end);
    // 只在这一层应用最外层的改写，被包含的内层改写交给递归处理。
    // 之前把所有改写平铺后丢弃「被包含的」，会让插槽内的 v-model 直接丢失。
    const outermost = contained
        .filter((edit) => !contained.some((other) => other !== edit && isInside(other, edit)))
        .sort((a, b) => a.start - b.start);

    let result = '';
    let cursor = start;
    for (const edit of outermost) {
        result += code.slice(cursor, edit.start);
        result += edit.kind === 'attr' ? edit.text : `{() => [${renderChildren(code, edit.children, edits, edit)}]}`;
        cursor = edit.end;
    }
    return result + code.slice(cursor, end);
}

/** 渲染惰性插槽的子节点，保持原有「表达式原样、文本转字符串」的规则。 */
function renderChildren(code: string, children: any[], edits: Edit[], skip?: Edit): string {
    const parts: string[] = [];
    for (const child of children) {
        if (child.type === 'JSXExpressionContainer') {
            const expression = child.expression;
            if (!expression || expression.type === 'JSXEmptyExpression') continue;
            parts.push(renderRange(code, expression.start, expression.end, edits, skip));
            continue;
        }
        if (child.type === 'JSXText') {
            const text = child.value.trim();
            if (text) parts.push(JSON.stringify(text));
            continue;
        }
        parts.push(renderRange(code, child.start, child.end, edits, skip));
    }
    return parts.join(', ');
}

/**
 * 把 Babel 插件的 Vue 专有 JSX 语法改写成标准 JSX。
 * 属性重命名基于 oxc 解析器给出的 span，避免正则误伤字符串内容。
 */
export function transformVueJSX(code: string, options: ResolvedOptions): string {
    const edits: Edit[] = [];

    for (const attr of collectAttributes(code)) {
        if (attr.name === 'v-models') {
            edits.push({ kind: 'attr', start: attr.start, end: attr.end, text: rewriteModels(attr, code) });
            continue;
        }
        if (modelAttribute.test(attr.name)) {
            edits.push({ kind: 'attr', start: attr.start, end: attr.end, text: rewriteModel(attr, code) });
            continue;
        }
        if (attr.name === 'v-html' || attr.name === 'v-text') {
            const replacement = attr.name === 'v-html' ? 'innerHTML' : 'textContent';
            edits.push({
                kind: 'attr',
                start: attr.start,
                end: attr.start + attr.name.length,
                text: replacement,
            });
            continue;
        }
        const xlink = xlinkAttribute.exec(attr.name);
        if (xlink) {
            edits.push({
                kind: 'attr',
                start: attr.start,
                end: attr.start + attr.name.length,
                text: `xlink:${xlink[1].toLowerCase()}${xlink[2]}`,
            });
            continue;
        }
    }

    // Babel 插件会把组件子节点包进 `() => [...]` 惰性插槽；oxc 默认把 children 放在 props 里
    // 立即求值，会让「未打开抽屉里的组件」在父组件渲染时就抛错，这里在编译期补上这一层。
    for (const element of collectElements(code)) {
        if (element.closeStart < 0 || !element.children.length) continue;
        if (!/^[A-Z]/.test(element.tag) && !element.tag.includes('.')) continue;
        const onlyChild = element.children[0];
        if (
            element.children.length === 1 &&
            onlyChild.type === 'JSXExpressionContainer' &&
            onlyChild.expression?.type === 'ArrowFunctionExpression'
        ) {
            continue;
        }
        edits.push({ kind: 'slot', start: element.openEnd, end: element.closeStart, children: element.children });
    }

    if (!edits.length) return code;
    void options;
    return renderRange(code, 0, code.length, edits);
}
