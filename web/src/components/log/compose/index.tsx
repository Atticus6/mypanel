import i18n from '@/lang';
import { fullscreen } from '@/utils/fullscreen';
import ContainerLog from '@/components/log/container/index';
import { useGlobalStore } from '@/composables/useGlobalStore';
interface DialogProps {
    compose: string;
    resource: string;
    container: string;
    node: string;
}
import './index.styles.css';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
    highlightDiff?: number;
}

const emits = {};

const options = {
    name: 'compose',
    props: {
        highlightDiff: {
            type: Number,
            default: 150,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-1cf1d6b8',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isMobile, isFullScreen } = useGlobalStore();
        const open = ref(false);
        const resource = ref('');
        const container = ref('');
        const logVisible = ref(false);
        const compose = ref('');
        const highlightDiff = ref(150);
        const node = ref('');
        const handleClose = () => {
            open.value = false;
            isFullScreen.value = false;
        };
        function toggleFullscreen() {
            isFullScreen.value = !isFullScreen.value;
        }
        const loadTooltip = () => {
            return i18n.global.t('commons.button.' + (isFullScreen.value ? 'quitFullscreen' : 'fullscreen'));
        };
        watch(logVisible, (val) => {
            if (fullscreen.isEnabled && !val && !isMobile.value) fullscreen.exit();
        });
        const acceptParams = (props: DialogProps): void => {
            highlightDiff.value = __panelSetupProps.highlightDiff;
            compose.value = props.compose;
            resource.value = props.resource;
            container.value = props.container;
            node.value = props.node;
            open.value = true;
        };
        onBeforeUnmount(() => {
            handleClose();
        });
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                v-model={open.value}
                header={unref(resource)}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size={unref(isFullScreen) ? 'full' : '60%'}
                resource={unref(container)}
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
                                compose={unref(compose)}
                                resource={unref(resource)}
                                container={unref(container)}
                                node={unref(node)}
                                highlightDiff={unref(highlightDiff)}
                            />
                        </>
                    ),
                }}
            />
        );
    },
    options,
);
