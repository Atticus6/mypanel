import { Fragment, KeepAlive, h, isVNode, resolveDirective, vShow, withDirectives } from 'vue';

export { Fragment, withDirectives };

/** 对象插槽判定：函数或普通对象，但不是 VNode。 */
export const isSlot = (value: unknown): boolean =>
    typeof value === 'function' || (Object.prototype.toString.call(value) === '[object Object]' && !isVNode(value));

const camelize = (text: string) => text.replace(/-(\w)/g, (_, char: string) => char.toUpperCase());

/**
 * 编译期就该被消掉的 Vue JSX 属性。
 *
 * 这些不是自定义指令，漏到运行时只说明编译期改写出了问题；
 * 不能交给 resolveDirective 处理，否则会报「Failed to resolve directive: model」这种误导性警告。
 */
function isCompileTimeProp(name: string): boolean {
    return (
        name === 'v-slots' ||
        name === 'v-show' ||
        name === 'v-html' ||
        name === 'v-text' ||
        name === 'v-models' ||
        name === 'v-model' ||
        name.startsWith('v-model:')
    );
}

/** 把 v-xxx 属性解析成 withDirectives 需要的数组。 */
function resolveCustomDirectives(props: Record<string, unknown>): unknown[][] {
    const directives: unknown[][] = [];
    for (const name of Object.keys(props)) {
        if (!name.startsWith('v-') || isCompileTimeProp(name)) continue;
        const segments = name.slice(2).split('.');
        const value = props[name];
        delete props[name];
        // v-node-admin 这类带连字符的指令注册名与 camelize 结果不同，两种名字都尝试。
        const directive = resolveDirective(camelize(segments[0])) ?? resolveDirective(segments[0]);
        if (!directive) continue;
        if (Array.isArray(value)) {
            directives.push([
                directive,
                value[0],
                value[1],
                value[2] ? Object.fromEntries(value[2].map((m: string) => [m, true])) : undefined,
            ]);
        } else {
            directives.push([
                directive,
                value,
                undefined,
                segments.length > 1 ? Object.fromEntries(segments.slice(1).map((m) => [m, true])) : undefined,
            ]);
        }
    }
    return directives;
}

/** 展开 transformOn 风格的 on / nativeOn 对象。 */
function expandTransformOn(props: Record<string, unknown>): void {
    for (const key of ['on', 'nativeOn']) {
        const handlers = props[key];
        if (!handlers || typeof handlers !== 'object' || Array.isArray(handlers)) continue;
        delete props[key];
        for (const [event, handler] of Object.entries(handlers)) {
            const name = event.startsWith('on') ? event : `on${event[0].toUpperCase()}${event.slice(1)}`;
            props[name] = handler;
        }
    }
}

/**
 * 对应 Babel 插件 createVNode 调用的运行时入口。
 * 负责 v-slots、v-show、自定义指令与 transformOn，其余属性原样交给 vue 的 h()。
 */
export function createVNode(
    type: unknown,
    rawProps: Record<string, unknown> | null,
    children: unknown,
    key?: unknown,
): ReturnType<typeof h> {
    const props: Record<string, unknown> = { ...(rawProps || {}) };
    delete props.children;
    if (key !== undefined && !('key' in props)) props.key = key;

    const slots = props['v-slots'];
    delete props['v-slots'];

    expandTransformOn(props);

    const directives = resolveCustomDirectives(props);
    if ('v-show' in props) {
        directives.unshift([vShow, props['v-show']]);
        delete props['v-show'];
    }

    // Vue 的 renderSlot 要求插槽函数返回数组，单个 VNode 会触发 ensureValidVNode 崩溃。
    const toArray = (value: unknown) => (Array.isArray(value) ? value : [value]);
    const isChildSlotFn = typeof children === 'function';
    const defaultSlot = () => toArray(children);
    const normalizedSlots =
        slots && typeof slots === 'object'
            ? Object.fromEntries(
                  Object.entries(slots).map(([name, fn]) => [
                      name,
                      typeof fn === 'function'
                          ? (...args: unknown[]) => toArray((fn as (...a: unknown[]) => unknown)(...args))
                          : fn,
                  ]),
              )
            : slots;
    const isComponent = typeof type === 'object' || typeof type === 'function';
    let nodeChildren = children;
    if (slots !== undefined) {
        nodeChildren =
            children === undefined || children === null
                ? normalizedSlots
                : { default: isChildSlotFn ? children : defaultSlot, ...(normalizedSlots as object) };
    } else if (isChildSlotFn) {
        nodeChildren = children;
    } else if (type === KeepAlive) {
        // Transition 离场时会克隆 KeepAlive 并把 children 置空但保留 slots 标志，
        // Vue 的 updateSlots 会对 null children 取 `._` 崩溃；用数组子节点规避该路径。
        nodeChildren =
            children === undefined || children === null ? [] : Array.isArray(children) ? children : [children];
    } else if (isComponent && type !== Fragment && children !== undefined && children !== null && !isSlot(children)) {
        nodeChildren = { default: defaultSlot };
    } else if (isSlot(children)) {
        nodeChildren = children;
    }

    // Fragment 的 children 必须是数组；字符串 / VNode / null 都会让 Vue 的 ensureValidVNode 递归时崩溃。
    if (type === Fragment) {
        // Element Plus 的 ElSelect 会递归读取子节点数组，条件分支留下的 null 会让它崩溃；
        // Fragment 只承载真实子节点，过滤掉空值。
        nodeChildren = (
            Array.isArray(nodeChildren)
                ? nodeChildren
                : nodeChildren === undefined || nodeChildren === null
                  ? []
                  : [nodeChildren]
        ).filter((child) => child !== null && child !== undefined && child !== false);
    }

    const vnode = h(type as never, props as never, nodeChildren as never);
    return directives.length ? withDirectives(vnode, directives as never) : vnode;
}

/** oxc 自动运行时入口，签名与 vue/jsx-runtime 一致。 */
export function jsx(type: unknown, props: Record<string, unknown>, key?: unknown): ReturnType<typeof h> {
    return createVNode(type, props, props?.children, key);
}

export const jsxs = jsx;
export const jsxDEV = jsx;
/** 开发模式下 oxc 的经典分支会额外请求 createElement。 */
export const createElement = jsx;
