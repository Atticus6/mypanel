/* 收尾脚本：把 TSX 中残留的短横线组件标签改为显式导入的 PascalCase 标签。 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as icons from '@element-plus/icons-vue';

const map = new Map<string, string>();
try {
    for (const line of readFileSync('components.d.ts', 'utf8').split('\n')) {
        const m = line.match(/^\s*([\w$]+):\s*typeof import\('([^']+)'\)/);
        if (!m) continue;
        const path = m[2] === 'element-plus/es' ? 'element-plus' : m[2].replace(/^\.\/src\//, '@/');
        map.set(m[1], line.includes("['default']") ? `default:${path}` : path);
    }
} catch {}
for (const name of Object.keys(icons)) if (!map.has(name)) map.set(name, 'icon');
map.set('KeepAlive', 'vue');
map.set('Transition', 'vue');
map.set('Teleport', 'vue');
map.set('I18nT', 'vue-i18n');
map.set('FuSteps', 'default:@/components/fu/FuSteps');
map.set('MobileHeader', 'default:@/layout/components/MobileHeader');
map.set('AppMain', 'default:@/layout/components/AppMain');

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (full.endsWith('.tsx')) out.push(full);
    }
    return out;
}

function pascal(tag: string): string {
    return tag
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
}

let changed = 0;
for (const file of walk('src')) {
    let source = readFileSync(file, 'utf8');
    const tags = new Set<string>();
    for (const m of source.matchAll(/<\/?([a-z][a-z0-9]*-[a-z0-9-]+)\b/g)) tags.add(m[1]);
    if (!tags.size) continue;
    const imports: string[] = [];
    for (const tag of tags) {
        const name = pascal(tag);
        const importRe = new RegExp(`\\bimport\\s+(?:\\{[^}]*\\b${name}\\b[^}]*\\}|${name}|\\*\\s+as\\s+\\w+)\\b`);
        if (importRe.test(source)) {
            source = source.replace(new RegExp(`</?${tag}\\b`, 'g'), (m) => m.replace(tag, name));
            continue;
        }
        const mapped = map.get(name);
        if (!mapped) {
            console.warn('未找到组件导入', file, tag, name);
            continue;
        }
        if (mapped === 'icon') imports.push(`import { ${name} } from '@element-plus/icons-vue';`);
        else if (mapped.startsWith('default:')) imports.push(`import ${name} from '${mapped.slice(8)}';`);
        else imports.push(`import { ${name} } from '${mapped}';`);
        source = source.replace(new RegExp(`</?${tag}\\b`, 'g'), (m) => m.replace(tag, name));
    }
    if (imports.length) source = `${[...new Set(imports)].join('\n')}\n${source}`;
    writeFileSync(file, source);
    changed++;
}
console.log(`修复 ${changed} 个 TSX 的短横线组件标签`);
