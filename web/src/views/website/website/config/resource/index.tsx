import Nginx from './nginx/index';
import { rpc } from '@/lib/rpc';

interface CodemodProps {
    [key: string]: any;
    id?: number;
}

const emits = {};

const options = {
    name: 'resource',
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
        let configPHP = ref(false);
        let installId = ref(0);
        const getWebsiteDetail = async () => {
            const res = await rpc.website.getWebsite({ id: __panelSetupProps.id });
            if (res.type === 'runtime') {
                installId.value = res.appInstallId;
                // 运行时能力已剔除，不再请求 runtime 详情。
                configPHP.value = false;
            }
        };
        onMounted(() => {
            getWebsiteDetail();
        });
        return () => (
            <ElTabs
                tab-position="left"
                modelValue={unref(index)}
                onUpdate:modelValue={($v) => {
                    index.value = $v as any;
                }}
            >
                <ElTabPane label={'OpenResty'} name="0">
                    {unref(index) == '0' ? <Nginx id={unref(id)} /> : null}
                </ElTabPane>
            </ElTabs>
        );
    },
    options,
);
