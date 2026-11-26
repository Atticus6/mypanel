import type { Step, Stepper } from './Stepper';

interface CodemodProps {
    [key: string]: any;
    stepper?: Stepper;
    steps?: Step[];
    disable?: (index: number) => boolean;
}

const emits = {
    active: (...args: unknown[]) => true,
};

const options = {
    name: 'FuHorizontalNavigation',
    props: {
        stepper: { type: Object as PropType<Stepper> },
        steps: { type: Array as PropType<Step[]> },
        disable: { type: Function as PropType<(index: number) => boolean> },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const active = computed(() => __panelSetupProps.stepper?.index ?? 0);
        const handleClick = (index: number) => {
            if (!__panelSetupProps.disable?.(index)) {
                ctx.emit('active', index);
            }
        };
        return () => (
            <ElSteps active={unref(active)} {...__panelSetupProps.stepper}>
                {(__panelSetupProps.steps || []).map((step, index) => (
                    <ElStep
                        {...step}
                        onClick={($event?: any) => {
                            handleClick(index);
                        }}
                        class={__panelSetupProps.disable?.(index) && 'fu-step--disable'}
                        key={index}
                    />
                ))}
            </ElSteps>
        );
    },
    options,
);
