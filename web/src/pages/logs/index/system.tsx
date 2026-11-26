import { $t } from '@/utils/i18n-t';
import LogFile from '@/components/log/file/index';
import LogRouter from '@/pages/logs/_components/router/index';
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
                {
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
                                        v-model={itemName.value}
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
                                            v-model={isWatch.value}
                                        >
                                            {$t('commons.button.watch')}
                                        </ElCheckbox>
                                    </ElButton>
                                    {unref(currentNode) === 'local' ? (
                                        <ElRadioGroup
                                            onChange={($event?: any) => {
                                                search();
                                            }}
                                            v-model={itemType.value}
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
                        v-loading={unref(loading)}
                    />
                }
            </div>
        );
    },
    options,
);

definePage({
    name: 'SystemLog',
    meta: { parent: 'menu.logs', title: 'logs.system', activeMenu: '/logs', permission: 'log_view', hidden: true },
});
