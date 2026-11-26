import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import LogFile from '@/components/log/file/index';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
import OpDialog from '@/components/del-dialog/index';

interface CodemodProps {
    [key: string]: any;
    logType?: string;
    id?: number;
}

const emits = {};

const options = {
    name: 'log-fiile',
    props: {
        logType: {
            type: String,
            default: '',
        },
        id: {
            type: Number,
            default: 0,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const logName = computed(() => {
            return __panelSetupProps.logType;
        });
        const id = computed(() => {
            return __panelSetupProps.id;
        });
        const loading = ref(false);
        const data = ref({
            enable: false,
            content: '',
            path: '',
        });
        const opRef = ref();
        const logRef = ref();
        const updateEnable = () => {
            const operate = data.value.enable ? 'enable' : 'disable';
            const req = {
                id: id.value,
                operate: operate,
                logType: __panelSetupProps.logType,
            };
            loading.value = true;
            rpc.website
                .operateLog(req as any)
                .then(() => {
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        const clearLog = () => {
            logRef.value.clearLog();
        };
        const cleanLog = async () => {
            let log =
                __panelSetupProps.logType === 'access.log'
                    ? i18n.global.t('logs.websiteLog')
                    : i18n.global.t('website.errLog');
            opRef.value.acceptParams({
                title: i18n.global.t('commons.button.clean'),
                names: [],
                msg: i18n.global.t('commons.msg.operatorHelper', [log, i18n.global.t('commons.button.clean')]),
                api: (params: any) => rpc.website.operateLog(params),
                params: { id: id.value, operate: 'delete', logType: __panelSetupProps.logType },
            });
        };
        const get = async () => {
            try {
                const res = await (rpc.website.getWebsite({ id: __panelSetupProps.id }) as Promise<any>);
                if (__panelSetupProps.logType === 'access.log') {
                    data.value.enable = res.data.accessLog;
                }
                if (__panelSetupProps.logType === 'error.log') {
                    data.value.enable = res.data.errorLog;
                }
            } catch (error) {}
        };
        onMounted(() => {
            get();
        });
        return () => (
            <>
                {
                    <div v-loading={unref(loading)}>
                        <div>
                            <ElFormItem label={$t('website.enable')}>
                                {
                                    <ElSwitch
                                        v-model={unref(data).enable}
                                        onChange={($event?: any) => {
                                            (updateEnable as any)($event);
                                        }}
                                        v-permission={true}
                                    />
                                }
                            </ElFormItem>
                        </div>
                        <LogFile
                            config={{ id: unref(id), type: 'website', name: unref(logName), colorMode: 'nginx' }}
                            ref={logRef}
                            v-slots={{
                                button: () => (
                                    <>
                                        {
                                            <ElButton
                                                onClick={($event?: any) => {
                                                    (cleanLog as any)($event);
                                                }}
                                                icon="Delete"
                                                v-permission={true}
                                            >
                                                {$t('commons.button.clean')}
                                            </ElButton>
                                        }
                                    </>
                                ),
                            }}
                        />
                    </div>
                }
                <OpDialog
                    ref={opRef}
                    onSearch={($event?: any) => {
                        (clearLog as any)($event);
                    }}
                />
            </>
        );
    },
    options,
);
