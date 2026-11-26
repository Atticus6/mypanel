import { $t } from '@/utils/i18n-t';
interface DialogProps {
    header: string;
    operationInfo: string;
    submitInputInfo: string;
}
import './index.styles.css';
import DialogPro from '@/components/dialog-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    confirm: (...args: unknown[]) => true,
    cancel: (...args: unknown[]) => true,
};

type SlotsShape = {
    default: (arg?: unknown) => VNode[];
};

const options = {
    name: 'confirm-dialog',
    props: {},
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
    __scopeId: 'data-v-b16b7ee2',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        const header = ref();
        const operationInfo = ref();
        const submitInputInfo = ref();
        const submitVisible = ref(false);
        const submitInput = ref();
        const acceptParams = (__panelSetupProps: DialogProps): void => {
            submitVisible.value = true;
            header.value = __panelSetupProps.header;
            operationInfo.value = __panelSetupProps.operationInfo;
            submitInputInfo.value = __panelSetupProps.submitInputInfo;
            submitInput.value = '';
        };
        const onConfirm = async () => {
            ctx.emit('confirm');
            submitVisible.value = false;
        };
        const onCancel = async () => {
            ctx.emit('cancel');
            submitVisible.value = false;
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DialogPro
                v-model={submitVisible.value}
                title={unref(header)}
                size="mini"
                onClose={($event?: any) => {
                    (onCancel as any)($event);
                }}
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        (onCancel as any)($event);
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    type="primary"
                                    disabled={unref(submitInput) !== unref(submitInputInfo)}
                                    onClick={($event?: any) => {
                                        (onConfirm as any)($event);
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
                    {unref(operationInfo) ? <span class={'operation-info'}>{unref(operationInfo)}</span> : null}
                    {ctx.slots['default']?.(undefined)}
                    <div style={{ 'margin-top': unref(operationInfo) ? '10px' : '0px' }}>
                        <span style={'font-size: 12px'}>{$t('commons.msg.operateConfirm')}</span>
                        <span style={'font-size: 12px; color: red; font-weight: 500'}>
                            {"'"}
                            {unref(submitInputInfo)}
                            {"'"}
                        </span>
                    </div>
                    <ElInput v-model={submitInput.value} style={'margin-top: 10px'} />
                </div>
            </DialogPro>
        );
    },
    options,
);
