import { $t } from '@/utils/i18n-t';
import { computed, onMounted, ref } from 'vue';
import i18n from '@/lang';
import LogFile from '@/components/log/file/index';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import permissionDirective from '@/directives/modules/permission';
import { ElFormItem } from 'element-plus';
import { ElSwitch } from 'element-plus';
import { ElButton } from 'element-plus';
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
                {withDirectives(
                    <div>
                        <div>
                            <ElFormItem label={$t('website.enable')}>
                                {withDirectives(
                                    <ElSwitch
                                        modelValue={unref(data).enable}
                                        onUpdate:modelValue={($v) => {
                                            unref(data).enable = $v as any;
                                        }}
                                        onChange={($event?: any) => {
                                            (updateEnable as any)($event);
                                        }}
                                    />,
                                    [[permissionDirective, true]],
                                )}
                            </ElFormItem>
                        </div>
                        <LogFile
                            config={{ id: unref(id), type: 'website', name: unref(logName), colorMode: 'nginx' }}
                            ref={logRef}
                            v-slots={{
                                button: () => (
                                    <>
                                        {withDirectives(
                                            <ElButton
                                                onClick={($event?: any) => {
                                                    (cleanLog as any)($event);
                                                }}
                                                icon="Delete"
                                            >
                                                {$t('commons.button.clean')}
                                            </ElButton>,
                                            [[permissionDirective, true]],
                                        )}
                                    </>
                                ),
                            }}
                        />
                    </div>,
                    [[vLoading, unref(loading)]],
                )}
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
