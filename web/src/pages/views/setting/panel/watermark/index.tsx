import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { Rules } from '@/global/form-rules';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { updateXpackSettingByKey } from '@/utils/xpack';
import './index.styles.css';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'watermark',
    props: {},
    emits: emits,
    __scopeId: 'data-v-40a222cf',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { globalStore, currentNode, currentNodeAddr, isDarkTheme, watermark, watermarkShow } = useGlobalStore();
        const drawerVisible = ref();
        const loading = ref();
        let form = reactive({
            lightColor: 'rgba(0, 0, 0, 0.15)',
            darkColor: 'rgba(255, 255, 255, 0.15)',
            fontSize: 16,
            content: '${nodeName} - ${nodeAddr}',
            rotate: -22,
            gap: 100,
        });
        const rules = reactive({
            content: [Rules.requiredInput],
        });
        const formRef = ref<FormInstance>();
        const acceptParams = (watermark: string): void => {
            if (watermark) {
                const parsedData = JSON.parse(watermark);
                form = reactive(parsedData);
            }
            drawerVisible.value = true;
        };
        const loadContent = () => {
            let itemName = form.content.replaceAll(
                '${nodeName}',
                currentNode.value === 'local' ? globalStore.getMasterAlias() : currentNode.value,
            );
            itemName = itemName.replaceAll('${nodeAddr}', currentNodeAddr.value);
            return itemName;
        };
        const setDefault = () => {
            form.lightColor = 'rgba(0, 0, 0, 0.15)';
            form.darkColor = 'rgba(255, 255, 255, 0.15)';
            form.fontSize = 16;
            form.content = '${nodeName} - ${nodeAddr}';
            form.rotate = -22;
            form.gap = 100;
        };
        const onSave = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                ElMessageBox.confirm(i18n.global.t('setting.watermarkOpenHelper'), i18n.global.t('setting.watermark'), {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                    type: 'info',
                }).then(async () => {
                    loading.value = true;
                    let itemVal = JSON.stringify(form);
                    await updateXpackSettingByKey('Watermark', itemVal)
                        .then(() => {
                            loading.value = false;
                            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                            watermark.value = {
                                lightColor: form.lightColor,
                                darkColor: form.darkColor,
                                fontSize: form.fontSize,
                                content: form.content,
                                rotate: form.rotate,
                                gap: form.gap,
                            };
                            watermarkShow.value = true;
                            handleClose();
                            return;
                        })
                        .catch(() => {
                            loading.value = false;
                        });
                });
            });
        };
        const handleClose = () => {
            ctx.emit('search');
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
                header={$t('setting.watermark')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="large"
                v-slots={{
                    footer: () => (
                        <>
                            <ElButton
                                onClick={($event?: any) => {
                                    (setDefault as any)($event);
                                }}
                            >
                                {$t('commons.button.setDefault')}
                            </ElButton>
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
                                    onSave(unref(formRef));
                                }}
                            >
                                {$t('commons.button.confirm')}
                            </ElButton>
                        </>
                    ),
                }}
            >
                <ElWatermark
                    content={loadContent()}
                    font={{
                        fontSize: form.fontSize,
                        color: unref(isDarkTheme) ? form.darkColor : form.lightColor,
                        textBaseline: 'top',
                    }}
                    rotate={form.rotate}
                    gap={[form.gap, form.gap]}
                    class={'watermark'}
                >
                    {withDirectives(
                        <ElForm
                            ref={formRef}
                            label-position="top"
                            model={form}
                            onSubmit={($event?: any) => {
                                $event.preventDefault();
                            }}
                            rules={rules}
                        >
                            <ElFormItem label={$t('setting.watermarkContent')} prop="content">
                                <ElInput
                                    clearable
                                    modelValue={form.content}
                                    onUpdate:modelValue={($v) => {
                                        form.content = typeof $v === 'string' ? $v.trim() : $v;
                                    }}
                                />
                                <span class={'input-help'}>
                                    {$t('setting.contentHelper', ['${nodeName}', '${nodeAddr}'])}
                                </span>
                            </ElFormItem>
                            <ElFormItem label={$t('setting.light')} prop="lightColor">
                                <ElColorPicker
                                    modelValue={form.lightColor}
                                    onUpdate:modelValue={($v) => {
                                        form.lightColor = $v as any;
                                    }}
                                    show-alpha
                                />
                            </ElFormItem>
                            <ElFormItem label={$t('setting.dark')} prop="darkColor">
                                <ElColorPicker
                                    modelValue={form.darkColor}
                                    onUpdate:modelValue={($v) => {
                                        form.darkColor = $v as any;
                                    }}
                                    show-alpha
                                />
                            </ElFormItem>
                            <ElFormItem label={$t('setting.watermarkFont')} prop="fontSize">
                                <ElSlider
                                    modelValue={form.fontSize}
                                    onUpdate:modelValue={($v) => {
                                        form.fontSize = $v as any;
                                    }}
                                    min={12}
                                    max={100}
                                />
                            </ElFormItem>
                            <ElFormItem label={$t('setting.watermarkRotate')} prop="rotate">
                                <ElSlider
                                    modelValue={form.rotate}
                                    onUpdate:modelValue={($v) => {
                                        form.rotate = $v as any;
                                    }}
                                    min={-180}
                                    max={180}
                                />
                            </ElFormItem>
                            <ElFormItem label={$t('setting.watermarkGap')} prop="gap">
                                <ElInputNumber
                                    modelValue={form.gap}
                                    onUpdate:modelValue={($v) => {
                                        form.gap = $v === '' ? $v : Number($v);
                                    }}
                                    class={'number-input'}
                                />
                            </ElFormItem>
                        </ElForm>,
                        [[vLoading, unref(loading)]],
                    )}
                </ElWatermark>
            </DrawerPro>
        );
    },
    options,
);
