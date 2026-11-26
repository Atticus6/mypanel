import { $t } from '@/utils/i18n-t';
import { copyText } from '@/utils/clipboard';
import FileList from '@/components/file-list/index';

interface CodemodProps {
    [key: string]: any;
    egHelp?: string;
    tags?: string[];
    withFile?: boolean;
    baseDir?: string;
}

const emits = {
    'update:tags': (...args: unknown[]) => true,
};

const options = {
    name: 'input-tag',
    props: {
        egHelp: { type: String, default: 'key=val' },
        tags: { type: Array<string>, default: [] },
        withFile: { type: Boolean, default: false },
        baseDir: { type: String, default: '/' },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const tmpTags = ref([]);
        const fileRef = ref();
        watch(
            () => __panelSetupProps.tags,
            (newVal) => {
                tmpTags.value = newVal || [];
            },
        );
        const loadFile = async (path: string) => {
            handleAdd(path);
        };
        const handlePaste = (event: any) => {
            event.preventDefault();
            const pasteData = event.clipboardData.getData('text');
            const tags = pasteData.split('\n');
            for (const item of tags) {
                if (item) {
                    handleAdd(item);
                }
            }
        };
        const handleAdd = (val: string) => {
            tmpTags.value = tmpTags.value?.filter((item) => item !== val);
            tmpTags.value.push(val);
            handleUpdate();
        };
        const handleUpdate = () => {
            ctx.emit('update:tags', tmpTags.value);
        };
        const handleClean = () => {
            tmpTags.value = [];
            handleUpdate();
        };
        onMounted(() => {
            tmpTags.value = __panelSetupProps.tags || [];
        });
        return () => (
            <div>
                <ElInputTag
                    modelValue={unref(tmpTags)}
                    onUpdate:modelValue={($v) => {
                        tmpTags.value = $v as any;
                    }}
                    trigger="Enter"
                    onPaste={($event?: any) => {
                        (handlePaste as any)($event);
                    }}
                    onChange={($event?: any) => {
                        (handleUpdate as any)($event);
                    }}
                    onAddTag={($event?: any) => {
                        (handleAdd as any)($event);
                    }}
                    v-slots={{
                        suffix: () => (
                            <>
                                {__panelSetupProps.withFile ? (
                                    <ElTooltip content={$t('website.select')}>
                                        <ElButton
                                            link
                                            icon="Folder"
                                            onClick={($event?: any) => {
                                                unref(fileRef).acceptParams({
                                                    path: __panelSetupProps.baseDir,
                                                    isAll: true,
                                                });
                                            }}
                                            class={'-mr-3'}
                                        />
                                    </ElTooltip>
                                ) : null}
                                <ElTooltip content={$t('commons.button.copy')}>
                                    <ElButton
                                        link
                                        icon="CopyDocument"
                                        onClick={($event?: any) => {
                                            copyText(unref(tmpTags).join('\n'));
                                        }}
                                        class={'-mr-3'}
                                    />
                                </ElTooltip>
                                <ElTooltip content={$t('commons.button.clean')}>
                                    <ElButton
                                        link
                                        icon="Close"
                                        onClick={($event?: any) => {
                                            (handleClean as any)($event);
                                        }}
                                    />
                                </ElTooltip>
                            </>
                        ),
                    }}
                />
                {__panelSetupProps.egHelp ? <span class={'input-help'}>{__panelSetupProps.egHelp}</span> : null}
                <FileList
                    ref={fileRef}
                    onChoose={($event?: any) => {
                        (loadFile as any)($event);
                    }}
                />
            </div>
        );
    },
    options,
);
