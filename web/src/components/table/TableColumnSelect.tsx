import { Setting } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import type { FuTableColumnConfig } from './shared';

interface CodemodProps {
    [key: string]: any;
    columns?: FuTableColumnConfig[];
    title?: string;
    icon?: string | Record<string, any>;
    onlyIcon?: boolean;
    trigger?: string;
    popperClass?: string;
}

const emits = {};

const options = {
    name: 'FuTableColumnSelect',
    props: {
        columns: {
            type: Array as PropType<FuTableColumnConfig[]>,
            default: () => [],
        },
        title: {
            type: String,
            default: '',
        },
        icon: {
            type: [String, Object],
            default: undefined,
        },
        onlyIcon: {
            type: Boolean,
            default: false,
        },
        trigger: {
            type: String,
            default: 'click',
        },
        popperClass: {
            type: String,
            default: '',
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { t } = useI18n();
        const visible = ref(false);
        const resolvedTitle = computed(() => __panelSetupProps.title || t('fu.table.custom_table_rows'));
        const resolvedPopperClass = computed(() =>
            ['fu-table-column-select__popover', __panelSetupProps.popperClass].filter(Boolean).join(' '),
        );
        const iconComponent = computed(() => __panelSetupProps.icon || Setting);
        const estimateTextWidth = (text: string) => {
            return Array.from(text).reduce((total, char) => total + (char.charCodeAt(0) > 255 ? 14 : 8), 0);
        };
        const popoverWidth = computed(() => {
            const texts = [
                resolvedTitle.value,
                ...__panelSetupProps.columns.map((column) => String(column.label || '')),
            ];
            const contentWidth = texts.reduce((maxWidth, text) => Math.max(maxWidth, estimateTextWidth(text)), 0);
            return Math.min(Math.max(contentWidth + 72, 180), 320);
        });
        const isFixedColumn = (column: FuTableColumnConfig) => {
            return Boolean(column.fixed);
        };
        return () => (
            <div class={'fu-search-bar fu-table-column-select'}>
                <ElPopover
                    visible={unref(visible)}
                    onUpdate:visible={($v) => {
                        visible.value = $v as any;
                    }}
                    trigger={__panelSetupProps.trigger}
                    popper-class={unref(resolvedPopperClass)}
                    placement="bottom-end"
                    width={unref(popoverWidth)}
                    v-slots={{
                        reference: () => (
                            <>
                                <ElButton
                                    icon={unref(iconComponent)}
                                    onClick={($event?: any) => {
                                        $event.stopPropagation();
                                    }}
                                    class={'fu-search-bar-button'}
                                >
                                    {!__panelSetupProps.onlyIcon ? <span>{unref(resolvedTitle)}</span> : null}
                                </ElButton>
                            </>
                        ),
                    }}
                >
                    <div
                        onClick={($event?: any) => {
                            $event.stopPropagation();
                        }}
                        class={'fu-table-column-select__panel'}
                    >
                        <div class={'fu-table-column-select__title'}>{unref(resolvedTitle)}</div>
                        <div class={'fu-table-column-select__list'}>
                            {(__panelSetupProps.columns || []).map((column) => (
                                <div class={'fu-table-column-select__item'} key={column.key}>
                                    <ElCheckbox
                                        modelValue={column.show}
                                        onUpdate:modelValue={($v) => {
                                            column.show = $v as any;
                                        }}
                                        disabled={isFixedColumn(column)}
                                    >
                                        {column.label}
                                    </ElCheckbox>
                                </div>
                            ))}
                        </div>
                    </div>
                </ElPopover>
            </div>
        );
    },
    options,
);
