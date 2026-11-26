import { parseSync, Visitor } from 'rolldown/utils';

type CondKind = 'if' | 'elseif' | 'else';

interface CondAttr {
    kind: CondKind;
    start: number;
    end: number;
    value: string;
}

interface Edit {
    start: number;
    end: number;
    text: string;
}

const whitespaceOnly = (node: any, code: string) =>
    node?.type === 'JSXText' && !code.slice(node.start, node.end).trim();

/** 从元素上取出 v-if / v-else-if / v-else 属性。 */
function condAttrs(code: string, element: any): CondAttr[] {
    const result: CondAttr[] = [];
    for (const attr of element.openingElement?.attributes || []) {
        if (attr.type !== 'JSXAttribute') continue;
        const name = code.slice(attr.name.start, attr.name.end);
        const kind: CondKind | null =
            name === 'v-if' ? 'if' : name === 'v-else-if' ? 'elseif' : name === 'v-else' ? 'else' : null;
        if (!kind) continue;
        const expression = attr.value?.expression;
        result.push({
            kind,
            start: attr.start,
            end: attr.end,
            value: expression ? code.slice(expression.start, expression.end) : '',
        });
    }
    return result;
}

/** 生成去掉条件属性后的元素文本。 */
function stripAttr(code: string, element: any, attr: CondAttr): string {
    const text = code.slice(element.start, element.end);
    let start = attr.start - element.start;
    let end = attr.end - element.start;
    while (start > 0 && /\s/.test(text[start - 1])) start--;
    while (end < text.length && /\s/.test(text[end])) end++;
    return text.slice(0, start) + text.slice(end);
}

function buildBranch(code: string, element: any, attr: CondAttr): string {
    const text = stripAttr(code, element, attr);
    return attr.kind === 'else' ? text : `${attr.value} ? ${text} : null`;
}

/**
 * 把 JSX 里的 v-if / v-else-if / v-else 编译成条件表达式。
 *
 * 官方 Babel JSX 插件不提供 v-if，这里按模板语义实现：相邻兄弟节点组成一条分支链，
 * 链整体替换成一个条件表达式；不在子节点位置的单个 v-if 直接替换成表达式。
 */
export function transformConditionalJSX(code: string): string {
    let current = code;
    for (let guard = 0; guard < 200; guard++) {
        const result = parseSync('x.tsx', current, { lang: 'tsx' });
        if (result.errors.length) break;
        const edits: Edit[] = [];

        const addChain = (children: any[], inChildren: boolean) => {
            const used = new Set<any>();
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (child.type !== 'JSXElement' || used.has(child)) continue;
                const first = condAttrs(current, child).find((a) => a.kind === 'if');
                if (!first) continue;
                const chain: { element: any; attr: CondAttr }[] = [{ element: child, attr: first }];
                used.add(child);
                for (let j = i + 1; j < children.length; j++) {
                    const next = children[j];
                    if (whitespaceOnly(next, current)) continue;
                    if (next.type !== 'JSXElement') break;
                    const branch = condAttrs(current, next).find((a) => a.kind === 'elseif' || a.kind === 'else');
                    if (!branch || used.has(next)) break;
                    chain.push({ element: next, attr: branch });
                    used.add(next);
                    if (branch.kind === 'else') break;
                }
                let expression = buildBranch(current, chain[chain.length - 1].element, chain[chain.length - 1].attr);
                for (let k = chain.length - 2; k >= 0; k--) {
                    const { element, attr } = chain[k];
                    expression = `${attr.value} ? ${stripAttr(current, element, attr)} : ${expression}`;
                }
                const start = child.start;
                const end = chain[chain.length - 1].element.end;
                edits.push({ start, end, text: inChildren ? `{${expression}}` : expression });
            }
        };

        const visitor = new Visitor({
            JSXElement(node: any) {
                if (node.children?.length) addChain(node.children, true);
            },
            JSXFragment(node: any) {
                if (node.children?.length) addChain(node.children, true);
            },
        });
        visitor.visit(result.program);

        // 未参与兄弟链的单个 v-if（如 return 位置的 JSX）也需要转换。
        const chained = new Set(edits.map((e) => e.start));
        const singles = new Visitor({
            JSXElement(node: any) {
                if (chained.has(node.start)) return;
                const attr = condAttrs(current, node).find((a) => a.kind === 'if');
                if (!attr) return;
                edits.push({ start: node.start, end: node.end, text: buildBranch(current, node, attr) });
            },
        });
        singles.visit(result.program);

        if (!edits.length) break;
        // 只应用最内层编辑，外层在下一次解析后重新计算，避免 span 重叠。
        const innermost = edits.filter(
            (e) => !edits.some((other) => other !== e && e.start > other.start && e.end < other.end),
        );
        let next = current;
        for (const edit of innermost.sort((a, b) => b.start - a.start)) {
            next = next.slice(0, edit.start) + edit.text + next.slice(edit.end);
        }
        current = next;
    }
    return current;
}
