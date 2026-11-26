import { $t } from '@/utils/i18n-t';
import { onActivated, ref, watch } from 'vue';
import { Search } from '@element-plus/icons-vue';
import './TableSearch.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElInput } from 'element-plus';
import { ElIcon } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
    placeholder?: string;
    disabled?: boolean;
    searchName?: string | number;
}

const emits = {
    search: (...args: unknown[]) => true,
    'update:searchName': (...args: unknown[]) => true,
};

const options = {
    name: 'TableSearch',
    props: {
        placeholder: { type: String },
        disabled: {
            type: Boolean,
            default: false,
        },
        searchName: {
            type: [String, Number],
            default: undefined,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-f7f1ea59',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const searchInfo = ref();
        let lastSearch: string | number | undefined;
        watch(
            () => __panelSetupProps.searchName,
            (newVal) => {
                if (searchInfo.value !== newVal) {
                    searchInfo.value = newVal;
                    lastSearch = newVal;
                }
            },
            { immediate: true },
        );
        onActivated(() => {
            searchInfo.value = __panelSetupProps.searchName;
        });
        const search = () => {
            if (__panelSetupProps.disabled) return;
            lastSearch = searchInfo.value;
            ctx.emit('update:searchName', searchInfo.value);
            ctx.emit('search');
        };
        const searchIfChanged = () => {
            if (searchInfo.value !== lastSearch) search();
        };
        return () => (
            <div>
                <div class={'search-button'}>
                    <ElInput
                        clearable
                        modelValue={unref(searchInfo)}
                        onUpdate:modelValue={($v) => {
                            searchInfo.value = $v as any;
                        }}
                        onClear={($event?: any) => {
                            search();
                        }}
                        onKeydown={($event?: any) => {
                            $event.stopPropagation();
                            $event.preventDefault();
                            if (!($event.key === 'Enter')) return;
                            search();
                        }}
                        onBlur={($event?: any) => {
                            searchIfChanged();
                        }}
                        disabled={__panelSetupProps.disabled}
                        placeholder={__panelSetupProps.placeholder || $t('commons.button.search')}
                        v-slots={{
                            suffix: () => (
                                <>
                                    <button
                                        type="button"
                                        disabled={__panelSetupProps.disabled}
                                        aria-label={$t('commons.button.search')}
                                        onMousedown={($event?: any) => {
                                            $event.preventDefault();
                                        }}
                                        onClick={($event?: any) => {
                                            search();
                                        }}
                                        class={'search-submit'}
                                    >
                                        <ElIcon>
                                            <Search />
                                        </ElIcon>
                                    </button>
                                </>
                            ),
                        }}
                    />
                </div>
            </div>
        );
    },
    options,
);
