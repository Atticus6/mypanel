import { routerToName, routerToPath, type RouteName } from '@/utils/router';
import { inject, useSlots } from 'vue';
import { useRouter } from 'vue-router';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElPageHeader } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
    path?: string;
    name?: RouteName;
    to?: Record<string, any>;
    header?: string;
    reload?: boolean;
}

const emits = {};

type SlotsShape = {
    buttons: (arg?: unknown) => VNode[];
};

const options = {
    name: 'back-button',
    props: {
        path: { type: String },
        name: { type: String },
        to: { type: Object },
        header: { type: String },
        reload: { type: Boolean },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        const slots = useSlots();
        const router = useRouter();
        function jump() {
            const { path, name, to, reload } = __panelSetupProps;
            if (reload) {
                reloadPage();
            }
            if (path) {
                routerToPath(path);
            }
            if (name) {
                routerToName(name);
            }
            if (to) {
                router.push(to);
            }
        }
        let reloadPage: Function = inject('reload');
        return () => (
            <ElPageHeader
                content={__panelSetupProps.header}
                onBack={($event?: any) => {
                    (jump as any)($event);
                }}
                v-slots={{ content: () => <>{ctx.slots['buttons']?.(undefined)}</> }}
            />
        );
    },
    options,
);
