import { h } from 'vue';
import { computed, type PropType } from 'vue';
import { useI18n } from 'vue-i18n';
import { isOperationDisabled, isOperationVisible, type FuTableOperationButton } from './shared';
type DropdownTrigger = 'hover' | 'click' | 'contextmenu';
type DropdownTriggerValue = DropdownTrigger | DropdownTrigger[];
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElButton } from 'element-plus';
import { ElIcon } from 'element-plus';
import { ElBadge } from 'element-plus';
import { ElDropdown } from 'element-plus';
import { ElDropdownMenu } from 'element-plus';
import { ElDropdownItem } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
    buttons?: FuTableOperationButton[];
    row?: Record<string, any>;
    ellipsis?: number;
    extra?: number;
    trigger?: DropdownTriggerValue;
    dropdownStyle?: Record<string, string> | undefined;
}

const emits = {};

const options = {
    name: 'FuTableOperationActions',
    props: {
        buttons: { type: Array as PropType<FuTableOperationButton[]>, default: () => [] },
        row: { type: Object, required: true },
        ellipsis: { type: Number, default: 2 },
        extra: { type: Number, default: 0 },
        trigger: {
            type: [String, Array] as PropType<DropdownTriggerValue>,
            default: 'hover',
        },
        dropdownStyle: { type: Object as PropType<Record<string, string> | undefined>, default: undefined },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { t } = useI18n();
        const actions = computed(() => {
            const visible = __panelSetupProps.buttons.filter((button) =>
                isOperationVisible(button, __panelSetupProps.row),
            );
            const limit = Math.max(__panelSetupProps.ellipsis + __panelSetupProps.extra, 0);
            return {
                inline: limit > 0 ? visible.slice(0, limit) : [],
                more: visible.slice(limit),
            };
        });
        const hasDot = (button: FuTableOperationButton) =>
            typeof button.dot === 'function' ? button.dot(__panelSetupProps.row) : Boolean(button.dot);
        const handleButtonClick = (button: FuTableOperationButton) => {
            if (!isOperationDisabled(button, __panelSetupProps.row)) {
                button.click?.(__panelSetupProps.row);
            }
        };
        const getButtonKey = (button: FuTableOperationButton, index: number) =>
            button.key ?? `${button.label || button.command || button.type || button.icon?.name || 'button'}-${index}`;
        return () => (
            <div
                onClick={($event?: any) => {
                    $event.stopPropagation();
                }}
                class={'fu-table-operations'}
            >
                {(unref(actions).inline || []).map((button, index) => (
                    <span class={'fu-table-operations__action'} key={getButtonKey(button, index)}>
                        <ElButton
                            link
                            type={button.type || 'primary'}
                            disabled={isOperationDisabled(button, __panelSetupProps.row)}
                            onClick={($event?: any) => {
                                $event.stopPropagation();
                                handleButtonClick(button);
                            }}
                            class={'fu-table-operations__button'}
                        >
                            {button.icon ? (
                                <ElIcon class={'mr-1'}>
                                    {h(button.icon, {  })}
                                </ElIcon>
                            ) : null}
                            <ElBadge is-dot hidden={!hasDot(button)}>
                                <span>{button.label}</span>
                            </ElBadge>
                        </ElButton>
                    </span>
                ))}
                {unref(actions).more.length ? (
                    <span class={'fu-table-operations__action'}>
                        <ElDropdown
                            trigger={__panelSetupProps.trigger}
                            onCommand={($event?: any) => {
                                (handleButtonClick as any)($event);
                            }}
                            class={'fu-table-more-button'}
                            v-slots={{
                                dropdown: () => (
                                    <>
                                        <ElDropdownMenu style={__panelSetupProps.dropdownStyle}>
                                            {(unref(actions).more || []).map((button, index) => (
                                                <ElDropdownItem
                                                    command={button}
                                                    disabled={isOperationDisabled(button, __panelSetupProps.row)}
                                                    divided={button.divided}
                                                    key={getButtonKey(button, index)}
                                                >
                                                    {button.icon ? (
                                                        <ElIcon class={'mr-1'}>
                                                            {h(button.icon, {  })}
                                                        </ElIcon>
                                                    ) : null}
                                                    <ElBadge is-dot hidden={!hasDot(button)}>
                                                        <span>{button.label}</span>
                                                    </ElBadge>
                                                </ElDropdownItem>
                                            ))}
                                        </ElDropdownMenu>
                                    </>
                                ),
                            }}
                        >
                            <span class={'fu-table-operations__dropdown-trigger'}>
                                <ElButton link type="primary" class={'fu-table-operations__button'}>
                                    <ElBadge is-dot hidden={!unref(actions).more.some(hasDot)}>
                                        {unref(t)('fu.table.more')}
                                    </ElBadge>
                                </ElButton>
                            </span>
                        </ElDropdown>
                    </span>
                ) : null}
            </div>
        );
    },
    options,
);
