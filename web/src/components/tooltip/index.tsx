import { TABLE_TOOLTIP_OPTIONS } from '@/components/table/shared';
import './index.styles.css';

interface CodemodProps {
    [key: string]: any;
    text?: string;
    islink?: boolean;
}

const emits = {};

const options = {
    name: 'Tooltip',
    props: {
        text: {
            type: String,
            default: '',
        },
        islink: {
            type: Boolean,
            default: true,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-fc3a80ab',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const showTooltip = ref();
        const tooltipBox = ref();
        const tooltipItem = ref();
        const tootipWidth = ref();
        onMounted(() => {
            const boxWidth = tooltipBox.value.offsetWidth;
            const itemWidth = tooltipItem.value.offsetWidth;
            tootipWidth.value = itemWidth > 250 ? '250px' : itemWidth + 'px';
            showTooltip.value = boxWidth > itemWidth;
        });
        return () => (
            <div class={'tooltip-container'}>
                <ElTooltip
                    disabled={unref(showTooltip)}
                    {...TABLE_TOOLTIP_OPTIONS}
                    v-slots={{
                        content: () => (
                            <>
                                <div style={{ width: unref(tootipWidth), 'word-break': 'break-all' }}>
                                    {__panelSetupProps.text}
                                </div>
                            </>
                        ),
                    }}
                >
                    <p ref={tooltipBox} class={'text-box'}>
                        {__panelSetupProps.islink ? (
                            <span ref={tooltipItem} class={'table-link'}>
                                {__panelSetupProps.text}
                            </span>
                        ) : (
                            <span ref={tooltipItem} class={''}>
                                {__panelSetupProps.text}
                            </span>
                        )}
                    </p>
                </ElTooltip>
            </div>
        );
    },
    options,
);
