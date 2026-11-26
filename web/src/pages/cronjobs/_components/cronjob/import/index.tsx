import { $t } from '@/utils/i18n-t';
import type { CronjobAlertTriggerMode } from '@/utils/cronjob-alert';
interface TransHelper {
    name: string;
    detailName: string;
}
interface URLItem {
    url: string;
    header: string;
}
interface CronjobTrans {
    name: string;
    type: string;
    specCustom: boolean;
    spec: string;
    group: string;

    executor: string;
    scriptMode: string;
    script: string;
    command: string;
    containerName: string;
    user: string;
    url: string;
    urlItems?: Array<URLItem>;

    scriptName: string;
    apps: Array<TransHelper>;
    websites: Array<string>;
    dbType: string;
    dbNames: Array<TransHelper>;

    exclusionRules: string;

    isDir: boolean;
    sourceDir: string;

    retainCopies: number;
    retryTimes: number;
    timeout: number;
    ignoreErr: boolean;
    snapshotRule: string;
    secret: string;

    sourceAccounts: Array<string>;
    downloadAccount: string;

    alertCount: number;
    alertTriggerMode?: CronjobAlertTriggerMode;
}
import { transSpecToStr } from './../helper';
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
        const data = ref();
        const uploadRef = ref();
        const uploaderFiles = ref();
        const pageData = ref([]);
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 10,
            total: 0,
        });
        const acceptParams = (): void => {
            visible.value = true;
            data.value = [];
        };
        const search = () => {
            const startIndex = (paginationConfig.currentPage - 1) * paginationConfig.pageSize;
            const endIndex = startIndex + paginationConfig.pageSize;
            pageData.value = data.value.slice(startIndex, endIndex);
        };
        const fileOnChange = (_uploadFile: UploadFile, uploadFiles: UploadFiles) => {
            loading.value = true;
            data.value = [];
            uploaderFiles.value = uploadFiles;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = e.target.result as string;
                    const parsed = JSON.parse(content) as CronjobTrans;
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
                    data.value = parsed;
                    paginationConfig.total = data.value.length;
                    search();
                    loading.value = false;
                } catch (error) {
                    MsgError(i18n.global.t('commons.msg.errImport') + error.message);
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
        const checkDataFormat = (item: any) => {
            if (!item.name) {
                return false;
            }
            const cronjobTypes = [
                'shell',
                'app',
                'website',
                'database',
                'directory',
                'log',
                'curl',
                'cutWebsiteLog',
                'clean',
                'snapshot',
                'ntp',
            ];
            if (!item.type || cronjobTypes.indexOf(item.type) === -1) {
                return false;
            }
            if (item.type === 'curl' && item.urlItems != null) {
                return (
                    Array.isArray(item.urlItems) &&
                    item.urlItems.length > 0 &&
                    item.urlItems.every((group: any) => {
                        const url = typeof group === 'string' ? group : group?.url;
                        const header = typeof group === 'string' ? '' : (group?.header ?? '');
                        return (
                            typeof url === 'string' &&
                            url.trim().length > 0 &&
                            !/[\r\n\0]/.test(url) &&
                            typeof header === 'string' &&
                            !/[\r\n\0]/.test(header)
                        );
                    })
                );
            }
            return true;
        };
        const onImport = async () => {
            await rpc.cronjob.importCronjobs({ payloadJson: JSON.stringify({ cronjobs: selects.value }) }).then(() => {
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                visible.value = false;
                ctx.emit('search');
            });
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
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
                            </span>
                        </>
                    ),
                }}
            >
                <div>
                    <ElAlert closable={false} show-icon type="info" title={$t('cronjob.importHelper')} />
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
                    <ElButton
                        disabled={unref(selects).length === 0}
                        onClick={($event?: any) => {
                            (onImport as any)($event);
                        }}
                        class={'mt-2 ml-2'}
                    >
                        {$t('commons.button.import')}
                    </ElButton>
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
                                    label={$t('cronjob.taskName')}
                                    min-width={120}
                                    prop="name"
                                    show-overflow-tooltip
                                />
                                <ElTableColumn
                                    label={$t('commons.table.type')}
                                    min-width={120}
                                    prop="type"
                                    show-overflow-tooltip
                                    v-slots={{
                                        default: ({ row }) => (
                                            <>
                                                <ElTag>{$t('cronjob.' + row.type)}</ElTag>
                                            </>
                                        ),
                                    }}
                                />
                                <ElTableColumn
                                    label={$t('cronjob.cronSpec')}
                                    show-overflow-tooltip
                                    min-width={120}
                                    v-slots={{
                                        default: ({ row }) => (
                                            <>
                                                {(row.spec.split(',') || []).map((item, index) => (
                                                    <div key={index}>
                                                        {row.expand || (!row.expand && Number(index) < 3) ? (
                                                            <div>
                                                                <span>
                                                                    {row.specCustom ? item : transSpecToStr(item)}
                                                                </span>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                ))}
                                                {!row.expand && row.spec.split(',').length > 3 ? (
                                                    <div>
                                                        <ElButton
                                                            type="primary"
                                                            link
                                                            onClick={($event?: any) => {
                                                                row.expand = true;
                                                            }}
                                                        >
                                                            {$t('commons.button.expand')}
                                                            {'... '}
                                                        </ElButton>
                                                    </div>
                                                ) : null}
                                                {row.expand && row.spec.split(',').length > 3 ? (
                                                    <div>
                                                        <ElButton
                                                            type="primary"
                                                            link
                                                            onClick={($event?: any) => {
                                                                row.expand = false;
                                                            }}
                                                        >
                                                            {$t('commons.button.collapse')}
                                                        </ElButton>
                                                    </div>
                                                ) : null}
                                            </>
                                        ),
                                    }}
                                />
                                <ElTableColumn label={$t('cronjob.retainCopies')} min-width={120} prop="retainCopies" />
                            </ComplexTable>
                        </ElCard>,
                        [[vLoading, unref(loading)]],
                    )}
                </div>
            </DialogPro>
        );
    },
    options,
);
