import { $t } from '@/utils/i18n-t';
interface DialogProps {
    content: string;
}
import DrawerPro from '@/components/drawer-pro/index';
import CodemirrorPro from '@/components/codemirror-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'detail',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const detailVisible = ref(false);
        const detailInfo = ref();
        const acceptParams = (params: DialogProps): void => {
            detailInfo.value = params.content;
            detailVisible.value = true;
        };
        const handleClose = () => {
            detailVisible.value = false;
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                v-model={detailVisible.value}
                header={$t('commons.button.view')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="large"
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        detailVisible.value = false;
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
                    placeholder={$t('commons.msg.noneData')}
                    v-model={detailInfo.value}
                    mode="yaml"
                    heightDiff={160}
                    readonly={true}
                />
            </DrawerPro>
        );
    },
    options,
);
