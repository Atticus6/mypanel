import { MdPreview } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import DOMPurify from 'dompurify';
import { useGlobalStore } from '@/composables/useGlobalStore';

interface CodemodProps {
    [key: string]: any;
    content?: string;
}

const emits = {};

const options = {
    name: 'mkdown-editor',
    props: {
        content: {
            type: String,
            default: '',
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isDarkTheme } = useGlobalStore();
        const sanitizeHtml = (html: string): string => {
            return DOMPurify.sanitize(html);
        };
        return () => (
            <MdPreview
                model-value={__panelSetupProps.content}
                sanitize={sanitizeHtml}
                theme={unref(isDarkTheme) ? 'dark' : 'light'}
            />
        );
    },
    options,
);
