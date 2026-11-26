interface CodemodProps {
    [key: string]: any;
    modelValue?: string | number | boolean | Record<string, any> | unknown[];
    data?: string | number | boolean | Record<string, any> | unknown[];
    writeTrigger?: string;
}

const emits = {
    'update:modelValue': (...args: unknown[]) => true,
    change: (...args: unknown[]) => true,
};

type SlotsShape = {
    read: (arg?: unknown) => VNode[];
    default: (arg?: unknown) => VNode[];
};

const options = {
    name: 'FuReadWriteSwitch',
    props: {
        modelValue: {
            type: [String, Number, Boolean, Object, Array],
            default: '',
        },
        data: {
            type: [String, Number, Boolean, Object, Array],
            default: '',
        },
        writeTrigger: {
            type: String,
            default: 'onClick',
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        const isWrite = ref(false);
        const permissionDisabled = ref(false);
        const effectiveWriteTrigger = computed(() => {
            return permissionDisabled.value ? 'disabled' : __panelSetupProps.writeTrigger;
        });
        const displayValue = computed(() => {
            const value =
                __panelSetupProps.modelValue !== '' && __panelSetupProps.modelValue !== undefined
                    ? __panelSetupProps.modelValue
                    : __panelSetupProps.data;
            return value === '' || value === undefined || value === null ? '-' : String(value);
        });
        const openWrite = () => {
            isWrite.value = true;
        };
        const closeWrite = (value?: any) => {
            if (value !== undefined) {
                ctx.emit('update:modelValue', value);
                ctx.emit('change', value);
            }
            isWrite.value = false;
        };
        const handleReadClick = () => {
            if (effectiveWriteTrigger.value === 'onClick') {
                openWrite();
            }
        };
        const handleReadDblClick = () => {
            if (effectiveWriteTrigger.value === 'onDblclick') {
                openWrite();
            }
        };
        ctx.expose({
            setPermissionDisabled: (disabled: boolean) => {
                permissionDisabled.value = disabled;
                if (disabled) {
                    isWrite.value = false;
                }
            },
            write: openWrite,
            read: closeWrite,
        });
        return () => (
            <div class={'fu-read-write-switch'}>
                {!unref(isWrite) ? (
                    <div
                        onClick={($event?: any) => {
                            $event.stopPropagation();
                            (handleReadClick as any)($event);
                        }}
                        onDblclick={($event?: any) => {
                            $event.stopPropagation();
                            (handleReadDblClick as any)($event);
                        }}
                        class={'fu-read-write-switch__read'}
                    >
                        {ctx.slots['read']?.({ write: openWrite }) ?? (
                            <>
                                <span class={'fu-read-write-switch__text'}>{unref(displayValue)}</span>
                            </>
                        )}
                    </div>
                ) : (
                    <div
                        onClick={($event?: any) => {
                            $event.stopPropagation();
                        }}
                        class={'fu-read-write-switch__write'}
                    >
                        {ctx.slots['default']?.({ read: closeWrite })}
                    </div>
                )}
            </div>
        );
    },
    options,
);
