/* codemod：<script setup> → defineComponent 的 setup 函数体与组件选项。 */

import ts from 'typescript';
import type { PropInfo, ScriptInfo } from './codemod-types';

/** 取调用表达式的函数名（仅识别直接标识符调用）。 */
function callName(expr: ts.Expression): string | undefined {
    if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) return expr.expression.text;
    return undefined;
}

/** 把 TS 类型文本映射为运行时 prop 的构造器文本。 */
function runtimeTypeFromTs(tsType: string): string {
    const t = tsType.trim();
    if (/^string$/.test(t)) return 'String';
    if (/^number$/.test(t)) return 'Number';
    if (/^boolean$/.test(t)) return 'Boolean';
    if (/^Function$|=>/.test(t)) return 'Function';
    if (/\[\]$|^Array|^ReadonlyArray/.test(t)) return 'Array';
    if (/Record<|\{/.test(t)) return 'Object';
    return 'null';
}

/** 把运行时 type 文本映射为 TS 类型文本。 */
function tsTypeFromRuntime(typeText: string): string {
    const t = typeText.trim();
    if (t === 'String') return 'string';
    if (t === 'Number') return 'number';
    if (t === 'Boolean') return 'boolean';
    if (t === 'Function') return '((...args: any[]) => any)';
    const genericArray = t.match(/^(?:Array|ReadonlyArray)<(.+)>$/);
    if (genericArray) return `${tsTypeFromRuntime(genericArray[1])}[]`;
    if (t === 'Array') return 'unknown[]';
    if (t === 'Object') return 'Record<string, any>';
    const propType = t.match(/PropType\s*<(.+)>/);
    if (propType) return propType[1].trim();
    const asFactory = t.match(/^\w+\s+as\s+\(\)\s*=>\s*(.+)$/);
    if (asFactory) return asFactory[1].trim();
    const union = t.match(/^\[(.+)\]$/);
    if (union) {
        const types = union[1].split(',').map((item) => tsTypeFromRuntime(item));
        return [...new Set(types)].join(' | ');
    }
    return t;
}

/** 从 defineProps 的 TS 类型参数生成 PropInfo 列表。 */
function propsFromTypeArg(typeText: string, sf?: ts.SourceFile): PropInfo[] {
    let resolved = typeText.trim();
    // defineProps<Props>() 中的具名类型引用：解析同文件内的 interface 声明。
    if (sf && /^[A-Za-z_$][\w$]*$/.test(resolved)) {
        for (const stmt of sf.statements) {
            if (ts.isInterfaceDeclaration(stmt) && stmt.name.text === resolved) {
                resolved = stmt.members.map((m) => m.getText(sf)).join('; ');
                break;
            }
        }
    }
    const body = resolved.replace(/^\s*\{|\}\s*$/g, '');
    // 按顶层逗号 / 分号切分成员，跳过泛型、括号与对象类型内部的符号。
    const members: string[] = [];
    let current = '';
    let angle = 0;
    let brace = 0;
    let paren = 0;
    for (const ch of body) {
        if (ch === '<') angle++;
        else if (ch === '>') angle = Math.max(0, angle - 1);
        else if (ch === '{') brace++;
        else if (ch === '}') brace = Math.max(0, brace - 1);
        else if (ch === '(') paren++;
        else if (ch === ')') paren = Math.max(0, paren - 1);
        if ((ch === ',' || ch === ';') && angle === 0 && brace === 0 && paren === 0) {
            if (current.trim()) members.push(current.trim());
            current = '';
        } else current += ch;
    }
    if (current.trim()) members.push(current.trim());
    return members.flatMap((text) => {
        const m = text.match(/^([A-Za-z_$][\w$*]*)\s*(\??)\s*:\s*(.+)$/s);
        if (!m) return [];
        return [
            {
                name: m[1].replace(/\*/g, ''),
                tsType: m[3]
                    .trim()
                    .replace(/[,;]\s*$/, '')
                    .replace(/^\w+\s+as\s+\(\)\s*=>\s*/, ''),
                runtime: runtimeTypeFromTs(m[3]),
                optional: m[2] === '?' || /\?/.test(m[3]),
            },
        ];
    });
}

/** 从 defineProps 的运行时对象生成 PropInfo 列表。 */
function propsFromRuntime(
    obj: ts.ObjectLiteralExpression,
    sf: ts.SourceFile,
    defaults?: ts.ObjectLiteralExpression,
): PropInfo[] {
    const defaultMap = new Map<string, string>();
    if (defaults) {
        for (const p of defaults.properties) {
            if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) {
                defaultMap.set(p.name.text, p.initializer.getText(sf));
            }
        }
    }
    const props: PropInfo[] = [];
    for (const p of obj.properties) {
        if (!ts.isPropertyAssignment(p) || !ts.isIdentifier(p.name)) continue;
        const name = p.name.text;
        const init = p.initializer;
        let typeText = 'null';
        let required = false;
        let hasDefault = defaultMap.has(name);
        let runtime = 'null';
        if (ts.isObjectLiteralExpression(init)) {
            for (const sub of init.properties) {
                if (!ts.isPropertyAssignment(sub)) continue;
                const subName = sub.name.getText(sf).replace(/['"]/g, '');
                if (subName === 'type') typeText = sub.initializer.getText(sf);
                if (subName === 'required' && sub.initializer.getText(sf) === 'true') required = true;
                if (subName === 'default') hasDefault = true;
            }
            runtime = init.getText(sf);
        } else if (ts.isIdentifier(init) || ts.isPropertyAccessExpression(init) || ts.isAsExpression(init)) {
            // 简写：header: String
            typeText = init.getText(sf);
            runtime = `{ type: ${typeText} }`;
        } else {
            continue;
        }
        props.push({
            name,
            tsType: tsTypeFromRuntime(typeText),
            runtime,
            optional: !required || hasDefault,
        });
    }
    return props;
}

/** 解析 defineEmits 的声明，产出带参数类型的 emits 对象。 */
function parseEmits(call: ts.CallExpression, sf: ts.SourceFile): { text: string; untyped: boolean } {
    const typeArg = call.typeArguments?.[0];
    if (typeArg) {
        const src = typeArg.getText(sf);
        const entries: string[] = [];
        // 支持 (e: 'x', a: A, b: B): void 与 'x': [a: A] 两种常见写法。
        const sigRe = /\(\s*(?:event|e)\s*:\s*['"]([^'"]+)['"]([^)]*)\)/g;
        let m: RegExpExecArray | null;
        while ((m = sigRe.exec(src))) {
            const name = m[1];
            const params = m[2]
                .split(',')
                .map((p) => p.trim())
                .filter(Boolean)
                .map((p) => {
                    const colon = p.indexOf(':');
                    return colon >= 0 ? p.slice(colon + 1).trim() : 'unknown';
                });
            entries.push(`    '${name}': (${params.map((p, i) => `arg${i}?: ${p}`).join(', ')}) => true,`);
        }
        if (entries.length) return { text: `{\n${entries.join('\n')}\n}`, untyped: false };
        const tupleRe = /['"]?([A-Za-z_$][\w$:-]*)['"]?\s*:\s*\[([^\]]*)\]/g;
        while ((m = tupleRe.exec(src))) {
            const name = m[1];
            const params = m[2]
                .split(',')
                .map((p) => p.trim())
                .filter(Boolean)
                .map((p) => {
                    const colon = p.indexOf(':');
                    return colon >= 0 ? p.slice(colon + 1).trim() : 'unknown';
                });
            entries.push(`    '${name}': (${params.map((p, i) => `arg${i}?: ${p}`).join(', ')}) => true,`);
        }
        if (entries.length) return { text: `{\n${entries.join('\n')}\n}`, untyped: false };
    }
    const arg = call.arguments[0];
    if (arg && ts.isArrayLiteralExpression(arg)) {
        const names = arg.elements.map((e) => e.getText(sf).replace(/['"]/g, ''));
        return {
            text: `{\n${names.map((n) => `    '${n}': (...args: unknown[]) => true,`).join('\n')}\n}`,
            untyped: true,
        };
    }
    if (arg && ts.isObjectLiteralExpression(arg)) return { text: arg.getText(sf), untyped: false };
    return { text: '{}', untyped: false };
}

/** 采集脚本中显式 import 的标识符。 */
function collectImports(sf: ts.SourceFile): Set<string> {
    const names = new Set<string>();
    for (const stmt of sf.statements) {
        if (!ts.isImportDeclaration(stmt) || !stmt.importClause) continue;
        const bind = stmt.importClause.namedBindings;
        if (stmt.importClause.name) names.add(stmt.importClause.name.text);
        if (bind && ts.isNamedImports(bind)) for (const el of bind.elements) names.add(el.name.text);
        if (bind && ts.isNamespaceImport(bind)) names.add(bind.name.text);
    }
    return names;
}

/** 采集模板表达式中需要解包的标识符：ref/computed 局部变量与 store 解构变量。 */
function collectRefNames(source: string): Set<string> {
    const names = new Set<string>();
    const refDecl =
        /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:ref|computed|shallowRef|customRef|defineModel|toRef|use[A-Z]\w*)\s*[<(]/g;
    let m: RegExpExecArray | null;
    while ((m = refDecl.exec(source))) names.add(m[1]);
    const storeDecl = /(?:const|let)\s*\{([^}]+)\}\s*=\s*(?:await\s+)?(?:use[A-Z]\w*|toRefs)\s*\(/g;
    while ((m = storeDecl.exec(source))) {
        for (const part of m[1].split(',')) {
            const segments = part.split(':');
            const candidate = segments.length > 1 ? segments[1] : segments[0];
            const name = candidate.split('=')[0].trim();
            if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
        }
    }
    return names;
}

/** 判断 setup 体内是否存在内部状态（决定能否用 FunctionalComponent）。 */
function hasInternalState(source: string): boolean {
    return /\b(ref|reactive|computed|watch|watchEffect|onMounted|onUnmounted|onBeforeMount|onBeforeUnmount|onUpdated|onActivated|onDeactivated|use[A-Z]\w*)\s*\(/.test(
        source,
    );
}

/** 转换 <script setup> 源码；返回 setup 所需的全部信息。 */
export function transformScript(source: string): ScriptInfo {
    const sf = ts.createSourceFile('setup.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const bodyParts: string[] = [];
    const headerParts: string[] = [];
    let props: PropInfo[] = [];
    let emits = { text: '{}', untyped: false };
    let propsVar = 'props';
    let emitsVar = 'emit';
    let name = '';
    const extraOptions: string[] = [];
    let exposeObject = '';
    const models = new Map<string, string>();

    for (const stmt of sf.statements) {
        const text = stmt.getText(sf).trim();
        if (!text) continue;

        // import 必须留在模块顶层；type/interface 保留在 setup 体内，以便引用 setup 中的局部变量。
        if (ts.isImportDeclaration(stmt)) {
            headerParts.push(text);
            continue;
        }

        // definePage 宏必须留在模块顶层，否则文件路由插件无法提取静态路由信息。
        if (
            ts.isExpressionStatement(stmt) &&
            ts.isCallExpression(stmt.expression) &&
            callName(stmt.expression) === 'definePage'
        ) {
            headerParts.push(text);
            continue;
        }

        // const xxx = defineProps(...) / withDefaults(defineProps(...), defaults)
        if (ts.isVariableStatement(stmt)) {
            const decl = stmt.declarationList.declarations[0];
            if (decl && ts.isIdentifier(decl.name) && decl.initializer) {
                const init = decl.initializer;
                const cname = callName(init);
                if (cname === 'defineProps' || cname === 'withDefaults') {
                    const inner =
                        cname === 'withDefaults' ? (ts.isCallExpression(init) ? init.arguments[0] : undefined) : init;
                    const defaults =
                        cname === 'withDefaults' && ts.isCallExpression(init) ? init.arguments[1] : undefined;
                    propsVar = decl.name.text;
                    if (inner && ts.isCallExpression(inner)) {
                        const typeArg = inner.typeArguments?.[0];
                        const runtimeArg = inner.arguments[0];
                        if (typeArg) props = propsFromTypeArg(typeArg.getText(sf), sf);
                        else if (runtimeArg && ts.isObjectLiteralExpression(runtimeArg)) {
                            props = propsFromRuntime(
                                runtimeArg,
                                sf,
                                defaults && ts.isObjectLiteralExpression(defaults) ? defaults : undefined,
                            );
                        }
                    }
                    continue;
                }
                if (cname === 'defineEmits') {
                    emits = parseEmits(init as ts.CallExpression, sf);
                    emitsVar = decl.name.text;
                    continue;
                }
                if (cname === 'defineModel') {
                    const call = init as ts.CallExpression;
                    const modelType = call.typeArguments?.[0]?.getText(sf) ?? 'unknown';
                    models.set(decl.name.text, modelType);
                    // 保留一个可写本地别名，模板与脚本中原先对模型变量的读写无需改写。
                    bodyParts.push(
                        `const ${decl.name.text} = computed({\n    get: () => __panelSetupProps.modelValue,\n    set: ($v) => ctx.emit('update:modelValue', $v),\n});`,
                    );
                    continue;
                }
            }
        }

        // defineExpose(...) / defineOptions(...)
        if (ts.isExpressionStatement(stmt) && ts.isCallExpression(stmt.expression)) {
            const cname = callName(stmt.expression);
            if (cname === 'defineProps' || cname === 'withDefaults') {
                const inner = cname === 'withDefaults' ? stmt.expression.arguments[0] : stmt.expression;
                const defaults = cname === 'withDefaults' ? stmt.expression.arguments[1] : undefined;
                const call = ts.isCallExpression(inner) ? inner : stmt.expression;
                const typeArg = call.typeArguments?.[0];
                const runtimeArg = call.arguments[0];
                if (typeArg) props = propsFromTypeArg(typeArg.getText(sf), sf);
                else if (runtimeArg && ts.isObjectLiteralExpression(runtimeArg)) {
                    props = propsFromRuntime(
                        runtimeArg,
                        sf,
                        defaults && ts.isObjectLiteralExpression(defaults) ? defaults : undefined,
                    );
                }
                continue;
            }
            if (cname === 'defineEmits') {
                emits = parseEmits(stmt.expression, sf);
                continue;
            }
            if (cname === 'defineExpose') {
                exposeObject = stmt.expression.arguments[0]?.getText(sf) ?? '{}';
                continue;
            }
            if (cname === 'defineOptions') {
                const opt = stmt.expression.arguments[0];
                if (opt && ts.isObjectLiteralExpression(opt)) {
                    for (const p of opt.properties) {
                        const key = p.name?.getText(sf).replace(/['"]/g, '');
                        const value = ts.isPropertyAssignment(p) ? p.initializer.getText(sf) : '';
                        if (key === 'name') name = value.replace(/['"]/g, '');
                        else extraOptions.push(`${key}: ${value}`);
                    }
                }
                continue;
            }
        }

        // 类型声明统一放到模块顶层，保证 Props / emits / 其它类型可以互相引用。
        if (ts.isTypeAliasDeclaration(stmt) || ts.isInterfaceDeclaration(stmt)) {
            headerParts.push(text.replace(/^export\s+/, ''));
            continue;
        }
        // 普通语句原样保留；emit/props 的改名在下方统一处理。
        bodyParts.push(text);
    }

    // defineProps / defineEmits 的局部变量映射到 setup 的 props 形参与 ctx.emit。
    const mapped = bodyParts
        .join('\n')
        .replace(new RegExp(`(?<!\\w\\.)(?<!\\?\\.)\\b${propsVar}\\b`, 'g'), '__panelSetupProps')
        .replace(new RegExp(`(?<![\\w.])\\b${emitsVar}\\s*\\(`, 'g'), 'ctx.emit(')
        .replace(new RegExp(`(?<![\\w.])\\b${emitsVar}\\b`, 'g'), 'ctx.emit');
    let finalBody = mapped;
    for (const [, modelType] of models) {
        if (!props.some((p) => p.name === 'modelValue')) {
            props.push({
                name: 'modelValue',
                tsType: modelType,
                runtime: `{ type: ${runtimeTypeFromTs(modelType)} }`,
                optional: false,
            });
        }
        if (!emits.text.includes("'update:modelValue'")) {
            emits = {
                text:
                    emits.text === '{}'
                        ? `{\n    'update:modelValue': (value: ${modelType}) => true,\n}`
                        : emits.text.replace(/^\{/, `{\n    'update:modelValue': (value: ${modelType}) => true,`),
                untyped: emits.untyped,
            };
        }
    }

    // 索引签名承接 v-on/v-bind 透传的属性，避免 JSX 的额外属性检查误报。
    // setup 形参使用不会与源码变量冲突的固定名字；源码中 props 变量统一映射到 __props。
    const paramName = '__panelSetupProps';

    const refNames = collectRefNames(source);

    const propsInterface = `interface CodemodProps {\n    [key: string]: any;\n${props.map((p) => `    ${p.name}?: ${p.tsType};`).join('\n')}\n}`;

    const propsOption = props.length
        ? `{\n${props
              .map((p) => {
                  const runtime = p.runtime === 'null' ? `{ type: null }` : p.runtime;
                  return `    ${JSON.stringify(p.name)}: ${runtime},`;
              })
              .join('\n')}\n} as unknown as ComponentObjectPropsOptions<CodemodProps>`
        : '{}';

    const extra = extraOptions.length ? `${extraOptions.join(',\n        ')},\n        ` : '';
    const info: ScriptInfo = {
        body: finalBody,
        propsInterface,
        propsOption,
        emitsObject: emits.text,
        emitsUntyped: emits.untyped,
        slotsShape: '',
        name,
        extraOptions: extra,
        header: headerParts.join('\n'),
        refNames,
        propNames: new Set(props.map((p) => p.name)),
        componentImports: collectImports(sf),
        propsVar,
        emitsVar,
        paramName,
        stateless: !hasInternalState(source),
        models,
        exposeObject,
    };
    return info;
}
