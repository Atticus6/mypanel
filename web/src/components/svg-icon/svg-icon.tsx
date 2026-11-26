import './svg-icon.styles.css';

interface CodemodProps {
    [key: string]: any;
    iconName?: string;
    className?: string;
    color?: string;
}

const emits = {};

const options = {
    name: 'svg-icon',
    props: {
        iconName: {
            type: String,
            required: true,
        },
        className: {
            type: String,
            default: '',
        },
        color: {
            type: String,
            default: '#005eeb',
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-6a01e91b',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const iconClassName = computed(() => {
            return `#${__panelSetupProps.iconName}`;
        });
        const svgClass = computed(() => {
            if (__panelSetupProps.className) {
                return `svg-icon ${__panelSetupProps.className}`;
            }
            return 'svg-icon';
        });
        return () => (
            <svg aria-hidden="true" class={unref(svgClass)}>
                <use xlink:href={unref(iconClassName)} />
            </svg>
        );
    },
    options,
);
