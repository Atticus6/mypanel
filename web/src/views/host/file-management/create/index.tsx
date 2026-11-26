import { $t } from '@/utils/i18n-t';
import { ref, reactive, computed } from 'vue';
import { File } from '@/types/file';
import { FormInstance, FormRules } from 'element-plus';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import FileRole from '@/components/file-role/index';
import { Rules } from '@/global/form-rules';
import FileList from '@/components/file-list/index';
import { MsgSuccess, MsgWarning } from '@/utils/message';
interface CreateProps {
    file: object;
}
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElAlert } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElRadioGroup } from 'element-plus';
import { ElRadio } from 'element-plus';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'create',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const fileForm = ref<FormInstance>();
        let loading = ref(false);
        let setRole = ref(false);
        const fileRef = ref();
        const propData = ref<CreateProps>({
            file: {},
        });
        let addForm = reactive({
            path: '',
            name: '',
            isDir: false,
            mode: 0o755,
            isLink: false,
            isSymlink: true,
            linkPath: '',
            isAppendOnly: false,
        });
        let open = ref(false);
        const handleClose = () => {
            open.value = false;
            if (fileForm.value) {
                fileForm.value.resetFields();
            }
            ctx.emit('close', open.value);
        };
        const rules = reactive<FormRules>({
            name: [Rules.requiredInput, Rules.linuxName],
            path: [Rules.requiredInput],
            isSymlink: [Rules.requiredInput],
            linkPath: [Rules.requiredInput],
        });
        const getMode = (val: number) => {
            addForm.mode = val;
        };
        let getPath = computed(() => {
            if (addForm.path.endsWith('/')) {
                return addForm.path + addForm.name.trim();
            } else {
                return addForm.path + '/' + addForm.name.trim();
            }
        });
        const getLinkPath = (path: string) => {
            addForm.linkPath = path;
        };
        const submit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            await formEl.validate((valid) => {
                if (!valid) {
                    return;
                }
                if (getPath.value.indexOf('.1panel_clash') > -1) {
                    MsgWarning(i18n.global.t('file.clashDidNotSupport'));
                    return;
                }

                let addItem = {};
                Object.assign(addItem, addForm);
                addItem['path'] = getPath.value;
                loading.value = true;
                if (!setRole.value) {
                    addItem['mode'] = undefined;
                }
                addItem['name'] = addForm.name.trim();
                rpc.file
                    .createFile(addItem)
                    .then(() => {
                        MsgSuccess(i18n.global.t('commons.msg.createSuccess'));
                        handleClose();
                    })
                    .finally(() => {
                        loading.value = false;
                    });
            });
        };
        const acceptParams = (create: File.FileCreate) => {
            propData.value.file = create;
            open.value = true;
            addForm.isDir = create.isDir;
            addForm.path = create.path;
            addForm.name = '';
            addForm.isLink = false;
            addForm.isAppendOnly = Boolean(create.isAppendOnly);

            init();
        };
        const init = () => {
            setRole.value = false;
        };
        ctx.expose({ acceptParams });
        return () => (
            <>
                <DrawerPro
                    modelValue={unref(open)}
                    onUpdate:modelValue={($v) => {
                        open.value = $v as any;
                    }}
                    header={$t('commons.button.create')}
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                    size="normal"
                    v-slots={{
                        footer: () => (
                            <>
                                <span class={'dialog-footer'}>
                                    <ElButton
                                        onClick={($event?: any) => {
                                            (handleClose as any)($event);
                                        }}
                                    >
                                        {$t('commons.button.cancel')}
                                    </ElButton>
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            submit(unref(fileForm));
                                        }}
                                    >
                                        {$t('commons.button.confirm')}
                                    </ElButton>
                                </span>
                            </>
                        ),
                    }}
                >
                    {addForm.isAppendOnly ? (
                        <ElAlert type="warning" title={$t('xpack.tamper.tamperCreateHint')} closable={false} />
                    ) : null}
                    {withDirectives(
                        <ElForm
                            ref={fileForm}
                            label-position="top"
                            model={addForm}
                            label-width="100px"
                            rules={rules}
                            onSubmit={($event?: any) => {
                                $event.preventDefault();
                                if (!($event.key === 'Enter')) return;
                            }}
                            class={'mt-2'}
                        >
                            <ElFormItem label={$t('commons.table.name')} prop="name">
                                <ElInput
                                    modelValue={addForm.name}
                                    onUpdate:modelValue={($v) => {
                                        addForm.name = $v as any;
                                    }}
                                />
                            </ElFormItem>
                            {!addForm.isDir ? (
                                <ElFormItem>
                                    <ElCheckbox
                                        modelValue={addForm.isLink}
                                        onUpdate:modelValue={($v) => {
                                            addForm.isLink = $v as any;
                                        }}
                                        label={$t('file.link')}
                                    />
                                </ElFormItem>
                            ) : null}
                            {addForm.isLink ? (
                                <ElFormItem label={$t('file.linkType')} prop="linkType">
                                    <ElRadioGroup
                                        modelValue={addForm.isSymlink}
                                        onUpdate:modelValue={($v) => {
                                            addForm.isSymlink = $v as any;
                                        }}
                                    >
                                        <ElRadio value={true}>{$t('file.softLink')}</ElRadio>
                                        <ElRadio value={false}>{$t('file.hardLink')}</ElRadio>
                                    </ElRadioGroup>
                                </ElFormItem>
                            ) : null}
                            {addForm.isLink ? (
                                <ElFormItem label={$t('file.linkPath')} prop="linkPath">
                                    <ElInput
                                        modelValue={addForm.linkPath}
                                        onUpdate:modelValue={($v) => {
                                            addForm.linkPath = $v as any;
                                        }}
                                        v-slots={{
                                            prepend: () => (
                                                <>
                                                    <ElButton
                                                        icon="Folder"
                                                        onClick={($event?: any) => {
                                                            unref(fileRef).acceptParams({});
                                                        }}
                                                    />
                                                </>
                                            ),
                                        }}
                                    />
                                </ElFormItem>
                            ) : null}
                            <ElFormItem>
                                {addForm.isDir ? (
                                    <ElCheckbox
                                        modelValue={unref(setRole)}
                                        onUpdate:modelValue={($v) => {
                                            setRole.value = $v as any;
                                        }}
                                        label={$t('file.editPermissions')}
                                    />
                                ) : null}
                            </ElFormItem>
                        </ElForm>,
                        [[vLoading, unref(loading)]],
                    )}
                    {unref(setRole) ? (
                        <FileRole
                            mode={'0755'}
                            onGetMode={($event?: any) => {
                                (getMode as any)($event);
                            }}
                            key={unref(open).toString()}
                        />
                    ) : null}
                </DrawerPro>
                <FileList
                    ref={fileRef}
                    onChoose={($event?: any) => {
                        (getLinkPath as any)($event);
                    }}
                />
            </>
        );
    },
    options,
);
