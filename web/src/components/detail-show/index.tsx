import { $t } from '@/utils/i18n-t';
interface DialogProps {
    list: Array<string>;
}
import DialogPro from '@/components/dialog-pro/index';
import CopyButton from '@/components/copy-button/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'detail-show',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const list = ref();
        const visible = ref(false);
        const acceptParams = (__panelSetupProps: DialogProps): void => {
            visible.value = true;
            list.value = __panelSetupProps.list;
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DialogPro
                modelValue={unref(visible)}
                onUpdate:modelValue={($v) => {
                    visible.value = $v as any;
                }}
                title={$t('app.detail')}
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        visible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            >
                <div class={'mt-5'}>
                    <ElDescriptions border column={1}>
                        {(unref(list) || []).map((item, key) => (
                            <ElDescriptionsItem label={item.label} key={key}>
                                {item.value}
                                {!item.hideCopy ? <CopyButton content={item.value} /> : null}
                            </ElDescriptionsItem>
                        ))}
                    </ElDescriptions>
                </div>
            </DialogPro>
        );
    },
    options,
);
