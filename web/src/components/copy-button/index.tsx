import { $t } from '@/utils/i18n-t';
import { copyText } from '@/utils/clipboard';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElButton } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
    content?: string;
    isIcon?: boolean;
}

const emits = {};

const options = {
    name: 'CopyButton',
    props: {
        content: { type: String },
        isIcon: {
            type: Boolean,
            default: true,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => (
            <>
                {__panelSetupProps.isIcon ? (
                    <ElButton
                        link
                        onClick={($event?: any) => {
                            copyText(__panelSetupProps.content);
                        }}
                        icon="DocumentCopy"
                        class={'ml-1.5'}
                    />
                ) : (
                    <ElButton
                        onClick={($event?: any) => {
                            copyText(__panelSetupProps.content);
                        }}
                    >
                        {$t('commons.button.copy')}
                    </ElButton>
                )}
            </>
        );
    },
    options,
);
