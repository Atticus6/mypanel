import { $t } from '@/utils/i18n-t';
import LogFile from '@/components/log/file/index';
import LogRouter from '@/pages/views/log/router/index';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { rpc } from '@/lib/rpc';
import LayoutContent from '@/components/layout-content/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'system',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode } = useGlobalStore();
        const loading = ref();
        const isWatch = ref();
        const fileList = ref();
        const logRef = ref();
        const hasContent = ref(false);
        const logConfig = reactive({
            type: 'system',
            name: '',
            colorMode: 'system',
        });
        const showLog = ref(false);
        const itemName = ref();
        const itemType = ref('Agent');
        const changeTail = () => {
            logRef.value.changeTail(true);
        };
        const loadFiles = async () => {
            const res = await rpc.log.listSystemFiles({});
            fileList.value = res.files || [];
            if (fileList.value) {
                itemName.value = fileList.value[0];
                search();
            }
        };
        const search = () => {
            logConfig.name = itemType.value === 'Agent' ? itemName.value : 'Core-' + itemName.value;
            showLog.value = false;
            nextTick(() => {
                showLog.value = true;
            });
        };
        onMounted(() => {
            loadFiles();
        });
        return () => (
            <div>
                {withDirectives(
                    <LayoutContent
                        title={$t('logs.system')}
                        v-slots={{
                            search: () => (
                                <>
                                    <LogRouter current="SystemLog" />
                                </>
                            ),
                            leftToolBar: () => (
                                <>
                                    <ElSelect
                                        modelValue={unref(itemName)}
                                        onUpdate:modelValue={($v) => {
                                            itemName.value = $v as any;
                                        }}
                                        filterable
                                        onChange={($event?: any) => {
                                            search();
                                        }}
                                        class={'p-w-200'}
                                        v-slots={{ prefix: () => <>{$t('commons.table.date')}</> }}
                                    >
                                        {(unref(fileList) || []).map((item, index) => (
                                            <ElOption label={item} value={item} key={index} />
                                        ))}
                                    </ElSelect>
                                    <ElButton>
                                        <ElCheckbox
                                            onChange={($event?: any) => {
                                                (changeTail as any)($event);
                                            }}
                                            modelValue={unref(isWatch)}
                                            onUpdate:modelValue={($v) => {
                                                isWatch.value = $v as any;
                                            }}
                                        >
                                            {$t('commons.button.watch')}
                                        </ElCheckbox>
                                    </ElButton>
                                    {unref(currentNode) === 'local' ? (
                                        <ElRadioGroup
                                            onChange={($event?: any) => {
                                                search();
                                            }}
                                            modelValue={unref(itemType)}
                                            onUpdate:modelValue={($v) => {
                                                itemType.value = $v as any;
                                            }}
                                            class={'ml-2'}
                                        >
                                            <ElRadioButton label={$t('logs.agent')} value="Agent" />
                                            <ElRadioButton label={$t('logs.core')} value="Core" />
                                        </ElRadioGroup>
                                    ) : null}
                                </>
                            ),
                            main: () => (
                                <>
                                    {unref(showLog) ? (
                                        <LogFile
                                            ref={logRef}
                                            config={logConfig}
                                            default-button={false}
                                            loading={unref(loading)}
                                            onUpdate:loading={($v) => {
                                                loading.value = $v as any;
                                            }}
                                            hasContent={unref(hasContent)}
                                            onUpdate:hasContent={($v) => {
                                                hasContent.value = $v as any;
                                            }}
                                            height-diff={330}
                                        />
                                    ) : null}
                                </>
                            ),
                        }}
                    />,
                    [[vLoading, unref(loading)]],
                )}
            </div>
        );
    },
    options,
);
