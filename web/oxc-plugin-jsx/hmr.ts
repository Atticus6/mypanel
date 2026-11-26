import { createHash } from 'node:crypto';

interface HotComponent {
    local: string;
    exported: string;
    id: string;
}

const getHash = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 8);

/** 从标识符后扫描到调用括号，支持嵌套的泛型参数。 */
function findCallStart(code: string, nameEnd: number): number {
    let i = nameEnd;
    while (i < code.length && /\s/.test(code[i])) i++;
    if (code[i] !== '<') return code[i] === '(' ? i + 1 : -1;

    let depth = 0;
    while (i < code.length) {
        if (code[i] === '<') depth++;
        else if (code[i] === '>') {
            depth--;
            if (depth === 0) {
                i++;
                break;
            }
        }
        i++;
    }
    while (i < code.length && /\s/.test(code[i])) i++;
    return code[i] === '(' ? i + 1 : -1;
}

/** 在源码里找到 `export default defineComponent` 的调用位置。 */
function findDefaultCall(
    code: string,
    name: string,
): { exportAt: number; nameStart: number; callStart: number } | null {
    const marker = 'export default';
    let from = 0;
    while (from < code.length) {
        const exportAt = code.indexOf(marker, from);
        if (exportAt < 0) return null;
        let i = exportAt + marker.length;
        while (i < code.length && /\s/.test(code[i])) i++;
        if (code.startsWith(name, i)) {
            const callStart = findCallStart(code, i + name.length);
            if (callStart > 0) return { exportAt, nameStart: i, callStart };
        }
        from = exportAt + marker.length;
    }
    return null;
}

/**
 * 与 @vitejs/plugin-vue-jsx 一致：开发模式下把 defineComponent 组件注册到
 * __VUE_HMR_RUNTIME__，并通过 import.meta.hot.accept 实现组件级热更新。
 */
export function injectHmr(code: string, filename: string, defineComponentName = 'defineComponent'): string {
    const components: HotComponent[] = [];
    let result = code;

    const defaultCall = findDefaultCall(result, defineComponentName);
    const hasDefaultCall = Boolean(defaultCall);
    if (defaultCall) {
        result = result.slice(0, defaultCall.exportAt) + 'const __default__ = ' + result.slice(defaultCall.nameStart);
        components.push({ local: '__default__', exported: 'default', id: getHash(filename + 'default') });
    } else {
        const defaultIdentifier = new RegExp(`export\\s+default\\s+([A-Za-z_$][\\w$]*)\\s*;?\\s*(?:\\r?\\n|$)`, 'g');
        for (const match of result.matchAll(defaultIdentifier)) {
            components.push({
                local: match[1],
                exported: 'default',
                id: getHash(filename + 'default'),
            });
        }
    }

    const namedCall = new RegExp(
        `(?:export\\s+)?const\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(?:[^=;]*?\\s+as\\s+[\\w<>]+,\\s*)?${defineComponentName}(?=\\s*(?:<|\\())`,
        'g',
    );
    for (const match of result.matchAll(namedCall)) {
        if (match[1] === '__default__') continue;
        const callStart = findCallStart(result, match.index + match[0].length);
        if (callStart < 0) continue;
        components.push({
            local: match[1],
            exported: match[1],
            id: getHash(filename + match[1]),
        });
    }

    // 替换产生的 const __default__ 不能被当成第二个组件重复注册。
    const unique = new Map(components.map((c) => [c.local, c]));
    if (!unique.size) return code;
    const hotComponents = [...unique.values()];

    for (const component of hotComponents) {
        result += `\n${component.local}.__hmrId = "${component.id}"`;
        result += `\n__VUE_HMR_RUNTIME__.createRecord("${component.id}", ${component.local})`;
    }

    const accepted = hotComponents.map((c) => `${c.exported}: __${c.exported}`).join(', ');
    const reloads = hotComponents.map((c) => `__VUE_HMR_RUNTIME__.reload("${c.id}", __${c.exported})`).join('\n');
    result += `\nimport.meta.hot.accept(({ ${accepted} }) => { ${reloads}\n})`;
    if (hasDefaultCall) {
        result += '\nexport default __default__;';
    }
    return result;
}
