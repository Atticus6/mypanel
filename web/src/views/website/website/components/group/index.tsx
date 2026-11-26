import { $t } from '@/utils/i18n-t';
import { Group } from '@/types/group';
import { rpc } from '@/lib/rpc';

interface CodemodProps {
    [key: string]: any;
    modelValue?: number;
    groupType?: string;
    prop?: string;
}

const emits = {
    'update:modelValue': (...args: unknown[]) => true,
};

const options = {
    name: 'group',
    props: {
        modelValue: {
            type: Number,
            required: true,
        },
        groupType: {
            type: String,
            default: 'website',
        },
        prop: {
            type: String,
            default: '',
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const groups = ref<Group.GroupInfo[]>([]);
        const selectedValue = computed({
            get: () => __panelSetupProps.modelValue,
            set: (value) => ctx.emit('update:modelValue', value),
        });
        onMounted(async () => {
            const res = await rpc.group.searchGroups({ type: __panelSetupProps.groupType });
            groups.value = (res.items || []).map((item) => ({ ...item, isDelete: false }));
            if (groups.value.length > 0 && !__panelSetupProps.modelValue && __panelSetupProps.modelValue == 0) {
                selectedValue.value = groups.value[0].id;
            }
        });
        return () => (
            <ElFormItem label={$t('commons.table.group')} prop={__panelSetupProps.prop}>
                <ElSelect
                    modelValue={unref(selectedValue)}
                    onUpdate:modelValue={($v) => {
                        selectedValue.value = $v as any;
                    }}
                >
                    {(unref(groups) || []).map((group, index) => (
                        <ElOption label={group.name} value={group.id} key={index} />
                    ))}
                </ElSelect>
            </ElFormItem>
        );
    },
    options,
);
