import { $t } from '@/utils/i18n-t';
import TaskLog from '@/components/log/task/index';
import i18n from '@/lang';
import { newUUID } from '@/utils/id';
import { ref } from 'vue';
import { rpc } from '@/lib/rpc';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElRadioGroup } from 'element-plus';
import { ElRadio } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElCheckboxGroup } from 'element-plus';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'prune',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const dialogVisible = ref(false);
        const scope = ref('untag');
        const showMsg = ref();
        const loading = ref();
        const unTagList = ref([]);
        const unUsedList = ref([]);
        const data = ref([]);
        const taskLogRef = ref();
        const checkAll = ref(false);
        const isIndeterminate = ref(false);
        const checkedLists = ref([]);
        const acceptParams = async (): Promise<void> => {
            const list = (await rpc.container.listAllImages({})).items;
            unTagList.value = [];
            unUsedList.value = [];
            for (const item of list) {
                if (
                    !item.tags ||
                    item.tags.length === 0 ||
                    (item.tags.length === 1 && item.tags[0].indexOf('<none>') !== -1 && !item.isUsed)
                ) {
                    unTagList.value.push(item);
                }
                if (!item.isUsed) {
                    unUsedList.value.push(item);
                }
            }
            checkedLists.value = [];
            checkAll.value = false;
            isIndeterminate.value = false;
            dialogVisible.value = true;
            scope.value = 'untag';
            changeScope();
        };
        const changeScope = () => {
            if (scope.value === 'untag') {
                data.value = unTagList.value || [];
                showMsg.value =
                    data.value.length !== 0
                        ? i18n.global.t('container.imagePruneSomeHelper')
                        : i18n.global.t('container.imagePruneSomeEmpty');
                return;
            }
            data.value = unUsedList.value || [];
            showMsg.value =
                data.value.length !== 0
                    ? i18n.global.t('container.imagePruneAllHelper')
                    : i18n.global.t('container.imagePruneAllEmpty');
            return;
        };
        const handleCheckAllChange = (val: boolean) => {
            checkedLists.value = [];
            if (!val) {
                isIndeterminate.value = false;
                return;
            }
            for (const item of data.value) {
                checkedLists.value.push(item.id);
            }
        };
        const handleCheckedChange = (value: string[]) => {
            const checkedCount = value.length;
            checkAll.value = checkedCount === unUsedList.value.length;
            isIndeterminate.value = checkedCount > 0 && checkedCount < unUsedList.value.length;
        };
        const handleClose = () => {
            dialogVisible.value = false;
        };
        const onSearch = () => {
            ctx.emit('search');
        };
        const onClean = async () => {
            loading.value = true;
            if (checkAll.value) {
                prune();
                return;
            }
            removeImage();
        };
        const prune = async () => {
            let params = {
                taskID: newUUID(),
                pruneType: 'image',
                withTagAll: scope.value === 'unused',
            };
            await rpc.container
                .prune(params)
                .then(() => {
                    loading.value = false;
                    dialogVisible.value = false;
                    openTaskLog(params.taskID);
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const openTaskLog = (taskID: string) => {
            taskLogRef.value.openWithTaskID(taskID);
        };
        const removeImage = async () => {
            let params = {
                taskID: newUUID(),
                names: checkedLists.value,
            };
            await rpc.container
                .removeImages(params)
                .then(() => {
                    loading.value = false;
                    dialogVisible.value = false;
                    openTaskLog(params.taskID);
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <>
                <DrawerPro
                    modelValue={unref(dialogVisible)}
                    onUpdate:modelValue={($v) => {
                        dialogVisible.value = $v as any;
                    }}
                    header={$t('container.imagePrune')}
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
                                            dialogVisible.value = false;
                                        }}
                                    >
                                        {$t('commons.button.cancel')}
                                    </ElButton>
                                    <ElButton
                                        type="primary"
                                        disabled={unref(data).length === 0 || unref(loading)}
                                        onClick={($event?: any) => {
                                            (onClean as any)($event);
                                        }}
                                    >
                                        {$t('commons.button.confirm')}
                                    </ElButton>
                                </span>
                            </>
                        ),
                    }}
                >
                    {withDirectives(
                        <ElForm ref="deleteForm">
                            <ElFormItem>
                                <ElRadioGroup
                                    modelValue={unref(scope)}
                                    onUpdate:modelValue={($v) => {
                                        scope.value = $v as any;
                                    }}
                                    onChange={($event?: any) => {
                                        (changeScope as any)($event);
                                    }}
                                    class={'w-full'}
                                >
                                    <ElRadio value="untag">{$t('container.imagePruneSome')}</ElRadio>
                                    <ElRadio value="unused">{$t('container.imagePruneAll')}</ElRadio>
                                </ElRadioGroup>
                                <span class={'input-help'}>{unref(showMsg)}</span>
                                {unref(data).length !== 0 ? (
                                    <ElCheckbox
                                        modelValue={unref(checkAll)}
                                        onUpdate:modelValue={($v) => {
                                            checkAll.value = $v as any;
                                        }}
                                        indeterminate={unref(isIndeterminate)}
                                        onChange={($event?: any) => {
                                            (handleCheckAllChange as any)($event);
                                        }}
                                        class={'w-full'}
                                    >
                                        {$t('commons.table.all')}
                                    </ElCheckbox>
                                ) : null}
                                <ElCheckboxGroup
                                    modelValue={unref(checkedLists)}
                                    onUpdate:modelValue={($v) => {
                                        checkedLists.value = $v as any;
                                    }}
                                    onChange={($event?: any) => {
                                        (handleCheckedChange as any)($event);
                                    }}
                                >
                                    {(unref(data) || []).map((item, index) => (
                                        <ElCheckbox value={item.id} class={'w-full'} key={index}>
                                            {item.tags && item.tags[0]
                                                ? item.tags[0]
                                                : item.id.replaceAll('sha256:', '').substring(0, 12)}
                                        </ElCheckbox>
                                    ))}
                                </ElCheckboxGroup>
                            </ElFormItem>
                        </ElForm>,
                        [[vLoading, unref(loading)]],
                    )}
                </DrawerPro>
                <TaskLog
                    ref={taskLogRef}
                    width="70%"
                    onClose={($event?: any) => {
                        (onSearch as any)($event);
                    }}
                />
            </>
        );
    },
    options,
);
