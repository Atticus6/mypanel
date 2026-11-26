# oxc-plugin-jsx

用 oxc 替代 `@vitejs/plugin-vue-jsx` 的 Vue 3 JSX 插件。Babel 逐文件解析/生成是构建热点，这里只让 oxc 做一次源码改写，通用 JSX 交给 Vite 内置的 oxc transformer。

## 使用

```ts
import vueJsxOxc from './oxc-plugin-jsx/index.ts';

export default defineConfig({
    plugins: [vueJsxOxc()],
});
```

插件会自动配置 `oxc.jsx` 的自动运行时，并把 `vue-jsx-runtime/jsx-runtime`、`jsx-dev-runtime` 别名到本目录的 `runtime.ts`。

## 已复刻的能力

参照 `@vue/babel-plugin-jsx`，按「编译期改写 + 运行时承接」实现：

| 能力                                          | 实现位置                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------ |
| JSX 元素 / Fragment / 文本 / 展开属性         | oxc transformer 通用 JSX 转换                                                  |
| `v-slots`（含与普通子节点合并、对象插槽判定） | `runtime.ts`                                                                   |
| 组件子节点惰性 `default` 插槽                 | `transform.ts`，避免未打开的抽屉提前渲染子组件                                 |
| `v-model`（参数、修饰符、数组形式）           | `transform.ts`，保留左值表达式                                                 |
| `v-models` 多重绑定                           | `transform.ts`                                                                 |
| `v-html` / `v-text`                           | `transform.ts` 改写为 `innerHTML` / `textContent`                              |
| `v-show` 与自定义 `v-xxx` 指令                | `runtime.ts`，`withDirectives` + `resolveDirective`                            |
| `transformOn`（`on` / `nativeOn` 对象）       | `runtime.ts`                                                                   |
| `xlink:Href` 命名空间                         | `transform.ts`                                                                 |
| `mergeProps`、`enableObjectSlots`、`pragma`   | 选项保留，`runtime.ts` 按 Vue 语义处理                                         |
| 开发期组件级热更新                            | `hmr.ts`，对齐官方插件的 `__VUE_HMR_RUNTIME__` 注册与 `import.meta.hot.accept` |
| SSR 模块登记                                  | 暂未实现（本项目无 SSR）                                                       |

## 未实现（与编译优化相关）

- `optimize: true` 对应的 `patchFlag` / 动态属性列表：oxc 的 JSX 转换不暴露插入额外调用参数的钩子。
- `resolveType`：Babel 插件的实验性类型推导，与 oxc 的转译模型不匹配。
- `isCustomElement` 标签级区分：仅影响子节点是否按组件插槽处理，可由 `v-slots` 显式控制。

## 测试

```bash
bun test oxc-plugin-jsx
```
