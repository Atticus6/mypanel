import { $t } from '@/utils/i18n-t';
interface FileTabs {
    path: string;
    name: string;
}
import './index.styles.css';
import { Close } from '@element-plus/icons-vue';
import { DArrowLeft } from '@element-plus/icons-vue';
import { DArrowRight } from '@element-plus/icons-vue';
import { More } from '@element-plus/icons-vue';
import { Operation } from '@element-plus/icons-vue';

interface CodemodProps {
    [key: string]: any;
    selectTab?: string;
    onRemoveTab?: (...args: any[]) => any;
    onChangeTab?: (...args: any[]) => any;
    onRemoveAllTab?: (...args: any[]) => any;
    onRemoveOtherTab?: (...args: any[]) => any;
}

const emits = {};

const options = {
    name: 'tabs',
    props: {
        selectTab: { type: String },
        onRemoveTab: { type: Function },
        onChangeTab: { type: Function },
        onRemoveAllTab: { type: Function },
        onRemoveOtherTab: { type: Function },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-73c6758d',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const dropdownRefs = ref<Record<string, any>>({});
        const setDropdownRef = (path: string, el: any) => {
            if (el) {
                dropdownRefs.value[path] = el;
            }
        };
        const currentTab = ref(__panelSetupProps.selectTab);
        watch(
            () => __panelSetupProps.selectTab,
            (val) => {
                currentTab.value = val;
            },
        );
        const onDropdownVisibleChange = (visible: boolean, currentPath: string) => {
            if (visible) {
                for (const path in dropdownRefs.value) {
                    if (path !== currentPath) {
                        dropdownRefs.value[path]?.handleClose?.();
                    }
                }
            }
        };
        return () => (
            <ElTabs
                modelValue={unref(currentTab)}
                onUpdate:modelValue={($v) => {
                    currentTab.value = $v as any;
                }}
                type="card"
                closable={true}
                onTabRemove={($event?: any) => {
                    (__panelSetupProps.onRemoveTab as any)($event);
                }}
                onTabChange={($event?: any) => {
                    (__panelSetupProps.onChangeTab as any)($event);
                }}
                class={'monaco-editor monaco-editor-background'}
            >
                {(__panelSetupProps.fileTabs || []).map((item) => (
                    <ElTabPane
                        name={item.path}
                        key={item.path}
                        v-slots={{
                            label: () => (
                                <>
                                    <ElDropdown
                                        size="small"
                                        id={item.path}
                                        ref={(el) => setDropdownRef(item.path, el)}
                                        trigger="contextmenu"
                                        placement="bottom"
                                        onVisibleChange={($event?: any) => {
                                            (visible) => onDropdownVisibleChange(visible, item.path);
                                        }}
                                        v-slots={{
                                            dropdown: () => (
                                                <>
                                                    <ElDropdownMenu>
                                                        <ElDropdownItem
                                                            onClick={($event?: any) => {
                                                                __panelSetupProps.onRemoveTab(item.path);
                                                            }}
                                                        >
                                                            <ElIcon>
                                                                <Close />
                                                            </ElIcon>
                                                            {$t('commons.button.close')}
                                                        </ElDropdownItem>
                                                        <ElDropdownItem
                                                            disabled={__panelSetupProps.fileTabs.length <= 1}
                                                            onClick={($event?: any) => {
                                                                __panelSetupProps.onRemoveAllTab(item.path, 'left');
                                                            }}
                                                        >
                                                            <ElIcon>
                                                                <DArrowLeft />
                                                            </ElIcon>
                                                            {$t('tabs.closeLeft')}
                                                        </ElDropdownItem>
                                                        <ElDropdownItem
                                                            disabled={__panelSetupProps.fileTabs.length <= 1}
                                                            onClick={($event?: any) => {
                                                                __panelSetupProps.onRemoveAllTab(item.path, 'right');
                                                            }}
                                                        >
                                                            <ElIcon>
                                                                <DArrowRight />
                                                            </ElIcon>
                                                            {$t('tabs.closeRight')}
                                                        </ElDropdownItem>
                                                        <ElDropdownItem
                                                            disabled={__panelSetupProps.fileTabs.length <= 1}
                                                            onClick={($event?: any) => {
                                                                __panelSetupProps.onRemoveOtherTab(item.path);
                                                            }}
                                                        >
                                                            <ElIcon>
                                                                <More />
                                                            </ElIcon>
                                                            {$t('tabs.closeOther')}
                                                        </ElDropdownItem>
                                                        <ElDropdownItem
                                                            onClick={($event?: any) => {
                                                                __panelSetupProps.onRemoveAllTab(item.path, 'all');
                                                            }}
                                                        >
                                                            <ElIcon>
                                                                <Operation />
                                                            </ElIcon>
                                                            {$t('tabs.closeAll')}
                                                        </ElDropdownItem>
                                                    </ElDropdownMenu>
                                                </>
                                            ),
                                        }}
                                    >
                                        <span class={'el-dropdown-link'}>
                                            <ElTooltip content={item.path} placement="bottom-start">
                                                {item.name}
                                            </ElTooltip>
                                        </span>
                                    </ElDropdown>
                                </>
                            ),
                        }}
                    />
                ))}
            </ElTabs>
        );
    },
    options,
);
