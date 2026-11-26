export default defineComponent(
    (props, { slots }) =>
        () => (
            <ElCol xs={24} sm={props.span} md={props.span} lg={props.span} xl={props.span}>
                {slots.default?.()}
            </ElCol>
        ),
    {
        name: 'LayoutCol',
        props: {
            span: { type: Number, default: 10 },
        } as any,
    },
);
