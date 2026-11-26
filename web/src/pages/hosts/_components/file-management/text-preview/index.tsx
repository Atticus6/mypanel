import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import { downloadFile } from '@/utils/file';
import { useGlobalStore } from '@/composables/useGlobalStore';
import i18n from '@/lang';
interface PreviewProps {
    path: string;
    name: string;
}
import './index.styles.css';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'text-preview',
    props: {},
    emits: emits,
    __scopeId: 'data-v-862cd9fd',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode } = useGlobalStore();
        const open = ref(false);
        const loading = ref(false);
        const title = ref('');
        const filePath = ref('');
        const lines = ref<string[]>([]);
        const isTruncated = ref(false);
        const hasContent = ref(false);
        const logContainer = ref<HTMLElement | null>(null);
        const lineHeight = 23;
        const scrollTop = ref(0);
        const totalHeight = computed(() => lines.value.length * lineHeight);
        const visibleCount = computed(() => {
            const buffer = 5;
            return Math.ceil(600 / lineHeight) + buffer * 2;
        });
        const startIndex = computed(() => {
            const buffer = 5;
            const index = Math.floor(scrollTop.value / lineHeight) - buffer;
            return Math.max(0, index);
        });
        const endIndex = computed(() => {
            return Math.min(lines.value.length, startIndex.value + visibleCount.value);
        });
        const visibleLines = computed(() => {
            return lines.value.slice(startIndex.value, endIndex.value);
        });
        const offsetY = computed(() => {
            return startIndex.value * lineHeight;
        });
        const onScroll = () => {
            if (!logContainer.value) return;
            scrollTop.value = logContainer.value.scrollTop;
        };
        const handleClose = () => {
            open.value = false;
            lines.value = [];
        };
        const onDownload = () => {
            downloadFile(filePath.value, currentNode.value);
        };
        const acceptParams = async (__panelSetupProps: PreviewProps) => {
            title.value = i18n.global.t('commons.button.preview') + ' - ' + __panelSetupProps.name;
            filePath.value = __panelSetupProps.path;
            lines.value = [];
            isTruncated.value = false;
            hasContent.value = false;
            open.value = true;
            loading.value = true;

            try {
                const res = await rpc.file.previewFile({ path: __panelSetupProps.path });
                if (res.content) {
                    lines.value = res.content.split('\n');
                    hasContent.value = true;
                    if (Number(res.size) > 10 * 1024 * 1024) {
                        isTruncated.value = true;
                    }
                }
                nextTick(() => {
                    if (logContainer.value) {
                        logContainer.value.scrollTop = logContainer.value.scrollHeight;
                    }
                });
            } catch (error) {
                console.error('Preview error:', error);
            } finally {
                loading.value = false;
            }
        };
        ctx.expose({ acceptParams });
        return () => (
            <ElDrawer
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
                title={unref(title)}
                size="50%"
                before-close={handleClose}
                destroy-on-close
            >
                {withDirectives(
                    <div>
                        <div class={'mb-4 flex items-center justify-between'}>
                            {unref(isTruncated) ? <ElTag type="warning">{$t('file.previewTruncated')}</ElTag> : null}
                            <ElButton
                                onClick={($event?: any) => {
                                    (onDownload as any)($event);
                                }}
                                icon="Download"
                                disabled={!unref(hasContent)}
                            >
                                {$t('commons.button.download')}
                            </ElButton>
                        </div>
                        <div
                            ref={logContainer}
                            onScroll={($event?: any) => {
                                (onScroll as any)($event);
                            }}
                            class={'log-container'}
                        >
                            <div class={'log-spacer'} style={{ height: `${totalHeight}px` }} />
                            <div class={'log-viewport'} style={{ transform: `translateY(${offsetY}px)` }}>
                                {(unref(visibleLines) || []).map((line, index) => (
                                    <div
                                        class={'log-item'}
                                        style={{ height: `${lineHeight}px` }}
                                        key={`${unref(startIndex) + index}-${line}`}
                                    >
                                        <span class={'line-content'}>{line}</span>
                                    </div>
                                ))}
                            </div>
                            {unref(lines).length === 0 && !unref(loading) ? (
                                <div class={'empty-content'}>{$t('file.previewEmpty')}</div>
                            ) : null}
                        </div>
                    </div>,
                    [[vLoading, unref(loading)]],
                )}
            </ElDrawer>
        );
    },
    options,
);
