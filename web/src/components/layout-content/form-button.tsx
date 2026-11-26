export default defineComponent(
    (_props, { slots }) =>
        () => <div class="form-button">{slots.default?.()}</div>,
    {
        name: 'FormButton',
    },
);
