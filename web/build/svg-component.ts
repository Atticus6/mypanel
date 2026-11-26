import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

export interface SvgInfo {
    attrs: Record<string, string>;
    innerHTML: string;
}

/** 提取 SVG 根节点属性与内部内容，根节点本身由渲染函数创建。 */
export function parseSvg(source: string): SvgInfo {
    const match = source.match(/<svg\b([^>]*)>([\s\S]*)<\/svg\s*>/i);
    if (!match) throw new Error('Invalid SVG: missing <svg> root element');
    const attrs: Record<string, string> = {};
    for (const item of match[1].matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)) {
        attrs[item[1]] = item[3];
    }
    return { attrs, innerHTML: match[2] };
}

/** 把 `*.svg?component` 编译成渲染内联 SVG 的组件，保持 currentColor 与 CSS 变量可用。 */
export function svgComponentPlugin(): Plugin {
    return {
        name: 'inline-svg-component',
        enforce: 'pre',
        load(id) {
            if (!id.includes('?component')) return null;
            const file = id.split('?')[0];
            if (!file.endsWith('.svg')) return null;
            const { attrs, innerHTML } = parseSvg(readFileSync(file, 'utf8'));
            return [
                "import { defineComponent, h } from 'vue';",
                `const attrs = ${JSON.stringify(attrs)};`,
                `const innerHTML = ${JSON.stringify(innerHTML)};`,
                'export default defineComponent((_, { attrs: passed }) => () => h("svg", { ...attrs, ...passed, innerHTML }));',
            ].join('\n');
        },
    };
}
