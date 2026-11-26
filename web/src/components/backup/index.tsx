import { $t } from '@/utils/i18n-t';
import { reactive, ref } from 'vue';
import { computeSize } from '@/utils/size';
import { dateFormat } from '@/utils/date';
import { downloadFile } from '@/utils/file';
import { newUUID } from '@/utils/id';
import { transferTimeToSecond } from '@/utils/validate';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import TaskLog from '@/components/log/task/index';
import { routerToFileWithPath } from '@/utils/router';
import { loadMysqlArgs } from '@/views/cronjob/cronjob/helper';
interface DialogProps {
    type: string;
    name: string;
    detailName: string;
    status: string;
    appInstallID?: number;
}
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElAlert } from 'element-plus';
import { ElIcon } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElTableColumn } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';
import { Position } from '@element-plus/icons-vue';
import ComplexTable from '@/components/table/complex/ComplexTable';
import TableRefresh from '@/components/table/TableRefresh';
import Status from '@/components/status/index';
import FuInputRwSwitch from '@/components/fu/FuInputRwSwitch';
import FuTableOperations from '@/components/table/TableOperations';
import DialogPro from '@/components/dialog-pro/index';
import OpDialog from '@/components/del-dialog/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'backup',
    props: {},
    emits: emits,
    __scopeId: 'data-v-cd47f038',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const selects = ref<any>([]);
        const args = ref([]);
        const loading = ref();
        const opRef = ref();
        const taskLogRef = ref();
        const data = ref();
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 10,
            total: 0,
        });
        const backupVisible = ref(false);
        const type = ref();
        const name = ref();
        const detailName = ref();
        const backupPath = ref();
        const status = ref();
        const secret = ref();
        const description = ref();
        const timeoutItem = ref(30);
        const timeoutUnit = ref('m');
        const stopBefore = ref(false);
        const dropAllCollections = ref(false);
        const open = ref();
        const isBackup = ref();
        const recordInfo = ref();
        const appInstallID = ref();
        const acceptParams = (params: DialogProps): void => {
            type.value = params.type;
            if (type.value === 'app') {
                appInstallID.value = params.appInstallID || 0;
                loadBackupDir();
            }
            name.value = params.name;
            detailName.value = params.detailName;
            backupVisible.value = true;
            status.value = params.status;
            secret.value = '';
            search();
        };
        const handleClose = () => {
            backupVisible.value = false;
            ctx.emit('close');
        };
        const handleBackupClose = () => {
            open.value = false;
            search();
        };
        const loadBackupDir = async () => {
            const res = await rpc.backup.getLocalBackupDir({});
            backupPath.value = res.dir;
        };
        const goFile = async () => {
            routerToFileWithPath(`${backupPath.value}/app/${name.value}/${detailName.value}`);
        };
        const onChange = async (info: any) => {
            await rpc.backup.updateRecordDescription({ id: info.id, description: info.description });
            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
        };
        const search = async () => {
            let params = {
                page: paginationConfig.currentPage,
                pageSize: paginationConfig.pageSize,
                type: type.value,
                name: name.value,
                detailName: detailName.value,
            };
            loading.value = true;
            await rpc.backup
                .searchBackupRecords(params)
                .then((res) => {
                    loading.value = false;
                    loadSize(params);
                    data.value = res.items || [];
                    paginationConfig.total = Number(res.total);
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const loadSize = async (params: any) => {
            await rpc.backup
                .loadRecordSize(params)
                .then((res) => {
                    let stats = res.items || [];
                    if (stats.length === 0) {
                        return;
                    }
                    for (const backup of data.value) {
                        for (const item of stats) {
                            if (backup.id === item.id) {
                                backup.hasLoad = true;
                                backup.size = Number(item.size);
                                break;
                            }
                        }
                    }
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const openTaskLog = (taskID: string) => {
            taskLogRef.value.openWithTaskID(taskID, true);
        };
        const supportMysqlBackupArgs = () => {
            return ['mysql', 'mysql-cluster', 'mariadb'].includes(type.value);
        };
        function selectable(row) {
            return row.status !== 'Waiting';
        }
        const backup = async () => {
            const taskID = newUUID();
            let params = {
                type: type.value,
                name: name.value,
                detailName: detailName.value,
                secret: secret.value,
                taskId: taskID,
                description: description.value,
                args: args.value,
                stopBefore: stopBefore.value,
            };
            loading.value = true;
            await rpc.backup
                .backupData(params)
                .then(() => {
                    loading.value = false;
                    openTaskLog(taskID);
                    handleBackupClose();
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const recover = async (row?: any) => {
            const taskID = newUUID();
            let params = {
                downloadAccountId: row.downloadAccountId,
                type: type.value,
                name: name.value,
                detailName: detailName.value,
                file: row.fileDir + '/' + row.fileName,
                secret: secret.value,
                taskId: taskID,
                backupRecordId: row.id,
                timeout: timeoutItem.value === -1 ? -1 : transferTimeToSecond(timeoutItem.value + timeoutUnit.value),
                dropAllCollections: type.value === 'mongodb' ? dropAllCollections.value : false,
            };
            loading.value = true;
            await rpc.backup
                .recoverData(params)
                .then(() => {
                    loading.value = false;
                    openTaskLog(taskID);
                    handleBackupClose();
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const onBackup = async () => {
            description.value = '';
            secret.value = '';
            args.value = [];
            stopBefore.value = false;
            isBackup.value = true;
            open.value = true;
        };
        const onRecover = async (row: any) => {
            secret.value = '';
            dropAllCollections.value = false;
            isBackup.value = false;
            recordInfo.value = row;
            open.value = true;
        };
        const onSubmit = () => {
            if (isBackup.value) {
                backup();
            } else {
                recover(recordInfo.value);
            }
        };
        const onDownload = async (row: any) => {
            const res = await rpc.backup.downloadBackupRecord({
                downloadAccountId: row.downloadAccountId,
                fileDir: row.fileDir,
                fileName: row.fileName,
            });
            downloadFile(res.path, 'local');
        };
        const onBatchDelete = async (row: any | null) => {
            let ids: Array<number> = [];
            let names = [];
            if (row) {
                ids.push(row.id);
                names.push(row.fileName);
            } else {
                selects.value.forEach((item: any) => {
                    ids.push(item.id);
                    names.push(item.fileName);
                });
            }
            opRef.value.acceptParams({
                names: names,
                title: i18n.global.t('commons.button.delete'),
                api: rpc.backup.deleteBackupRecords,
                msg: i18n.global.t('commons.msg.operatorHelper', [
                    i18n.global.t('commons.button.backup'),
                    i18n.global.t('commons.button.delete'),
                ]),
                params: { ids: ids },
            });
        };
        const buttons = [
            {
                label: i18n.global.t('commons.button.recover'),
                disabled: (row: any) => {
                    return row.size === 0 || row.status === 'Failed';
                },
                click: (row: any) => {
                    onRecover(row);
                },
            },
            {
                label: i18n.global.t('commons.button.download'),
                disabled: (row: any) => {
                    return row.size === 0 || row.status === 'Failed';
                },
                click: (row: any) => {
                    onDownload(row);
                },
            },
            {
                label: i18n.global.t('commons.button.delete'),
                disabled: (row: any) => {
                    return row.status === 'Waiting';
                },
                click: (row: any) => {
                    onBatchDelete(row);
                },
            },
        ];
        ctx.expose({
            acceptParams,
        });
        return () => (
            <>
                <DrawerPro
                    modelValue={unref(backupVisible)}
                    onUpdate:modelValue={($v) => {
                        backupVisible.value = $v as any;
                    }}
                    header={$t('commons.button.backup')}
                    resource={unref(detailName) ? unref(name) + ' [' + unref(detailName) + ']' : unref(name)}
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                    size="60%"
                    v-slots={{
                        content: () => (
                            <>
                                {unref(type) === 'app' ? (
                                    <ElAlert closable={false} type="warning">
                                        <div class={'mt-2 text-xs'}>
                                            <span>{$t('setting.backupJump')}</span>
                                            <span
                                                onClick={($event?: any) => {
                                                    goFile();
                                                }}
                                                class={'jump'}
                                            >
                                                <ElIcon class={'ml-2'}>
                                                    <Position />
                                                </ElIcon>
                                                {$t('firewall.quickJump')}
                                            </span>
                                        </div>
                                    </ElAlert>
                                ) : null}
                                {withDirectives(
                                    <ComplexTable
                                        pagination-config={paginationConfig}
                                        selects={unref(selects)}
                                        onUpdate:selects={($v) => {
                                            selects.value = $v as any;
                                        }}
                                        onSearch={($event?: any) => {
                                            (search as any)($event);
                                        }}
                                        data={unref(data)}
                                        class={'mt-5'}
                                        style={'width: 100%'}
                                        v-slots={{
                                            toolbar: () => (
                                                <>
                                                    <ElButton
                                                        type="primary"
                                                        disabled={
                                                            unref(status) && unref(status).toLowerCase() != 'running'
                                                        }
                                                        onClick={($event?: any) => {
                                                            onBackup();
                                                        }}
                                                    >
                                                        {$t('commons.button.backup')}
                                                    </ElButton>
                                                    <ElButton
                                                        type="primary"
                                                        plain
                                                        disabled={unref(selects).length === 0}
                                                        onClick={($event?: any) => {
                                                            onBatchDelete(null);
                                                        }}
                                                    >
                                                        {$t('commons.button.delete')}
                                                    </ElButton>
                                                    <TableRefresh
                                                        onSearch={($event?: any) => {
                                                            search();
                                                        }}
                                                        class={'float-right'}
                                                    />
                                                </>
                                            ),
                                        }}
                                    >
                                        <ElTableColumn type="selection" selectable={selectable} fix />
                                        <ElTableColumn
                                            label={$t('commons.table.name')}
                                            prop="fileName"
                                            show-overflow-tooltip
                                        />
                                        <ElTableColumn
                                            min-width="80px"
                                            label={$t('commons.table.status')}
                                            prop="status"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        {row.status === 'Waiting' ? (
                                                            <Status
                                                                status={row.status}
                                                                onClick={($event?: any) => {
                                                                    openTaskLog(row.taskId);
                                                                }}
                                                                msg={row.message}
                                                                operate={true}
                                                            />
                                                        ) : (
                                                            <Status status={row.status} msg={row.message} />
                                                        )}
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            min-width="80px"
                                            label={$t('file.size')}
                                            prop="size"
                                            show-overflow-tooltip
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        {row.hasLoad &&
                                                        (row.status === 'Success' || row.status === 'Failed') ? (
                                                            <div>
                                                                {row.size ? (
                                                                    <span>{computeSize(row.size)}</span>
                                                                ) : (
                                                                    <span>{'-'}</span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <ElButton link loading />
                                                            </div>
                                                        )}
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            min-width="100px"
                                            label={$t('app.source')}
                                            prop="backupType"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        {row.accountType === 'LOCAL' ? (
                                                            <span>{$t('setting.LOCAL')}</span>
                                                        ) : null}
                                                        {row.accountType && row.accountType !== 'LOCAL' ? (
                                                            <span>
                                                                {$t('setting.' + row.accountType) +
                                                                    ' - ' +
                                                                    row.accountName}
                                                            </span>
                                                        ) : null}
                                                        {!row.accountType ? <span>{'-'}</span> : null}
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            min-width="120px"
                                            label={$t('commons.table.description')}
                                            prop="description"
                                            show-overflow-tooltip
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        <FuInputRwSwitch
                                                            modelValue={row.description}
                                                            onUpdate:modelValue={($v) => {
                                                                row.description = $v as any;
                                                            }}
                                                            onEnter={($event?: any) => {
                                                                onChange(row);
                                                            }}
                                                            onBlur={($event?: any) => {
                                                                onChange(row);
                                                            }}
                                                        />
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            min-width="80px"
                                            prop="createdAt"
                                            label={$t('commons.table.date')}
                                            formatter={dateFormat}
                                            show-overflow-tooltip
                                        />
                                        <FuTableOperations
                                            width="200px"
                                            buttons={buttons}
                                            label={$t('commons.table.operate')}
                                            fix
                                        />
                                    </ComplexTable>,
                                    [[vLoading, unref(loading)]],
                                )}
                            </>
                        ),
                    }}
                />
                <DialogPro
                    modelValue={unref(open)}
                    onUpdate:modelValue={($v) => {
                        open.value = $v as any;
                    }}
                    title={
                        unref(isBackup)
                            ? $t('commons.button.backup')
                            : $t('commons.button.recover') + ' - ' + unref(name)
                    }
                    onClose={($event?: any) => {
                        (handleBackupClose as any)($event);
                    }}
                    v-slots={{
                        footer: () => (
                            <>
                                <span class={'dialog-footer'}>
                                    <ElButton
                                        onClick={($event?: any) => {
                                            (handleBackupClose as any)($event);
                                        }}
                                        disabled={unref(loading)}
                                    >
                                        {$t('commons.button.cancel')}
                                    </ElButton>
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            (onSubmit as any)($event);
                                        }}
                                        disabled={unref(loading)}
                                    >
                                        {$t('commons.button.confirm')}
                                    </ElButton>
                                </span>
                            </>
                        ),
                    }}
                >
                    <ElAlert closable={false}>
                        {$t('commons.msg.' + (unref(isBackup) ? 'backupHelper' : 'recoverHelper'), [
                            unref(name) + '( ' + unref(detailName) + ' )',
                        ])}
                    </ElAlert>
                    {withDirectives(
                        <ElForm
                            ref="backupForm"
                            onSubmit={($event?: any) => {
                                $event.preventDefault();
                            }}
                            label-position="top"
                            class={'mt-5'}
                        >
                            {unref(isBackup) && (unref(type) === 'container' || unref(type) === 'compose') ? (
                                <ElFormItem>
                                    <ElCheckbox
                                        modelValue={unref(stopBefore)}
                                        onUpdate:modelValue={($v) => {
                                            stopBefore.value = $v as any;
                                        }}
                                    >
                                        {unref(type) === 'container'
                                            ? $t('container.stopContainerBeforeBackup')
                                            : $t('container.stopComposeBeforeBackup')}
                                    </ElCheckbox>
                                    <span class={'input-help'}>{$t('container.stopBeforeBackupHelper')}</span>
                                </ElFormItem>
                            ) : null}
                            <ElFormItem label={$t('setting.compressPassword')}>
                                <ElInput
                                    modelValue={unref(secret)}
                                    onUpdate:modelValue={($v) => {
                                        secret.value = $v as any;
                                    }}
                                    placeholder={$t('setting.backupRecoverMessage')}
                                />
                            </ElFormItem>
                            {!unref(isBackup) && unref(type) === 'mongodb' ? (
                                <ElFormItem>
                                    <ElCheckbox
                                        modelValue={unref(dropAllCollections)}
                                        onUpdate:modelValue={($v) => {
                                            dropAllCollections.value = $v as any;
                                        }}
                                    >
                                        {$t('database.mongodbRecoverDropAllCollections')}
                                    </ElCheckbox>
                                    <span class={'input-help'}>
                                        {$t('database.mongodbRecoverDropAllCollectionsHelper')}
                                    </span>
                                </ElFormItem>
                            ) : null}
                            {unref(isBackup) && supportMysqlBackupArgs() ? (
                                <ElFormItem label={$t('cronjob.backupArgs')}>
                                    <ElSelect
                                        modelValue={unref(args)}
                                        onUpdate:modelValue={($v) => {
                                            args.value = $v as any;
                                        }}
                                        filterable
                                        allow-create
                                        multiple
                                    >
                                        {(loadMysqlArgs(unref(type)) || []).map((item) => (
                                            <ElOption value={item.arg} label={item.arg} key={item.arg}>
                                                {item.arg}
                                                <span class={'ml-2'}>{item.description}</span>
                                            </ElOption>
                                        ))}
                                    </ElSelect>
                                    <span class={'input-help'}>{$t('cronjob.backupArgsHelper')}</span>
                                </ElFormItem>
                            ) : null}
                            {!unref(isBackup) && unref(type) !== 'app' && unref(type) !== 'website' ? (
                                <ElFormItem label={$t('cronjob.timeout')} prop="timeoutItem">
                                    <ElInput
                                        type="number"
                                        modelValue={unref(timeoutItem)}
                                        onUpdate:modelValue={($v) => {
                                            timeoutItem.value = $v === '' ? $v : Number($v);
                                        }}
                                        class={'selectClass'}
                                        v-slots={{
                                            append: () => (
                                                <>
                                                    <ElSelect
                                                        modelValue={unref(timeoutUnit)}
                                                        onUpdate:modelValue={($v) => {
                                                            timeoutUnit.value = $v as any;
                                                        }}
                                                        style={'width: 80px'}
                                                    >
                                                        <ElOption label={$t('commons.units.second')} value="s" />
                                                        <ElOption label={$t('commons.units.minute')} value="m" />
                                                        <ElOption label={$t('commons.units.hour')} value="h" />
                                                    </ElSelect>
                                                </>
                                            ),
                                        }}
                                    />
                                    <span class={'input-help'}>{$t('database.recoverTimeoutHelper')}</span>
                                </ElFormItem>
                            ) : null}
                            {unref(isBackup) ? (
                                <ElFormItem label={$t('commons.table.description')}>
                                    <ElInput
                                        type="textarea"
                                        autosize={{ minRows: 2, maxRows: 5 }}
                                        modelValue={unref(description)}
                                        onUpdate:modelValue={($v) => {
                                            description.value = $v as any;
                                        }}
                                    />
                                </ElFormItem>
                            ) : null}
                        </ElForm>,
                        [[vLoading, unref(loading)]],
                    )}
                </DialogPro>
                <OpDialog
                    ref={opRef}
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <TaskLog
                    ref={taskLogRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
            </>
        );
    },
    options,
);
