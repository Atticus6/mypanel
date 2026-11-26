import i18n from '@/lang';
import { useGlobalStore } from '@/composables/useGlobalStore';

interface CodemodProps {
    [key: string]: any;
    header?: string;
    back?: (...args: any[]) => any;
    resource?: string;
    size?: string;
    modelValue?: boolean;
    fullScreen?: boolean;
    autoClose?: boolean;
    confirmBeforeClose?: boolean;
}

const emits = {
    'update:modelValue': (...args: unknown[]) => true,
    close: (...args: unknown[]) => true,
    beforeClose: (...args: unknown[]) => true,
};

type SlotsShape = {
    buttons: (arg?: unknown) => VNode[];
    extra: (arg?: unknown) => VNode[];
    content: (arg?: unknown) => VNode[];
    default: (arg?: unknown) => VNode[];
    footer: (arg?: unknown) => VNode[];
};

const options = {
    name: 'DrawerPro',
    props: {
        header: { type: String },
        back: { type: Function },
        resource: {
            type: String,
            default: '',
        },
        size: {
            type: String,
            default: 'normal',
        },
        modelValue: {
            type: Boolean,
            default: false,
        },
        fullScreen: {
            type: Boolean,
            default: false,
        },
        autoClose: {
            type: Boolean,
            default: true,
        },
        confirmBeforeClose: {
            type: Boolean,
            default: false,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        const { isFullScreen } = useGlobalStore();
        const isFull = ref(false);
        const slots = useSlots();
        const size = computed(() => {
            switch (__panelSetupProps.size) {
                case 'small':
                    return '30%';
                case 'normal':
                    return '40%';
                case 'large':
                    return '50%';
                case 'full':
                    return '100%';
                case '60%':
                    return '60%';
                case __panelSetupProps.size:
                    return __panelSetupProps.size;
                default:
                    return '50%';
            }
        });
        const localOpenPage = computed({
            get() {
                return __panelSetupProps.modelValue;
            },
            set(value: boolean) {
                ctx.emit('update:modelValue', value);
            },
        });
        const handleBack = () => {
            if (__panelSetupProps.confirmBeforeClose) {
                const done = () => {
                    if (__panelSetupProps.back) {
                        __panelSetupProps.back();
                    } else {
                        localOpenPage.value = false;
                        isFullScreen.value = false;
                    }
                };
                ctx.emit('beforeClose', done);
            } else {
                if (__panelSetupProps.back) {
                    __panelSetupProps.back();
                } else {
                    localOpenPage.value = false;
                    isFullScreen.value = false;
                }
            }
        };
        const handleClose = () => {
            localOpenPage.value = false;
            isFull.value = false;
            isFullScreen.value = false;
            ctx.emit('close');
        };
        const beforeClose = (done: () => void) => {
            if (!__panelSetupProps.confirmBeforeClose) {
                done();
            } else {
                ctx.emit('beforeClose', done);
            }
        };
        function toggleFullscreen() {
            isFullScreen.value = !isFullScreen.value;
            isFull.value = isFullScreen.value;
        }
        const loadTooltip = () => {
            return i18n.global.t('commons.button.' + (isFullScreen.value ? 'quitFullscreen' : 'fullscreen'));
        };
        return () => (
            <ElDrawer
                modelValue={unref(localOpenPage)}
                onUpdate:modelValue={($v) => {
                    localOpenPage.value = $v as any;
                }}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                destroy-on-close={true}
                before-close={beforeClose}
                append-to-body
                size={unref(isFull) ? '100%' : unref(size)}
                close-on-press-escape={__panelSetupProps.autoClose}
                close-on-click-modal={__panelSetupProps.autoClose}
                v-slots={{
                    header: () => (
                        <>
                            <ElPageHeader
                                onBack={($event?: any) => {
                                    (handleBack as any)($event);
                                }}
                                v-slots={{
                                    content: () => (
                                        <>
                                            <span>{__panelSetupProps.header}</span>
                                            {__panelSetupProps.resource != '' ? (
                                                <span>
                                                    {' - '}
                                                    {__panelSetupProps.resource.length > 25 ? (
                                                        <ElTooltip
                                                            content={__panelSetupProps.resource}
                                                            placement="bottom"
                                                        >
                                                            <ElText type="primary">
                                                                {__panelSetupProps.resource.substring(0, 23) + '...'}
                                                            </ElText>
                                                        </ElTooltip>
                                                    ) : (
                                                        <ElText type="primary">{__panelSetupProps.resource}</ElText>
                                                    )}
                                                </span>
                                            ) : null}
                                            {unref(slots).buttons ? <ElDivider direction="vertical" /> : null}
                                            {unref(slots).buttons ? ctx.slots['buttons']?.(undefined) : null}
                                        </>
                                    ),
                                    extra: () => (
                                        <>
                                            {__panelSetupProps.fullScreen ? (
                                                <ElTooltip content={loadTooltip()} placement="top">
                                                    <ElButton
                                                        onClick={($event?: any) => {
                                                            (toggleFullscreen as any)($event);
                                                        }}
                                                        link
                                                        icon="FullScreen"
                                                        plain
                                                        class={'-mt-1 mr-2'}
                                                    />
                                                </ElTooltip>
                                            ) : null}
                                            {unref(slots).extra ? ctx.slots['extra']?.(undefined) : null}
                                        </>
                                    ),
                                }}
                            />
                        </>
                    ),
                    footer: () => <>{ctx.slots['footer']?.(undefined)}</>,
                }}
            >
                <div ref="drawerContent">
                    {unref(slots).content ? (
                        <div>{ctx.slots['content']?.(undefined)}</div>
                    ) : (
                        <ElRow>
                            <ElCol span={22} offset={1}>
                                {ctx.slots['default']?.(undefined)}
                            </ElCol>
                        </ElRow>
                    )}
                </div>
            </ElDrawer>
        );
    },
    options,
);
