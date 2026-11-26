interface CodemodProps {
    [key: string]: any;
    modelValue?: string | number | boolean;
    blurTime?: number;
    writeTrigger?: string;
}

const emits = {
    'update:modelValue': (...args: unknown[]) => true,
    input: (...args: unknown[]) => true,
    blur: (...args: unknown[]) => true,
    change: (...args: unknown[]) => true,
};

type SlotsShape = {
    read: (arg?: unknown) => VNode[];
    default: (arg?: unknown) => VNode[];
};

const options = {
    name: 'FuSelectRwSwitch',
    props: {
        modelValue: {
            type: [String, Number, Boolean],
            default: '',
        },
        blurTime: {
            type: Number,
            default: 150,
        },
        writeTrigger: {
            type: String,
            default: 'onClick',
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
    inheritAttrs: false,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        const selectRef = ref();
        const isWrite = ref(false);
        const permissionDisabled = ref(false);
        const effectiveWriteTrigger = computed(() => {
            return permissionDisabled.value ? 'disabled' : __panelSetupProps.writeTrigger;
        });
        const displayValue = computed(() => {
            return __panelSetupProps.modelValue === '' ||
                __panelSetupProps.modelValue === undefined ||
                __panelSetupProps.modelValue === null
                ? '-'
                : String(__panelSetupProps.modelValue);
        });
        const openWrite = async () => {
            isWrite.value = true;
            await nextTick();
            selectRef.value?.focus?.();
        };
        const closeWrite = () => {
            window.setTimeout(() => {
                isWrite.value = false;
            }, __panelSetupProps.blurTime);
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
        const handleUpdate = (value: string | number | boolean) => {
            ctx.emit('update:modelValue', value);
            ctx.emit('input', value);
        };
        const handleChange = (value: string | number | boolean) => {
            ctx.emit('change', value);
            closeWrite();
        };
        const handleBlur = (event: FocusEvent) => {
            ctx.emit('blur', event);
            closeWrite();
        };
        const handleVisibleChange = (visible: boolean) => {
            if (!visible) {
                closeWrite();
            }
        };
        ctx.expose({
            setPermissionDisabled: (disabled: boolean) => {
                permissionDisabled.value = disabled;
                if (disabled) {
                    isWrite.value = false;
                }
            },
        });
        return () => (
            <div class={'fu-select-rw-switch'}>
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
                        class={'fu-select-rw-switch__read'}
                    >
                        {ctx.slots['read']?.(undefined) ?? (
                            <>
                                <span class={'fu-select-rw-switch__text'}>{unref(displayValue)}</span>
                            </>
                        )}
                    </div>
                ) : (
                    <ElSelect
                        ref={selectRef}
                        {...ctx.attrs}
                        model-value={__panelSetupProps.modelValue}
                        onUpdate:model-value={($event?: any) => {
                            (handleUpdate as any)($event);
                        }}
                        onChange={($event?: any) => {
                            (handleChange as any)($event);
                        }}
                        onBlur={($event?: any) => {
                            (handleBlur as any)($event);
                        }}
                        onVisibleChange={($event?: any) => {
                            (handleVisibleChange as any)($event);
                        }}
                        onClick={($event?: any) => {
                            $event.stopPropagation();
                        }}
                    >
                        {ctx.slots['default']?.(undefined)}
                    </ElSelect>
                )}
            </div>
        );
    },
    options,
);
