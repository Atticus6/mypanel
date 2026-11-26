import { $t } from '@/utils/i18n-t';
import { reactive, ref } from 'vue';
import { ElForm } from 'element-plus';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { rpc } from '@/lib/rpc';
import TaskLog from '@/components/log/task/index';
import { MsgSuccess } from '@/utils/message';
import { newUUID } from '@/utils/id';
interface DialogProps {
    containerID: string;
    containerName: string;
}
type FormInstance = InstanceType<typeof ElForm>;
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;

}

const emits = {
    'search': () => true,
};



const options = {
        name: "commit",
        props: {},
        emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const drawerVisible = ref<boolean>(false);
        const loading = ref(false);
        const form = reactive({
            containerID: '',
            containerName: '',
            newImageName: '',
            comment: '',
            author: '',
            pause: false,
            taskID: '',
        });
        const taskLogRef = ref();
        const acceptParams = (__panelSetupProps: DialogProps): void => {
            form.newImageName = '';
            form.comment = '';
            form.author = '';
            form.containerID = __panelSetupProps.containerID;
            form.containerName = __panelSetupProps.containerName;
            drawerVisible.value = true;
        };
        const formRef = ref<FormInstance>();
        const onSubmit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                ElMessageBox.confirm(i18n.global.t('container.ifMakeImageWithContainer'), {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                }).then(async () => {
                    loading.value = true;
                    form.taskID = newUUID();
                    await rpc.container
                        .commitContainer({ payloadJson: JSON.stringify(form) })
                        .then(() => {
                            loading.value = false;
                            ctx.emit('search');
                            drawerVisible.value = false;
                            openTaskLog(form.taskID);
                            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        })
                        .catch(() => {
                            loading.value = false;
                        });
                });
            });
        };
        const openTaskLog = (taskID: string) => {
            taskLogRef.value.openWithTaskID(taskID);
        };
        const handleClose = async () => {
            drawerVisible.value = false;
            ctx.emit('search');
        };
        ctx.expose({
    acceptParams,
});
        return () => (
            <>
            <DrawerPro modelValue={unref(drawerVisible)} onUpdate:modelValue={$v => { drawerVisible.value = $v as any }} header={$t('container.makeImage')} onClose={($event?: any) => { (handleClose as any)($event); }} resource={form.containerName} size="large" v-slots={{ "footer": () => <><span class={"dialog-footer"}><ElButton disabled={unref(loading)} onClick={($event?: any) => { drawerVisible.value = false; }}>{$t('commons.button.cancel')}</ElButton><ElButton disabled={unref(loading)} type="primary" onClick={($event?: any) => { onSubmit(unref(formRef)); }}>{$t('commons.button.confirm')}</ElButton></span></> }}>{withDirectives(<ElForm onSubmit={($event?: any) => { $event.preventDefault(); ; }} ref={formRef} model={form} label-position="top"><ElFormItem prop="newImageName" rules={Rules.imageName} v-slots={{ "label": () => <>{$t('container.newImageName')}</> }}><ElInput modelValue={form.newImageName} onUpdate:modelValue={$v => { form.newImageName = $v as any }} /></ElFormItem><ElFormItem prop="comment" v-slots={{ "label": () => <>{$t('container.commitMessage')}</> }}><ElInput modelValue={form.comment} onUpdate:modelValue={$v => { form.comment = $v as any }} /></ElFormItem><ElFormItem prop="author" v-slots={{ "label": () => <>{$t('container.author')}</> }}><ElInput modelValue={form.author} onUpdate:modelValue={$v => { form.author = $v as any }} /></ElFormItem><ElFormItem prop="pause"><ElCheckbox modelValue={form.pause} onUpdate:modelValue={$v => { form.pause = $v as any }}>{$t('container.ifPause')}</ElCheckbox></ElFormItem></ElForm>, [[vLoading, unref(loading)]])}</DrawerPro>
            <TaskLog ref={taskLogRef} width="70%" />
            </>
        );
    },
    options,
);
