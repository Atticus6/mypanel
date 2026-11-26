interface CodemodProps {
    [key: string]: any;
    disabled?: boolean;
}

const emits = {};

type SlotsShape = {
    default: (arg?: unknown) => VNode[];
};

const options = {
    name: 'FuStepButton',
    props: {
        disabled: {
            type: Boolean,
            default: false,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        return () => (
            <ElButton disabled={__panelSetupProps.disabled} {...ctx.attrs}>
                {ctx.slots['default']?.(undefined)}
            </ElButton>
        );
    },
    options,
);
