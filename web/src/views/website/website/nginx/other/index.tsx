import { $t } from '@/utils/i18n-t';
import Https from './https/index';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElTabs } from 'element-plus';
import { ElTabPane } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'other',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const tabIndex = ref('0');
        return () => (
            <div>
                <ElTabs
                    tab-position="left"
                    modelValue={unref(tabIndex)}
                    onUpdate:modelValue={($v) => {
                        tabIndex.value = $v as any;
                    }}
                    ref="tabsRef"
                >
                    <ElTabPane label={$t('nginx.defaultHttps')} name="0">
                        {unref(tabIndex) == '0' ? <Https /> : null}
                    </ElTabPane>
                </ElTabs>
            </div>
        );
    },
    options,
);
