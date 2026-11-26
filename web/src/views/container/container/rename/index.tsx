import { $t } from '@/utils/i18n-t';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { ElForm } from 'element-plus';
import { reactive, ref } from 'vue';
import { rpc } from '@/lib/rpc';
type FormInstance = InstanceType<typeof ElForm>;
interface DialogProps {
    container: string;
}
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;

}

const emits = {
    'search': () => true,
};



const options = {
        name: "rename",
        props: {},
        emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref(false);
        const renameForm = reactive({
            name: '',
            newName: '',
        });
        const newNameRef = ref<FormInstance>();
        const newNameVisible = ref<boolean>(false);
        const onSubmitName = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                loading.value = true;
                await rpc.container.renameContainer(renameForm)
                    .then(() => {
                        loading.value = false;
                        ctx.emit('search');
                        newNameVisible.value = false;
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            });
        };
        const acceptParams = (__panelSetupProps: DialogProps): void => {
            renameForm.name = __panelSetupProps.container;
            renameForm.newName = '';
            newNameVisible.value = true;
        };
        const handleClose = async () => {
            newNameVisible.value = false;
            ctx.emit('search');
        };
        ctx.expose({
    acceptParams,
});
        return () => (
            <DrawerPro modelValue={unref(newNameVisible)} onUpdate:modelValue={$v => { newNameVisible.value = $v as any }} header={$t('container.rename')} onClose={($event?: any) => { (handleClose as any)($event); }} resource={renameForm.name} size="small" v-slots={{ "footer": () => <><span class={"dialog-footer"}><ElButton disabled={unref(loading)} onClick={($event?: any) => { newNameVisible.value = false; }}>{$t('commons.button.cancel')}</ElButton><ElButton disabled={unref(loading)} type="primary" onClick={($event?: any) => { onSubmitName(unref(newNameRef)); }}>{$t('commons.button.confirm')}</ElButton></span></> }}>{withDirectives(<ElForm onSubmit={($event?: any) => { $event.preventDefault(); ; }} ref={newNameRef} model={renameForm} label-position="top"><ElFormItem label={$t('container.newName')} rules={[Rules.containerName, Rules.requiredInput]} prop="newName"><ElInput modelValue={renameForm.newName} onUpdate:modelValue={$v => { renameForm.newName = $v as any }} /></ElFormItem></ElForm>, [[vLoading, unref(loading)]])}</DrawerPro>
        );
    },
    options,
);
