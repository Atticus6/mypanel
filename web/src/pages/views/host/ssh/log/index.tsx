import FireRouter from '@/pages/views/host/ssh/index';
import Log from '@/pages/views/host/ssh/log/log';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'log',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => (
            <div>
                <FireRouter />
                <Log />
            </div>
        );
    },
    options,
);
