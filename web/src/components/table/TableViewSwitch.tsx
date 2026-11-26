import { $t } from '@/utils/i18n-t';
import { Grid, List } from '@element-plus/icons-vue';
type ViewMode = 'table' | 'card';

interface CodemodProps {
    [key: string]: any;
    modelValue?: ViewMode;
    storageKey?: string;
}

const emits = {
    'update:modelValue': (...args: unknown[]) => true,
};

const options = {
    name: 'TableViewSwitch',
    props: {
        modelValue: {
            type: String as PropType<ViewMode>,
            default: 'table',
        },
        storageKey: {
            type: String,
            required: true,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const getStorageKey = () => `COMPLEX-T-V-${__panelSetupProps.storageKey}`;
        const getStoredViewMode = (): ViewMode | undefined => {
            if (typeof window === 'undefined') {
                return undefined;
            }
            const mode = localStorage.getItem(getStorageKey());
            return mode === 'card' || mode === 'table' ? mode : undefined;
        };
        const currentViewMode = ref<ViewMode>(getStoredViewMode() || __panelSetupProps.modelValue);
        watch(
            () => __panelSetupProps.modelValue,
            (mode) => {
                if (mode !== currentViewMode.value) {
                    currentViewMode.value = mode;
                }
            },
        );
        watch(
            currentViewMode,
            (mode) => {
                if (typeof window !== 'undefined') {
                    localStorage.setItem(getStorageKey(), mode);
                }
                if (mode !== __panelSetupProps.modelValue) {
                    ctx.emit('update:modelValue', mode);
                }
            },
            { immediate: true },
        );
        return () => (
            <ElRadioGroup v-model={currentViewMode.value}>
                <ElTooltip content={$t('commons.table.card')} placement="top">
                    <ElRadioButton value="card">
                        <ElIcon>
                            <Grid />
                        </ElIcon>
                    </ElRadioButton>
                </ElTooltip>
                <ElTooltip content={$t('commons.table.table')} placement="top">
                    <ElRadioButton value="table">
                        <ElIcon>
                            <List />
                        </ElIcon>
                    </ElRadioButton>
                </ElTooltip>
            </ElRadioGroup>
        );
    },
    options,
);
