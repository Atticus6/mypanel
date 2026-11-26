import FuSteps from '@/components/fu/FuSteps';
import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import { computeSize } from '@/utils/size';
import { newUUID } from '@/utils/id';
import { transferTimeToSecond } from '@/utils/validate';
import i18n from '@/lang';
import TaskLog from '@/components/log/task/index';
import InputTag from '@/components/input-tag/index';
import { Rules } from '@/global/form-rules';
import { MsgSuccess } from '@/utils/message';
type FormInstance = InstanceType<typeof ElForm>;
import './index.styles.css';
import DrawerPro from '@/components/drawer-pro/index';
import FuStep from '@/components/fu/steps/FuStep';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: (...args: unknown[]) => true,
};

const options = {
    name: 'create',
    props: {},
    emits: emits,
    __scopeId: 'data-v-79c6ffc2',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref();
        const stepsRef = ref();
        const nowIndex = ref(0);
        const appRef = ref();
        const panelRef = ref();
        const backupRef = ref();
        const taskLogRef = ref();
        const baseDir = ref();
        const backupOptions = ref();
        const accountOptions = ref();
        const formRef = ref<FormInstance>();
        const form = reactive({
            id: 0,
            taskID: '',
            downloadAccountID: '',
            fromAccounts: [],
            sourceAccountIDs: '',
            description: '',
            secret: '',

            timeout: 3600,
            timeoutItem: 3600,
            timeoutUnit: 's',

            backupAllImage: false,
            withDockerConf: true,
            withLoginLog: false,
            withOperationLog: false,
            withSystemLog: false,
            withTaskLog: false,
            withMonitorData: false,

            panelData: [],
            backupData: [],
            appData: [],
            ignoreFiles: [],
        });
        const rules = reactive({
            fromAccounts: [Rules.requiredSelect],
            downloadAccountID: [Rules.requiredSelect],

            timeoutItem: [Rules.number],
        });
        const defaultProps = {
            children: 'children',
            label: 'label',
            checked: 'isCheck',
            disabled: 'isDisable',
        };
        const drawerVisible = ref();
        const acceptParams = (): void => {
            form.downloadAccountID = '';
            form.fromAccounts = [];
            form.description = '';
            form.secret = '';
            nowIndex.value = 0;
            search();
            loadBackups();
            loadInstallDir();
            drawerVisible.value = true;
        };
        const handleClose = () => {
            drawerVisible.value = false;
            ctx.emit('search');
        };
        const submitForm = async (formEl: any) => {
            let bool;
            if (!formEl) return;
            await formEl.validate((valid: boolean) => {
                if (valid) {
                    bool = true;
                } else {
                    bool = false;
                }
            });
            return bool;
        };
        const beforeLeave = async (stepItem: any) => {
            switch (stepItem.id) {
                case 'baseData':
                    if (await submitForm(formRef.value)) {
                        stepsRef.value.next();
                        return true;
                    } else {
                        return false;
                    }
                case 'appData':
                    if (form.appData && form.appData.length !== 0) {
                        let appChecks = appRef.value.getCheckedNodes();
                        loadCheckForSubmit(appChecks, form.appData);
                    }
                    return true;
                case 'panelData':
                    let panelChecks = panelRef.value.getCheckedNodes();
                    loadCheckForSubmit(panelChecks, form.panelData);
                    return true;
                case 'backupData':
                    if (!form.backupData || form.backupData.length === 0) {
                        return true;
                    }
                    if (form.backupData && form.backupData.length !== 0) {
                        let backupChecks = backupRef.value.getCheckedNodes();
                        loadCheckForSubmit(backupChecks, form.backupData);
                    }
                    return true;
            }
            return true;
        };
        function next() {
            stepsRef.value.next();
        }
        function prev() {
            stepsRef.value.prev();
        }
        const loadApp18n = (label: string) => {
            switch (label) {
                case 'appData':
                    return i18n.global.t('setting.appDataLabel');
                case 'appImage':
                case 'appBackup':
                    return i18n.global.t('setting.' + label);
                default:
                    return label;
            }
        };
        const loadBackups = async () => {
            const res = await rpc.backup.loadBackupOptions({});
            backupOptions.value = [];
            for (const item of res.items) {
                if (item.id !== 0) {
                    backupOptions.value.push({
                        id: item.id,
                        type: i18n.global.t('setting.' + item.type),
                        name: item.name,
                    });
                }
            }
            changeAccount(true);
        };
        const changeStep = (currentStep: any) => {
            nowIndex.value = currentStep.index;
            switch (currentStep.id) {
                case 'appData':
                    if (appRef.value) {
                        return;
                    }
                    nextTick(() => {
                        setAppDefaultCheck(form.appData);
                    });
                    return;
                case 'panelData':
                    if (panelRef.value) {
                        return;
                    }
                    nextTick(() => {
                        setPanelDefaultCheck(form.panelData);
                        return;
                    });
                    return;
                case 'backupData':
                    if (backupRef.value) {
                        return;
                    }
                    nextTick(() => {
                        setBackupDefaultCheck(form.backupData);
                        return;
                    });
                    return;
            }
        };
        const changeAccount = async (isInit: boolean) => {
            accountOptions.value = [];
            let isInAccounts = false;
            for (const item of backupOptions.value) {
                let exist = false;
                for (const ac of form.fromAccounts) {
                    if (item.id == ac) {
                        exist = true;
                        break;
                    }
                }
                if (exist) {
                    if (item.id === form.downloadAccountID) {
                        isInAccounts = true;
                    }
                    accountOptions.value.push(item);
                }
            }
            if (!isInAccounts && !isInit) {
                form.downloadAccountID = form.fromAccounts.length === 0 ? undefined : form.fromAccounts[0];
            }
        };
        const load18n = (node: any, label: string) => {
            if (node.level === 1) {
                switch (label) {
                    case 'log':
                    case 'app':
                    case 'database':
                    case 'website':
                    case 'directory':
                        return i18n.global.t('setting.' + label + 'Label');
                    case 'system_snapshot':
                        return i18n.global.t('setting.snapshotLabel');
                    case 'master':
                        return i18n.global.t('xpack.node.masterBackup');
                    case 'file-history':
                        return i18n.global.t('file.file');
                    default:
                        return label;
                }
            }
            if (node.level === 2) {
                switch (label) {
                    case 'App':
                        return i18n.global.t('setting.appLabel');
                    case 'AppStore':
                        return i18n.global.t('menu.apps');
                    case 'shell':
                        return i18n.global.t('setting.shellLabel');
                    default:
                        return label;
                }
            }
            return label;
        };
        const submitAddSnapshot = async () => {
            loading.value = true;
            form.taskID = newUUID();
            form.sourceAccountIDs = form.fromAccounts.join(',');
            form.timeout = transferTimeToSecond(form.timeoutItem + form.timeoutUnit);
            await rpc.snapshot
                .create({
                    ...form,
                    sourceAccountIds: form.sourceAccountIDs,
                    downloadAccountId: Number(form.downloadAccountID) || 0,
                    taskId: form.taskID,
                    appData: form.appData,
                    backupData: form.backupData,
                    panelData: form.panelData,
                })
                .then(() => {
                    loading.value = false;
                    drawerVisible.value = false;
                    ctx.emit('search');
                    openTaskLog(form.taskID);
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const openTaskLog = (taskID: string) => {
            taskLogRef.value.openWithTaskID(taskID);
        };
        const loadCheckForSubmit = (checks: any, list: any) => {
            for (const item of list) {
                let isCheck = false;
                for (const check of checks) {
                    if (item.id == check.id) {
                        isCheck = true;
                        break;
                    }
                }
                item.isCheck = isCheck;
                if (item.children) {
                    loadCheckForSubmit(checks, item.children);
                }
            }
        };
        const selectAllImage = () => {
            for (const item of form.appData) {
                for (const item2 of item.children) {
                    if (item2.label === 'appImage') {
                        appRef.value.setChecked(item2.id, form.backupAllImage, false);
                    }
                }
            }
        };
        const loadInstallDir = async () => {
            const pathRes = await rpc.agentSetting.getBaseDir({});
            baseDir.value = pathRes.path;
        };
        const search = async () => {
            loading.value = true;
            await rpc.snapshot
                .loadData({})
                .then((res) => {
                    loading.value = false;
                    form.panelData = res.panelData || [];
                    form.backupData = res.backupData || [];
                    form.appData = res.appData || [];
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        function onChangeAppData(data: any, checked: any) {
            let isChecked = false;
            let keys = checked.checkedKeys || [];
            for (const item of keys) {
                if (data.id === item) {
                    isChecked = true;
                }
            }
            let relationID = data.relationItemID;
            if (!relationID) {
                let list = data.children || [];
                for (const item of list) {
                    if (item.label === 'appData' && item.relationItemID && !item.isDisable) {
                        relationID = item.relationItemID;
                        break;
                    }
                }
            }
            if (!relationID) {
                return;
            }
            changeRelation(relationID, isChecked);
        }
        const changeRelation = (relationID: string, isChecked: boolean) => {
            for (const item of form.appData) {
                if (!item.children) {
                    return;
                }
                for (const relationItem of item.children) {
                    if (relationItem.id !== relationID) {
                        continue;
                    }
                    relationItem.isDisable = isChecked;
                    if (isChecked) {
                        appRef.value.setChecked(relationItem.id, isChecked, isChecked);
                    }
                    if (relationItem.relationID) {
                        changeRelation(relationItem.relationID, isChecked);
                    }
                    break;
                }
            }
        };
        const onChangePanelData = (data: any, checked: any) => {
            let isChecked = false;
            let keys = checked.checkedKeys || [];
            for (const item of keys) {
                if (data.id === item) {
                    isChecked = true;
                }
            }
            if (!isChecked && data.label === 'agent' && data.path.indexOf('1panel/agent') !== -1) {
                for (const item of data.children) {
                    if (item.label !== 'package') {
                        item.isCheck = true;
                        panelRef.value.setChecked(item.id, true, true);
                    }
                }
            }
        };
        const setAppDefaultCheck = async (list: any) => {
            for (const item of list) {
                if (item.isCheck) {
                    appRef.value.setChecked(item.id, true, true);
                }
                if (item.children) {
                    setAppDefaultCheck(item.children);
                }
            }
        };
        const setPanelDefaultCheck = async (list: any) => {
            for (const item of list) {
                if (item.isCheck) {
                    panelRef.value.setChecked(item.id, true, true);
                    continue;
                }
                if (item.children) {
                    setPanelDefaultCheck(item.children);
                }
            }
        };
        const setBackupDefaultCheck = async (list: any) => {
            if (!form.backupData || form.backupData.length === 0) {
                return;
            }
            for (const item of list) {
                if (item.isCheck) {
                    backupRef.value.setChecked(item.id, true, true);
                    continue;
                }
                if (item.children) {
                    setBackupDefaultCheck(item.children);
                }
            }
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <>
                <DrawerPro
                    v-model={drawerVisible.value}
                    header={$t('setting.snapshot')}
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                    size="large"
                    v-slots={{
                        footer: () => (
                            <>
                                <ElButton
                                    onClick={($event?: any) => {
                                        drawerVisible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                {unref(nowIndex) !== 0 ? (
                                    <ElButton
                                        onClick={($event?: any) => {
                                            (prev as any)($event);
                                        }}
                                    >
                                        {$t('commons.button.prev')}
                                    </ElButton>
                                ) : null}
                                {unref(nowIndex) === 5 ? (
                                    <ElButton
                                        type="primary"
                                        disabled={unref(loading)}
                                        onClick={($event?: any) => {
                                            (submitAddSnapshot as any)($event);
                                        }}
                                    >
                                        {$t('commons.button.create')}
                                    </ElButton>
                                ) : (
                                    <ElButton
                                        onClick={($event?: any) => {
                                            (next as any)($event);
                                        }}
                                    >
                                        {$t('commons.button.next')}
                                    </ElButton>
                                )}
                            </>
                        ),
                    }}
                >
                    <FuSteps
                        space={50}
                        ref={stepsRef}
                        direction="vertical"
                        isLoading={unref(loading)}
                        finishButtonText={$t('commons.button.create')}
                        onChange={($event?: any) => {
                            (changeStep as any)($event);
                        }}
                        beforeLeave={beforeLeave}
                        class={'steps'}
                        v-slots={{ footer: () => <></> }}
                    >
                        <FuStep id="baseData" title={$t('setting.stepBaseData')}>
                            <ElForm label-position="top" ref={formRef} model={form} rules={rules} class={'mt-5'}>
                                <ElFormItem label={$t('setting.backupAccount')} prop="fromAccounts">
                                    <ElSelect
                                        multiple
                                        onChange={($event?: any) => {
                                            changeAccount(false);
                                        }}
                                        v-model={form.fromAccounts}
                                        clearable
                                    >
                                        {(unref(backupOptions) || []).map((item) => (
                                            <div key={item.id}>
                                                {item.type !== $t('setting.LOCAL') ? (
                                                    <ElOption value={item.id} label={item.name}>
                                                        {item.name}
                                                        <ElTag type="primary" class={'tagClass'}>
                                                            {item.type}
                                                        </ElTag>
                                                    </ElOption>
                                                ) : (
                                                    <ElOption value={item.id} label={item.type} />
                                                )}
                                            </div>
                                        ))}
                                    </ElSelect>
                                </ElFormItem>
                                <ElFormItem label={$t('cronjob.default_download_path')} prop="downloadAccountID">
                                    <ElSelect v-model={form.downloadAccountID} clearable>
                                        {(unref(accountOptions) || []).map((item) => (
                                            <div key={item.id}>
                                                {item.type !== $t('setting.LOCAL') ? (
                                                    <ElOption value={item.id} label={item.name}>
                                                        {item.name}
                                                        <ElTag type="primary" class={'tagClass'}>
                                                            {item.type}
                                                        </ElTag>
                                                    </ElOption>
                                                ) : (
                                                    <ElOption value={item.id} label={item.type} />
                                                )}
                                            </div>
                                        ))}
                                    </ElSelect>
                                </ElFormItem>
                                <ElFormItem label={$t('setting.compressPassword')} prop="secret">
                                    <ElInput type="password" show-password clearable v-model={form.secret} />
                                </ElFormItem>
                                <ElFormItem label={$t('cronjob.timeout')} prop="timeoutItem">
                                    <ElInput
                                        type="number"
                                        modelValue={form.timeoutItem}
                                        onUpdate:modelValue={($v) => {
                                            form.timeoutItem = $v === '' ? $v : Number($v);
                                        }}
                                        class={'selectClass'}
                                        v-slots={{
                                            append: () => (
                                                <>
                                                    <ElSelect v-model={form.timeoutUnit} style={'width: 80px'}>
                                                        <ElOption label={$t('commons.units.second')} value="s" />
                                                        <ElOption label={$t('commons.units.minute')} value="m" />
                                                        <ElOption label={$t('commons.units.hour')} value="h" />
                                                    </ElSelect>
                                                </>
                                            ),
                                        }}
                                    />
                                </ElFormItem>
                                <ElFormItem label={$t('commons.table.description')} prop="description">
                                    <ElInput type="textarea" clearable v-model={form.description} />
                                </ElFormItem>
                            </ElForm>
                        </FuStep>
                        <FuStep id="appData" title={$t('setting.stepAppData')}>
                            {!form.appData || form.appData.length === 0 ? (
                                <div class={'mt-5 mb-5'}>
                                    <span class={'input-help'}>{$t('setting.noAppData')}</span>
                                </div>
                            ) : (
                                <div>
                                    <ElCheckbox
                                        v-model={form.backupAllImage}
                                        onChange={($event?: any) => {
                                            (selectAllImage as any)($event);
                                        }}
                                        label={$t('setting.selectAllImage')}
                                        size="large"
                                        class={'ml-6'}
                                    />
                                    <ElTree
                                        ref={appRef}
                                        node-key="id"
                                        data={form.appData}
                                        props={defaultProps}
                                        onCheck={($event?: any) => {
                                            (onChangeAppData as any)($event);
                                        }}
                                        show-checkbox
                                        style={'max-width: 600px'}
                                        v-slots={{
                                            default: ({ data }) => (
                                                <>
                                                    <div class={'float-left'}>
                                                        <span>{loadApp18n(data.label)}</span>
                                                    </div>
                                                    <div class={'float-left ml-4'}>
                                                        {data.size ? <span>{computeSize(data.size)}</span> : null}
                                                    </div>
                                                </>
                                            ),
                                        }}
                                    />
                                </div>
                            )}
                        </FuStep>
                        <FuStep id="panelData" title={$t('setting.stepPanelData')}>
                            <ElTree
                                ref={panelRef}
                                node-key="id"
                                data={form.panelData}
                                props={defaultProps}
                                onCheck={($event?: any) => {
                                    (onChangePanelData as any)($event);
                                }}
                                show-checkbox
                                style={'max-width: 600px'}
                                v-slots={{
                                    default: ({ data }) => (
                                        <>
                                            <div class={'float-left'}>
                                                <span>{data.label}</span>
                                            </div>
                                            <div class={'float-left ml-4'}>
                                                {data.size ? <span>{computeSize(data.size)}</span> : null}
                                            </div>
                                        </>
                                    ),
                                }}
                            />
                        </FuStep>
                        <FuStep id="backupData" title={$t('setting.stepBackupData')}>
                            {!form.backupData || form.backupData.length === 0 ? (
                                <div class={'mt-5 mb-5'}>
                                    <span class={'input-help'}>{$t('setting.noBackupData')}</span>
                                </div>
                            ) : (
                                <div>
                                    <ElTree
                                        ref={backupRef}
                                        node-key="id"
                                        data={form.backupData}
                                        props={defaultProps}
                                        show-checkbox
                                        style={'max-width: 600px'}
                                        v-slots={{
                                            default: ({ node, data }) => (
                                                <>
                                                    <div class={'float-left'}>
                                                        <span>{load18n(node, data.label)}</span>
                                                    </div>
                                                    <div class={'float-left ml-4'}>
                                                        {data.size ? <span>{computeSize(data.size)}</span> : null}
                                                    </div>
                                                </>
                                            ),
                                        }}
                                    />
                                </div>
                            )}
                        </FuStep>
                        <FuStep id="otherData" title={$t('setting.stepOtherData')}>
                            <div class={'ml-5'}>
                                <ElCheckbox
                                    v-model={form.withDockerConf}
                                    label={$t('setting.dockerConf')}
                                    size="large"
                                />
                            </div>
                            <div class={'ml-5'}>
                                <ElCheckbox v-model={form.withOperationLog} label={$t('logs.operation')} size="large" />
                            </div>
                            <div class={'ml-5'}>
                                <ElCheckbox v-model={form.withLoginLog} label={$t('logs.login')} size="large" />
                            </div>
                            <div class={'ml-5'}>
                                <ElCheckbox v-model={form.withSystemLog} label={$t('logs.system')} size="large" />
                            </div>
                            <div class={'ml-5'}>
                                <ElCheckbox v-model={form.withTaskLog} label={$t('logs.task')} size="large" />
                            </div>
                            <div class={'ml-5'}>
                                <ElCheckbox
                                    v-model={form.withMonitorData}
                                    label={$t('setting.monitorData')}
                                    size="large"
                                />
                            </div>
                        </FuStep>
                        <FuStep id="ignoreFiles" title={$t('cronjob.exclusionRules')}>
                            <InputTag
                                tags={form.ignoreFiles}
                                onUpdate:tags={($v) => {
                                    form.ignoreFiles = $v as any;
                                }}
                                withFile={true}
                                baseDir={unref(baseDir)}
                                egHelp={$t('cronjob.exclusionRulesHelper')}
                                class={'w-full'}
                            />
                        </FuStep>
                    </FuSteps>
                </DrawerPro>
                <TaskLog
                    ref={taskLogRef}
                    width="70%"
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                />
            </>
        );
    },
    options,
);
