import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { resolveOptions, type VueJSXPluginOptions } from './options.ts';
import { injectHmr } from './hmr.ts';
import { transformVueJSX } from './transform.ts';

export type { VueJSXPluginOptions } from './options';

const runtimeId = fileURLToPath(new URL('./runtime.ts', import.meta.url));

/**
 * 用 oxc 替代 @vitejs/plugin-vue-jsx 的 Vue JSX 插件。
 *
 * Vue 专有语法先由 oxc parser 定位并按 span 改写，通用 JSX 再交给 Vite 内置的
 * oxc transformer，避免 Babel 逐文件解析/生成的开销。
 */
export function vueJsxOxc(options: VueJSXPluginOptions = {}): Plugin {
    const resolved = resolveOptions(options);
    let needHmr = false;
    return {
        name: 'oxc-plugin-jsx',
        enforce: 'pre',
        configResolved(config) {
            needHmr = config.command === 'serve' && !config.isProduction;
        },
        config() {
            return {
                resolve: {
                    alias: [
                        {
                            find: /^vue-jsx-runtime(?:\/jsx-(?:dev-)?runtime)?$/,
                            replacement: runtimeId,
                        },
                    ],
                },
                oxc: {
                    jsx: resolved.pragma
                        ? { runtime: 'classic', pragma: resolved.pragma, pragmaFrag: 'Fragment' }
                        : { runtime: 'automatic', importSource: 'vue-jsx-runtime' },
                },
            };
        },
        transform(code, id, transformOptions) {
            const filename = id.split('?')[0];
            if (!/\.[jt]sx$/.test(filename)) return null;
            let result = transformVueJSX(code, resolved);
            const ssr = transformOptions?.ssr === true;
            if (needHmr && !ssr) {
                result = injectHmr(result, filename);
            }
            return result === code ? null : { code: result, map: null };
        },
    };
}

export default vueJsxOxc;
