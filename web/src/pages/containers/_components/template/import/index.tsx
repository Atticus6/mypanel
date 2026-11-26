import { $t } from '@/utils/i18n-t';
import { MsgError, MsgSuccess } from '@/utils/message';
import DetailDialog from '@/pages/containers/_components/template/detail/index';
import i18n from '@/lang';
import { Container } from '@/types/container';
import { rpc } from '@/lib/rpc';
import DialogPro from '@/components/dialog-pro/index';
import ComplexTable from '@/components/table/complex/ComplexTable';
import Status from '@/components/status/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'import',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const visible = ref(false);
        const loading = ref(false);
        const selects = ref<any>([]);
        const displayData = ref<any>([]);
        const currentData = ref<any[]>([]);
        const uploadRef = ref();
        const uploaderFiles = ref();
        const detailRef = ref();
        const pageData = ref([]);
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 10,
            total: 0,
        });
        const acceptParams = async (): Promise<void> => {
            visible.value = true;
            displayData.value = [];
            selects.value = [];
            loadTemplates();
        };
        const loadTemplates = async () => {
            const res = await rpc.container.searchComposeTemplates({
                info: '',
                page: 1,
                pageSize: 100,
            });
            currentData.value = res.items || [];
        };
        const search = () => {
            const startIndex = (paginationConfig.currentPage - 1) * paginationConfig.pageSize;
            const endIndex = startIndex + paginationConfig.pageSize;
            pageData.value = displayData.value.slice(startIndex, endIndex);
        };
        const onOpenDetail = async (row: Container.TemplateInfo) => {
            detailRef.value.acceptParams({ content: row.content });
        };
        const fileOnChange = (_uploadFile: UploadFile, uploadFiles: UploadFiles) => {
            loading.value = true;
            displayData.value = [];
            uploaderFiles.value = uploadFiles;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = e.target.result as string;
                    const parsed = JSON.parse(content);

                    if (!Array.isArray(parsed)) {
                        MsgError(i18n.global.t('commons.msg.errImportFormat'));
                        loading.value = false;
                        return;
                    }

                    for (const item of parsed) {
                        if (!checkDataFormat(item)) {
                            MsgError(i18n.global.t('commons.msg.errImportFormat'));
                            loading.value = false;
                            return;
                        }
                    }

                    compareData(parsed);
                    loading.value = false;
                } catch (error) {
                    loading.value = false;
                }
            };
            reader.readAsText(_uploadFile.raw);
        };
        const handleExceed: UploadProps['onExceed'] = (files) => {
            uploadRef.value!.clearFiles();
            const file = files[0] as UploadRawFile;
            file.uid = genFileId();
            uploadRef.value!.handleStart(file);
        };
        const checkDataFormat = (item: any): boolean => {
            return item.name && item.content;
        };
        const compareData = (importLists: any[]) => {
            const news: any[] = [];
            const conflicts: any[] = [];
            const duplicates: any[] = [];

            for (const importItem of importLists) {
                const key = `${importItem.name}:${importItem.content}`;

                const existing = currentData.value.find((item) => {
                    const existingKey = `${item.name}:${item.content}`;
                    return existingKey === key;
                });
                const conflict = currentData.value.find((item) => {
                    if (existing) {
                        return false;
                    }
                    return item.name === importItem.name && item.content !== importItem.content;
                });

                if (existing) {
                    duplicates.push({ ...importItem, status: 'duplicate' });
                    continue;
                }
                if (conflict) {
                    conflicts.push({ ...importItem, status: 'conflict' });
                    continue;
                }
                news.push({ ...importItem, status: 'new' });
            }

            displayData.value = [...news, ...conflicts, ...duplicates];
            paginationConfig.total = displayData.value.length;
            search();
        };
        const onImport = async () => {
            loading.value = true;
            await rpc.container
                .batchTemplates({ templates: selects.value as any })
                .then(() => {
                    loading.value = false;
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    ctx.emit('search');
                    visible.value = false;
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <>
                <DialogPro
                    modelValue={unref(visible)}
                    onUpdate:modelValue={($v) => {
                        visible.value = $v as any;
                    }}
                    title={$t('commons.button.import')}
                    size="large"
                    v-slots={{
                        footer: () => (
                            <>
                                <span class={'dialog-footer'}>
                                    <ElButton
                                        onClick={($event?: any) => {
                                            visible.value = false;
                                        }}
                                    >
                                        {$t('commons.button.cancel')}
                                    </ElButton>
                                    <ElButton
                                        type="primary"
                                        disabled={unref(selects).length === 0}
                                        onClick={($event?: any) => {
                                            (onImport as any)($event);
                                        }}
                                    >
                                        {$t('commons.button.import')}
                                    </ElButton>
                                </span>
                            </>
                        ),
                    }}
                >
                    <div>
                        <ElAlert
                            closable={false}
                            show-icon
                            type="info"
                            v-slots={{
                                default: () => (
                                    <>
                                        <div>{$t('commons.msg.importHelper')}</div>
                                    </>
                                ),
                            }}
                        />
                        <ElUpload
                            action="#"
                            auto-upload={false}
                            ref={uploadRef}
                            show-file-list={false}
                            limit={1}
                            accept=".json"
                            on-change={fileOnChange}
                            on-exceed={handleExceed}
                            file-list={unref(uploaderFiles)}
                            onUpdate:file-list={($v) => {
                                uploaderFiles.value = $v as any;
                            }}
                            class={'float-left mt-2'}
                        >
                            <ElButton type="primary" class={'float-left'}>
                                {$t('commons.button.upload')}
                            </ElButton>
                        </ElUpload>
                        {withDirectives(
                            <ElCard class={'mt-2 w-full'}>
                                <ComplexTable
                                    pagination-config={paginationConfig}
                                    onSearch={($event?: any) => {
                                        (search as any)($event);
                                    }}
                                    selects={unref(selects)}
                                    onUpdate:selects={($v) => {
                                        selects.value = $v as any;
                                    }}
                                    data={unref(pageData)}
                                    height={440}
                                >
                                    <ElTableColumn type="selection" fix />
                                    <ElTableColumn
                                        label={$t('commons.table.status')}
                                        min-width={80}
                                        v-slots={{
                                            default: ({ row }) => (
                                                <>
                                                    <Status status={row.status} />
                                                </>
                                            ),
                                        }}
                                    />
                                    <ElTableColumn
                                        label={$t('commons.table.name')}
                                        min-width={70}
                                        show-overflow-tooltip
                                        prop="name"
                                    />
                                    <ElTableColumn
                                        label={$t('commons.table.description')}
                                        show-overflow-tooltip
                                        min-width={120}
                                        prop="description"
                                    />
                                    <ElTableColumn
                                        label={$t('container.content')}
                                        min-width={70}
                                        prop="content"
                                        v-slots={{
                                            default: ({ row }) => (
                                                <>
                                                    <ElButton
                                                        type="primary"
                                                        link
                                                        onClick={($event?: any) => {
                                                            onOpenDetail(row);
                                                        }}
                                                    >
                                                        {$t('commons.button.view')}
                                                    </ElButton>
                                                </>
                                            ),
                                        }}
                                    />
                                </ComplexTable>
                            </ElCard>,
                            [[vLoading, unref(loading)]],
                        )}
                    </div>
                </DialogPro>
                <DetailDialog ref={detailRef} />
            </>
        );
    },
    options,
);
