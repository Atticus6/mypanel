import { computed, type PropType } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import FuTableOperationActions from './TableOperationActions';
import type { FuTableOperationButton } from './shared';
type DropdownTrigger = 'hover' | 'click' | 'contextmenu';
type DropdownTriggerValue = DropdownTrigger | DropdownTrigger[];
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElTableColumn } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
    buttons?: any[];
    label?: string;
    width?: number | string;
    minWidth?: number | string;
    align?: string;
    ellipsis?: number;
    trigger?: DropdownTriggerValue;
    fixed?: boolean | string;
    fix?: boolean | string;
    maxHeight?: number | string;
    cardRow?: Record<string, any>;
}

const emits = {};

const options = {
    name: 'FuTableOperations',
    props: {
        buttons: {
            type: Array as PropType<FuTableOperationButton[]>,
            default: () => [],
        },
        label: {
            type: String,
            default: '',
        },
        width: {
            type: [Number, String],
            default: undefined,
        },
        minWidth: {
            type: [Number, String],
            default: undefined,
        },
        align: {
            type: String,
            default: 'center',
        },
        ellipsis: {
            type: Number,
            default: 2,
        },
        trigger: {
            type: [String, Array] as PropType<DropdownTriggerValue>,
            default: undefined,
        },
        fixed: {
            type: [Boolean, String],
            default: undefined,
        },
        fix: {
            type: [Boolean, String],
            default: undefined,
        },
        maxHeight: {
            type: [Number, String],
            default: undefined,
        },
        cardRow: {
            type: Object,
            default: undefined,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const normalizeWidth = (value?: string | number) => {
            if (value === undefined || value === null || value === '') {
                return undefined;
            }
            if (typeof value === 'number') {
                return value;
            }
            const trimmed = value.trim();
            if (!trimmed || trimmed === 'auto') {
                return undefined;
            }
            return trimmed;
        };
        const hasFinePointer = useMediaQuery('(hover: hover) and (pointer: fine)');
        const resolvedTrigger = computed<DropdownTriggerValue>(
            () => __panelSetupProps.trigger ?? (hasFinePointer.value ? 'hover' : 'click'),
        );
        const resolvedFixed = computed(() => {
            if (__panelSetupProps.fixed !== undefined) {
                return __panelSetupProps.fixed;
            }
            if (typeof __panelSetupProps.fix === 'string') {
                return __panelSetupProps.fix;
            }
            return __panelSetupProps.fix ? 'right' : false;
        });
        const hasDynamicShow = computed(() => {
            return __panelSetupProps.buttons.some((button) => typeof button.show === 'function');
        });
        const staticVisibleCount = computed(() => {
            return __panelSetupProps.buttons.filter((button) => button.show !== false).length;
        });
        const estimatedVisibleCount = computed(() => {
            if (staticVisibleCount.value === 0) {
                return 0;
            }

            const renderCap = Math.max(__panelSetupProps.ellipsis, 0) + 1;
            if (hasDynamicShow.value) {
                return renderCap;
            }

            return Math.min(staticVisibleCount.value, renderCap);
        });
        const estimatedWidth = computed(() => {
            const buttonsWidth = 35 + estimatedVisibleCount.value * 58 + 58;
            const minWidth = normalizeWidth(__panelSetupProps.minWidth);
            if (typeof minWidth === 'number') {
                return Math.max(buttonsWidth, minWidth);
            }
            if (typeof minWidth === 'string') {
                const parsed = Number(minWidth.replace('px', ''));
                if (!Number.isNaN(parsed)) {
                    return Math.max(buttonsWidth, parsed);
                }
            }
            return buttonsWidth;
        });
        const resolvedWidth = computed(() => {
            if (__panelSetupProps.width === 'auto') {
                return undefined;
            }
            return normalizeWidth(__panelSetupProps.width) ?? estimatedWidth.value;
        });
        const resolvedMinWidth = computed(() => {
            return __panelSetupProps.width === 'auto' ? normalizeWidth(__panelSetupProps.minWidth) : undefined;
        });
        const dropdownStyle = computed(() => {
            if (
                __panelSetupProps.maxHeight === undefined ||
                __panelSetupProps.maxHeight === null ||
                __panelSetupProps.maxHeight === ''
            ) {
                return undefined;
            }
            const maxHeight =
                typeof __panelSetupProps.maxHeight === 'number'
                    ? `${__panelSetupProps.maxHeight}px`
                    : __panelSetupProps.maxHeight;
            return {
                maxHeight,
                overflowY: 'auto',
            };
        });
        return () => (
            <>
                {__panelSetupProps.cardRow ? (
                    <FuTableOperationActions
                        buttons={__panelSetupProps.buttons}
                        row={__panelSetupProps.cardRow}
                        ellipsis={__panelSetupProps.ellipsis}
                        extra={2}
                        trigger={unref(resolvedTrigger)}
                        dropdown-style={unref(dropdownStyle)}
                    />
                ) : (
                    <ElTableColumn
                        {...ctx.attrs}
                        label={__panelSetupProps.label}
                        width={unref(resolvedWidth)}
                        min-width={unref(resolvedMinWidth)}
                        align={__panelSetupProps.align}
                        fixed={unref(resolvedFixed)}
                        v-slots={{
                            default: ({ row }) => (
                                <>
                                    <FuTableOperationActions
                                        buttons={__panelSetupProps.buttons}
                                        row={row}
                                        ellipsis={__panelSetupProps.ellipsis}
                                        trigger={unref(resolvedTrigger)}
                                        dropdown-style={unref(dropdownStyle)}
                                    />
                                </>
                            ),
                        }}
                    />
                )}
            </>
        );
    },
    options,
);
