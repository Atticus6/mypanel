import { $t } from '@/utils/i18n-t';
import LogFile from './log-fiile/index';

interface CodemodProps {
    [key: string]: any;
    id?: number;
}

const emits = {};

const options = {
    name: 'log',
    props: {
        id: {
            type: Number,
            default: 0,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const id = computed(() => {
            return __panelSetupProps.id;
        });
        let index = ref('0');
        return () => (
            <ElTabs tab-position="left" v-model={index.value}>
                <ElTabPane label={$t('logs.websiteLog')} name="0">
                    {unref(index) == '0' ? <LogFile id={unref(id)} log-type={'access.log'} /> : null}
                </ElTabPane>
                <ElTabPane label={$t('website.errLog')} name="1">
                    {unref(index) == '1' ? <LogFile id={unref(id)} log-type={'error.log'} /> : null}
                </ElTabPane>
            </ElTabs>
        );
    },
    options,
);
