import { h } from 'vue';
import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { ref } from 'vue';
import { Close, FullScreen } from '@element-plus/icons-vue';
import VueOfficeDocx from '@vue-office/docx';
import VueOfficeExcel from '@vue-office/excel';
import '@vue-office/docx/lib/index.css';
import '@vue-office/excel/lib/index.css';
import { MsgError } from '@/utils/message';
interface EditProps {
    fileType: string;
    path: string;
    name: string;
    extension: string;
    imageFiles: [];
    currentNode: string;
}
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { cn } from '@/utils/cn';
import { ElSpace } from 'element-plus';
import { ElTooltip } from 'element-plus';
import { ElIcon } from 'element-plus';
import { ElImage } from 'element-plus';
import DialogPro from '@/components/dialog-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'preview',
    props: {},
    emits: emits,
    __scopeId: 'data-v-a64ad9e9',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const open = ref(false);
        const loading = ref(false);
        const filePath = ref('');
        const fileName = ref('');
        const fileType = ref('');
        const fileUrl = ref('');
        const currentNode = ref('');
        const imageFiles = ref([]);
        const fileExtension = ref('');
        const isFullscreen = ref(false);
        const handleClose = () => {
            open.value = false;

            ctx.emit('close', open.value);
        };
        const renderedHandler = () => {
            loading.value = false;
        };
        const errorHandler = () => {
            open.value = false;
            MsgError(i18n.global.t('commons.msg.unSupportType'));
        };
        const loadTooltip = () => {
            return i18n.global.t('commons.button.' + (isFullscreen.value ? 'quitFullscreen' : 'fullscreen'));
        };
        const toggleFullscreen = () => {
            isFullscreen.value = !isFullscreen.value;
        };
        const getDownloadUrl = (path: string) => {
            const baseUrl = `${import.meta.env.VITE_API_URL as string}/files/download`;
            const encodedPath = encodeURIComponent(path);
            const timestamp = new Date().getTime();
            return `${baseUrl}?operateNode=${currentNode.value}&path=${encodedPath}&timestamp=${timestamp}`;
        };
        const acceptParams = (__panelSetupProps: EditProps) => {
            imageFiles.value = [];
            fileExtension.value = __panelSetupProps.extension;
            fileName.value = __panelSetupProps.name;
            filePath.value = __panelSetupProps.path;
            fileType.value = __panelSetupProps.fileType;
            currentNode.value = __panelSetupProps.currentNode;
            isFullscreen.value = fileType.value === 'excel';

            loading.value = true;
            fileUrl.value = getDownloadUrl(__panelSetupProps.path);
            imageFiles.value = __panelSetupProps.imageFiles.map((item) => ({
                path: item,
                url: getDownloadUrl(item),
            }));
            open.value = true;
            loading.value = false;
        };
        const onOpen = () => {};
        const changeImg = (path: string) => {
            filePath.value = path;
            fileUrl.value = getDownloadUrl(path);
        };
        ctx.expose({ acceptParams });
        return () => (
            <DialogPro
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
                show-close={false}
                append-to-body
                onOpened={($event?: any) => {
                    (onOpen as any)($event);
                }}
                top={'5vh'}
                fullscreen={unref(isFullscreen)}
                close-on-click-modal={true}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                class={unref(isFullscreen) ? 'w-full' : '!w-3/4'}
                v-slots={{
                    header: () => (
                        <>
                            <div class={'flex items-center justify-between'}>
                                <span>{$t('commons.button.preview') + ' - ' + unref(filePath)}</span>
                                <ElSpace alignment="center" size={10} class={'dialog-header-icon'}>
                                    {unref(fileType) !== 'excel' ? (
                                        <ElTooltip content={loadTooltip()} placement="top">
                                            <ElIcon
                                                onClick={($event?: any) => {
                                                    (toggleFullscreen as any)($event);
                                                }}
                                                class={'cursor-pointer hover:scale-110'}
                                            >
                                                <FullScreen />
                                            </ElIcon>
                                        </ElTooltip>
                                    ) : null}
                                    <ElIcon
                                        onClick={($event?: any) => {
                                            (handleClose as any)($event);
                                        }}
                                        size="20"
                                        class={'cursor-pointer hover:scale-110'}
                                    >
                                        <Close />
                                    </ElIcon>
                                </ElSpace>
                            </div>
                        </>
                    ),
                }}
            >
                {withDirectives(
                    <div
                        class={unref(fileType) === 'image' ? 'overflow-y-auto' : 'flex items-center justify-center'}
                        style={unref(isFullscreen) ? 'height: 90vh' : 'height: 80vh'}
                    >
                        {unref(fileType) === 'image' ? (
                            <>
                                <div class={'flex h-full'}>
                                    {unref(imageFiles).length > 1 ? (
                                        <aside
                                            class={'left-aside hidden w-[200px] overflow-y-auto rounded p-2 sm:block'}
                                        >
                                            {(unref(imageFiles) || []).map((item, index) => (
                                                <>
                                                    <ElTooltip content={item.path} placement="right">
                                                        <div
                                                            onClick={($event?: any) => {
                                                                changeImg(item.path);
                                                            }}
                                                            class={cn(
                                                                'dialog-object-name left-item mb-1 rounded p-1 text-sm',
                                                                item.path === unref(filePath)
                                                                    ? 'left-item-default'
                                                                    : '',
                                                            )}
                                                        >
                                                            {item.path}
                                                        </div>
                                                    </ElTooltip>
                                                </>
                                            ))}
                                        </aside>
                                    ) : null}
                                    <main class={'flex-1 overflow-hidden'}>
                                        <ElTooltip content={unref(filePath)} placement="bottom">
                                            <ElImage
                                                loading="lazy"
                                                src={unref(fileUrl)}
                                                alt={unref(filePath)}
                                                fit="contain"
                                                class={'h-full w-full'}
                                            />
                                        </ElTooltip>
                                    </main>
                                </div>
                            </>
                        ) : unref(fileType) === 'video' ? (
                            <video src={unref(fileUrl)} controls autoplay class={'size-3/4'} />
                        ) : unref(fileType) === 'audio' ? (
                            <audio src={unref(fileUrl)} controls />
                        ) : unref(fileType) === 'word' ? (
                            h(VueOfficeDocx, {
                                src: unref(fileUrl),
                                onRendered: ($event?: any) => {
                                    (renderedHandler as any)($event);
                                },
                                onError: ($event?: any) => {
                                    (errorHandler as any)($event);
                                },
                                class: 'w-full',
                                style: unref(isFullscreen) ? 'height: 90vh' : 'height: 80vh',
                            })
                        ) : unref(fileType) === 'excel' ? (
                            h(VueOfficeExcel, {
                                src: unref(fileUrl),
                                onRendered: ($event?: any) => {
                                    (renderedHandler as any)($event);
                                },
                                onError: ($event?: any) => {
                                    (errorHandler as any)($event);
                                },
                                class: 'w-full',
                                style: unref(isFullscreen) ? 'height: 90vh;' : 'height: 80vh',
                            })
                        ) : null}
                    </div>,
                    [[vLoading, unref(loading)]],
                )}
            </DialogPro>
        );
    },
    options,
);
