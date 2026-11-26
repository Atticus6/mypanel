import { $t } from '@/utils/i18n-t';
import { downloadFile } from '@/utils/file';
import { Host } from '@/types/host';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { computeSize } from '@/utils/size';
import i18n from '@/lang';
import { MsgError, MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
import './index.styles.css';
import DrawerPro from '@/components/drawer-pro/index';
import { QuestionFilled } from '@element-plus/icons-vue';
import ComplexTable from '@/components/table/complex/ComplexTable';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'diagnostics',
    props: {},
    emits: emits,
    __scopeId: 'data-v-047ea927',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode } = useGlobalStore();
        const target = ref('agent');
        const diagnosticsNode = ref('local');
        const open = ref(false);
        const captureLoading = ref(false);
        const goroutineLoading = ref(false);
        const stackDialogVisible = ref(false);
        const selectedStack = ref<string[]>([]);
        const summary = reactive<Host.RuntimeDiagnosticsSummary>({
            rss: 0,
            heapAlloc: 0,
            heapObjects: 0,
            goroutines: 0,
        });
        const goroutineSnapshot = reactive<Host.RuntimeGoroutineSnapshot>({
            total: 0,
            groupCount: 0,
            truncated: false,
            capturedAt: '',
            goroutines: [],
        });
        const captureForm = reactive<Host.RuntimeProfileCreate>({ type: 'cpu', duration: 15 });
        const profileTypes = computed(() => [
            {
                label: i18n.global.t('monitor.profileCPU'),
                description: i18n.global.t('monitor.profileCPUDesc'),
                value: 'cpu',
            },
            {
                label: i18n.global.t('monitor.profileHeap'),
                description: i18n.global.t('monitor.profileHeapDesc'),
                value: 'heap',
            },
            {
                label: i18n.global.t('monitor.profileGoroutine'),
                description: i18n.global.t('monitor.profileGoroutineDesc'),
                value: 'goroutine',
            },
            {
                label: i18n.global.t('monitor.profileMutex'),
                description: i18n.global.t('monitor.profileMutexDesc'),
                value: 'mutex',
            },
            {
                label: i18n.global.t('monitor.profileBlock'),
                description: i18n.global.t('monitor.profileBlockDesc'),
                value: 'block',
            },
        ]);
        const showDuration = computed(() => captureForm.type !== 'heap' && captureForm.type !== 'goroutine');
        const summaryCards = computed(() => [
            {
                label: i18n.global.t('monitor.runtimeRSS'),
                value: computeSize(summary.rss),
                description: i18n.global.t('monitor.runtimeRSSDesc'),
            },
            {
                label: i18n.global.t('monitor.runtimeHeapAlloc'),
                value: computeSize(summary.heapAlloc),
                description: i18n.global.t('monitor.runtimeHeapAllocDesc'),
            },
            {
                label: i18n.global.t('monitor.runtimeHeapObjects'),
                value: summary.heapObjects.toLocaleString(),
                description: i18n.global.t('monitor.runtimeHeapObjectsDesc'),
            },
            {
                label: i18n.global.t('monitor.runtimeGoroutines'),
                value: summary.goroutines.toLocaleString(),
                description: i18n.global.t('monitor.runtimeGoroutineDesc'),
            },
        ]);
        const loadSummary = async () => {
            const res = await diagnosticsApi().summary({});
            Object.assign(summary, res);
        };
        const loadGoroutines = async () => {
            goroutineLoading.value = true;
            try {
                const res = await diagnosticsApi().goroutines({});
                Object.assign(goroutineSnapshot, res);
            } finally {
                goroutineLoading.value = false;
            }
        };
        const showGoroutineStack = (row: Host.RuntimeGoroutineGroup) => {
            selectedStack.value = row.stack || [];
            stackDialogVisible.value = true;
        };
        const diagnosticsApi = () =>
            target.value === 'core'
                ? {
                      summary: (req: Record<string, never>) => rpc.core.diagnostics.summary(req),
                      goroutines: (req: Record<string, never>) => rpc.core.diagnostics.goroutines(req),
                      createProfile: (req: { type: string; duration: number }) =>
                          rpc.core.diagnostics.createProfile(req),
                  }
                : {
                      summary: (req: Record<string, never>) => rpc.host.getDiagnosticsSummary(req),
                      goroutines: (req: Record<string, never>) => rpc.host.getDiagnosticsGoroutines(req),
                      createProfile: (req: { type: string; duration: number }) =>
                          rpc.host.createDiagnosticsProfile(req),
                  };
        const captureProfile = async () => {
            captureLoading.value = true;
            try {
                // 剖析文件由后端写入临时目录，再用文件下载通道取回。
                const profile = await diagnosticsApi().createProfile(captureForm);
                downloadFile(profile.path, diagnosticsNode.value);
                MsgSuccess(i18n.global.t('monitor.captureSuccess'));
                await loadSummary();
            } catch (error) {
                MsgError((error as Error)?.message || i18n.global.t('commons.res.commonError'));
            } finally {
                captureLoading.value = false;
            }
        };
        const acceptParams = (process: 'core' | 'agent' = 'agent') => {
            target.value = process;
            diagnosticsNode.value = process === 'core' ? 'local' : currentNode.value || 'local';
            open.value = true;
            Promise.all([loadSummary(), loadGoroutines()]);
        };
        const handleBeforeClose = (done: () => void) => {
            if (!captureLoading.value) {
                done();
            }
        };
        ctx.expose({ acceptParams });
        return () => (
            <div>
                <DrawerPro
                    modelValue={unref(open)}
                    onUpdate:modelValue={($v) => {
                        open.value = $v as any;
                    }}
                    header={`${$t('monitor.runtimeDiagnostics')} - 1panel-${target}`}
                    size="large"
                    confirm-before-close={unref(captureLoading)}
                    onBeforeClose={($event?: any) => {
                        (handleBeforeClose as any)($event);
                    }}
                >
                    {withDirectives(
                        <div
                            element-loading-lock
                            element-loading-text={$t('monitor.capturing')}
                            class={'diagnostics-content'}
                        >
                            <section>
                                <ElRow gutter={12}>
                                    {(unref(summaryCards) || []).map((item) => (
                                        <ElCol xs={12} sm={8} md={6} key={item.label}>
                                            <div class={'summary-item'}>
                                                <ElCard class={'summary-title'}>
                                                    <span>{item.label}</span>
                                                    <ElTooltip
                                                        content={item.description}
                                                        placement="top"
                                                        show-after={200}
                                                    >
                                                        <ElIcon class={'summary-help'}>
                                                            <QuestionFilled />
                                                        </ElIcon>
                                                    </ElTooltip>
                                                    <div class={'summary-value'}>{item.value}</div>
                                                </ElCard>
                                            </div>
                                        </ElCol>
                                    ))}
                                </ElRow>
                            </section>
                            <ElDivider />
                            <section>
                                <div class={'section-title'}>{$t('monitor.manualCapture')}</div>
                                <div class={'profile-toolbar'}>
                                    <ElSelect
                                        modelValue={captureForm.type}
                                        onUpdate:modelValue={($v) => {
                                            captureForm.type = $v as any;
                                        }}
                                        popper-class="runtime-profile-select-popper"
                                        class={'profile-type'}
                                    >
                                        {(unref(profileTypes) || []).map((item) => (
                                            <ElOption label={item.label} value={item.value} key={item.value}>
                                                <div class={'runtime-profile-option'}>
                                                    <span class={'runtime-profile-option-title'}>{item.label}</span>
                                                    <span class={'runtime-profile-option-description'}>
                                                        {item.description}
                                                    </span>
                                                </div>
                                            </ElOption>
                                        ))}
                                    </ElSelect>
                                    {unref(showDuration) ? (
                                        <ElInputNumber
                                            modelValue={captureForm.duration}
                                            onUpdate:modelValue={($v) => {
                                                captureForm.duration = $v as any;
                                            }}
                                            min={5}
                                            max={30}
                                            controls-position="right"
                                        />
                                    ) : null}
                                    {unref(showDuration) ? (
                                        <span class={'text-sm'}>{$t('commons.units.secondUnit')}</span>
                                    ) : null}
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            (captureProfile as any)($event);
                                        }}
                                    >
                                        {$t('monitor.startCapture')}
                                    </ElButton>
                                </div>
                            </section>
                            <ElDivider />
                            <section>
                                <div class={'section-header'}>
                                    <div>
                                        <div class={'section-title'}>{$t('monitor.goroutineSnapshot')}</div>
                                        <span class={'goroutine-summary'}>
                                            {$t('monitor.goroutineSummary', [
                                                goroutineSnapshot.total,
                                                goroutineSnapshot.groupCount,
                                            ])}
                                        </span>
                                    </div>
                                    <ElTooltip content={$t('monitor.captureSnapshot')} placement="top">
                                        <ElButton
                                            icon="Refresh"
                                            text
                                            circle
                                            loading={unref(goroutineLoading)}
                                            aria-label={$t('monitor.captureSnapshot')}
                                            onClick={($event?: any) => {
                                                (loadGoroutines as any)($event);
                                            }}
                                        />
                                    </ElTooltip>
                                </div>
                                {goroutineSnapshot.truncated ? (
                                    <ElAlert
                                        type="warning"
                                        title={$t('monitor.goroutineTruncated')}
                                        closable={false}
                                        show-icon
                                        class={'snapshot-warning'}
                                    />
                                ) : null}
                                {withDirectives(
                                    <ComplexTable data={goroutineSnapshot.goroutines} max-height="420">
                                        <ElTableColumn prop="count" label={$t('monitor.count')} width="90" sortable />
                                        <ElTableColumn prop="state" label={$t('commons.table.status')} width="180" />
                                        <ElTableColumn
                                            prop="top"
                                            label={$t('monitor.topFunction')}
                                            min-width="360"
                                            show-overflow-tooltip
                                        />
                                        <ElTableColumn
                                            label={$t('commons.table.operate')}
                                            fixed="right"
                                            width="90"
                                            v-slots={{
                                                default: (scope) => (
                                                    <>
                                                        <ElButton
                                                            link
                                                            type="primary"
                                                            onClick={($event?: any) => {
                                                                showGoroutineStack(scope.row);
                                                            }}
                                                        >
                                                            {$t('commons.button.view')}
                                                        </ElButton>
                                                    </>
                                                ),
                                            }}
                                        />
                                    </ComplexTable>,
                                    [[vLoading, unref(goroutineLoading)]],
                                )}
                            </section>
                        </div>,
                        [[vLoading, unref(captureLoading)]],
                    )}
                </DrawerPro>
                <ElDialog
                    modelValue={unref(stackDialogVisible)}
                    onUpdate:modelValue={($v) => {
                        stackDialogVisible.value = $v as any;
                    }}
                    title={$t('monitor.goroutineSnapshot')}
                    width="70%"
                    append-to-body
                    destroy-on-close
                >
                    <pre class={'stack-view'}>{unref(selectedStack).join('\n')}</pre>
                </ElDialog>
            </div>
        );
    },
    options,
);
