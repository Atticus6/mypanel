/// <reference types="vite/client" />
/// <reference types="vue-router/auto" />

declare module '*.vue' {
    const component: DefineComponent<{}, {}, any>;
    export default component;
}

declare module '*.svg?component' {
    import type { DefineComponent } from 'vue';
    const component: DefineComponent;
    export default component;
}

declare module 'virtual:benchmark-report' {
    export const script: string;
    export const styles: string;
}
