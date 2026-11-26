/* 建立每个 .tsx 文件与其可被截图访问的路由之间的映射。 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, relative, resolve, basename } from 'node:path';

const root = process.cwd();
const srcRoot = resolve(root, 'src');

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = resolve(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (full.endsWith('.tsx') || full.endsWith('.ts')) out.push(full);
    }
    return out;
}

const allSourceFiles = walk(srcRoot).map((p) => relative(srcRoot, p).replaceAll('\\', '/'));
const allTsx = allSourceFiles.filter((f) => f.endsWith('.tsx'));
const fileSet = new Set(allSourceFiles);

function resolveImport(from: string, spec: string): string | undefined {
    if (!spec.startsWith('@/') && !spec.startsWith('./') && !spec.startsWith('../')) return undefined;
    const base = spec.startsWith('@/')
        ? resolve(srcRoot, spec.slice(2))
        : resolve(dirname(resolve(srcRoot, from)), spec);
    for (const candidate of [
        base,
        `${base}.tsx`,
        `${base}.ts`,
        resolve(base, 'index.tsx'),
        resolve(base, 'index.ts'),
    ]) {
        const rel = relative(srcRoot, candidate).replaceAll('\\', '/');
        if (fileSet.has(rel) || (candidate.endsWith('.ts') && existsSync(candidate))) return rel;
    }
    return undefined;
}

const graph = new Map<string, string[]>();
for (const file of allSourceFiles) {
    const source = readFileSync(resolve(srcRoot, file), 'utf8');
    const deps = new Set<string>();
    for (const m of source.matchAll(/(?:from|import)\s*['"]([^'"]+)['"]/g)) {
        const dep = resolveImport(file, m[1]);
        if (dep && dep !== file) deps.add(dep);
    }
    graph.set(file, [...deps]);
}

// 路由名 -> 路径
const nameToPath = new Map<string, string>();
const routerDts = readFileSync(resolve(srcRoot, 'typed-router.d.ts'), 'utf8');
for (const m of routerDts.matchAll(/RouteRecordInfo<\s*'([^']+)',\s*'([^']+)'/g)) {
    if (!nameToPath.has(m[1])) nameToPath.set(m[1], m[2]);
}

const routes: Array<{ page: string; name: string; path: string }> = [];
for (const file of allTsx.filter((f) => f.startsWith('pages/'))) {
    const source = readFileSync(resolve(srcRoot, file), 'utf8');
    const nameMatch = source.match(/definePage\(\{[\s\S]*?\bname:\s*['"]([^'"]+)['"]/);
    const name = nameMatch?.[1] ?? basename(file, '.tsx');
    const path = nameToPath.get(name) ?? '/' + file.replace(/^pages\//, '').replace(/\.tsx$/, '');
    routes.push({ page: file, name, path });
}

const canonical = new Map<string, { path: string; page: string }>();
const allRoutes = new Map<string, string[]>();
for (const route of routes) {
    const seen = new Set<string>();
    const queue = [route.page];
    while (queue.length) {
        const file = queue.shift()!;
        if (seen.has(file)) continue;
        seen.add(file);
        if (!canonical.has(file)) canonical.set(file, { path: route.path, page: route.page });
        const list = allRoutes.get(file) ?? [];
        if (!list.includes(route.path)) list.push(route.path);
        allRoutes.set(file, list);
        for (const dep of graph.get(file) ?? []) queue.push(dep);
    }
}

// main.ts 入口可达文件兜底
const mainSource = readFileSync(resolve(srcRoot, 'main.ts'), 'utf8');
const queue = ['main.ts'];
const seenMain = new Set<string>();
while (queue.length) {
    const file = queue.shift()!;
    if (seenMain.has(file)) continue;
    seenMain.add(file);
    const deps =
        file === 'main.ts'
            ? ([...mainSource.matchAll(/from\s*['"]([^'"]+)['"]/g)]
                  .map((m) => resolveImport('main.ts', m[1]))
                  .filter(Boolean) as string[])
            : (graph.get(file) ?? []);
    for (const dep of deps) {
        if (!canonical.has(dep)) canonical.set(dep, { path: '/', page: 'main.ts' });
        queue.push(dep);
    }
}

// 前缀：与 pbase-* 基线一致
const prefixByPath = new Map<string, string>();
const routeList = readFileSync('/tmp/opencode/route-list.tsv', 'utf8').split('\n').filter(Boolean);
for (const line of routeList) {
    const [prefix, path] = line.split('\t');
    prefixByPath.set(path, `p${prefix}`);
}

// 全局注册组件：按实际在页面 JSX 中出现的标签名补映射，避免统一回退到首页。
const componentNames = new Map<string, string>();
for (const file of allTsx) {
    const source = readFileSync(resolve(srcRoot, file), 'utf8');
    const nameMatch = source.match(/defineOptions\(\{[\s\S]*?\bname:\s*['"]([^'"]+)['"]/);
    const name = nameMatch?.[1] ?? basename(file, '.tsx');
    componentNames.set(file, name);
}
for (const [file, name] of componentNames) {
    if (!/^[A-Z]/.test(name)) continue;
    if ((canonical.get(file)?.page ?? '') !== 'unmapped') continue;
    const tagRe = new RegExp(`<${name}\\b`);
    for (const [consumer, paths] of allRoutes) {
        if (consumer === file) continue;
        const source = readFileSync(resolve(srcRoot, consumer), 'utf8');
        if (tagRe.test(source) && paths.length) {
            canonical.set(file, { path: paths[0], page: consumer });
            break;
        }
    }
}

const fallbackPath = new Map<string, string>([
    ['/:code?', '/'],
    ['/s/:code', '/login'],
    ['/error', '/error/404'],
    ['/websites/:id/config/:tab', '/websites'],
    ['/websites/ssl/dns-account', '/websites/ssl'],
]);

const rows = allTsx.map((file) => {
    const route = canonical.get(file) ?? { path: '/', page: 'unmapped' };
    const screenshotPath = fallbackPath.get(route.path) ?? route.path;
    const prefix = prefixByPath.get(screenshotPath) ?? 'pbase-home';
    return `${file}\t${route.path}\t${prefix}\t${route.page}\t${(allRoutes.get(file) ?? []).join('|')}\t${screenshotPath}`;
});
writeFileSync('/tmp/opencode/file-route.tsv', rows.join('\n') + '\n');
console.log('files', allTsx.length, 'routes', routes.length, 'mapped', canonical.size);
console.log('without_prefix', rows.filter((r) => !r.split('\t')[2]).length);
