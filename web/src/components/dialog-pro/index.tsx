import { computed, useSlots } from 'vue';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElDialog } from 'element-plus';
import { ElRow } from 'element-plus';
import { ElCol } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
    title?: string;
    showClose?: boolean;
    closeOnClickModal?: boolean;
    size?: string;
    modelValue?: boolean;
}

const emits = {
    'update:modelValue': (...args: unknown[]) => true,
    close: (...args: unknown[]) => true,
    open: (...args: unknown[]) => true,
    opened: (...args: unknown[]) => true,
};

type SlotsShape = {
    header: (arg?: unknown) => VNode[];
    content: (arg?: unknown) => VNode[];
    default: (arg?: unknown) => VNode[];
    footer: (arg?: unknown) => VNode[];
};

const options = {
    name: 'DialogPro',
    props: {
        title: { type: String },
        showClose: {
            type: Boolean,
            default: true,
        },
        closeOnClickModal: {
            type: Boolean,
            default: false,
        },
        size: {
            type: String,
            default: 'normal',
        },
        modelValue: {
            type: Boolean,
            default: false,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        const slots = useSlots();
        const size = computed(() => {
            switch (__panelSetupProps.size) {
                case 'mini':
                    return '20%';
                case 'small':
                    return '30%';
                case 'normal':
                    return '40%';
                case 'large':
                    return '50%';
                case 'full':
                    return '100%';
                case 'w-60':
                    return '60%';
                case 'w-70':
                    return '70%';
                case 'w-90':
                    return '90%';
                default:
                    return '50%';
            }
        });
        const dialogVisible = computed({
            get() {
                return __panelSetupProps.modelValue;
            },
            set(value: boolean) {
                ctx.emit('update:modelValue', value);
            },
        });
        const handleBeforeClose = () => {
            ctx.emit('close');
            dialogVisible.value = false;
        };
        const open = () => {
            ctx.emit('open');
        };
        const opened = () => {
            ctx.emit('opened');
        };
        return () => (
            <ElDialog
                title={__panelSetupProps.title}
                modelValue={unref(dialogVisible)}
                onUpdate:modelValue={($v) => {
                    dialogVisible.value = $v as any;
                }}
                destroy-on-close={true}
                close-on-click-modal={__panelSetupProps.closeOnClickModal}
                show-close={__panelSetupProps.showClose}
                width={unref(size)}
                append-to-body
                draggable
                open={open}
                onOpened={($event?: any) => {
                    (opened as any)($event);
                }}
                before-close={handleBeforeClose}
                v-slots={{
                    header: () => <>{ctx.slots['header']?.(undefined)}</>,
                    footer: () => <>{ctx.slots['footer']?.(undefined)}</>,
                }}
            >
                {unref(slots).content ? (
                    <div>{ctx.slots['content']?.(undefined)}</div>
                ) : (
                    <ElRow>
                        <ElCol span={22} offset={1}>
                            {ctx.slots['default']?.(undefined)}
                        </ElCol>
                    </ElRow>
                )}
            </ElDialog>
        );
    },
    options,
);
