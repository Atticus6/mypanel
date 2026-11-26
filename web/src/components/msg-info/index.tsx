import { TABLE_TOOLTIP_OPTIONS } from '@/components/table/shared';
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElTooltip } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
    width?: string;
    info?: string;
}

const emits = {};

const options = {
    name: 'MsgInfo',
    props: {
        width: {
            type: String,
            default: '100',
        },
        info: {
            type: String,
            default: '',
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-78cf3fe9',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => (
            <ElTooltip
                {...TABLE_TOOLTIP_OPTIONS}
                v-slots={{
                    content: () => (
                        <>
                            <div class={'info-break'} style={{ width: __panelSetupProps.width + 'px' }}>
                                {__panelSetupProps.info}
                            </div>
                        </>
                    ),
                }}
            >
                <div class={'info-hidden'} style={{ width: __panelSetupProps.width + 'px' }}>
                    {__panelSetupProps.info}
                </div>
            </ElTooltip>
        );
    },
    options,
);
