import { $t } from '@/utils/i18n-t';
import { reactive, ref } from 'vue';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { ElForm } from 'element-plus';
import { MsgError, MsgSuccess } from '@/utils/message';
import { Command } from '@/types/command';
import { rpc } from '@/lib/rpc';
type FormInstance = InstanceType<typeof ElForm>;
interface DialogProps {
    title: string;
    rowData?: Command.CommandInfo;
    getTableList?: () => Promise<any>;
}
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElFormItem } from 'element-plus';
import { ElSwitch } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'operate',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref();
        const open = ref();
        const groupList = ref();
        const batchMode = ref(false);
        const batchCommandText = ref('');
        const rules = reactive({
            name: [Rules.requiredInput],
            command: [Rules.requiredInput],
        });
        const formRef = ref<FormInstance>();
        const title = ref<string>('');
        const dialogData = ref<DialogProps>({
            title: '',
        });
        const acceptParams = (params: DialogProps): void => {
            dialogData.value = params;
            title.value =
                i18n.global.t('commons.button.' + dialogData.value.title) + i18n.global.t('terminal.quickCommand');
            batchMode.value = false;
            batchCommandText.value = '';
            loadGroups();
            open.value = true;
        };
        const handleClose = () => {
            open.value = false;
        };
        const buildBatchCommands = (): Array<Command.CommandOperate> => {
            const lines = batchCommandText.value
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean);
            return lines.map((line) => {
                const tripleDashSeparator = '---';
                const tripleDashIndex = line.indexOf(tripleDashSeparator);
                const separator = tripleDashIndex > 0 ? tripleDashSeparator : '';
                const separatorIndex = separator ? line.indexOf(separator) : -1;
                const hasCustomName = separatorIndex > 0;
                const name = hasCustomName ? line.slice(0, separatorIndex).trim() : line;
                const command = hasCustomName ? line.slice(separatorIndex + separator.length).trim() : line;
                return {
                    id: 0,
                    type: 'command',
                    groupID: dialogData.value.rowData!.groupID,
                    name,
                    command,
                };
            });
        };
        const onSubmit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            if (batchMode.value) {
                if (!dialogData.value.rowData?.groupID) {
                    MsgError(i18n.global.t('commons.rule.requiredSelect'));
                    return;
                }
                const items = buildBatchCommands().filter((item) => item.name && item.command);
                if (items.length === 0) {
                    MsgError(i18n.global.t('commons.rule.requiredInput'));
                    return;
                }
                loading.value = true;
                await rpc.core.command.import({ items: items as any });
                open.value = false;
                ctx.emit('search');
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                return;
            }
            formEl.validate(async (valid) => {
                if (!valid) return;
                loading.value = true;
                if (!valid) return;
                if (dialogData.value.title === 'create') {
                    await rpc.core.command.create(dialogData.value.rowData as any);
                } else {
                    await rpc.core.command.update(dialogData.value.rowData as any);
                }
                open.value = false;
                ctx.emit('search');
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            });
        };
        const loadGroups = async () => {
            const res = await rpc.core.group.list({ type: 'command' });
            groupList.value = res.items as any;
            if (dialogData.value.title === 'edit') {
                return;
            }
            for (const group of groupList.value) {
                if (group.isDefault) {
                    dialogData.value.rowData.groupID = group.id;
                    break;
                }
            }
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
                header={unref(title)}
                resource={unref(dialogData).title === 'create' ? '' : unref(dialogData).rowData?.name}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="small"
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        open.value = false;
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
                <ElForm
                    onSubmit={($event?: any) => {
                        $event.preventDefault();
                    }}
                    ref={formRef}
                    label-width="100px"
                    label-position="top"
                    model={unref(dialogData).rowData}
                    rules={rules}
                >
                    {unref(dialogData).title === 'create' ? (
                        <ElFormItem label={$t('terminal.batchInput')}>
                            <ElSwitch
                                modelValue={unref(batchMode)}
                                onUpdate:modelValue={($v) => {
                                    batchMode.value = $v as any;
                                }}
                            />
                        </ElFormItem>
                    ) : null}
                    {!unref(batchMode) ? (
                        <ElFormItem label={$t('commons.table.name')} prop="name">
                            <ElInput
                                clearable
                                modelValue={unref(dialogData).rowData!.name}
                                onUpdate:modelValue={($v) => {
                                    unref(dialogData).rowData!.name = $v as any;
                                }}
                            />
                        </ElFormItem>
                    ) : null}
                    <ElFormItem label={$t('commons.table.group')} prop="groupID">
                        <ElSelect
                            filterable
                            modelValue={unref(dialogData).rowData!.groupID}
                            onUpdate:modelValue={($v) => {
                                unref(dialogData).rowData!.groupID = $v as any;
                            }}
                            clearable
                            style={'width: 100%'}
                        >
                            {(unref(groupList) || []).map((item) => (
                                <ElOption label={item.name} value={item.id} key={item.id} />
                            ))}
                        </ElSelect>
                    </ElFormItem>
                    {!unref(batchMode) ? (
                        <ElFormItem label={$t('terminal.command')} prop="command">
                            <ElInput
                                type="textarea"
                                clearable
                                modelValue={unref(dialogData).rowData!.command}
                                onUpdate:modelValue={($v) => {
                                    unref(dialogData).rowData!.command = $v as any;
                                }}
                            />
                        </ElFormItem>
                    ) : (
                        <ElFormItem label={$t('terminal.command')}>
                            <ElInput
                                modelValue={unref(batchCommandText)}
                                onUpdate:modelValue={($v) => {
                                    batchCommandText.value = $v as any;
                                }}
                                type="textarea"
                                clearable
                                autosize={{ minRows: 8, maxRows: 16 }}
                            />
                            <div class={'input-help mt-1 text-xs leading-5 text-[var(--el-text-color-secondary)]'}>
                                {$t('terminal.quickCommandBatchHelper')}
                            </div>
                        </ElFormItem>
                    )}
                </ElForm>
            </DrawerPro>
        );
    },
    options,
);
