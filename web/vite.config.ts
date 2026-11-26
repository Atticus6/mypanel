import { resolve } from 'path';
import { benchmarkReportPlugin } from './build/benchmark-report.ts';
import { wrapperEnv } from './src/utils/get-env.ts';
import vueJsxOxc from './oxc-plugin-jsx/index.ts';
import viteCompression from 'vite-plugin-compression';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv, ConfigEnv, UserConfig, Plugin } from 'vite';
import pkg from './package.json' with { type: 'json' };
import dayjs from 'dayjs';

import VueRouter from 'unplugin-vue-router/vite';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import svgLoader from 'vite-svg-loader';

function patchCodeFilterOverflow(): Plugin {
    return {
        name: 'patch-code-filter-overflow',
        configResolved(config) {
            const target = config.plugins.find((p) => p.name === 'vite:asset-import-meta-url');
            if (target?.transform && typeof target.transform === 'object' && target.transform.filter) {
                (target.transform.filter as Record<string, any>).code = 'import.meta.url';
            }
        },
    };
}

const prefix = `monaco-editor/esm/vs`;

function getManualChunkName(id: string): string | undefined {
    if (id.includes(`${prefix}/language/json/json.worker`)) return 'jsonWorker';
    if (id.includes(`${prefix}/language/css/css.worker`)) return 'cssWorker';
    if (id.includes(`${prefix}/language/html/html.worker`)) return 'htmlWorker';
    if (id.includes(`${prefix}/language/typescript/ts.worker`)) return 'tsWorker';
    if (id.includes(`${prefix}/editor/editor.worker`)) return 'editorWorker';

    if (id.includes('node_modules/echarts/')) return 'vendor-echarts';
    if (id.includes('node_modules/element-plus/') || id.includes('node_modules/@element-plus/')) {
        return 'vendor-element-plus';
    }
    if (id.includes('node_modules/codemirror/') || id.includes('node_modules/@codemirror/')) {
        return 'vendor-codemirror';
    }

    return undefined;
}

const { dependencies, devDependencies, name, version } = pkg;
const __APP_INFO__ = {
    pkg: { dependencies, devDependencies, name, version },
    lastBuildTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
};

export default defineConfig(async ({ mode }: ConfigEnv): Promise<UserConfig> => {
    const env = loadEnv(mode, process.cwd());
    const viteEnv = wrapperEnv(env);
    const isProduction = mode === 'production';
    const reportPlugin = viteEnv.VITE_REPORT ? (await import('rollup-plugin-visualizer')).visualizer() : false;
    // 开发期代理目标默认保持 8080；指向已运行的生产实例时可即时截图验收。
    const proxyTarget = process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8080';
    const wsProxyTarget = proxyTarget.replace(/^http/, 'ws');

    return {
        // 默认按需发现依赖：切到懒加载路由时才扫出新依赖会触发
        // "optimized dependencies changed. reloading" 整页刷新。
        // 这里把业务代码实际引用到的包与子路径一次性预构建，避免开发期导航时反复整页刷新。
        optimizeDeps: {
            noDiscovery: true,
            include: [
                'unplugin-vue-router/runtime',
                'element-plus/es/components/base/style/index',
                'element-plus/es/components/message-box/style/index',
                'anser',
                '@bufbuild/protobuf',
                '@bufbuild/protobuf/codegenv2',
                '@bufbuild/protobuf/wkt',
                '@bufbuild/protovalidate',
                'clsx',
                'codemirror',
                '@codemirror/commands',
                '@codemirror/lang-html',
                '@codemirror/lang-json',
                '@codemirror/lang-php',
                '@codemirror/language',
                '@codemirror/legacy-modes/mode/dockerfile',
                '@codemirror/legacy-modes/mode/javascript',
                '@codemirror/legacy-modes/mode/shell',
                '@codemirror/legacy-modes/mode/yaml',
                '@codemirror/state',
                '@codemirror/theme-one-dark',
                '@codemirror/view',
                '@connectrpc/connect',
                '@connectrpc/connect-web',
                'crypto-js',
                'dayjs',
                'dompurify',
                'echarts/charts',
                'echarts/components',
                'echarts/core',
                'echarts/renderers',
                'element-plus',
                'element-plus/es',
                '@element-plus/icons-vue',
                'js-base64',
                'jsencrypt',
                'lodash-es',
                'md-editor-v3',
                'monaco-editor/editor',
                'nprogress',
                'pinia',
                '@pinia/colada',
                'pinia-plugin-persistedstate',
                'punycode',
                'screenfull',
                'sortablejs',
                'tailwind-merge',
                'uuid',
                'vue',
                'vue-clipboard3',
                'vue-i18n',
                'vue-router',
                '@vue-office/docx',
                '@vue-office/excel',
                '@xterm/addon-fit',
                '@xterm/xterm',
            ],
        },
        resolve: {
            preserveSymlinks: true,
            alias: {
                '@': resolve(import.meta.dirname, './src'),
                'vue-i18n': 'vue-i18n/dist/vue-i18n.cjs.js',
            },
        },
        define: {
            __APP_INFO__: JSON.stringify(__APP_INFO__),
        },
        css: {
            preprocessorOptions: {
                scss: {
                    additionalData: `@use "@/styles/var.scss" as *;`,
                    silenceDeprecations: ['legacy-js-api'],
                },
            },
        },
        server: {
            port: viteEnv.VITE_PORT,
            open: viteEnv.VITE_OPEN,
            host: '0.0.0.0',
            sourcemapIgnoreList: (sourcePath) => {
                return sourcePath.includes('node_modules');
            },
            proxy: {
                // master 同时提供 RPC、旧协议端点与静态资源，开发期统一代理到它。
                '/rpc': {
                    target: proxyTarget,
                    changeOrigin: true,
                },
                '/files': {
                    target: proxyTarget,
                    changeOrigin: true,
                },
                '/ws': {
                    target: wsProxyTarget,
                    changeOrigin: true,
                    ws: true,
                },
                '/api/v2': {
                    target: `${proxyTarget}/`,
                    changeOrigin: true,
                    ws: true,
                    configure(proxy) {
                        proxy.on('proxyReqWs', (proxyReq, req) => {
                            if (req.headers.host) {
                                proxyReq.setHeader('Host', req.headers.host);
                            }
                        });
                    },
                },
            },
        },
        plugins: [
            // 文件路由必须放在 vue() 之前，definePage 宏才能在 SFC 编译前被提取。
            VueRouter({ extensions: ['.tsx', '.vue'], dts: 'src/types/typed-router.d.ts' }),
            benchmarkReportPlugin(import.meta.dirname),
            patchCodeFilterOverflow(),
            tailwindcss(),
            vueJsxOxc(),
            reportPlugin,
            viteEnv.VITE_BUILD_GZIP &&
                viteCompression({
                    verbose: true,
                    disable: false,
                    threshold: 10240,
                    algorithm: 'gzip',
                    ext: '.gz',
                }),
            AutoImport({
                dts: 'src/types/auto-imports.d.ts',
                // 只扫描业务源码，跳过生成代码与声明文件，减少 transform 调用。
                include: ['src/**/*.{ts,tsx}'],
                exclude: ['src/gen/**', 'src/types/**', 'src/assets/**'],
                imports: ['vue', 'vue-router'],
                resolvers: [
                    ElementPlusResolver({
                        importStyle: 'sass',
                    }),
                ],
            }),
            Components({
                dts: 'src/types/components.d.ts',
                resolvers: [
                    ElementPlusResolver({
                        importStyle: 'sass',
                    }),
                ],
            }),
            svgLoader({
                defaultImport: 'url',
            }),
        ],
        build: {
            sourcemap: false,
            outDir: 'dist',
            // Monaco 与 Element Plus 已按 vendor 拆包，单块天然超过默认 500 kB，阈值按实际体量调整。
            chunkSizeWarningLimit: 2500,
            // 产物体积由部署侧的 gzip 配置决定，构建时不必再逐块压缩统计。
            reportCompressedSize: false,
            minify: 'oxc',
            target: 'esnext',
            cssCodeSplit: false,
            rollupOptions: {
                output: {
                    chunkFileNames: 'assets/js/[name]-[hash].js',
                    entryFileNames: 'assets/js/[name]-[hash].js',
                    assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
                    minify: {
                        compress: {
                            dropDebugger: viteEnv.VITE_DROP_CONSOLE && isProduction,
                            treeshake: {
                                manualPureFunctions: viteEnv.VITE_DROP_CONSOLE ? ['console.log'] : [],
                            },
                        },
                        mangle: true,
                    },
                    manualChunks: getManualChunkName,
                },
            },
        },
    };
});
