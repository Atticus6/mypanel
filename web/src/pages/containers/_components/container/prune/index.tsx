import { $t } from '@/utils/i18n-t';
import TaskLog from '@/components/log/task/index';
import { newUUID } from '@/utils/id';
import { rpc } from '@/lib/rpc';
import './index.styles.css';
import DialogPro from '@/components/dialog-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'prune',
    props: {},
    emits: emits,
    __scopeId: 'data-v-d4be4f42',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref(false);
        const open = ref<boolean>(false);
        const taskLogRef = ref();
        const onClean = async () => {
            loading.value = true;
            let params = {
                taskID: newUUID(),
                pruneType: 'container',
                withTagAll: false,
            };
            await rpc.container
                .prune(params)
                .then(() => {
                    loading.value = false;
                    open.value = false;
                    openTaskLog(params.taskID);
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const openTaskLog = (taskID: string) => {
            taskLogRef.value.openWithTaskID(taskID);
        };
        const onSearch = () => {
            ctx.emit('search');
        };
        const acceptParams = (): void => {
            open.value = true;
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <>
                <DialogPro
                    modelValue={unref(open)}
                    onUpdate:modelValue={($v) => {
                        open.value = $v as any;
                    }}
                    title={$t('container.containerPrune')}
                    size="small"
                    v-slots={{
                        footer: () => (
                            <>
                                <span class={'dialog-footer'}>
                                    <ElButton
                                        disabled={unref(loading)}
                                        onClick={($event?: any) => {
                                            open.value = false;
                                        }}
                                    >
                                        {$t('commons.button.cancel')}
                                    </ElButton>
                                    <ElButton
                                        disabled={unref(loading)}
                                        type="primary"
                                        onClick={($event?: any) => {
                                            onClean();
                                        }}
                                    >
                                        {$t('commons.button.confirm')}
                                    </ElButton>
                                </span>
                            </>
                        ),
                    }}
                >
                    <div>
                        <ul class={'help-ul'}>
                            <li class={'lineClass'} style={'color: red'}>
                                {$t('container.containerPruneHelper1')}
                            </li>
                            <li class={'lineClass'}>{$t('container.containerPruneHelper2')}</li>
                            <li class={'lineClass'}>{$t('container.containerPruneHelper3')}</li>
                        </ul>
                    </div>
                </DialogPro>
                <TaskLog
                    ref={taskLogRef}
                    width="70%"
                    onClose={($event?: any) => {
                        (onSearch as any)($event);
                    }}
                />
            </>
        );
    },
    options,
);
