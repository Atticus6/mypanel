import './TableRefresh.styles.css';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: (...args: unknown[]) => true,
};

const options = {
    name: 'TableRefresh',
    props: {},
    emits: emits,
    __scopeId: 'data-v-37f5d4b3',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const onRefresh = () => {
            ctx.emit('search');
        };
        return () => (
            <ElButton
                icon="Refresh"
                onClick={($event?: any) => {
                    (onRefresh as any)($event);
                }}
                class={'fresh-button'}
            />
        );
    },
    options,
);
