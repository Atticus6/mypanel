import { $t } from '@/utils/i18n-t';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { getErrorMessage } from '@/utils/misc';
import { getHttpResponseMessage } from '@/api/http-core';
import { MsgError } from '@/utils/message';
import { Firewall } from '@/types/firewall';
import { deepCopy } from '@/utils/misc';
import {
    isValidAddressForFamily,
    isValidPortRange,
    normalizePortRange,
} from '@/pages/hosts/_components/firewall/utils/validation';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    title: string;
    rowData?: Firewall.RuleForward;
    getTableList?: () => Promise<any>;
}
type FormInstance = InstanceType<typeof ElForm>;
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    created: (arg0?: string) => true,
};

const options = {
    name: 'operate',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref();
        const oldRule = ref<Firewall.RuleForward>();
        const interfaceOptions = ref<Array<{ label: string; value: string }>>([]);
        const title = ref<string>('');
        const drawerVisible = ref(false);
        const dialogData = ref<DialogProps>({
            title: '',
        });
        const acceptParams = (params: DialogProps): void => {
            dialogData.value = params;
            if (dialogData.value.title === 'edit') {
                oldRule.value = deepCopy(params.rowData);
            }
            rpc.monitor.listNetworkOptions({}).then((res) => {
                interfaceOptions.value = res.items.map((item) => ({ label: item, value: item }));
                dialogData.value.rowData!.interface = dialogData.value.rowData!.interface || 'all';
            });
            title.value = i18n.global.t('firewall.' + dialogData.value.title);
            drawerVisible.value = true;
        };
        const handleClose = () => {
            drawerVisible.value = false;
        };
        const rules = reactive({
            family: [Rules.requiredSelect],
            protocol: [Rules.requiredSelect],
            port: [{ validator: checkPortRule, trigger: 'blur', required: true }],
            targetPort: [{ validator: checkPortRule, trigger: 'blur', required: true }],
            targetIP: [{ validator: checkAddress, trigger: 'blur' }],
        });
        function checkPortRule(rule: any, value: string, callback: any) {
            if (!isValidPortRange(value)) {
                return callback(new Error(i18n.global.t('firewall.portFormatError')));
            }
            callback();
        }
        function checkAddress(rule: any, value: string, callback: any) {
            if (!value) {
                return callback();
            }
            const family = dialogData.value.rowData?.family || 'ipv4';
            if (!isValidAddressForFamily(family, value, false)) {
                return callback(new Error(i18n.global.t('firewall.addressFormatError')));
            }
            callback();
        }
        const formRef = ref<FormInstance>();
        const onSubmit = async (formEl: FormInstance | undefined) => {
            if (!formEl || loading.value) return;
            const { rowData } = dialogData.value;
            if (!rowData) return;
            if (!isValidPortRange(rowData.port) || !isValidPortRange(rowData.targetPort)) {
                await formEl.validateField(['port', 'targetPort']).catch(() => undefined);
                MsgError(i18n.global.t('commons.rule.port'));
                return;
            }
            const valid = await formEl.validate().catch(() => false);
            if (!valid) return;
            rowData.port = normalizePortRange(rowData.port);
            rowData.targetPort = normalizePortRange(rowData.targetPort);
            rowData.operation = 'add';
            if (rowData.targetIP === '') {
                rowData.targetIP = rowData.family === 'ipv6' ? '::1' : '127.0.0.1';
            }
            if (rowData.interface === 'all') {
                rowData.interface = '';
            }
            const operations: Firewall.RuleForward[] = [];
            if (dialogData.value.title !== 'create') {
                operations.push({ ...oldRule.value, operation: 'remove' });
            }
            operations.push(rowData);
            loading.value = true;
            try {
                const result = await rpc.firewall.operateForwardRules({ rules: operations } as any);
                if (!result.taskId || !result.queued) {
                    MsgError(i18n.global.t('commons.msg.operationFailed'));
                    return;
                }
                drawerVisible.value = false;
                ctx.emit('created', result.taskId);
            } catch (error) {
                MsgError(
                    getHttpResponseMessage(error) ||
                        (error && getErrorMessage(error)) ||
                        i18n.global.t('commons.res.commonError'),
                );
            } finally {
                loading.value = false;
            }
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                v-model={drawerVisible.value}
                header={unref(title)}
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
                                        drawerVisible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    type="primary"
                                    onClick={($event?: any) => {
                                        onSubmit(unref(formRef));
                                    }}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            >
                {
                    <ElForm
                        ref={formRef}
                        label-position="top"
                        model={unref(dialogData).rowData}
                        rules={rules}
                        v-loading={unref(loading)}
                    >
                        <ElFormItem label="IP" prop="family">
                            <ElSelect v-model={unref(dialogData).rowData!.family} class={'w-full'}>
                                <ElOption value="ipv4" label="IPv4" />
                                <ElOption value="ipv6" label="IPv6" />
                            </ElSelect>
                        </ElFormItem>
                        <ElFormItem label={$t('commons.table.protocol')} prop="protocol">
                            <ElSelect v-model={unref(dialogData).rowData!.protocol} class={'w-full'}>
                                <ElOption value="tcp" label="tcp" />
                                <ElOption value="udp" label="udp" />
                                <ElOption value="tcp/udp" label="tcp/udp" />
                            </ElSelect>
                        </ElFormItem>
                        <ElFormItem label={$t('firewall.sourcePort')} prop="port">
                            <ElInput
                                clearable
                                modelValue={unref(dialogData).rowData!.port}
                                onUpdate:modelValue={($v) => {
                                    unref(dialogData).rowData!.port = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                            />
                            <span class={'input-help'}>{$t('firewall.forwardPortHelper')}</span>
                        </ElFormItem>
                        <ElFormItem label={$t('firewall.targetIP')} prop="targetIP">
                            <ElInput
                                modelValue={unref(dialogData).rowData!.targetIP}
                                onUpdate:modelValue={($v) => {
                                    unref(dialogData).rowData!.targetIP = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                            />
                            <span class={'input-help'}>{$t('firewall.forwardHelper1')}</span>
                            <span class={'input-help'}>{$t('firewall.forwardHelper2')}</span>
                        </ElFormItem>
                        <ElFormItem label={$t('firewall.targetPort')} prop="targetPort">
                            <ElInput
                                clearable
                                modelValue={unref(dialogData).rowData!.targetPort}
                                onUpdate:modelValue={($v) => {
                                    unref(dialogData).rowData!.targetPort = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                            />
                            <span class={'input-help'}>{$t('firewall.forwardPortHelper')}</span>
                        </ElFormItem>
                        <ElFormItem label={$t('firewall.forwardInboundInterface')} prop="interface">
                            <ElSelect v-model={unref(dialogData).rowData!.interface} class={'w-full'}>
                                {(unref(interfaceOptions) || []).map((item) => (
                                    <ElOption
                                        label={item.label === 'all' ? $t('commons.table.all') : item.label}
                                        value={item.value}
                                        key={item.value}
                                    />
                                ))}
                            </ElSelect>
                        </ElFormItem>
                    </ElForm>
                }
            </DrawerPro>
        );
    },
    options,
);
