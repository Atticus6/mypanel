/* codemod：把 Vue 模板 AST 生成 TSX（JSX）代码。 */

import { readFileSync } from 'node:fs';
import * as icons from '@element-plus/icons-vue';
import type { ScriptInfo } from './codemod-types';

interface GenContext {
    info: ScriptInfo;
    /** 顶层组件是否需要 ctx（具名插槽 / expose）。 */
    slotNames: Set<string>;
}

const DIR = {
    permission: "import permissionDirective from '@/directives/modules/permission';",
    nodeAdmin: "import { nodeAdminDirective } from '@/directives/modules/permission';",
    integer: "import integerInputDirective from '@/directives/modules/integer';",
    loading: "import { vLoading } from 'element-plus';",
    clickOutside: "import { ClickOutside } from 'element-plus';",
};

/** 记录生成过程中需要补充的指令 import。 */
export const directiveImports = new Set<string>();

/** 记录生成过程中需要补充的工具函数 import。 */
export const helperImports = new Set<string>();

/** 记录需要显式从 element-plus 导入的组件（不再用 el-xxx 字符串标签）。 */
export const elementPlusImports = new Set<string>();

/** 记录其它需要显式导入的组件（项目组件、Router、第三方组件等）。 */
export const componentImports = new Set<string>();

/** 从 components.d.ts 读取全局组件到 import 路径的映射。 */
function loadGlobalComponentMap(): Map<string, string> {
    const map = new Map<string, string>();
    try {
        const source = readFileSync('components.d.ts', 'utf8');
        for (const line of source.split('\n')) {
            const m = line.match(/^\s*([\w$]+):\s*typeof import\('([^']+)'\)/);
            if (!m) continue;
            const [, name, path] = m;
            if (name === 'default') continue;
            const importPath = path === 'element-plus/es' ? 'element-plus' : path.replace(/^\.\/src\//, '@/');
            map.set(name, line.includes("['default']") ? `default:${importPath}` : importPath);
        }
    } catch {
        //  components.d.ts 尚未生成时只依赖显式 import。
    }
    // 无声明但模板中常见的组件。
    map.set('I18nT', 'vue-i18n');
    map.set('VueOfficeDocx', '@vue-office/docx');
    map.set('VueOfficeExcel', '@vue-office/excel');
    map.set('OpDialog', 'default:@/components/del-dialog/index.vue');
    map.set('LayoutContent', 'default:@/components/layout-content/index.vue');
    map.set('RouterButton', 'default:@/components/router-button/index.vue');
    map.set('ComplexTable', 'default:@/components/table/complex/ComplexTable.vue');
    map.set('CopyButton', 'default:@/components/copy-button/index.vue');
    map.set('MsgInfo', 'default:@/components/msg-info/index.vue');
    map.set('DrawerPro', 'default:@/components/drawer-pro/index.vue');
    map.set('DialogPro', 'default:@/components/dialog-pro/index.vue');
    map.set('TableRefresh', 'default:@/components/table/TableRefresh.vue');
    map.set('TableSearch', 'default:@/components/table/TableSearch.vue');
    map.set('TableSetting', 'default:@/components/table/TableSetting.vue');
    map.set('TableViewSwitch', 'default:@/components/table/TableViewSwitch.vue');
    map.set('FuTable', 'default:@/components/table/Table.vue');
    map.set('FuTableOperations', 'default:@/components/table/TableOperations.vue');
    map.set('FuTablePagination', 'default:@/components/table/TablePagination.vue');
    map.set('FuTableColumnSelect', 'default:@/components/table/TableColumnSelect.vue');
    // Element Plus 图标在 main.ts 里全局注册，TSX 需要显式导入。
    for (const name of Object.keys(icons)) if (!map.has(name)) map.set(name, 'vue-icon');
    return map;
}

const globalComponentMap = loadGlobalComponentMap();

/** 把短横线标签转成 PascalCase，并生成显式 import。 */
function resolveComponentTag(tag: string, imported: Set<string>): string {
    const pascal = tag.includes('-')
        ? tag
              .split('-')
              .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
              .join('')
        : tag.charAt(0).toUpperCase() + tag.slice(1);
    if (imported.has(pascal) || !/^[A-Z]/.test(pascal)) return tag;
    const mapped = globalComponentMap.get(pascal);
    if (!mapped) return tag;
    if (mapped === 'vue-icon') {
        componentImports.add(`import { ${pascal} } from '@element-plus/icons-vue';`);
        imported.add(pascal);
        return pascal;
    }
    const isDefault = mapped.startsWith('default:');
    const path = isDefault ? mapped.slice(8) : mapped;
    componentImports.add(isDefault ? `import ${pascal} from '${path}';` : `import { ${pascal} } from '${path}';`);
    imported.add(pascal);
    return pascal;
}

/** 原生 HTML/SVG 标签不需要组件导入。 */
const nativeTags = new Set([
    'a',
    'abbr',
    'article',
    'aside',
    'audio',
    'b',
    'body',
    'br',
    'button',
    'canvas',
    'caption',
    'code',
    'col',
    'colgroup',
    'dd',
    'details',
    'div',
    'dl',
    'dt',
    'em',
    'footer',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'head',
    'header',
    'hr',
    'html',
    'i',
    'iframe',
    'img',
    'input',
    'label',
    'li',
    'main',
    'nav',
    'ol',
    'option',
    'p',
    'pre',
    'section',
    'select',
    'small',
    'source',
    'span',
    'strong',
    'summary',
    'svg',
    'table',
    'tbody',
    'td',
    'textarea',
    'tfoot',
    'th',
    'thead',
    'tr',
    'u',
    'ul',
    'video',
]);

/** v-for / 作用域插槽的局部别名，不应被当作 prop 改写。 */
const localNames = new Set<string>();

const ROOT = 0;
const ELEMENT = 1;
const TEXT = 2;
const COMMENT = 3;
const INTERPOLATION = 5;
const ATTRIBUTE = 6;
const DIRECTIVE = 7;

/** 模板表达式改写：把已知 ref 标识符包一层 unref。 */
function rewriteExpr(expr: string, info: ScriptInfo): string {
    // 判断标识符是否落在字符串字面量里。
    const isInString = (offset: number) => {
        let quote = '';
        for (let i = 0; i < offset; i++) {
            const ch = expr[i];
            if (quote) {
                if (ch === '\\') i++;
                else if (ch === quote) quote = '';
            } else if (ch === "'" || ch === '"') quote = ch;
        }
        return !!quote;
    };
    expr = expr
        .replace(/\$emit\b/g, 'ctx.emit')
        .replace(/\$route\b/g, '__vueRoute')
        .replace(/\$attrs\b/g, 'ctx.attrs')
        .replace(/\$slots\b/g, 'ctx.slots')
        .replace(/\$props\b/g, 'props');
    return expr.replace(/\b([A-Za-z_$][\w$]*)\b/g, (match, _name, offset: number, full: string) => {
        const before = full[offset - 1];
        const after = full[offset + match.length];
        if (localNames.has(match)) return match;
        if (isInString(offset)) return match;
        // 对象字面量的简写键（{ foo }）不能改成 __props.foo，需展开成 foo: __props.foo。
        const stack: string[] = [];
        for (let i = 0; i < offset; i++) {
            const ch = full[i];
            if (ch === '(' || ch === '{' || ch === '[') stack.push(ch);
            else if (ch === ')' || ch === '}' || ch === ']') stack.pop();
        }
        const left = full.slice(0, offset).replace(/\s+$/, '');
        const right = full.slice(offset + match.length).replace(/^\s+/, '');
        if (stack[stack.length - 1] === '{' && /[{,]$/.test(left) && /^[,}]/.test(right)) {
            return info.propNames.has(match) ? `${match}: ${info.paramName}.${match}` : match;
        }
        // 箭头函数参数 (foo) => ... 不能改写。
        if (left.endsWith('(') && /^\)?\s*=>/.test(right)) return match;
        if (before === '.' || before === '?') return match;
        if (full.slice(offset + match.length).startsWith('.value')) return match;
        if (after === ':') return match;
        if (before === "'" || before === '"') return match;
        if (full.slice(Math.max(0, offset - 5), offset) === 'unref') return match;
        if (match === '$emit' || match === info.emitsVar) return 'ctx.emit';
        if (match === '$attrs') return 'ctx.attrs';
        if (match === info.propsVar) return info.paramName;
        // 局部变量（含 ref）会遮蔽同名 prop，先判断 refNames。
        if (info.refNames.has(match)) return `unref(${match})`;
        if (info.propNames.has(match)) return `${info.paramName}.${match}`;
        return match;
    });
}

/** 取得节点上指定名称的指令。 */
function getDirective(node: any, name: string): any | undefined {
    return node.props?.find((p: any) => p.type === DIRECTIVE && p.name === name);
}

/** 判断子元素是否为携带 v-slot 的 template。 */
function slotTemplate(node: any): { name: string; exp: string | undefined } | undefined {
    if (node.type !== ELEMENT || node.tag !== 'template') return undefined;
    const d = getDirective(node, 'slot');
    if (!d) return undefined;
    return { name: d.arg?.content ?? 'default', exp: d.exp?.content };
}

/** 生成事件处理器字符串，处理常见修饰符。 */
function eventHandler(exp: string, modifiers: string[], arg: string, info: ScriptInfo): string {
    let source = exp.replace(/\$emit\b/g, 'ctx.emit').replace(/\$attrs\b/g, 'ctx.attrs');
    for (const ref of info.refNames) {
        source = source
            .replace(new RegExp(`(?<![\\w.])\\b${ref}\\s*=\\s*(?!=)`, 'g'), `${ref}.value = `)
            .replace(new RegExp(`\\b${ref}\\.([A-Za-z_$][\\w$]*)\\s*=\\s*(?!=)`, 'g'), (_m, prop: string) =>
                prop === 'value' ? `${ref}.value = ` : `unref(${ref}).${prop} = `,
            );
    }
    source = rewriteExpr(source, info);
    const body: string[] = [];
    const evt = '$event';
    if (modifiers.includes('stop')) body.push(`${evt}.stopPropagation();`);
    if (modifiers.includes('prevent')) body.push(`${evt}.preventDefault();`);
    if (modifiers.includes('self')) body.push(`if (${evt}.target !== ${evt}.currentTarget) return;`);
    const keyMap: Record<string, string> = { enter: 'Enter', esc: 'Escape', tab: 'Tab', space: ' ' };
    const keys = modifiers.filter((m) => keyMap[m]);
    if (keys.length) {
        const checks = keys.map((k) => `${evt}.key === ${JSON.stringify(keyMap[k])}`).join(' || ');
        body.push(`if (!(${checks})) return;`);
    }
    if (/^(click|dblclick|mousedown|mouseup|keydown|keyup|submit|change|input)$/.test(arg) === false) {
        // 自定义事件保持原样透传
    }
    const call = source.trim();
    // 模板里 @click="fn" 表示调用；裸标识符需要补上参数列表。
    body.push(/^[A-Za-z_$][\w$.]*$/.test(call) ? `(${call} as any)($event);` : `${call};`);
    return `(${evt}?: any) => { ${body.join(' ')} }`;
}

/** 属性名转 JSX 事件名：click -> onClick、update:modelValue -> onUpdate:modelValue。 */
function eventName(arg: string): string {
    if (!arg) return 'onEvent';
    return `on${arg[0].toUpperCase()}${arg.slice(1)}`;
}

/** 生成 v-for 的迭代表达式。 */
function forHeader(exp: string, info: ScriptInfo): { head: string; aliases: string[] } {
    const m = exp.match(/^\s*(?:\(([^)]+)\)|([A-Za-z_$][\w$]*))\s+(?:in|of)\s+(.+)$/s);
    if (!m) return { head: '[]', aliases: [] };
    const aliases = m[1] ? m[1].split(',').map((s) => s.trim()) : [m[2]];
    for (const alias of aliases) if (/^[A-Za-z_$][\w$]*$/.test(alias)) localNames.add(alias);
    const list = rewriteExpr(m[3].trim(), info);
    // 模板 v-for 对 undefined 会渲染空列表，JSX 的 map 需要显式兜底。
    return { head: `(${list} || [])`, aliases };
}

/** 生成子节点列表；同时把具名 template 槽抽成 v-slots 对象。 */
function genChildren(children: any[] | undefined, ctx: GenContext): { jsx: string[]; slots: string[] } {
    if (!children) return { jsx: [], slots: [] };
    const jsx: string[] = [];
    const slots: string[] = [];
    let i = 0;
    while (i < children.length) {
        const node = children[i];
        if (node.type === TEXT) {
            const text = node.content as string;
            if (text.trim()) jsx.push(`{${JSON.stringify(text)}}`);
            i++;
            continue;
        }
        if (node.type === INTERPOLATION) {
            jsx.push(`{${rewriteExpr(node.content?.content ?? '', ctx.info)}}`);
            i++;
            continue;
        }
        if (node.type === COMMENT) {
            i++;
            continue;
        }
        if (node.type === ELEMENT) {
            const slot = slotTemplate(node);
            if (slot) {
                if (slot.exp) {
                    for (const part of slot.exp.replace(/[{}]/g, '').split(',')) {
                        const name = part.split(':').pop()?.split('=')[0].trim();
                        if (name && /^[A-Za-z_$][\w$]*$/.test(name)) localNames.add(name);
                    }
                }
                const inner = genChildren(node.children, ctx);
                const params = slot.exp ? `(${slot.exp})` : '()';
                slots.push(`${JSON.stringify(slot.name)}: ${params} => <>${inner.jsx.join('')}</>`);
                i++;
                continue;
            }
            const ifDir = getDirective(node, 'if');
            if (ifDir) {
                const branches: string[] = [];
                const cond = rewriteExpr(ifDir.exp?.content ?? '', ctx.info);
                branches.push(`(${cond}) ? ${genElement(node, ctx, true)} : `);
                let j = i + 1;
                // 跳过纯空白文本节点，寻找 else-if / else。
                while (j < children.length && children[j].type === TEXT && !children[j].content?.trim()) j++;
                let chain = '';
                while (j < children.length) {
                    const next = children[j];
                    if (next.type === TEXT && !next.content?.trim()) {
                        j++;
                        continue;
                    }
                    const elseif = next.type === ELEMENT ? getDirective(next, 'else-if') : undefined;
                    const elseDir = next.type === ELEMENT ? getDirective(next, 'else') : undefined;
                    if (elseif) {
                        const c = rewriteExpr(elseif.exp?.content ?? '', ctx.info);
                        chain += `(${c}) ? ${genElement(next, ctx, true)} : `;
                        j++;
                        continue;
                    }
                    if (elseDir) {
                        chain += genElement(next, ctx, true);
                        j++;
                        break;
                    }
                    break;
                }
                branches.push(/:\s*$/.test(chain) ? chain + 'null' : chain || 'null');
                jsx.push(`{${branches.join('')}}`);
                i = j;
                continue;
            }
            if (getDirective(node, 'else') || getDirective(node, 'else-if')) {
                i++;
                continue;
            }
            const generated = genElement(node, ctx);
            // 只有非 JSX 表达式（指令 / map / 插槽）需要包一层大括号。
            jsx.push(/^</.test(generated) ? generated : `{${generated}}`);
            i++;
            continue;
        }
        i++;
    }
    return { jsx, slots };
}

/** 生成单个元素（含指令）的 JSX。 */
function genElement(node: any, ctx: GenContext, skipIf = false): string {
    let tag: string = node.tag;
    // Element Plus 组件统一改为从 element-plus 显式导入的 PascalCase 组件。
    if (tag.startsWith('el-')) {
        const component =
            'El' +
            tag
                .slice(3)
                .split('-')
                .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                .join('');
        elementPlusImports.add(`import { ${component} } from 'element-plus';`);
        tag = component;
    }
    // 其余非原生标签统一转成 PascalCase，并补上显式 import。
    else if (!nativeTags.has(tag)) {
        tag = resolveComponentTag(tag, ctx.info.componentImports);
    }
    const props: string[] = [];
    const directives: string[] = [];
    let keyAttr = '';
    let staticClass = '';
    let dynamicClass = '';
    let staticStyle = '';
    let dynamicStyle = '';

    // v-for 放在最外层，先生成元素本体。
    const forDir = getDirective(node, 'for');
    let forHead = '';
    let aliases: string[] = [];
    if (forDir) {
        const parsed = forHeader(forDir.exp?.content ?? '', ctx.info);
        forHead = parsed.head;
        aliases = parsed.aliases;
    }

    for (const p of node.props ?? []) {
        if (p.type === ATTRIBUTE) {
            if (p.name === 'key') continue;
            const value = p.value?.content ?? '';
            if (p.name === 'class') staticClass = JSON.stringify(value);
            else if (p.name === 'style') staticStyle = JSON.stringify(value);
            else if (p.name === 'ref' && ctx.info.refNames.has(value)) props.push(`ref={${value}}`);
            else if (value === '') props.push(p.name);
            else props.push(`${p.name}="${value.replace(/"/g, '&quot;')}"`);
            continue;
        }
        if (p.type !== DIRECTIVE) continue;
        const name = p.name;
        const arg = p.arg?.content;
        const exp: string = p.exp?.content ?? '';
        const modifiers: string[] = (p.modifiers ?? []).map((m: any) => m.content);

        if (name === 'if' || name === 'else' || name === 'else-if' || name === 'for' || name === 'slot') continue;
        if (name === 'bind') {
            if (!arg) {
                props.push(`{...${rewriteExpr(exp, ctx.info)}}`);
            } else if (arg === 'key') {
                keyAttr = `key={${rewriteExpr(exp, ctx.info)}}`;
            } else if (arg === 'class') {
                dynamicClass = rewriteExpr(exp, ctx.info);
            } else if (arg === 'style') {
                dynamicStyle = rewriteExpr(exp, ctx.info);
            } else {
                props.push(`${arg}={${rewriteExpr(exp, ctx.info)}}`);
            }
            continue;
        }
        if (name === 'on') {
            props.push(`${eventName(arg)}={${eventHandler(exp, modifiers, arg, ctx.info)}}`);
            continue;
        }
        if (name === 'model') {
            const target = exp.trim();
            const isRef = ctx.info.refNames.has(target);
            const modelProp = arg || 'modelValue';
            const updateEvent = `onUpdate:${modelProp}`;
            let read = isRef ? `unref(${target})` : rewriteExpr(target, ctx.info);
            const lhs = isRef ? `${target}.value` : rewriteExpr(target, ctx.info);
            let write = `${lhs} = $v as any`;
            if (modifiers.includes('number')) write = `${lhs} = $v === '' ? $v : Number($v)`;
            if (modifiers.includes('trim')) write = `${lhs} = typeof $v === 'string' ? $v.trim() : $v`;
            props.push(`${modelProp}={${read}}`);
            props.push(`${updateEvent}={$v => { ${write} }}`);
            continue;
        }
        if (name === 'show') {
            dynamicStyle = `[(${dynamicStyle || '{}'}), { display: (${rewriteExpr(exp, ctx.info)}) ? '' : 'none' }]`;
            continue;
        }
        if (name === 'html') {
            props.push(`innerHTML={${rewriteExpr(exp, ctx.info)}}`);
            continue;
        }
        if (name === 'text') {
            props.push(`textContent={${rewriteExpr(exp, ctx.info)}}`);
            continue;
        }
        if (name === 'pre' || name === 'once' || name === 'cloak') continue;

        // 自定义指令：permission / node-admin / loading / integer-input / click-outside。
        const directiveMap: Record<string, { expr: string; importLine: string }> = {
            permission: { expr: 'permissionDirective', importLine: DIR.permission },
            'node-admin': { expr: 'nodeAdminDirective', importLine: DIR.nodeAdmin },
            'integer-input': { expr: 'integerInputDirective', importLine: DIR.integer },
            loading: { expr: 'vLoading', importLine: DIR.loading },
            'click-outside': { expr: 'ClickOutside', importLine: DIR.clickOutside },
        };
        const mapped = directiveMap[name];
        if (mapped) {
            directiveImports.add(mapped.importLine);
            const value = exp ? rewriteExpr(exp, ctx.info) : 'true';
            directives.push(`[${mapped.expr}, ${value}]`);
        }
    }

    // 静态与动态 class / style 合并成单一属性，避免 JSX 重复属性报错。
    if (staticClass && dynamicClass) {
        helperImports.add("import { cn } from '@/utils/cn';");
        props.push(`class={cn(${staticClass}, ${dynamicClass})}`);
    } else if (staticClass) props.push(`class={${staticClass}}`);
    else if (dynamicClass) props.push(`class={${dynamicClass}}`);
    if (staticStyle && dynamicStyle) props.push(`style={[${staticStyle}, ${dynamicStyle}]}`);
    else if (staticStyle) props.push(`style={${staticStyle}}`);
    else if (dynamicStyle) props.push(`style={${dynamicStyle}}`);

    // 同一属性可能由 v-model 与 v-on 同时生成（如 onUpdate:size），保留第一个。
    const seenAttrs = new Set<string>();
    const uniqueProps = props.filter((p) => {
        const key = p.split(/[=\s]/)[0];
        if (seenAttrs.has(key)) return false;
        seenAttrs.add(key);
        return true;
    });
    props.length = 0;
    props.push(...uniqueProps);

    const inner = genChildren(node.children, ctx);
    const ownSlot = getDirective(node, 'slot');
    const slotProps = ownSlot
        ? ` v-slots={{ default: (${ownSlot.exp?.content || '()'}) => <>${inner.jsx.join('')}</> }}`
        : inner.slots.length
          ? ` v-slots={{ ${inner.slots.join(', ')} }}`
          : '';
    let jsxTag = `<${tag}${props.length ? ' ' + props.join(' ') : ''}${keyAttr ? ' ' + keyAttr : ''}${slotProps}>`;
    if (tag === 'slot') {
        const slotName = props.find((p) => p.startsWith('name='))?.match(/name="([^"]*)"/)?.[1] ?? 'default';
        const slotBindings = inner.slots.length ? `{ ${inner.slots.join(', ')} }` : 'undefined';
        ctx.slotNames.add(slotName);
        const fallback = inner.jsx.length ? ` ?? <>${inner.jsx.join('')}</>` : '';
        return `ctx.slots[${JSON.stringify(slotName)}]?.(${slotBindings})${fallback}`;
    }
    // template 无 v-slot 时表示 Fragment，直接输出子内容。
    if (tag === 'template' && !slotTemplate(node)) {
        const fragChildren = inner.jsx.join('');
        let frag = `<>${fragChildren}</>`;
        if (directives.length) frag = `withDirectives(${frag}, [${directives.join(', ')}])`;
        if (forDir) {
            frag = `(${forHead}).map((${aliases.join(', ') || 'item'}) => ${frag})`;
        }
        return frag;
    }
    const children = ownSlot ? '' : inner.jsx.join('');
    const jsx = children ? `${jsxTag}${children}</${tag}>` : `${jsxTag.slice(0, -1)} />`;
    let out = jsx;
    if (directives.length) out = `withDirectives(${jsx}, [${directives.join(', ')}])`;

    if (forDir) {
        const alias = aliases[0] || 'item';
        const indexAlias = aliases[1] || 'index';
        out = `(${forHead}).map((${aliases.join(', ') || 'item'}) => ${out})`;
        void alias;
        void indexAlias;
    }
    if (!skipIf && getDirective(node, 'if')) {
        // if 分支已在 genChildren 中处理；此处仅兜底。
    }
    return out;
}

/** 生成整棵模板的 JSX 片段数组。 */
export function genTemplate(ast: any, info: ScriptInfo): { jsx: string[]; slotNames: Set<string> } {
    localNames.clear();
    const ctx: GenContext = { info, slotNames: new Set() };
    const result = genChildren(ast.children, ctx);
    return { jsx: result.jsx, slotNames: ctx.slotNames };
}
