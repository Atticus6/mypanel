/**
 * 与 @vue/babel-plugin-jsx 对齐的选项。
 *
 * transformOn / optimize / mergeProps / isCustomElement / enableObjectSlots /
 * pragma / resolveType 都保留同名入口，便于从 Babel 插件平滑迁移。
 */
export interface VueJSXPluginOptions {
    /** 把 `on`、`nativeOn` 对象展开成 onClick 等事件属性。 */
    transformOn?: boolean;
    /**
     * 生成 patchFlag / 动态属性列表等编译期优化信息。
     * oxc 的 JSX 转换不暴露插入额外调用参数的钩子，该选项仅保留兼容，不产生优化标记。
     */
    optimize?: boolean;
    /** 合并静态与动态 class / style / 事件属性。 */
    mergeProps?: boolean;
    /** 配置自定义元素，影响子节点是否按组件插槽处理。 */
    isCustomElement?: (tag: string) => boolean;
    /** 启用对象形式插槽，默认开启。 */
    enableObjectSlots?: boolean;
    /** 替换 createVNode 的调用名。 */
    pragma?: string;
    /** 从类型推导组件元数据，Babel 插件里的实验特性，oxc 版不实现。 */
    resolveType?: boolean | Record<string, unknown>;
}

/** 插件内部使用的归一化选项。 */
export interface ResolvedOptions {
    transformOn: boolean;
    optimize: boolean;
    mergeProps: boolean;
    isCustomElement?: (tag: string) => boolean;
    enableObjectSlots: boolean;
    pragma?: string;
}

/** 填好默认值，避免 transform 里到处判空。 */
export function resolveOptions(options: VueJSXPluginOptions): ResolvedOptions {
    return {
        transformOn: options.transformOn ?? false,
        optimize: options.optimize ?? false,
        mergeProps: options.mergeProps ?? true,
        isCustomElement: options.isCustomElement,
        enableObjectSlots: options.enableObjectSlots ?? true,
        pragma: options.pragma,
    };
}
