import './FuDropdownItem.styles.css';

interface CodemodProps {
    [key: string]: any;
    disabled?: boolean;
}

const emits = {};

type SlotsShape = {
    default: (arg?: unknown) => VNode[];
};

const options = {
    name: 'FuDropdownItem',
    props: {
        disabled: {
            type: Boolean,
            default: false,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
    __scopeId: 'data-v-85aae938',
    inheritAttrs: false,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        const permissionDisabled = ref(false);
        const computedDisabled = computed(() => __panelSetupProps.disabled || permissionDisabled.value);
        ctx.expose({
            setPermissionDisabled: (disabled: boolean) => {
                permissionDisabled.value = disabled;
            },
        });
        return () => (
            <span class={'fu-dropdown-item'}>
                <ElDropdownItem
                    {...ctx.attrs}
                    disabled={unref(computedDisabled)}
                    class={{ 'fu-dropdown-item--permission-disabled': unref(computedDisabled) }}
                >
                    {ctx.slots['default']?.(undefined)}
                </ElDropdownItem>
            </span>
        );
    },
    options,
);
