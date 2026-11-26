import './index.styles.css';

interface CodemodProps {
    [key: string]: any;
    header?: string;
    height?: string;
    fill?: boolean;
}

const emits = {};

type SlotsShape = {
    'header-l': (arg?: unknown) => VNode[];
    'header-r': (arg?: unknown) => VNode[];
    body: (arg?: unknown) => VNode[];
};

const options = {
    name: 'CardWithHeader',
    props: {
        header: { type: String },
        height: { type: String },
        fill: { type: Boolean },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
    __scopeId: 'data-v-51bbfe3f',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        return () => (
            <div class={{ 'fill-height': __panelSetupProps.fill }}>
                <ElCard class={'home-card'} style={{ height: __panelSetupProps.height }}>
                    <div class={'header'}>
                        <div class={'header-left flex flex-wrap gap-3'}>
                            <span class={'header-span'}>{__panelSetupProps.header}</span>
                            {ctx.slots['header-l']?.(undefined)}
                        </div>
                        <div class={'header-right flex flex-wrap gap-3'}>{ctx.slots['header-r']?.(undefined)}</div>
                    </div>
                    <div class={'body-content'}>{ctx.slots['body']?.(undefined)}</div>
                </ElCard>
            </div>
        );
    },
    options,
);
