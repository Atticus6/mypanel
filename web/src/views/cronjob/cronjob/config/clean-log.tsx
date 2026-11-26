import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
interface Props {
    modelValue?: string[];
}
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElCard } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
    modelValue?: string[];
}

const emits = {
    'update:modelValue': (arg0?: string[]) => true,
};

const options = {
    name: 'clean-log',
    props: {
        modelValue: Array,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const handleChange = (value: string[]) => {
            ctx.emit('update:modelValue', value);
        };
        const scopes = [{ value: 'website', label: i18n.global.t('logs.websiteLog') }];
        return () => (
            <ElCard>
                <ElFormItem label={$t('cronjob.cleanLogscope')} prop="scopes">
                    <ElSelect
                        model-value={__panelSetupProps.modelValue}
                        multiple
                        onChange={($event?: any) => {
                            (handleChange as any)($event);
                        }}
                        clearable
                    >
                        {(scopes || []).map((item) => (
                            <ElOption value={item.value} label={item.label} key={item.value} />
                        ))}
                    </ElSelect>
                </ElFormItem>
            </ElCard>
        );
    },
    options,
);
