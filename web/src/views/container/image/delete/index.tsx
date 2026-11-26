import { $t } from '@/utils/i18n-t';
import { reactive, ref } from 'vue';
import { ElForm } from 'element-plus';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
interface DialogProps {
    id: string;
    isUsed: boolean;
    tags: Array<string>;
}
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElFormItem } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElCheckboxGroup } from 'element-plus';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';
import OpDialog from '@/components/del-dialog/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'delete',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const deleteVisible = ref(false);
        const form = reactive({
            id: '',
            force: false,
            tags: [] as Array<string>,
            deleteTags: [] as Array<string>,
        });
        const deleteAll = ref();
        const isIndeterminate = ref(true);
        const opRef = ref();
        const acceptParams = (params: DialogProps) => {
            deleteAll.value = false;
            deleteVisible.value = true;
            form.deleteTags = [];
            form.id = params.id;
            form.tags = params.tags;
            form.force = !params.isUsed;
        };
        const handleClose = () => {
            deleteVisible.value = false;
        };
        const onSearch = () => {
            ctx.emit('search');
        };
        const handleCheckAllChange = (val: boolean) => {
            form.deleteTags = val ? form.tags : [];
            isIndeterminate.value = false;
        };
        const handleCheckedChange = (value: string[]) => {
            const checkedCount = value.length;
            deleteAll.value = checkedCount === form.tags.length;
            isIndeterminate.value = checkedCount > 0 && checkedCount < form.tags.length;
        };
        const batchDelete = async () => {
            let names = [];
            let showNames = [];
            if (deleteAll.value) {
                names.push(form.id);
                for (const item of form.deleteTags) {
                    showNames.push(item);
                }
            } else {
                for (const item of form.deleteTags) {
                    names.push(item);
                    showNames.push(item);
                }
            }
            opRef.value.acceptParams({
                title: i18n.global.t('commons.button.delete'),
                names: showNames,
                msg: i18n.global.t('commons.msg.operatorHelper', [
                    i18n.global.t('container.image'),
                    i18n.global.t('commons.button.delete'),
                ]),
                api: (params: { names: string[] }) => rpc.container.removeImages(params),
                params: { names: names, force: form.force },
            });
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <div>
                <DrawerPro
                    modelValue={unref(deleteVisible)}
                    onUpdate:modelValue={($v) => {
                        deleteVisible.value = $v as any;
                    }}
                    header={$t('container.imageDelete')}
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                    size="small"
                    v-slots={{
                        footer: () => (
                            <>
                                <ElButton
                                    onClick={($event?: any) => {
                                        deleteVisible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    type="primary"
                                    disabled={form.deleteTags.length === 0}
                                    onClick={($event?: any) => {
                                        batchDelete();
                                    }}
                                >
                                    {$t('commons.button.delete')}
                                </ElButton>
                            </>
                        ),
                    }}
                >
                    <ElForm
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                        model={form}
                        label-position="top"
                    >
                        <ElFormItem label={$t('container.tag')} prop="tagName">
                            <div style={'width: 100%'}>
                                <ElCheckbox
                                    modelValue={unref(deleteAll)}
                                    onUpdate:modelValue={($v) => {
                                        deleteAll.value = $v as any;
                                    }}
                                    indeterminate={unref(isIndeterminate)}
                                    onChange={($event?: any) => {
                                        (handleCheckAllChange as any)($event);
                                    }}
                                >
                                    {$t('container.removeAll')}
                                </ElCheckbox>
                            </div>
                            <ElCheckboxGroup
                                modelValue={form.deleteTags}
                                onUpdate:modelValue={($v) => {
                                    form.deleteTags = $v as any;
                                }}
                                onChange={($event?: any) => {
                                    (handleCheckedChange as any)($event);
                                }}
                            >
                                <div>
                                    {(form.tags || []).map((item) => (
                                        <ElCheckbox value={item} label={item} style={'width: 100%'} key={item} />
                                    ))}
                                </div>
                            </ElCheckboxGroup>
                        </ElFormItem>
                    </ElForm>
                </DrawerPro>
                <OpDialog
                    ref={opRef}
                    onSearch={($event?: any) => {
                        (onSearch as any)($event);
                    }}
                    onCancel={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                />
            </div>
        );
    },
    options,
);
