import { $t } from '@/utils/i18n-t';
interface AgentFeishuTransition {
    confirmed: boolean;
    streaming: boolean;
    groupSessionScope: string;
    requireMention: string;
}
import Diff from './diff/index';
import TaskLog from '@/components/log/task/index';
import CodemirrorPro from '@/components/codemirror-pro/index';
import { App } from '@/types/app';
import FeishuTransition from '@/views/ai/agents/agent/config/tabs/channels/components/feishu-transition';
import { rpc } from '@/lib/rpc';
import { isOpenclawCurrentHTTPVersion, isOpenclawHTTPSWindowVersion } from '@/utils/agent';
import i18n from '@/lang';
import { ElMessageBox, FormInstance } from 'element-plus';
import { computed, onBeforeUnmount, reactive, ref } from 'vue';
import { MsgError, MsgSuccess } from '@/utils/message';
import { Rules } from '@/global/form-rules';
import bus from '@/global/bus';
import { v4 as uuidv4 } from 'uuid';
import { useGlobalStore } from '@/composables/useGlobalStore';
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElDescriptions } from 'element-plus';
import { ElDescriptionsItem } from 'element-plus';
import { ElLink } from 'element-plus';
import { ElIcon } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElAlert } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElText } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';
import { OfficeBuilding } from '@element-plus/icons-vue';
import { Document } from '@element-plus/icons-vue';
import { Link } from '@element-plus/icons-vue';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'upgrade',
    props: {},
    emits: emits,
    __scopeId: 'data-v-9fd27ca3',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode } = useGlobalStore();
        const composeDiffRef = ref();
        const updateRef = ref<FormInstance>();
        const open = ref(false);
        const loading = ref(false);
        const loadingVersions = ref(false);
        const composeReady = ref(false);
        const currentComposeReady = ref(false);
        let versionRequest = 0;
        const versions = ref<App.VersionDetail[]>();
        const operateReq = reactive({
            detailId: 0,
            operate: 'upgrade',
            installId: 0,
            backup: true,
            pullImage: true,
            deleteImage: false,
            version: '',
            dockerCompose: '',
            taskID: '',
            feishuTransition: undefined as AgentFeishuTransition | undefined,
        });
        const feishuLegacy = ref(false);
        const feishuConfigured = ref(false);
        const feishuTransition = reactive<AgentFeishuTransition>({
            confirmed: false,
            streaming: false,
            groupSessionScope: 'group',
            requireMention: 'true',
        });
        const resourceName = ref('');
        const rules = ref<any>({
            detailId: [Rules.requiredSelect],
        });
        const app = ref();
        const oldContent = ref('');
        const newContent = ref('');
        const handleClose = () => {
            versionRequest++;
            loadingVersions.value = false;
            composeReady.value = false;
            open.value = false;
            ctx.emit('close', open.value);
        };
        const newCompose = ref('');
        const useNewCompose = ref(false);
        const appInstallID = ref(0);
        const taskLogRef = ref();
        const ignoreAppReq = reactive({
            appID: 0,
            appDetailID: 0,
            scope: 'app',
        });
        const isEdit = ref(false);
        const node = ref('');
        const currentVersion = ref('');
        const currentAppKey = ref('');
        const showOpenclawHttpRollbackNotice = computed(() => {
            return (
                operateReq.operate === 'upgrade' &&
                currentAppKey.value === 'openclaw' &&
                isOpenclawHTTPSWindowVersion(currentVersion.value) &&
                isOpenclawCurrentHTTPVersion(operateReq.version)
            );
        });
        const toLink = (link: string) => {
            window.open(link, '_blank');
        };
        const openDiff = async () => {
            if (!composeReady.value) {
                await getVersions(operateReq.version);
            }
            if (!composeReady.value) return;
            composeDiffRef.value.acceptParams(oldContent.value, newContent.value);
        };
        const getNewCompose = (compose: string) => {
            if (compose !== '') {
                newCompose.value = compose;
                useNewCompose.value = true;
            } else {
                newCompose.value = newContent.value;
                useNewCompose.value = false;
            }
        };
        const initData = async () => {
            const request = versionRequest;
            const config = await rpc.core.setting.getAppStoreConfig({});
            if (request !== versionRequest) return false;
            newCompose.value = '';
            useNewCompose.value = false;
            operateReq.backup = config.upgradeBackup == 'Enable';
            operateReq.pullImage = true;
            operateReq.deleteImage = config.upgradeDeleteImage == 'Enable';
            operateReq.dockerCompose = '';
            return true;
        };
        const acceptParams = async (appInstall: App.AppInstallDto, op: string, opNode?: string) => {
            versionRequest++;
            composeReady.value = false;
            currentComposeReady.value = false;
            loadingVersions.value = false;
            versions.value = undefined;
            operateReq.detailId = 0;
            operateReq.version = '';
            if (opNode) {
                node.value = opNode;
            } else {
                node.value = currentNode.value;
            }
            feishuLegacy.value = false;
            feishuConfigured.value = false;
            operateReq.feishuTransition = undefined;
            Object.assign(feishuTransition, {
                confirmed: false,
                streaming: false,
                groupSessionScope: 'group',
                requireMention: 'true',
            });
            if (!(await initData())) return;
            isEdit.value = appInstall.isEdit;
            currentVersion.value = appInstall.version;
            currentAppKey.value = appInstall.appKey;
            operateReq.installId = appInstall.id;
            operateReq.operate = op;
            resourceName.value = appInstall.name;
            app.value = appInstall.app;
            oldContent.value = appInstall.dockerCompose;
            appInstallID.value = appInstall.id;
            getVersions('');
            ignoreAppReq.appID = appInstall.app.id;
            if (op === 'ignore') {
                operateReq.detailId = -1;
            }
            open.value = true;
        };
        const getVersions = async (version: string) => {
            const request = ++versionRequest;
            const upgrading = operateReq.operate === 'upgrade';
            composeReady.value = false;
            if (upgrading) operateReq.detailId = 0;
            loadingVersions.value = true;
            const req: App.AppUpdateVersionReq = {
                appInstallID: appInstallID.value,
                loadCompose: false,
            };
            try {
                if (!versions.value || version === '') {
                    const res = await rpc.app.updateVersions({
                        appInstallId: req.appInstallID,
                        loadCompose: req.loadCompose,
                    });
                    if (request !== versionRequest) return;
                    versions.value = res.items || [];
                }
                let item = version ? versions.value.find((v) => v.version === version) : versions.value[0];
                if (!item) {
                    if (upgrading && version) MsgError(i18n.global.t('container.contentEmpty'));
                    return;
                }
                operateReq.version = item.version;
                if (!upgrading) {
                    operateReq.detailId = item.detailId;
                    return;
                }
                if (!currentComposeReady.value) {
                    const config = await rpc.app.getInstalledParams({ appInstallId: appInstallID.value });
                    if (request !== versionRequest) return;
                    if (typeof config.isEdit === 'boolean') isEdit.value = config.isEdit;
                    oldContent.value = JSON.parse(config.containerJson || '{}').dockerCompose;
                    currentComposeReady.value = true;
                }
                const res = await rpc.app.updateVersions({
                    appInstallId: req.appInstallID,
                    loadCompose: true,
                    updateVersion: item.version,
                });
                if (request !== versionRequest) return;
                item = res.items?.find((v) => v.version === operateReq.version);
                if (!item?.dockerCompose?.trim()) {
                    MsgError(i18n.global.t('container.contentEmpty'));
                    return;
                }
                feishuLegacy.value = Boolean(item.feishuLegacy);
                feishuConfigured.value = Boolean(item.feishuConfigured);
                if (feishuLegacy.value) operateReq.backup = true;
                operateReq.detailId = item.detailId;
                newContent.value = item.dockerCompose;
                newCompose.value = item.dockerCompose;
                useNewCompose.value = false;
                composeReady.value = true;
            } catch (error) {
            } finally {
                if (request === versionRequest) loadingVersions.value = false;
            }
        };
        const openTaskLog = (taskID: string) => {
            taskLogRef.value.openWithTaskID(taskID, true, node.value);
        };
        const operate = async () => {
            if (operateReq.operate === 'upgrade' && !composeReady.value) return;
            loading.value = true;
            if (operateReq.operate === 'upgrade') {
                if (useNewCompose.value) {
                    operateReq.dockerCompose = newCompose.value;
                }
                const taskID = uuidv4();
                operateReq.taskID = taskID;
                await rpc.app
                    .operate({
                        installId: operateReq.installId,
                        operate: operateReq.operate,
                        detailId: operateReq.detailId,
                        backup: operateReq.backup,
                        pullImage: operateReq.pullImage,
                        deleteImage: operateReq.deleteImage,
                        dockerCompose: operateReq.dockerCompose,
                        taskId: operateReq.taskID,
                    })
                    .then(() => {
                        bus.emit('upgrade', true);
                        handleClose();
                        openTaskLog(taskID);
                    })
                    .finally(() => {
                        loading.value = false;
                    });
            } else {
                await rpc.app
                    .ignoreAppUpgrade({
                        appId: ignoreAppReq.appID,
                        appDetailId: ignoreAppReq.appDetailID,
                        scope: ignoreAppReq.scope,
                    })
                    .then(() => {
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        bus.emit('upgrade', true);
                        handleClose();
                    })
                    .finally(() => {
                        loading.value = false;
                    });
            }
        };
        const onOperate = async () => {
            if (loadingVersions.value || (operateReq.operate === 'upgrade' && !composeReady.value)) return;
            if (operateReq.operate === 'upgrade' && useNewCompose.value && !newCompose.value.trim()) {
                MsgError(i18n.global.t('container.contentEmpty'));
                return;
            }
            await updateRef.value?.validate();
            const helper = i18n.global.t('app.operatorHelper', [i18n.global.t('commons.button.' + operateReq.operate)]);
            const notice =
                feishuLegacy.value && operateReq.operate === 'upgrade'
                    ? i18n.global.t('aiTools.agents.feishuUpgradeNotice') +
                      (feishuConfigured.value ? ' ' + i18n.global.t('aiTools.agents.feishuSwitchConfirm') : '')
                    : helper;
            ElMessageBox.confirm(notice, i18n.global.t('commons.button.upgrade'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
                type: 'info',
            }).then(() => {
                operateReq.feishuTransition =
                    feishuLegacy.value && feishuConfigured.value ? { ...feishuTransition, confirmed: true } : undefined;
                operate();
            });
        };
        onBeforeUnmount(() => {
            bus.off('upgrade');
        });
        ctx.expose({
            acceptParams,
        });
        return () => (
            <>
                <DrawerPro
                    modelValue={unref(open)}
                    onUpdate:modelValue={($v) => {
                        open.value = $v as any;
                    }}
                    header={$t('commons.button.' + operateReq.operate)}
                    resource={unref(resourceName)}
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                    v-slots={{
                        footer: () => (
                            <>
                                <ElButton
                                    onClick={($event?: any) => {
                                        (handleClose as any)($event);
                                    }}
                                    disabled={unref(loading)}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    type="primary"
                                    onClick={($event?: any) => {
                                        (onOperate as any)($event);
                                    }}
                                    disabled={
                                        unref(versions) == null ||
                                        unref(loading) ||
                                        unref(loadingVersions) ||
                                        (operateReq.operate === 'upgrade' && !unref(composeReady))
                                    }
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </>
                        ),
                    }}
                >
                    {withDirectives(
                        <div>
                            <ElDescriptions direction="vertical">
                                <ElDescriptionsItem>
                                    <ElLink
                                        onClick={($event?: any) => {
                                            toLink(unref(app).website);
                                        }}
                                    >
                                        <ElIcon>
                                            <OfficeBuilding />
                                        </ElIcon>
                                        <span>{$t('app.appOfficeWebsite')}</span>
                                    </ElLink>
                                </ElDescriptionsItem>
                                <ElDescriptionsItem>
                                    <ElLink
                                        onClick={($event?: any) => {
                                            toLink(unref(app).document);
                                        }}
                                    >
                                        <ElIcon>
                                            <Document />
                                        </ElIcon>
                                        <span>{$t('app.document')}</span>
                                    </ElLink>
                                </ElDescriptionsItem>
                                <ElDescriptionsItem>
                                    <ElLink
                                        onClick={($event?: any) => {
                                            toLink(unref(app).github);
                                        }}
                                    >
                                        <ElIcon>
                                            <Link />
                                        </ElIcon>
                                        <span>{$t('app.github')}</span>
                                    </ElLink>
                                </ElDescriptionsItem>
                            </ElDescriptions>
                            <ElForm
                                onSubmit={($event?: any) => {
                                    $event.preventDefault();
                                }}
                                ref={updateRef}
                                rules={unref(rules)}
                                label-position="top"
                                model={operateReq}
                            >
                                <ElFormItem label={$t('app.versionSelect')} prop="detailId">
                                    <ElSelect
                                        modelValue={operateReq.version}
                                        onUpdate:modelValue={($v) => {
                                            operateReq.version = $v as any;
                                        }}
                                        onChange={($event?: any) => {
                                            getVersions(operateReq.version);
                                        }}
                                    >
                                        {operateReq.operate == 'ignore' ? (
                                            <ElOption
                                                value={'all'}
                                                label={$t('commons.table.all') + $t('app.version')}
                                            />
                                        ) : null}
                                        {(unref(versions) || []).map((version, index) => (
                                            <ElOption value={version.version} label={version.version} key={index} />
                                        ))}
                                    </ElSelect>
                                    {operateReq.operate === 'upgrade' &&
                                    !unref(composeReady) &&
                                    !unref(loadingVersions) ? (
                                        <ElButton
                                            onClick={($event?: any) => {
                                                getVersions(operateReq.version);
                                            }}
                                            class={'mt-2'}
                                        >
                                            {$t('commons.button.retry')}
                                        </ElButton>
                                    ) : null}
                                </ElFormItem>
                                {unref(showOpenclawHttpRollbackNotice) ? (
                                    <ElAlert
                                        type="warning"
                                        closable={false}
                                        show-icon
                                        class={'upgrade-notice'}
                                        v-slots={{ title: () => <>{$t('app.openclawHttpsUpgradeNoticeTitle')}</> }}
                                    >
                                        <div class={'upgrade-notice-content'}>
                                            <div>
                                                {'1. '}
                                                {$t('app.openclawHttpsUpgradeNoticeItem1')}
                                            </div>
                                            <div>
                                                {'2. '}
                                                {$t('app.openclawHttpsUpgradeNoticeItem2')}
                                            </div>
                                        </div>
                                    </ElAlert>
                                ) : null}
                                {unref(feishuLegacy) && operateReq.operate === 'upgrade' && unref(composeReady) ? (
                                    <>
                                        <ElAlert
                                            type="warning"
                                            closable={false}
                                            title={$t('aiTools.agents.feishuUpgradeNotice')}
                                            class={'mb-4'}
                                        />
                                        {unref(feishuConfigured) ? (
                                            <FeishuTransition
                                                streaming={feishuTransition.streaming}
                                                onUpdate:streaming={($v) => {
                                                    feishuTransition.streaming = $v as any;
                                                }}
                                                group-session-scope={feishuTransition.groupSessionScope}
                                                onUpdate:group-session-scope={($v) => {
                                                    feishuTransition.groupSessionScope = $v as any;
                                                }}
                                                require-mention={feishuTransition.requireMention}
                                                onUpdate:require-mention={($v) => {
                                                    feishuTransition.requireMention = $v as any;
                                                }}
                                            />
                                        ) : null}
                                    </>
                                ) : null}
                                {operateReq.operate === 'upgrade' ? (
                                    <ElFormItem prop="backup">
                                        <ElCheckbox
                                            modelValue={operateReq.backup}
                                            onUpdate:modelValue={($v) => {
                                                operateReq.backup = $v as any;
                                            }}
                                            disabled={unref(feishuLegacy)}
                                            label={$t('app.backupApp')}
                                        />
                                        <span class={'input-help'}>
                                            <ElText type="warning">{$t('app.backupAppHelper')}</ElText>
                                        </span>
                                    </ElFormItem>
                                ) : null}
                                {operateReq.operate === 'upgrade' ? (
                                    <ElFormItem prop="pullImage">
                                        <ElCheckbox
                                            modelValue={operateReq.pullImage}
                                            onUpdate:modelValue={($v) => {
                                                operateReq.pullImage = $v as any;
                                            }}
                                            label={$t('app.pullImage')}
                                            size="large"
                                        />
                                        <span class={'input-help'}>{$t('app.pullImageHelper')}</span>
                                    </ElFormItem>
                                ) : null}
                                {operateReq.operate === 'upgrade' ? (
                                    <ElFormItem prop="deleteImage">
                                        <ElCheckbox
                                            modelValue={operateReq.deleteImage}
                                            onUpdate:modelValue={($v) => {
                                                operateReq.deleteImage = $v as any;
                                            }}
                                            label={$t('app.upgradeDeleteImage')}
                                        />
                                    </ElFormItem>
                                ) : null}
                            </ElForm>
                            {operateReq.operate === 'upgrade' && unref(composeReady) ? (
                                <div>
                                    {unref(isEdit) ? (
                                        <ElText type="danger">{$t('app.isEdirWarn')}</ElText>
                                    ) : (
                                        <ElText type="warning">{$t('app.upgradeWarn')}</ElText>
                                    )}
                                    <div>
                                        <ElButton
                                            onClick={($event?: any) => {
                                                openDiff();
                                            }}
                                            type={unref(isEdit) ? 'warning' : 'primary'}
                                        >
                                            {$t('app.showDiff')}
                                        </ElButton>
                                    </div>
                                    <ElCheckbox
                                        modelValue={unref(useNewCompose)}
                                        onUpdate:modelValue={($v) => {
                                            useNewCompose.value = $v as any;
                                        }}
                                        label={$t('app.useCustom')}
                                        size="large"
                                    />
                                    {unref(useNewCompose) ? (
                                        <div>
                                            {!unref(isEdit) ? (
                                                <ElText type="danger">{$t('app.useCustomHelper')}</ElText>
                                            ) : null}
                                            <CodemirrorPro
                                                modelValue={unref(newCompose)}
                                                onUpdate:modelValue={($v) => {
                                                    newCompose.value = $v as any;
                                                }}
                                                mode="yaml"
                                            />
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>,
                        [[vLoading, unref(loading) || unref(loadingVersions)]],
                    )}
                    <Diff
                        ref={composeDiffRef}
                        onConfirm={($event?: any) => {
                            (getNewCompose as any)($event);
                        }}
                    />
                </DrawerPro>
                <TaskLog ref={taskLogRef} />
            </>
        );
    },
    options,
);
