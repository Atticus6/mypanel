import { $t } from '@/utils/i18n-t';
import { reactive, ref } from 'vue';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
import { FormInstance } from 'element-plus';
import { useGlobalStore } from '@/composables/useGlobalStore';
interface DialogProps {
    edition: string;
    docSource: string;
}
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElRadioGroup } from 'element-plus';
import { ElRadio } from 'element-plus';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: (...args: unknown[]) => true,
};

const options = {
    name: 'edition',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { docWithRegion, isIntl } = useGlobalStore();
        const drawerVisible = ref();
        const loading = ref(false);
        const form = reactive({
            edition: '',
            docSource: 'withByRegion',
        });
        const initialForm = reactive({
            edition: '',
            docSource: 'withByRegion',
        });
        const formRef = ref<FormInstance>();
        const acceptParams = (params: DialogProps): void => {
            form.edition = params.edition;
            form.docSource = params.docSource || 'withByRegion';
            initialForm.edition = params.edition;
            initialForm.docSource = params.docSource || 'withByRegion';
            drawerVisible.value = true;
        };
        const onSaveEdition = async () => {
            const editionChanged = form.edition !== initialForm.edition;
            const docSourceChanged = form.docSource !== initialForm.docSource;
            if (!editionChanged && !docSourceChanged) {
                drawerVisible.value = false;
                return;
            }

            if (editionChanged) {
                try {
                    await ElMessageBox.confirm(i18n.global.t('setting.regionHelper'), i18n.global.t('setting.region'), {
                        confirmButtonText: i18n.global.t('commons.button.confirm'),
                        cancelButtonText: i18n.global.t('commons.button.cancel'),
                        dangerouslyUseHTMLString: true,
                    });
                } catch {
                    return;
                }
            }

            loading.value = true;
            try {
                if (editionChanged) {
                    await rpc.core.setting.updateSetting({ key: 'Edition', value: form.edition });
                    isIntl.value = form.edition === 'intl';
                }
                if (docSourceChanged) {
                    await rpc.core.setting.updateSetting({ key: 'DocSource', value: form.docSource });
                    docWithRegion.value = form.docSource === 'withByRegion';
                }
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                if (editionChanged) {
                    location.reload();
                    return;
                }
                ctx.emit('search');
                drawerVisible.value = false;
            } finally {
                loading.value = false;
            }
        };
        const handleClose = () => {
            drawerVisible.value = false;
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                modelValue={unref(drawerVisible)}
                onUpdate:modelValue={($v) => {
                    drawerVisible.value = $v as any;
                }}
                header={$t('setting.runtimeEnv')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="small"
                v-slots={{
                    footer: () => (
                        <>
                            <ElButton
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
                                    onSaveEdition();
                                }}
                            >
                                {$t('commons.button.confirm')}
                            </ElButton>
                        </>
                    ),
                }}
            >
                {withDirectives(
                    <ElForm
                        ref={formRef}
                        label-position="top"
                        model={form}
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                    >
                        <ElFormItem label={$t('setting.region')} prop="edition">
                            <ElRadioGroup
                                modelValue={form.edition}
                                onUpdate:modelValue={($v) => {
                                    form.edition = $v as any;
                                }}
                            >
                                <ElRadio value="cn">
                                    <span>{$t('setting.cn')}</span>
                                </ElRadio>
                                <ElRadio value="intl">
                                    <span>{$t('setting.intl')}</span>
                                </ElRadio>
                            </ElRadioGroup>
                            <span class={'input-help'}>{$t('setting.regionTip')}</span>
                        </ElFormItem>
                        <ElFormItem label={$t('setting.docSource')} prop="docSource">
                            <ElRadioGroup
                                modelValue={form.docSource}
                                onUpdate:modelValue={($v) => {
                                    form.docSource = $v as any;
                                }}
                            >
                                <ElRadio value="withByRegion">
                                    <span>{$t('setting.withByRegion')}</span>
                                </ElRadio>
                                <ElRadio value="withByLang">
                                    <span>{$t('setting.withByLang')}</span>
                                </ElRadio>
                            </ElRadioGroup>
                            <span class={'input-help'}>{$t('setting.docSourceTip')}</span>
                        </ElFormItem>
                    </ElForm>,
                    [[vLoading, unref(loading)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
