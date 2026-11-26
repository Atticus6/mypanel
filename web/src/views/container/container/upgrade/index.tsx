import { $t } from '@/utils/i18n-t';
import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf';
type Init<T extends DescMessage> = MessageInitShape<T>;
import { ContainerSchema } from '@/gen/panel/agent/v1/container_pb';
interface ContainerNetwork {
    network: string;
    ipv4: string;
    ipv6: string;
    macAddr: string;
    links?: Array<string>;
    aliases?: Array<string>;
    driverOpts?: Record<string, string>;
    gwPriority?: number;
    linkLocalIPs?: Array<string>;
}
type ContainerInfo = Omit<Init<typeof ContainerSchema>, 'network'> & {
    containerID?: string;
    network: Array<ContainerNetwork>;
    hasLoad: boolean;
    cpuPercent: number;
    memoryPercent: number;
};
interface ContainerOption {
    name: string;
    state: string;
}
import { Rules } from '@/global/form-rules';
import { newUUID } from '@/utils/id';
import i18n from '@/lang';
import TaskLog from '@/components/log/task/index';
import bus from '@/global/bus';
import { GlobalStore } from '@/store';
import { rpc } from '@/lib/rpc';
interface UpgradeGroup {
    currentImage: string;
    targetImage: string;
    availableVersion: string;
    names: string[];
    appNames: string[];
    options: ContainerOption[];
    taskID: string;
    state: 'draft' | 'submitting' | 'submitted' | 'failed' | 'unknown';
    taskStatus: string;
    currentStep: string;
}
interface DialogProps {
    container: string;
    image: string;
    fromApp: boolean;
    latestVersion?: string;
    hasUpdate?: boolean;
}
import './index.styles.css';
import DrawerPro from '@/components/drawer-pro/index';
import CopyButton from '@/components/copy-button/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'upgrade',
    props: {},
    emits: emits,
    __scopeId: 'data-v-47aaf329',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const imageTag = (image: string) => {
            const name = image.slice(image.lastIndexOf('/') + 1);
            const separator = name.lastIndexOf(':');
            return separator < 0 ? 'latest' : name.slice(separator + 1);
        };
        const isBatch = ref(false);
        const isGroupEditable = (group: UpgradeGroup) => ['draft', 'failed'].includes(group.state);
        const isGroupChecked = (group: UpgradeGroup) =>
            group.options.length > 0 && group.names.length === group.options.length;
        const handleCheckAllChange = (group: UpgradeGroup, value: CheckboxValueType) => {
            if (loading.value || !isGroupEditable(group)) return;
            group.names = value ? group.options.map((item) => item.name) : [];
        };
        const visible = ref(false);
        const loading = ref(false);
        const started = ref(false);
        const formRef = ref<FormInstance>();
        const taskLogRef = ref<InstanceType<typeof TaskLog>>();
        const form = reactive({ groups: [] as UpgradeGroup[], forcePull: false });
        let timer: ReturnType<typeof setTimeout> | undefined;
        let generation = 0;
        let operateNode = '';
        const canSubmit = computed(() => form.groups.some((group) => group.names.length > 0 && isGroupEditable(group)));
        const acceptParams = async (__panelSetupProps: DialogProps | ContainerInfo[]) => {
            if (loading.value) return;
            isBatch.value = Array.isArray(__panelSetupProps);
            const containers = Array.isArray(__panelSetupProps)
                ? __panelSetupProps
                : [
                      {
                          name: __panelSetupProps.container,
                          imageName: __panelSetupProps.image,
                          isFromApp: __panelSetupProps.fromApp,
                          latestVersion: __panelSetupProps.latestVersion,
                          hasUpdate: __panelSetupProps.hasUpdate,
                      },
                  ];
            operateNode = GlobalStore().currentNode;
            clearTimeout(timer);
            generation++;
            const groups = new Map<string, UpgradeGroup>();
            for (const item of containers) {
                let group = groups.get(item.imageName);
                if (!group) {
                    group = {
                        currentImage: item.imageName,
                        targetImage: item.imageName.includes('sha256:') ? '' : item.imageName,
                        availableVersion: '',
                        names: [],
                        appNames: [],
                        options: [],
                        taskID: newUUID(),
                        state: 'draft',
                        taskStatus: '',
                        currentStep: '',
                    };
                    groups.set(item.imageName, group);
                }
                if (item.hasUpdate && item.latestVersion) group.availableVersion = item.latestVersion;
                if (!group.names.includes(item.name)) {
                    group.names.push(item.name);
                    group.options.push({ name: item.name, state: '' });
                }
                if (item.isFromApp && !group.appNames.includes(item.name)) group.appNames.push(item.name);
            }
            form.groups = [...groups.values()];
            form.forcePull = containers.some((item) => item.hasUpdate);
            started.value = false;
            visible.value = true;
            formRef.value?.clearValidate();
            const version = generation;
            const node = operateNode;
            const pending = [...form.groups];
            for (let index = 0; index < pending.length; index += 3) {
                if (version !== generation || !visible.value || started.value) return;
                await Promise.all(
                    pending.slice(index, index + 3).map(async (group) => {
                        try {
                            const res = await rpc.container.listContainersByImage({ image: group.currentImage });
                            if (version !== generation || !visible.value || started.value) return;
                            const options = new Map(group.options.map((item) => [item.name, item]));
                            for (const item of (res.items || []) as any[]) options.set(item, { name: item } as any);
                            group.options = [...options.values()];
                        } catch {
                            // Keep the original selection available when loading peers fails.
                        }
                    }),
                );
            }
        };
        const refreshGroup = async (group: UpgradeGroup, version = generation) => {
            try {
                const res = await rpc.task.search({
                    page: 1,
                    pageSize: 1,
                    type: 'Image',
                    status: '',
                    taskId: group.taskID,
                });
                if (!visible.value || version !== generation) return false;
                const task = res.items?.[0];
                if (!task) return false;
                group.state = 'submitted';
                group.taskStatus = task.status;
                group.currentStep = task.currentStep;
                return true;
            } catch {
                // A failed status request does not imply that submitting the upgrade failed.
                return false;
            }
        };
        const needsRefresh = (group: UpgradeGroup) =>
            group.state === 'unknown' ||
            (group.state === 'submitted' && !['Success', 'Failed', 'Canceled'].includes(group.taskStatus));
        const poll = async (version: number) => {
            if (!visible.value || version !== generation) return;
            const pending = form.groups.filter(needsRefresh);
            // Bound request concurrency without adding another API or polling abstraction.
            for (let index = 0; index < pending.length; index += 3) {
                await Promise.all(pending.slice(index, index + 3).map((group) => refreshGroup(group, version)));
                if (!visible.value || version !== generation) return;
            }
            if (form.groups.some(needsRefresh)) {
                timer = setTimeout(() => poll(version), 3000);
            }
        };
        const submit = async () => {
            if (loading.value || !(await formRef.value?.validate().catch(() => false))) return;
            if (loading.value || !canSubmit.value) return;
            loading.value = true;
            try {
                await ElMessageBox.confirm(
                    i18n.global.t('container.upgradeWarning2'),
                    i18n.global.t(isBatch.value ? 'container.batchUpgrade' : 'commons.button.upgrade'),
                    {
                        confirmButtonText: i18n.global.t('commons.button.confirm'),
                        cancelButtonText: i18n.global.t('commons.button.cancel'),
                    },
                );
            } catch {
                loading.value = false;
                return;
            }
            started.value = true;
            clearTimeout(timer);
            const version = ++generation;
            const forcePull = form.forcePull;
            const pending = form.groups.filter((group) => group.names.length > 0 && isGroupEditable(group));
            try {
                for (const group of pending) {
                    group.state = 'submitting';
                    try {
                        await rpc.container.upgradeContainer({
                            payloadJson: JSON.stringify({
                                taskID: group.taskID,
                                names: [...group.names],
                                image: group.targetImage.trim(),
                                forcePull,
                            }),
                        });
                        group.state = 'submitted';
                    } catch (error) {
                        if (!(await refreshGroup(group))) {
                            const failure = error as { code?: number; response?: { status?: number } };
                            const rejected =
                                typeof failure.code === 'number' ||
                                ((failure.response?.status || 0) >= 400 && (failure.response?.status || 0) < 500);
                            group.state = rejected ? 'failed' : 'unknown';
                        }
                    }
                }
            } finally {
                loading.value = false;
                bus.emit('refreshTask', true);
                if (!isBatch.value && form.groups[0]?.state === 'submitted') {
                    openLog(form.groups[0]);
                    visible.value = false;
                } else {
                    void poll(version);
                }
            }
        };
        const statusLabel = (group: UpgradeGroup) => {
            const t = i18n.global.t;
            if (group.state === 'submitting') return t('container.batchUpgradeSubmitting');
            if (group.state === 'failed') return t('container.batchUpgradeSubmitFailed');
            if (group.state === 'unknown') return t('container.batchUpgradeUnknown');
            if (group.taskStatus === 'Success') return t('commons.status.success');
            if (group.taskStatus === 'Failed') return t('commons.status.failed');
            if (group.taskStatus === 'Canceled') return t('container.batchUpgradeCanceled');
            if (group.currentStep === 'ContainerUpgradeWaiting') return t('container.batchUpgradeWaiting');
            if (group.taskStatus === 'Executing') return t('container.batchUpgradeRunning');
            return t('container.batchUpgradeSubmitted');
        };
        const statusType = (group: UpgradeGroup) => {
            if (group.state === 'failed' || group.taskStatus === 'Failed') return 'danger';
            if (group.taskStatus === 'Success') return 'success';
            if (group.state === 'unknown') return 'warning';
            return 'info';
        };
        const openLog = (group: UpgradeGroup) => taskLogRef.value?.openWithTaskID(group.taskID, true, operateNode);
        const beforeClose = (done: () => void) => {
            if (!loading.value) done();
        };
        const handleClose = () => {
            clearTimeout(timer);
            generation++;
            ctx.emit('search');
        };
        onBeforeUnmount(() => {
            clearTimeout(timer);
            generation++;
        });
        ctx.expose({ acceptParams });
        return () => (
            <>
                <DrawerPro
                    modelValue={unref(visible)}
                    onUpdate:modelValue={($v) => {
                        visible.value = $v as any;
                    }}
                    header={$t(unref(isBatch) ? 'container.batchUpgrade' : 'commons.button.upgrade')}
                    size="large"
                    confirm-before-close={true}
                    onBeforeClose={($event?: any) => {
                        (beforeClose as any)($event);
                    }}
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                    v-slots={{
                        footer: () => (
                            <>
                                <ElButton
                                    disabled={unref(loading)}
                                    onClick={($event?: any) => {
                                        visible.value = false;
                                    }}
                                >
                                    {$t('commons.button.close')}
                                </ElButton>
                                {unref(canSubmit) ? (
                                    <ElButton
                                        type="primary"
                                        loading={unref(loading)}
                                        onClick={($event?: any) => {
                                            (submit as any)($event);
                                        }}
                                    >
                                        {unref(started)
                                            ? $t('container.batchUpgradeRetry')
                                            : $t('commons.button.confirm')}
                                    </ElButton>
                                ) : null}
                            </>
                        ),
                    }}
                >
                    <ElForm
                        ref={formRef}
                        model={form}
                        label-position="top"
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                    >
                        {(form.groups || []).map((group, index) => (
                            <section class={'upgrade-group'} key={group.currentImage}>
                                {unref(isBatch) ? (
                                    <div class={'mb-3'}>
                                        {(group.names || []).map((name) => (
                                            <span class={'group-name mr-2 mb-2'} key={name}>
                                                {name}
                                            </span>
                                        ))}
                                    </div>
                                ) : null}
                                {group.appNames.some((name) => group.names.includes(name)) ? (
                                    <ElAlert
                                        title={$t('container.appHelper')}
                                        type="warning"
                                        closable={false}
                                        class={'common-prompt app-warning'}
                                    />
                                ) : null}
                                <ElFormItem label={$t('container.oldImage')}>
                                    <ElTag class={'image-name'}>{group.currentImage}</ElTag>
                                </ElFormItem>
                                {group.options.length > 1 ? (
                                    <ElFormItem label={$t('container.sameImageContainer')}>
                                        <div class={'w-full'}>
                                            <ElCheckbox
                                                model-value={isGroupChecked(group)}
                                                indeterminate={group.names.length > 0 && !isGroupChecked(group)}
                                                disabled={unref(loading) || !isGroupEditable(group)}
                                                onChange={($event?: any) => {
                                                    (value) => handleCheckAllChange(group, value);
                                                }}
                                            >
                                                {$t('commons.table.all')}
                                            </ElCheckbox>
                                        </div>
                                        <ElCheckboxGroup
                                            modelValue={group.names}
                                            onUpdate:modelValue={($v) => {
                                                group.names = $v as any;
                                            }}
                                            disabled={unref(loading) || !isGroupEditable(group)}
                                        >
                                            {(group.options || []).map((item) => (
                                                <ElCheckbox value={item.name} key={item.name}>
                                                    {item.name}
                                                </ElCheckbox>
                                            ))}
                                        </ElCheckboxGroup>
                                        <span class={'input-help'}>{$t('container.sameImageHelper')}</span>
                                    </ElFormItem>
                                ) : null}
                                <ElFormItem
                                    prop={`groups.${index}.targetImage`}
                                    rules={group.names.length ? Rules.imageName : []}
                                    v-slots={{
                                        label: () => (
                                            <>
                                                {$t('container.targetImage')}
                                                {group.currentImage.includes('sha256:') ? (
                                                    <span>{' (' + $t('container.imageLoadErr') + ')'}</span>
                                                ) : null}
                                            </>
                                        ),
                                    }}
                                >
                                    <ElInput
                                        modelValue={group.targetImage}
                                        onUpdate:modelValue={($v) => {
                                            group.targetImage = $v as any;
                                        }}
                                        disabled={unref(loading) || !group.names.length || !isGroupEditable(group)}
                                    />
                                    <span class={'input-help'}>{$t('container.upgradeHelper')}</span>
                                    {group.availableVersion ? (
                                        <div class={'input-help'}>
                                            {$t('container.imageCheckUpdateAvailableVersion', {
                                                version: group.availableVersion,
                                            })}
                                            {imageTag(group.currentImage) === group.availableVersion ? (
                                                <span>{$t('container.imageCheckUpdateContentChanged')}</span>
                                            ) : null}
                                            <CopyButton content={group.availableVersion} />
                                        </div>
                                    ) : null}
                                </ElFormItem>
                                {group.state !== 'draft' ? (
                                    <div class={'mb-3'}>
                                        <ElTag type={statusType(group)}>{statusLabel(group)}</ElTag>
                                        {group.state === 'submitted' ? (
                                            <ElButton
                                                link
                                                type="primary"
                                                onClick={($event?: any) => {
                                                    openLog(group);
                                                }}
                                            >
                                                {$t('container.batchUpgradeLog')}
                                            </ElButton>
                                        ) : null}
                                        {group.state === 'unknown' ? (
                                            <ElButton
                                                link
                                                type="primary"
                                                onClick={($event?: any) => {
                                                    refreshGroup(group);
                                                }}
                                            >
                                                {$t('container.batchUpgradeCheck')}
                                            </ElButton>
                                        ) : null}
                                    </div>
                                ) : null}
                            </section>
                        ))}
                        <ElFormItem>
                            <ElCheckbox
                                modelValue={form.forcePull}
                                onUpdate:modelValue={($v) => {
                                    form.forcePull = $v as any;
                                }}
                                disabled={unref(started) || unref(loading)}
                            >
                                {$t('container.forcePull')}
                            </ElCheckbox>
                            <span class={'input-help'}>{$t('container.forcePullHelper')}</span>
                        </ElFormItem>
                    </ElForm>
                </DrawerPro>
                <TaskLog
                    ref={taskLogRef}
                    width="70%"
                    onClose={($event?: any) => {
                        ctx.emit('search');
                    }}
                />
            </>
        );
    },
    options,
);
