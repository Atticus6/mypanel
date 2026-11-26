import { $t } from '@/utils/i18n-t';
import { uploadCommands } from '@/api/modules/command';
import { MsgError, MsgSuccess } from '@/utils/message';
import i18n from '@/lang';
import { rpc } from '@/lib/rpc';
import DialogPro from '@/components/dialog-pro/index';
import ComplexTable from '@/components/table/complex/ComplexTable';

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
        const loading = ref();
        const selects = ref<any>([]);
        const data = ref([]);
        const uploadRef = ref();
        const uploaderFiles = ref();
        const pageData = ref([]);
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 10,
            total: 0,
        });
        const currentGroup = ref();
        const groupList = ref();
        const acceptParams = (): void => {
            visible.value = true;
            selects.value = [];
            loadGroups();
            currentGroup.value = '';
            data.value = [];
            pageData.value = [];
        };
        const search = () => {
            const startIndex = (paginationConfig.currentPage - 1) * paginationConfig.pageSize;
            const endIndex = startIndex + paginationConfig.pageSize;
            pageData.value = data.value.slice(startIndex, endIndex);
        };
        const loadGroups = async () => {
            const res = await rpc.core.group.list({ type: 'command' });
            groupList.value = (res.items as any) || [];
        };
        const changeGroup = () => {
            let itemGroup;
            for (const g of groupList.value) {
                if (g.id === currentGroup.value) {
                    itemGroup = g;
                    break;
                }
            }
            for (const item of data.value) {
                item.groupID = currentGroup.value;
                item.groupBelong = itemGroup.name;
            }
        };
        const fileOnChange = async (_uploadFile: UploadFile, uploadFiles: UploadFiles) => {
            uploaderFiles.value = uploadFiles;
            if (uploaderFiles.value.length !== 1) {
                return;
            }
            const file = uploaderFiles.value[0];
            const formData = new FormData();
            formData.append('file', file.raw);
            loading.value = true;
            await uploadCommands(formData)
                .then((res) => {
                    loading.value = false;
                    uploadRef.value!.clearFiles();
                    uploaderFiles.value = [];
                    data.value = res.data || [];
                    if (data.value.length === 0) {
                        MsgError(i18n.global.t('terminal.noSuchCommand'));
                    }
                    paginationConfig.total = data.value.length;
                    search();
                })
                .catch(() => {
                    loading.value = false;
                    uploadRef.value!.clearFiles();
                    uploaderFiles.value = [];
                });
        };
        const handleExceed: UploadProps['onExceed'] = (files) => {
            uploadRef.value!.clearFiles();
            const file = files[0] as UploadRawFile;
            file.uid = genFileId();
            uploadRef.value!.handleStart(file);
        };
        const onImport = async () => {
            loading.value = true;
            rpc.core.command
                .import({ items: selects.value as any })
                .then(() => {
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    loading.value = false;
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
            <DialogPro
                v-model={visible.value}
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
                            </span>
                        </>
                    ),
                }}
            >
                <div>
                    <ElUpload
                        action="#"
                        auto-upload={false}
                        ref={uploadRef}
                        show-file-list={false}
                        limit={1}
                        accept=".csv"
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
                    <ElButton
                        disabled={unref(selects).length === 0}
                        onClick={($event?: any) => {
                            (onImport as any)($event);
                        }}
                        class={'mt-2 ml-2'}
                    >
                        {$t('commons.button.import')}
                    </ElButton>
                    <ElSelect
                        filterable
                        placeholder={$t('terminal.groupChange')}
                        v-model={currentGroup.value}
                        onChange={($event?: any) => {
                            (changeGroup as any)($event);
                        }}
                        class={'p-w-200 mt-2 ml-2'}
                    >
                        {(unref(groupList) || []).map((item) => (
                            <ElOption label={item.name} value={item.id} key={item.id} />
                        ))}
                    </ElSelect>
                    {
                        <ElCard class={'mt-2 w-full'} v-loading={unref(loading)}>
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
                                    label={$t('commons.table.name')}
                                    min-width={80}
                                    prop="name"
                                    show-overflow-tooltip
                                />
                                <ElTableColumn
                                    label={$t('commons.table.group')}
                                    show-overflow-tooltip
                                    min-width="80"
                                    prop="groupBelong"
                                    fix
                                />
                                <ElTableColumn
                                    label={$t('terminal.command')}
                                    min-width={120}
                                    prop="command"
                                    show-overflow-tooltip
                                />
                            </ComplexTable>
                        </ElCard>
                    }
                </div>
            </DialogPro>
        );
    },
    options,
);
