import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { Document, FolderOpened } from '@element-plus/icons-vue';
import DialogPro from '@/components/dialog-pro/index';
import { Firewall } from '@/types/firewall';
import TaskLog from '@/components/log/task/index';
import { GlobalStore } from '@/store';
import { downloadFile } from '@/utils/file';
import { rpc } from '@/lib/rpc';
import './rule-initialize.styles.css';
import permissionDirective from '@/directives/modules/permission';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    initialize: () => true,
    restore: (arg0?: string) => true,
    complete: () => true,
};

type SlotsShape = {
    'before-options': (arg?: unknown) => VNode[];
    confirmation: (arg?: unknown) => VNode[];
};

const options = {
    name: 'rule-initialize',
    props: {},
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        const globalStore = GlobalStore();
        const visible = ref(false);
        const loading = ref(false);
        const loaded = ref(false);
        const backupLoadFailed = ref(false);
        const message = ref('');
        const initialize = ref(true);
        const starting = ref(false);
        const initializeLabel = computed(() =>
            i18n.global.t(starting.value ? 'firewall.startOnly' : 'firewall.initializeOnly'),
        );
        const restoreLabel = computed(() =>
            i18n.global.t(starting.value ? 'firewall.startAndRestore' : 'firewall.restoreAllRules'),
        );
        const subsystem = ref<Firewall.BackendSubsystem>('system');
        const mode = ref<'restore' | 'initialize'>('initialize');
        const selected = ref('');
        const backups = ref<Firewall.RuleBackups>({ directory: '', files: [] });
        const taskLogRef = ref<InstanceType<typeof TaskLog>>();
        const acceptParams = async (
            warning: string,
            withInitialization = true,
            target: Firewall.BackendSubsystem = 'system',
            start = false,
        ) => {
            subsystem.value = target;
            starting.value = start;
            initialize.value = withInitialization;
            message.value = warning;
            visible.value = true;
            await loadBackups();
        };
        const loadBackups = async () => {
            if (loading.value) return;
            backups.value = { directory: '', files: [] };
            selected.value = '';
            mode.value = initialize.value ? 'initialize' : 'restore';
            loaded.value = false;
            backupLoadFailed.value = false;
            loading.value = true;
            try {
                backups.value = (await rpc.firewall.listRuleBackups({ subsystem: subsystem.value })) as any;
                selected.value = backups.value.files[0]?.name || '';
                mode.value = !starting.value && (selected.value || !initialize.value) ? 'restore' : 'initialize';
                loaded.value = true;
            } catch {
                backupLoadFailed.value = true;
            } finally {
                loading.value = false;
            }
        };
        const submit = async () => {
            if (loading.value) return;
            if (mode.value === 'initialize') {
                visible.value = false;
                ctx.emit('initialize');
                return;
            }
            if (!loaded.value || !selected.value) return;
            if (starting.value) {
                visible.value = false;
                ctx.emit('restore', selected.value);
                return;
            }
            loading.value = true;
            try {
                const response =
                    subsystem.value === 'forwarding'
                        ? await rpc.firewall.enableForwarding({ backupFile: selected.value })
                        : subsystem.value === 'docker'
                          ? await rpc.firewall.operateDocker({ operation: 'initialize', backupFile: selected.value })
                          : await rpc.firewall.createRules({
                                initialize: initialize.value,
                                backupFile: selected.value,
                                items: [],
                            });
                const result = response as any;
                visible.value = false;
                if (result.queued && result.taskId) {
                    taskLogRef.value?.openWithTaskID(result.taskId, true);
                } else {
                    ctx.emit('complete');
                }
            } finally {
                loading.value = false;
            }
        };
        ctx.expose({ acceptParams });
        return () => (
            <>
                <DialogPro
                    modelValue={unref(visible)}
                    onUpdate:modelValue={($v) => {
                        visible.value = $v as any;
                    }}
                    title={
                        unref(starting)
                            ? $t('firewall.firewallHelper', [$t('commons.button.start')])
                            : unref(initialize)
                              ? $t('commons.button.init')
                              : $t('firewall.importRuleBackup')
                    }
                    show-close={!unref(loading)}
                    close-on-press-escape={!unref(loading)}
                    class={'firewall-rule-dialog firewall-initialize-dialog'}
                    v-slots={{
                        content: () => (
                            <>
                                {withDirectives(
                                    <div class={'firewall-rule-dialog__content'}>
                                        {ctx.slots['before-options']?.(undefined)}
                                        {unref(message) && unref(starting) ? (
                                            <p class={'firewall-initialize-dialog__description'}>{unref(message)}</p>
                                        ) : unref(message) ? (
                                            <ElAlert title={unref(message)} type="warning" closable={false} show-icon />
                                        ) : null}
                                        {unref(backupLoadFailed) ? (
                                            <ElAlert
                                                title={$t('firewall.ruleBackupLoadFailed')}
                                                type="warning"
                                                closable={false}
                                                show-icon
                                            >
                                                <ElButton
                                                    type="primary"
                                                    link
                                                    disabled={unref(loading)}
                                                    onClick={($event?: any) => {
                                                        (loadBackups as any)($event);
                                                    }}
                                                >
                                                    {$t('commons.button.retry')}
                                                </ElButton>
                                            </ElAlert>
                                        ) : null}
                                        {unref(initialize) ? (
                                            <ElRadioGroup
                                                modelValue={unref(mode)}
                                                onUpdate:modelValue={($v) => {
                                                    mode.value = $v as any;
                                                }}
                                                disabled={unref(loading)}
                                                class={'firewall-rule-dialog__modes'}
                                            >
                                                <ElRadio value="initialize" border>
                                                    <span class={'firewall-rule-dialog__choice-title'}>
                                                        {unref(initializeLabel)}
                                                    </span>
                                                </ElRadio>
                                                <ElRadio value="restore" border>
                                                    <span class={'firewall-rule-dialog__choice-title'}>
                                                        {unref(restoreLabel)}
                                                    </span>
                                                </ElRadio>
                                            </ElRadioGroup>
                                        ) : null}
                                        {unref(loaded) && unref(mode) === 'restore' ? (
                                            <div class={'firewall-rule-dialog__directory'}>
                                                <ElIcon>
                                                    <FolderOpened />
                                                </ElIcon>
                                                <span>
                                                    {$t('firewall.backupDirectoryHelper', [unref(backups).directory])}
                                                </span>
                                            </div>
                                        ) : null}
                                        {unref(mode) === 'restore' ? (
                                            <div class={'firewall-initialize-dialog__backups'}>
                                                {unref(backups).files.length ? (
                                                    <ElRadioGroup
                                                        modelValue={unref(selected)}
                                                        onUpdate:modelValue={($v) => {
                                                            selected.value = $v as any;
                                                        }}
                                                        disabled={unref(loading)}
                                                        aria-label={$t('firewall.importRuleBackup')}
                                                        class={'firewall-rule-dialog__files'}
                                                    >
                                                        {(unref(backups).files || []).map((file) => (
                                                            <ElRadio value={file.name} border key={file.name}>
                                                                <span class={'firewall-rule-dialog__file-name'}>
                                                                    <ElIcon>
                                                                        <Document />
                                                                    </ElIcon>
                                                                    <span class={'min-w-0'}>{file.name}</span>
                                                                    {withDirectives(
                                                                        <ElButton
                                                                            type="primary"
                                                                            link
                                                                            size="small"
                                                                            disabled={unref(loading)}
                                                                            aria-label={`${$t('firewall.downloadRuleBackup')}: ${file.name}`}
                                                                            onClick={($event?: any) => {
                                                                                $event.stopPropagation();
                                                                                $event.preventDefault();
                                                                                downloadFile(
                                                                                    `${unref(backups).directory}/${file.name}`,
                                                                                    globalStore.currentNode,
                                                                                );
                                                                            }}
                                                                            class={'shrink-0'}
                                                                        >
                                                                            {$t('commons.button.download')}
                                                                        </ElButton>,
                                                                        [[permissionDirective, true]],
                                                                    )}
                                                                </span>
                                                                <span class={'firewall-rule-dialog__file-meta'}>
                                                                    <ElTag size="small" type="info" effect="plain">
                                                                        {file.provider}
                                                                    </ElTag>
                                                                    <span>
                                                                        {$t('firewall.backupRuleCount')}
                                                                        {': '}
                                                                        {file.ruleCount}
                                                                    </span>
                                                                    <span>
                                                                        {new Date(file.modifiedAt).toLocaleString()}
                                                                    </span>
                                                                </span>
                                                            </ElRadio>
                                                        ))}
                                                    </ElRadioGroup>
                                                ) : !unref(initialize) &&
                                                  unref(loaded) &&
                                                  !unref(backups).files.length ? (
                                                    <ElEmpty
                                                        description={$t('firewall.noRuleBackup')}
                                                        image-size={64}
                                                    />
                                                ) : null}
                                            </div>
                                        ) : null}
                                    </div>,
                                    [[vLoading, unref(loading)]],
                                )}
                            </>
                        ),
                        footer: () => (
                            <>
                                {ctx.slots['confirmation']?.(undefined)}
                                <ElButton
                                    disabled={unref(loading)}
                                    onClick={($event?: any) => {
                                        visible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    type="primary"
                                    loading={unref(loading)}
                                    disabled={
                                        unref(loading) ||
                                        (unref(mode) === 'restore' && (!unref(loaded) || !unref(selected)))
                                    }
                                    onClick={($event?: any) => {
                                        (submit as any)($event);
                                    }}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </>
                        ),
                    }}
                />
                <TaskLog
                    ref={taskLogRef}
                    onClose={($event?: any) => {
                        ctx.emit('complete');
                    }}
                />
            </>
        );
    },
    options,
);
