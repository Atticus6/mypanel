/* codemod 辅助：把源码中对已转换组件的 .vue 引用改写为 .tsx。 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.(ts|tsx|js|jsx|vue)$/.test(entry)) out.push(full);
    }
    return out;
}

function main() {
    const root = resolve('src');
    let changed = 0;
    for (const file of walk(root)) {
        const source = readFileSync(file, 'utf8');
        let out = source;
        out = out.replace(/(['"])([^'"]+)\.vue\1/g, (full, quote: string, spec: string) => {
            const base = spec.startsWith('@/')
                ? join(root, spec.slice(2))
                : spec.startsWith('.')
                  ? resolve(dirname(file), spec)
                  : '';
            if (!base) return full;
            const target = base + '.tsx';
            return existsSync(target) ? `${quote}${spec}${quote}` : full;
        });
        if (out !== source) {
            writeFileSync(file, out);
            changed++;
        }
    }
    console.log(`改写 ${changed} 个文件的 .vue 引用`);
}

if (import.meta.main) main();
