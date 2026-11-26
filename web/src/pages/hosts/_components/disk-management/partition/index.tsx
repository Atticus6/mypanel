import { $t } from '@/utils/i18n-t';
import { Host } from '@/types/host';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
import permissionDirective from '@/directives/modules/permission';
import { nodeAdminDirective } from '@/directives/modules/permission';
import DrawerPro from '@/components/drawer-pro/index';
import FileList from '@/components/file-list/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: (...args: unknown[]) => true,
};

const options = {
    name: 'partition',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const rules = ref<any>({
            filesystem: [Rules.requiredInput],
            autoMount: [Rules.requiredInput],
            mountPoint: [Rules.requiredInput],
        });
        const form = reactive({
            device: '',
            filesystem: 'ext4',
            autoMount: true,
            mountPoint: '',
            label: '',
            noFail: true,
        });
        const open = ref(false);
        const loading = ref(false);
        const operate = ref('mount');
        const fileRef = ref();
        const filesystem = ref('');
        const formRef = ref();
        const loadBuildDir = async (path: string) => {
            form.mountPoint = path;
        };
        const acceptParams = (diskInfo: Host.DiskInfo, operateType: string) => {
            operate.value = operateType;
            form.device = diskInfo.device;
            form.mountPoint = '';
            if (operateType == 'mount' && diskInfo.filesystem) {
                filesystem.value = diskInfo.filesystem;
                form.filesystem = diskInfo.filesystem;
            }
            open.value = true;
        };
        const submit = async () => {
            try {
                const isValid = await formRef.value.validate();
                if (!isValid) {
                    loading.value = false;
                    return;
                }
                loading.value = true;
                if (operate.value == 'mount') {
                    await rpc.host.mountDisk({
                        device: form.device,
                        mountPoint: form.mountPoint,
                        filesystem: form.filesystem,
                        autoMount: form.autoMount,
                        noFail: form.noFail,
                    });
                    MsgSuccess(i18n.global.t('disk.mount') + i18n.global.t('commons.status.success'));
                    handleClose();
                } else {
                    await rpc.host.partitionDisk({
                        device: form.device,
                        filesystem: form.filesystem,
                        label: form.label,
                        autoMount: form.autoMount,
                        mountPoint: form.mountPoint,
                    });
                    MsgSuccess(i18n.global.t('disk.partition') + i18n.global.t('commons.status.success'));
                    handleClose();
                }
            } catch (error) {
                loading.value = false;
                return;
            }
        };
        const handleClose = () => {
            open.value = false;
            loading.value = false;
            ctx.emit('search');
        };
        ctx.expose({
            acceptParams,
        });
        return () =>
            withDirectives(
                <DrawerPro
                    modelValue={unref(open)}
                    onUpdate:modelValue={($v) => {
                        open.value = $v as any;
                    }}
                    header={$t('disk.' + unref(operate))}
                    resource={form.device.split('/').pop()}
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                    v-slots={{
                        footer: () => (
                            <>
                                <ElButton
                                    onClick={($event?: any) => {
                                        (handleClose as any)($event);
                                    }}
                                    disabled={unref(loading)}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                {withDirectives(
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            (submit as any)($event);
                                        }}
                                        disabled={unref(loading)}
                                    >
                                        {$t('commons.button.confirm')}
                                    </ElButton>,
                                    [
                                        [permissionDirective, true],
                                        [nodeAdminDirective, true],
                                    ],
                                )}
                            </>
                        ),
                    }}
                >
                    {unref(operate) == 'partition' || (unref(operate) == 'mount' && unref(filesystem) == '') ? (
                        <ElAlert title={$t('disk.partitionAlert')} type="warning" closable={false} />
                    ) : null}
                    {withDirectives(
                        <ElForm
                            onSubmit={($event?: any) => {
                                $event.preventDefault();
                            }}
                            ref={formRef}
                            rules={unref(rules)}
                            label-position="top"
                            model={form}
                            class={'mt-2'}
                        >
                            <ElFormItem label={$t('disk.filesystem')} prop="filesystem">
                                <ElRadioGroup
                                    modelValue={form.filesystem}
                                    onUpdate:modelValue={($v) => {
                                        form.filesystem = $v as any;
                                    }}
                                    disabled={unref(operate) == 'mount' && unref(filesystem) != ''}
                                >
                                    <ElRadioButton label="ext4" value="ext4" />
                                    <ElRadioButton label="xfs" value="xfs" />
                                </ElRadioGroup>
                            </ElFormItem>
                            <ElFormItem label={$t('disk.mountPoint')} prop="mountPoint">
                                <ElInput
                                    modelValue={form.mountPoint}
                                    onUpdate:modelValue={($v) => {
                                        form.mountPoint = $v as any;
                                    }}
                                    v-slots={{
                                        prepend: () => (
                                            <>
                                                {withDirectives(
                                                    <ElButton
                                                        icon="Folder"
                                                        onClick={($event?: any) => {
                                                            unref(fileRef).acceptParams({ dir: true });
                                                        }}
                                                    />,
                                                    [
                                                        [permissionDirective, true],
                                                        [nodeAdminDirective, true],
                                                    ],
                                                )}
                                            </>
                                        ),
                                    }}
                                />
                            </ElFormItem>
                            <ElFormItem label={$t('disk.autoMount')} prop="autoMount">
                                {withDirectives(
                                    <ElSwitch
                                        modelValue={form.autoMount}
                                        onUpdate:modelValue={($v) => {
                                            form.autoMount = $v as any;
                                        }}
                                    />,
                                    [
                                        [permissionDirective, true],
                                        [nodeAdminDirective, true],
                                    ],
                                )}
                            </ElFormItem>
                            {form.autoMount ? (
                                <ElFormItem label={$t('disk.noFail')} prop="noFail">
                                    {withDirectives(
                                        <ElSwitch
                                            modelValue={form.noFail}
                                            onUpdate:modelValue={($v) => {
                                                form.noFail = $v as any;
                                            }}
                                        />,
                                        [
                                            [permissionDirective, true],
                                            [nodeAdminDirective, true],
                                        ],
                                    )}
                                </ElFormItem>
                            ) : null}
                        </ElForm>,
                        [[vLoading, unref(loading)]],
                    )}
                    <FileList
                        ref={fileRef}
                        onChoose={($event?: any) => {
                            (loadBuildDir as any)($event);
                        }}
                    />
                </DrawerPro>,
                [[vLoading, unref(loading)]],
            );
    },
    options,
);
