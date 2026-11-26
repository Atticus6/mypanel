import './index.styles.css';

interface CodemodProps {
    [key: string]: any;
    title?: string;
}

const emits = {};

const options = {
    name: 'ErrPrompt',
    props: {
        title: {
            type: String,
            default: '',
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-1ebeec7d',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => (
            <div class={'msg'}>
                <span>{__panelSetupProps.title}</span>
            </div>
        );
    },
    options,
);
