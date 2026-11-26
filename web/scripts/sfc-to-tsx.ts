/* codemod 主程序：把 .vue 转成 .tsx，并用 Vue 编译器保留 scoped 样式语义。 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, relative, resolve } from 'node:path';
import { parse as parseSFC, compileStyle } from '@vue/compiler-sfc';
import { baseParse } from '@vue/compiler-dom';
import { transformScript } from './transform-script';
import { genTemplate, directiveImports, helperImports, elementPlusImports, componentImports } from './gen-jsx';

/** 把 SCSS 的 @use 内联展开，避免编译器无法识别 @/ 别名。 */
function expandScssImports(source: string, filename: string, seen = new Set<string>()): string {
    return source.replace(/@use\s+['"]([^'"]+)['"]\s*(?:as\s+\*)?\s*;/g, (full, spec: string) => {
        if (spec.includes('var.scss')) return '';
        const base = spec.startsWith('@/') ? resolve('src', spec.slice(2)) : resolve(dirname(filename), spec);
        const candidates = [base, `${base}.scss`, resolve(dirname(base), '_' + basename(base) + '.scss')];
        const found = candidates.find((p) => existsSync(p));
        if (!found || seen.has(found)) return '';
        seen.add(found);
        return expandScssImports(readFileSync(found, 'utf8'), found, seen);
    });
}

/** 转换单个 SFC 文件。 */
export function convertFile(file: string): { tsx: string; css?: string } | undefined {
    const source = readFileSync(file, 'utf8');
    const { descriptor, errors } = parseSFC(source, { filename: file });
    if (errors.length) {
        console.error('解析失败', file, errors.map((e) => e.message).join('; '));
        return undefined;
    }
    const setup = descriptor.scriptSetup;
    if (!setup) {
        console.warn('跳过（非 script setup）', file);
        return undefined;
    }

    directiveImports.clear();
    helperImports.clear();
    elementPlusImports.clear();
    componentImports.clear();

    const info = transformScript(setup.content);
    const templateSource = descriptor.template?.content ?? '<div />';
    const ast = baseParse(templateSource, { whitespace: 'condense' });
    const { jsx, slotNames } = genTemplate(ast, info);

    const generated = jsx.join('\n');
    if (generated.includes('__vueRoute')) {
        info.header = `import { useRoute } from 'vue-router';\n${info.header}`;
        info.body = `const __vueRoute = useRoute();\n${info.body}`;
    }
    const usesI18n = /\$t\s*\(/.test(source) || /\$t\s*\(/.test(generated);
    if (usesI18n) {
        info.header = `import { $t } from '@/utils/i18n-t';\n${info.header}`;
    }

    const scopeId = 'data-v-' + createHash('md5').update(file).digest('hex').slice(0, 8);
    const cssParts: string[] = [];
    let hasScopedStyle = false;
    const sharedVars = existsSync('src/styles/var.scss') ? readFileSync('src/styles/var.scss', 'utf8') : '';
    for (const style of descriptor.styles) {
        const isScss = style.lang === 'scss' || style.lang === 'sass';
        const scssSource = isScss ? `${sharedVars}\n${expandScssImports(style.content, file)}` : style.content;
        const result = compileStyle({
            source: scssSource,
            filename: file,
            id: scopeId,
            scoped: style.scoped,
            preprocessLang: isScss ? style.lang : undefined,
            preprocessOptions: isScss ? { loadPaths: [process.cwd()] } : undefined,
        });
        if (result.errors.length) {
            console.error('样式编译失败', file, result.errors.map((e) => String(e)).join('\n'));
            return undefined;
        }
        hasScopedStyle = hasScopedStyle || style.scoped;
        cssParts.push(result.code.trim());
    }
    const css = cssParts.length ? cssParts.join('\n\n') + '\n' : undefined;
    const styleImport = css ? `import './${basename(file, '.vue')}.styles.css';\n` : '';

    const already = (name: string) => new RegExp(`\\b${name}\\b`).test(info.header);
    const vueImports = ['defineComponent', 'Fragment', 'unref', 'withDirectives'].filter((n) => !already(n));
    if (/\bcomputed\s*\(/.test(info.body) && !already('computed')) vueImports.push('computed');
    const typeImports = ['type VNode', 'type SlotsType', 'type ComponentObjectPropsOptions'];

    const importedNames = new Set<string>();
    for (const m of info.header.matchAll(/import\s*\{([^}]+)\}/g)) {
        for (const name of m[1].split(',')) if (name.trim()) importedNames.add(name.trim());
    }
    const dedupeImports = (lines: Set<string>): string[] => {
        const out: string[] = [];
        for (const line of lines) {
            const m = line.match(/import\s*\{([^}]+)\}\s*from\s*'([^']+)'/);
            if (!m) {
                out.push(line);
                continue;
            }
            const names = m[1]
                .split(',')
                .map((n) => n.trim())
                .filter((n) => n && !importedNames.has(n));
            if (!names.length) continue;
            names.forEach((n) => importedNames.add(n));
            out.push(`import { ${names.join(', ')} } from '${m[2]}';`);
        }
        return out;
    };
    const directiveImportLines = [
        ...dedupeImports(directiveImports),
        ...dedupeImports(helperImports),
        ...dedupeImports(elementPlusImports),
        ...dedupeImports(componentImports),
    ].join('\n');
    const emitsName = 'emits';
    const slotsType = slotNames.size
        ? `type SlotsShape = {\n${[...slotNames]
              .map((n) => `    ${JSON.stringify(n)}: (arg?: unknown) => VNode[];`)
              .join('\n')}\n};`
        : '';
    const slotsArg = slotNames.size ? 'SlotsType<SlotsShape>' : 'Record<string, never>';

    const bodies = generated || '<div />';
    const rootNodes = ast.children.filter((node: any) => node.type !== 2 || String(node.content).trim());
    const singleRoot = rootNodes.length === 1 && rootNodes[0].type === 1;
    let renderBody = singleRoot ? bodies : `<>\n${bodies}\n</>`;
    // 根节点带指令时 genChildren 会生成 {withDirectives(...)}，这里还原成表达式。
    if (singleRoot && renderBody.startsWith('{') && renderBody.endsWith('}')) {
        renderBody = renderBody.slice(1, -1);
    }
    const baseName = basename(file, '.vue');
    const componentName = baseName === 'index' ? basename(dirname(file)) : baseName;
    const exposeLine = info.exposeObject ? `\n        ctx.expose(${info.exposeObject});` : '';
    const slotsOption = slotNames.size ? `\n        slots: {} as SlotsType<SlotsShape>,` : '';

    const optionsEntries = [
        `        name: ${JSON.stringify(info.name || componentName)},`,
        `        props: ${info.propsOption},`,
        `        emits: ${emitsName},${slotsOption}`,
        hasScopedStyle ? `        __scopeId: ${JSON.stringify(scopeId)},` : '',
        info.extraOptions ? `        ${info.extraOptions}` : '',
    ]
        .filter(Boolean)
        .join('\n');

    const component = `const options = {\n${optionsEntries}\n};\n\nexport default defineComponent<CodemodProps, typeof ${emitsName}, keyof typeof ${emitsName}, ${slotsArg}>(
    (${info.paramName}, ctx) => {
${info.body
    .split('\n')
    .map((line) => `        ${line}`)
    .join('\n')}${exposeLine}
        return () => (
${renderBody
    .split('\n')
    .map((line) => `            ${line}`)
    .join('\n')}
        );
    },
    options,
);`;

    const out = `${info.header}
${styleImport}import { ${[...new Set(vueImports)].join(', ')} } from 'vue';
import { ${typeImports.join(', ')} } from 'vue';
${directiveImportLines}

${info.propsInterface}

const ${emitsName} = ${info.emitsObject};

${slotsType}

${component}
`;
    return { tsx: out, css };
}

/** 主流程：只接收 .vue 文件，逐个转换。 */
function main() {
    const args = process.argv.slice(2);
    const targets = args.filter((a) => !a.startsWith('-'));
    const dryRun = args.includes('--dry-run');
    if (!targets.length) {
        console.error('用法：bun scripts/sfc-to-tsx.ts <file.vue> [...] [--dry-run]');
        process.exit(1);
    }
    let count = 0;
    for (const target of targets) {
        if (!existsSync(target) || !target.endsWith('.vue')) {
            console.error('不是有效的 .vue 文件', target);
            continue;
        }
        const result = convertFile(target);
        if (!result) continue;
        const tsx = target.replace(/\.vue$/, '.tsx');
        const css = target.replace(/\.vue$/, '.styles.css');
        if (dryRun) {
            console.log('DRY', target, '->', relative(process.cwd(), tsx));
            continue;
        }
        writeFileSync(tsx, result.tsx);
        if (result.css) writeFileSync(css, result.css);
        unlinkSync(target);
        count++;
        console.log('转换', target);
    }
    console.log(`完成 ${count} 个文件`);
}

if (import.meta.main) main();
