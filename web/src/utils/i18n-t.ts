import i18n from '@/lang';

/** TSX 中替代模板隐式 $t 的运行时实现，供各组件显式导入。 */
export const $t = (key: string, ...values: unknown[]) =>
    (i18n.global.t as (...args: unknown[]) => string)(key, ...values);
