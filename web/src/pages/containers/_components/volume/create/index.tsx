import { $t } from '@/utils/i18n-t';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
type FormInstance = InstanceType<typeof ElForm>;
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'create',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref(false);
        const drawerVisible = ref(false);
        const form = reactive({
            name: '',
            driver: 'local',
            labelStr: '',
            labels: [] as Array<string>,
            nfsStatus: 'disable',
            nfsAddress: '',
            nfsVersion: 'v4',
            nfsMount: '',
            nfsOption: 'rw,noatime,rsize=8192,wsize=8192,tcp,timeo=14',
            optionStr: '',
            options: [] as Array<string>,
        });
        const acceptParams = (): void => {
            form.name = '';
            form.labels = [];
            form.labelStr = '';
            form.options = [];
            form.optionStr = '';
            form.nfsStatus = 'disable';
            form.nfsAddress = '';
            form.nfsVersion = 'v4';
            form.nfsMount = '';
            form.nfsOption = 'rw,noatime,rsize=8192,wsize=8192,tcp,timeo=14';
            drawerVisible.value = true;
        };
        const handleClose = () => {
            drawerVisible.value = false;
        };
        const rules = reactive({
            name: [Rules.requiredInput, Rules.volumeName],
            driver: [Rules.requiredSelect],
            nfsAddress: [Rules.host],
            nfsVersion: [Rules.requiredSelect],
            nfsMount: [Rules.requiredInput],
        });
        const formRef = ref<FormInstance>();
        const onSubmit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                if (form.labelStr !== '') {
                    form.labels = form.labelStr.split('\n');
                }
                if (form.optionStr !== '') {
                    form.options = form.optionStr.split('\n');
                }
                if (form.nfsStatus === 'enable') {
                    let typeOption = form.nfsVersion === 'v4' ? 'nfs4' : 'nfs';
                    form.options.push('type=' + typeOption);
                    form.options.push('o=addr=' + form.nfsAddress + ',' + form.nfsOption);
                    let mount = form.nfsMount.startsWith(':') ? form.nfsMount : ':' + form.nfsMount;
                    form.options.push('device=' + mount);
                }
                loading.value = true;
                await rpc.container
                    .createVolume(form)
                    .then(() => {
                        loading.value = false;
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        ctx.emit('search');
                        drawerVisible.value = false;
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            });
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                v-model={drawerVisible.value}
                header={$t('commons.button.create')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="small"
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    disabled={unref(loading)}
                                    onClick={($event?: any) => {
                                        drawerVisible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    disabled={unref(loading)}
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
                        model={form}
                        rules={rules}
                        label-width="80px"
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                        v-loading={unref(loading)}
                    >
                        <ElFormItem label={$t('commons.table.name')} prop="name">
                            <ElInput
                                clearable
                                modelValue={form.name}
                                onUpdate:modelValue={($v) => {
                                    form.name = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                            />
                        </ElFormItem>
                        <ElFormItem label={$t('container.driver')} prop="driver">
                            <ElTag type="success">{'local'}</ElTag>
                        </ElFormItem>
                        <ElFormItem label={$t('container.nfsEnable')} prop="nfsStatus">
                            <ElSwitch v-model={form.nfsStatus} active-value="enable" inactive-value="disable" />
                        </ElFormItem>
                        {form.nfsStatus === 'enable' ? (
                            <div>
                                <ElFormItem label={$t('container.nfsAddress')} prop="nfsAddress">
                                    <ElInput
                                        clearable
                                        modelValue={form.nfsAddress}
                                        onUpdate:modelValue={($v) => {
                                            form.nfsAddress = typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                        placeholder={$t('commons.rule.hostHelper')}
                                    />
                                </ElFormItem>
                                <ElFormItem label={$t('app.version')} prop="nfsVersion">
                                    <ElRadioGroup v-model={form.nfsVersion}>
                                        <ElRadio value="v3">{'NFS'}</ElRadio>
                                        <ElRadio value="v4">{'NFS4'}</ElRadio>
                                    </ElRadioGroup>
                                </ElFormItem>
                                <ElFormItem label={$t('container.mountpoint')} prop="nfsMount">
                                    <ElInput
                                        clearable
                                        modelValue={form.nfsMount}
                                        onUpdate:modelValue={($v) => {
                                            form.nfsMount = typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                        placeholder={$t('container.mountpointNFSHelper')}
                                    />
                                </ElFormItem>
                                <ElFormItem label={$t('container.options')} prop="nfsOption">
                                    <ElInput
                                        clearable
                                        modelValue={form.nfsOption}
                                        onUpdate:modelValue={($v) => {
                                            form.nfsOption = typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                            </div>
                        ) : null}
                        <ElFormItem label={$t('container.option')} prop="optionStr">
                            <ElInput
                                type="textarea"
                                placeholder={$t('container.tagHelper')}
                                rows={3}
                                v-model={form.optionStr}
                            />
                        </ElFormItem>
                        <ElFormItem label={$t('container.tag')} prop="labelStr">
                            <ElInput
                                type="textarea"
                                placeholder={$t('container.tagHelper')}
                                rows={3}
                                v-model={form.labelStr}
                            />
                        </ElFormItem>
                    </ElForm>
                }
            </DrawerPro>
        );
    },
    options,
);
