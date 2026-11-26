import { $t } from '@/utils/i18n-t';
import DialogPro from '@/components/dialog-pro/index';
import DrawerPro from '@/components/drawer-pro/index';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
interface DialogProps {
    title: string;
    msg: string;
    names: Array<string>;

    api: Function;
    params: object;
    successMsg: string;
    noMsg: boolean;
}
import './index.styles.css';

interface CodemodProps {
    [key: string]: any;
    drawer?: boolean;
}

const emits = {
    search: (...args: unknown[]) => true,
    cancel: (...args: unknown[]) => true,
    submit: (...args: unknown[]) => true,
};

type SlotsShape = {
    content: (arg?: unknown) => VNode[];
};

const options = {
    name: 'OpDialog',
    props: {
        drawer: Boolean,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
    __scopeId: 'data-v-ba516e84',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        const form = reactive({
            msgs: [],
            title: '',
            names: [],
            api: null as Function,
            params: {},
        });
        const loading = ref();
        const open = ref();
        const successMsg = ref('');
        const noMsg = ref(false);
        const acceptParams = (__panelSetupProps: DialogProps): void => {
            form.title = __panelSetupProps.title;
            form.names = __panelSetupProps.names;
            form.msgs = __panelSetupProps.msg.split('\n');
            form.api = __panelSetupProps.api;
            form.params = __panelSetupProps.params;
            successMsg.value = __panelSetupProps.successMsg;
            if (__panelSetupProps.noMsg) {
                noMsg.value = __panelSetupProps.noMsg;
            }
            open.value = true;
        };
        const onConfirm = async () => {
            if (form.api === null) {
                ctx.emit('submit');
                open.value = false;
                return;
            }
            loading.value = true;
            await form
                .api(form.params)
                .then(() => {
                    ctx.emit('search');
                    if (!noMsg.value) {
                        MsgSuccess(successMsg.value ?? i18n.global.t('commons.msg.deleteSuccess'));
                    }
                    open.value = false;
                    loading.value = false;
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const handleClose = () => {
            ctx.emit('cancel');
            open.value = false;
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <div>
                {h(
                    __panelSetupProps.drawer ? DrawerPro : DialogPro,
                    {
                        modelValue: unref(open),
                        'onUpdate:modelValue': ($v) => {
                            open.value = $v as any;
                        },
                        onClose: ($event?: any) => {
                            (handleClose as any)($event);
                        },
                        'v-slots': {
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
                                                (onConfirm as any)($event);
                                            }}
                                            disabled={unref(loading)}
                                        >
                                            {$t('commons.button.confirm')}
                                        </ElButton>
                                    </span>
                                </>
                            ),
                        },
                    },
                    {
                        default: () => (
                            <>
                                {
                                    <div class={'del-dialog-body'} v-loading={unref(loading)}>
                                        <ElRow type="flex" justify="center">
                                            <ElCol span={22}>
                                                <ElAlert
                                                    show-icon={true}
                                                    type="warning"
                                                    closable={false}
                                                    class={'mt-2'}
                                                >
                                                    {(form.msgs || []).map((item, index) => (
                                                        <div key={index}>
                                                            <div
                                                                class={'dialog-object-name'}
                                                                style={'line-height: 20px'}
                                                            >
                                                                <span>{item}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </ElAlert>
                                                {ctx.slots['content']?.(undefined)}
                                                {(form.names || []).map((item, index) => (
                                                    <ul key={index}>
                                                        <div class={'dialog-object-name'}>
                                                            <li>{item}</li>
                                                        </div>
                                                    </ul>
                                                ))}
                                            </ElCol>
                                        </ElRow>
                                    </div>
                                }
                            </>
                        ),
                    },
                )}
            </div>
        );
    },
    options,
);
