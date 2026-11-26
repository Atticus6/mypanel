import { $t } from '@/utils/i18n-t';
import { ref } from 'vue';
interface DialogProps {
    isFromApp: boolean;
}
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElButton } from 'element-plus';
import DialogPro from '@/components/dialog-pro/index';

interface CodemodProps {
    [key: string]: any;

}

const emits = {
    'submit': (...args: unknown[]) => true,
};



const options = {
        name: "confirm",
        props: {},
        emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref();
        const open = ref(false);
        const isFromApp = ref();
        const acceptParams = (__panelSetupProps: DialogProps): void => {
            isFromApp.value = __panelSetupProps.isFromApp;
            open.value = true;
        };
        const onSubmit = async () => {
            ctx.emit('submit');
            open.value = false;
        };
        ctx.expose({
    acceptParams,
});
        return () => (
            <DialogPro modelValue={unref(open)} onUpdate:modelValue={$v => { open.value = $v as any }} title={$t('commons.button.edit')} size="small" v-slots={{ "footer": () => <><ElButton disabled={unref(loading)} onClick={($event?: any) => { open.value = false; }}>{$t('commons.button.cancel')}</ElButton><ElButton disabled={unref(loading)} type="primary" onClick={($event?: any) => { onSubmit(); }}>{$t('commons.button.confirm')}</ElButton></> }}>{(unref(isFromApp)) ? <div class={"leading-6"}><div><span>{$t('container.updateHelper1')}</span></div><br /><div><span>{$t('container.updateHelper2')}</span></div><div><span>{$t('container.updateHelper3')}</span></div><br /></div> : null}<div><span>{$t('container.updateHelper4')}</span></div></DialogPro>
        );
    },
    options,
);
