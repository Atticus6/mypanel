interface CodemodProps {
    [key: string]: any;
    modelValue?: string | number;
    writeTrigger?: string;
}

const emits = {
    'update:modelValue': (...args: unknown[]) => true,
    input: (...args: unknown[]) => true,
    blur: (...args: unknown[]) => true,
    enter: (...args: unknown[]) => true,
};

const options = {
    name: 'FuInputRwSwitch',
    props: {
        modelValue: {
            type: [String, Number],
            default: '',
        },
        writeTrigger: {
            type: String,
            default: 'onClick',
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    inheritAttrs: false,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const inputRef = ref();
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
            inputRef.value?.focus?.();
            inputRef.value?.select?.();
        };
        const closeWrite = () => {
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
        const handleUpdate = (value: string | number) => {
            ctx.emit('update:modelValue', value);
        };
        const handleInput = (value: string) => {
            ctx.emit('input', value);
        };
        const handleBlur = (event: FocusEvent) => {
            ctx.emit('blur', event);
            closeWrite();
        };
        const handleEnter = (event: KeyboardEvent) => {
            ctx.emit('enter', event);
            closeWrite();
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
            <div class={'fu-input-rw-switch'}>
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
                        class={'fu-input-rw-switch__read'}
                    >
                        <span class={'fu-input-rw-switch__text'}>{unref(displayValue)}</span>
                    </div>
                ) : (
                    <ElInput
                        ref={inputRef}
                        {...ctx.attrs}
                        model-value={__panelSetupProps.modelValue}
                        onUpdate:model-value={($event?: any) => {
                            (handleUpdate as any)($event);
                        }}
                        onInput={($event?: any) => {
                            (handleInput as any)($event);
                        }}
                        onBlur={($event?: any) => {
                            (handleBlur as any)($event);
                        }}
                        onKeyup={($event?: any) => {
                            if (!($event.key === 'Enter')) return;
                            (handleEnter as any)($event);
                        }}
                        onClick={($event?: any) => {
                            $event.stopPropagation();
                        }}
                    />
                )}
            </div>
        );
    },
    options,
);
