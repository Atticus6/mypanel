/* codemod 辅助：把已生成 TSX 中的 el-xxx 字符串标签改成从 element-plus 导入的 ElXxx 组件。 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as ep from 'element-plus';

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (full.endsWith('.tsx')) out.push(full);
    }
    return out;
}

function main() {
    const exports = new Set(Object.keys(ep));
    let changed = 0;
    for (const file of walk('src')) {
        const source = readFileSync(file, 'utf8');
        let out = source;
        const rename = new Map<string, string>();

        // 把 el-xxx 标签换成 ElXxx，并记录需要补充的导入。
        out = out.replace(/<\/?el-([a-z][a-z0-9-]*)\b/g, (match, rest: string) => {
            const component =
                'El' +
                rest
                    .split('-')
                    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                    .join('');
            rename.set(component, component);
            return match.replace(`el-${rest}`, component);
        });

        // 类型导入不参与组件名转换；若上一轮被误加 El 前缀则还原。
        out = out.replace(/import type \{([^}]+)\} from 'element-plus';\n/g, (full, list: string) => {
            const fixed = list
                .split(',')
                .map((s) => {
                    const name = s.trim();
                    if (!name) return '';
                    if (name.startsWith('El') && exports.has(name.slice(2))) {
                        rename.set(name, name.slice(2));
                        return name.slice(2);
                    }
                    return name;
                })
                .filter(Boolean);
            return `import type { ${[...new Set(fixed)].join(', ')} } from 'element-plus';\n`;
        });
        // 值导入：组件名以 El 开头；上一轮漏加前缀的补上，误加在类型上的还原。
        out = out.replace(/import \{([^}]+)\} from 'element-plus';\n/g, (full, list: string) => {
            const fixed = list
                .split(',')
                .map((s) => {
                    const name = s.trim();
                    if (!name) return '';
                    if (exports.has(name)) return name;
                    if (name.startsWith('El') && exports.has(name.slice(2))) {
                        rename.set(name, name.slice(2));
                        return name.slice(2);
                    }
                    if (!name.startsWith('El') && exports.has(`El${name}`)) {
                        rename.set(name, `El${name}`);
                        return `El${name}`;
                    }
                    return name;
                })
                .filter(Boolean);
            return `import { ${[...new Set(fixed)].join(', ')} } from 'element-plus';\n`;
        });

        for (const [from, to] of rename) {
            if (from !== to) out = out.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
        }

        // 合并重复的 element-plus import。
        const lines = out.split('\n').filter((line) => /^import \{.*\} from 'element-plus';$/.test(line));
        if (lines.length > 1) {
            const names = new Set<string>();
            for (const line of lines) {
                for (const name of line.match(/\{([^}]+)\}/)![1].split(',')) {
                    if (name.trim()) names.add(name.trim());
                }
            }
            out = out.replace(lines[0], `import { ${[...names].sort().join(', ')} } from 'element-plus';`);
            for (const line of lines.slice(1)) out = out.replace(line + '\n', '');
        }

        // 同名组件同时出现在 type 与 value import 时，移除 type 那份。
        const valueNames = new Set<string>();
        for (const m of out.matchAll(/import \{([^}]+)\} from 'element-plus';/g)) {
            for (const name of m[1].split(',')) if (name.trim()) valueNames.add(name.trim());
        }
        out = out.replace(/import type \{([^}]+)\} from 'element-plus';\n/g, (full, list: string) => {
            const kept = list
                .split(',')
                .map((s) => s.trim())
                .filter((name) => name && !valueNames.has(name));
            return kept.length ? `import type { ${kept.join(', ')} } from 'element-plus';\n` : '';
        });

        if (out !== source) {
            writeFileSync(file, out);
            changed++;
        }
    }
    console.log(`改写 ${changed} 个 TSX 的 Element Plus 组件引用`);
}

if (import.meta.main) main();
