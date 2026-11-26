import { KeepAlive } from 'vue';
import {
    getTabCacheName,
    routeCacheContextKey,
    type KeepAlivePattern,
    type RouteCacheContext,
} from '@/utils/tab-cache';
import {
    computed,
    cloneVNode,
    h,
    Transition,
    defineComponent,
    inject,
    provide,
    type Component as VueComponent,
    type PropType,
    type VNode,
} from 'vue';
import type { RouteRecordName } from 'vue-router';
import { Fragment, unref, withDirectives } from 'vue';
import { type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { RouterView } from 'vue-router';

interface CodemodProps {
    [key: string]: any;
    keepAlive?: KeepAlivePattern | null;
    routeProps?: Record<string, unknown>;
    withTransition?: boolean;
}

const emits = {};

const options = {
    name: 'router-view-cache',
    props: {
        keepAlive: { type: null },
        routeProps: Object,
        withTransition: Boolean,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const inheritedCacheContext = inject(routeCacheContextKey, null);
        const localCacheContext: RouteCacheContext = {
            include: computed<KeepAlivePattern>(() => {
                return __panelSetupProps.keepAlive ?? [];
            }),
            tabCacheEnabled: computed(
                () => __panelSetupProps.keepAlive !== undefined && __panelSetupProps.keepAlive !== null,
            ),
        };
        const cacheContext = inheritedCacheContext || localCacheContext;
        if (!inheritedCacheContext) {
            provide(routeCacheContextKey, cacheContext);
        }
        const include = cacheContext.include;
        const routeWrappers = new Map<string, VueComponent>();
        const getRouteWrapper = (path: string, routeName?: RouteRecordName | null) => {
            const wrapperName = cacheContext.tabCacheEnabled.value
                ? getTabCacheName(path)
                : String(routeName || getTabCacheName(path));
            let wrapper = routeWrappers.get(wrapperName);
            if (!wrapper) {
                wrapper = defineComponent({
                    name: wrapperName,
                    props: {
                        routeComponent: {
                            type: Object as PropType<VNode>,
                            required: true,
                        },
                        routeProps: {
                            type: Object as PropType<Record<string, unknown>>,
                            required: false,
                        },
                    },
                    setup(wrapperProps: any) {
                        return () => {
                            return wrapperProps.routeProps
                                ? cloneVNode(wrapperProps.routeComponent, wrapperProps.routeProps)
                                : wrapperProps.routeComponent;
                        };
                    },
                });
                routeWrappers.set(wrapperName, wrapper);
            }
            return wrapper;
        };
        return () => (
            <RouterView
                v-slots={{
                    default: ({ Component, route }) => (
                        <>
                            <Transition
                                appear={__panelSetupProps.withTransition}
                                css={__panelSetupProps.withTransition}
                                name={__panelSetupProps.withTransition ? 'fade-transform' : undefined}
                                mode={__panelSetupProps.withTransition ? 'out-in' : undefined}
                            >
                                <KeepAlive include={include.value}>
                                    {h(getRouteWrapper(route.path, route.name), {
                                        routeComponent: Component,
                                        routeProps: __panelSetupProps.routeProps,
                                        key: route.path,
                                    })}
                                </KeepAlive>
                            </Transition>
                        </>
                    ),
                }}
            />
        );
    },
    options,
);
