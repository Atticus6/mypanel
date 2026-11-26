import { $t } from '@/utils/i18n-t';
import AppInstallForm from '@/pages/views/app-store/detail/form/index';
import { rpc } from '@/lib/rpc';
import { MsgError } from '@/utils/message';
import { newUUID } from '@/utils/id';
import { routerToName } from '@/utils/router';
import TaskLog from '@/components/log/task/index';
import i18n from '@/lang';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'AppInstallPage',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const router = useRouter();
        const open = ref(false);
        const loading = ref(false);
        const installFormRef = ref<InstanceType<typeof AppInstallForm>>();
        const taskLogRef = ref();
        const appKey = ref('');
        const batchInstallSupport = ref(false);
        const formData = ref({
            appDetailId: 0,
            params: {},
            name: '',
            advanced: true,
            cpuQuota: 0,
            memoryLimit: 0,
            memoryUnit: 'M',
            containerName: '',
            allowPort: false,
            editCompose: false,
            dockerCompose: '',
            version: '',
            appID: '',
            pullImage: true,
            taskID: '',
            gpuConfig: false,
            specifyIP: '',
            format: 'utf8mb4',
            collation: '',
        });
        const handleClose = () => {
            open.value = false;
            installFormRef.value?.resetForm();
            if (router.currentRoute.value.query.install) {
                routerToName('AppAll');
            }
        };
        const handleSubmit = async () => {
            if (!formData.value.appDetailId) return;

            const isValid = await installFormRef.value?.validate();
            if (!isValid) return;

            const submitData = installFormRef.value?.getFormData();

            if (submitData.editCompose && submitData.dockerCompose === '') {
                MsgError(i18n.global.t('app.composeNullErr'));
                return;
            }

            if (submitData.cpuQuota < 0) {
                submitData.cpuQuota = 0;
            }
            if (submitData.memoryLimit < 0) {
                submitData.memoryLimit = 0;
            }

            const isHostMode = installFormRef.value?.isHostMode();
            if (!isHostMode && !submitData.allowPort) {
                ElMessageBox.confirm(i18n.global.t('app.installWarn'), i18n.global.t('app.checkTitle'), {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                }).then(async () => {
                    await install(submitData);
                });
            } else {
                await install(submitData);
            }
        };
        const install = async (submitData: any) => {
            loading.value = true;
            const taskID = newUUID();
            submitData.taskID = taskID;

            try {
                // 单进程不再分发到多个节点，统一走本机安装。
                await rpc.app.install({
                    appDetailId: submitData.appDetailId,
                    name: submitData.name,
                    services: submitData.services ?? {},
                    taskId: taskID,
                    paramsJson: JSON.stringify(submitData.params ?? {}),
                });
                handleClose();
                openTaskLog(taskID);
            } catch (error) {
            } finally {
                loading.value = false;
            }
        };
        const openTaskLog = (taskID: string) => {
            taskLogRef.value.openWithTaskID(taskID);
        };
        const acceptParams = async (__panelSetupProps: { app: any; params?: any }) => {
            appKey.value = __panelSetupProps.app.key;
            batchInstallSupport.value = __panelSetupProps.app.batchInstallSupport;
            open.value = true;
            await nextTick();
            installFormRef.value?.resetForm();
            installFormRef.value?.initForm(__panelSetupProps.app.key);
        };
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
                    header={$t('commons.button.install')}
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                    size="large"
                    v-slots={{
                        footer: () => (
                            <>
                                <span class={'dialog-footer'}>
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
                                            (handleSubmit as any)($event);
                                        }}
                                        disabled={unref(loading) || !unref(formData).appDetailId}
                                    >
                                        {$t('commons.button.confirm')}
                                    </ElButton>
                                </span>
                            </>
                        ),
                    }}
                >
                    <AppInstallForm
                        ref={installFormRef}
                        modelValue={unref(formData)}
                        onUpdate:modelValue={($v) => {
                            formData.value = $v as any;
                        }}
                        loading={unref(loading)}
                        batch-install-support={unref(batchInstallSupport)}
                    />
                </DrawerPro>
                <TaskLog ref={taskLogRef} />
            </>
        );
    },
    options,
);
