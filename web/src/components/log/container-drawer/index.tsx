import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import screenfull from 'screenfull';
import ContainerLog from '@/components/log/container/index';
import { useGlobalStore } from '@/composables/useGlobalStore';
interface DialogProps {
    container: string;
    containerID: string;
}
import './index.styles.css';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
    highlightDiff?: number;
}

const emits = {};

const options = {
    name: 'container-drawer',
    props: {
        highlightDiff: {
            type: Number,
            default: 320,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-5b446716',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isMobile, isFullScreen } = useGlobalStore();
        const logVisible = ref(false);
        const logSearch = reactive({
            isWatch: true,
            container: '',
            containerID: '',
            mode: 'all',
            tail: 100,
        });
        function toggleFullscreen() {
            isFullScreen.value = !isFullScreen.value;
        }
        const loadTooltip = () => {
            return i18n.global.t('commons.button.' + (isFullScreen.value ? 'quitFullscreen' : 'fullscreen'));
        };
        const handleClose = async () => {
            logVisible.value = false;
            isFullScreen.value = false;
        };
        watch(logVisible, (val) => {
            if (screenfull.isEnabled && !val && !isMobile.value) screenfull.exit();
        });
        const config = ref<DialogProps>({
            container: '',
            containerID: '',
        });
        const acceptParams = (__panelSetupProps: DialogProps): void => {
            config.value.containerID = __panelSetupProps.containerID;
            config.value.container = __panelSetupProps.container;
            logSearch.container = __panelSetupProps.container;
            logVisible.value = true;

            if (!isMobile.value) {
                screenfull.on('change', () => {
                    isFullScreen.value = screenfull.isFullscreen;
                });
            }
        };
        onBeforeUnmount(() => {
            handleClose();
        });
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                modelValue={unref(logVisible)}
                onUpdate:modelValue={($v) => {
                    logVisible.value = $v as any;
                }}
                header={$t('commons.button.log')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                resource={logSearch.container}
                size={unref(isFullScreen) ? 'full' : '60%'}
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
                            <ContainerLog
                                container={unref(config).container}
                                highlightDiff={__panelSetupProps.highlightDiff}
                            />
                        </>
                    ),
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        (handleClose as any)($event);
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            />
        );
    },
    options,
);
