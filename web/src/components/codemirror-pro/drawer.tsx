import { $t } from '@/utils/i18n-t';
import { ref } from 'vue';
interface DialogProps {
    header: string;
    mode: string;
    detailInfo: string;
}
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';
import CodemirrorPro from '@/components/codemirror-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'drawer',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const header = ref();
        const detailInfo = ref();
        const mode = ref();
        const codeVisible = ref(false);
        const acceptParams = (__panelSetupProps: DialogProps): void => {
            header.value = __panelSetupProps.header;
            detailInfo.value = __panelSetupProps.detailInfo;
            mode.value = __panelSetupProps.mode;
            codeVisible.value = true;
        };
        const handleClose = () => {
            codeVisible.value = false;
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                modelValue={unref(codeVisible)}
                onUpdate:modelValue={($v) => {
                    codeVisible.value = $v as any;
                }}
                header={unref(header)}
                size="large"
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        codeVisible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            >
                <CodemirrorPro
                    modelValue={unref(detailInfo)}
                    onUpdate:modelValue={($v) => {
                        detailInfo.value = $v as any;
                    }}
                    height-diff={160}
                    readonly={true}
                    mode={unref(mode)}
                />
            </DrawerPro>
        );
    },
    options,
);
