import { $t } from '@/utils/i18n-t';
import { listNodes } from '@/utils/node';
import { useGlobalStore } from '@/composables/useGlobalStore';

interface CodemodProps {
    [key: string]: any;
    modelValue?: string;
}

const emits = {
    'update:modelValue': (...args: unknown[]) => true,
    change: (...args: unknown[]) => true,
};

const options = {
    name: 'node-select',
    props: {
        modelValue: {
            type: String,
            default: '',
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { globalStore } = useGlobalStore();
        const nodes = ref([]);
        const handleChange = (value) => {
            ctx.emit('update:modelValue', value);
            ctx.emit('change', value);
        };
        const search = async () => {
            try {
                const res = await listNodes('all');
                nodes.value = res || [];
            } catch (error) {}
        };
        onMounted(() => {
            search();
        });
        return () => (
            <ElSelect
                model-value={__panelSetupProps.modelValue}
                onUpdate:model-value={($event?: any) => {
                    (handleChange as any)($event);
                }}
                placeholder={$t('setting.selectNode')}
                class={'p-w-200'}
                v-slots={{ prefix: () => <>{$t('xpack.node.node')}</> }}
            >
                {(unref(nodes) || []).map((item) => (
                    <ElOption
                        label={item.name === 'local' ? unref(globalStore).getMasterAlias() : item.name}
                        value={item.name}
                        key={item.id}
                    />
                ))}
            </ElSelect>
        );
    },
    options,
);
