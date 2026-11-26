type TagType = 'primary' | 'success' | 'warning' | 'info';
import './index.styles.css';

interface CodemodProps {
    [key: string]: any;
    apiType?: string;
}

const emits = {};

const options = {
    name: 'api-type-tag',
    props: {
        apiType: String,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-375bea0b',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const tagType = computed<TagType>(() => {
            if (__panelSetupProps.apiType === 'openai-completions') {
                return 'primary';
            }
            if (__panelSetupProps.apiType === 'openai-responses') {
                return 'info';
            }
            if (__panelSetupProps.apiType === 'anthropic-messages') {
                return 'warning';
            }
            if (__panelSetupProps.apiType.endsWith('-images')) {
                return 'success';
            }
            return 'info';
        });
        return () => (
            <ElTag
                size="small"
                effect="light"
                type={unref(tagType)}
                class={{
                    'api-type-tag--responses': __panelSetupProps.apiType === 'openai-responses',
                    'api-type-tag--embedding': __panelSetupProps.apiType === 'openai-embeddings',
                }}
            >
                {__panelSetupProps.apiType || '-'}
            </ElTag>
        );
    },
    options,
);
