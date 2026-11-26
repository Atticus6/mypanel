import { $t } from '@/utils/i18n-t';
import LogFile from '@/components/log/file/index';
import i18n from '@/lang';
import { fullscreen } from '@/utils/fullscreen';
import { useGlobalStore } from '@/composables/useGlobalStore';
interface LogProps {
    id: number;
    type: string;
    name: string;
    tail: boolean;
}
import './index.styles.css';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
    heightDiff?: number;
    style?: Record<string, any>;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'file-drawer',
    props: {
        heightDiff: {
            type: Number,
            default: 0,
        },
        style: {
            type: Object,
            default: () => ({}),
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-84903b93',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isMobile, isFullScreen } = useGlobalStore();
        const open = ref(false);
        const config = ref();
        const handleClose = () => {
            open.value = false;
            isFullScreen.value = false;
            ctx.emit('close', false);
        };
        function toggleFullscreen() {
            isFullScreen.value = !isFullScreen.value;
        }
        const loadTooltip = () => {
            return i18n.global.t('commons.button.' + (isFullScreen.value ? 'quitFullscreen' : 'fullscreen'));
        };
        watch(open, (val) => {
            if (fullscreen.isEnabled && !val && !isMobile.value) fullscreen.exit();
        });
        const acceptParams = (logProps: LogProps) => {
            config.value = logProps;
            open.value = true;
        };
        onBeforeUnmount(() => {
            handleClose();
        });
        ctx.expose({ acceptParams });
        return () => (
            <DrawerPro
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
                header={$t('commons.button.log')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size={unref(isFullScreen) ? 'full' : 'large'}
                v-slots={{
                    extra: () => (
                        <>
                            <ElTooltip content={loadTooltip()} placement="top">
                                <ElButton
                                    onClick={($event?: any) => {
                                        (toggleFullscreen as any)($event);
                                    }}
                                    icon="FullScreen"
                                    plain
                                    class={'fullScreen'}
                                />
                            </ElTooltip>
                        </>
                    ),
                    content: () => (
                        <>
                            <LogFile config={unref(config)} height-diff={__panelSetupProps.heightDiff} />
                        </>
                    ),
                }}
            />
        );
    },
    options,
);
