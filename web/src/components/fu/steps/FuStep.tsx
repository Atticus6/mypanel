import type { Stepper } from './Stepper';

interface CodemodProps {
    [key: string]: any;
    id?: string;
    title?: string;
    description?: string;
    status?: string;
    icon?: string;
}

const emits = {};

type SlotsShape = {
    default: (arg?: unknown) => VNode[];
};

const options = {
    name: 'FuStep',
    props: {
        id: {
            type: String,
            default: '',
        },
        title: {
            type: String,
            default: '',
        },
        description: {
            type: String,
            default: '',
        },
        status: {
            type: String,
            default: '',
        },
        icon: {
            type: String,
            default: '',
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        const stepper = inject<Stepper>('stepper');
        const loading = computed(() => {
            return stepper?.isLoading || false;
        });
        return () =>
            withDirectives(<div class={'fu-step'}>{ctx.slots['default']?.(undefined)}</div>, [
                [vLoading, unref(loading)],
            ]);
    },
    options,
);
