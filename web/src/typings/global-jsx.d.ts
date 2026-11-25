/** TSX 中模板式全局 i18n 方法的类型声明（运行时由 vue-i18n 注入到组件代理）。 */
declare global {
    /** 所有组件共有的 JSX 属性：由 Vue JSX 插件在编译期注入，统一在这里给出具体类型。 */
    interface CommonJsxProps {
        class?: unknown;
        style?: unknown;
        'v-slots'?: Record<string, (...args: unknown[]) => unknown>;
        onMouseenter?: (...args: unknown[]) => unknown;
    }

    const $t: (key: string, ...values: unknown[]) => string;
    const $route: import('vue-router').RouteLocationNormalizedLoaded;
    /** 历史遗留类型：原 SFC 中未声明来源，转换后补一个宽松别名。 */
    type CronjobAlertTriggerMode = string;
    type Locale = Record<string, string>;
    /** 原 SFC 中散落的命名空间类型引用，转换后补宽松别名。 */
}

declare module 'vue' {
    interface ComponentCustomProps {
        [key: string]: unknown;
    }
    /** JSX 中由 v-model / v-on 展开出的事件属性由编译期生成，需显式声明以免被当作未知属性。 */
}

/** 文件路由 definePage 宏支持菜单排序与隐藏等自定义字段。 */
declare module 'vue-router/experimental' {
    interface DefinePage<FilePath extends string = string, Component = unknown> {
        hidden?: boolean;
        sort?: number;
    }
}

declare module '@vue/runtime-core' {
    interface ComponentCustomProps {
        [key: string]: unknown;
    }
}

export {};
