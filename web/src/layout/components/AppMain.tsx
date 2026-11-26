import RouterViewCache from '@/components/router-view-cache/index';
import type { KeepAlivePattern } from '@/utils/tab-cache';

export default defineComponent((props) => () => <RouterViewCache keepAlive={props.keepAlive} withTransition />, {
    name: 'AppMain',
    props: {
        keepAlive: {
            type: Array as PropType<KeepAlivePattern | null>,
            required: false,
        },
    },
});
