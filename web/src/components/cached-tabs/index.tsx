import { useRoute } from 'vue-router';
import { useCachedTab } from '@/composables/useCachedTab';
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElCard } from 'element-plus';
import { ElRadioGroup } from 'element-plus';
import { ElRadioButton } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
    items?: { value: string; label: string }[];
    defaultValue?: string;
    cacheKey?: string;
    requestedValue?: string;
}

const emits = {
    activate: (arg0?: string) => true,
};

type SlotsShape = {
    default: (arg?: unknown) => VNode[];
};

const options = {
    name: 'cached-tabs',
    props: {
        items: Array,
        defaultValue: String,
        cacheKey: String,
        requestedValue: String,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
    __scopeId: 'data-v-9e332ffc',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        const pagePath = useRoute().path;
        const { activeTab, select } = useCachedTab({
            key: () => JSON.stringify([pagePath, __panelSetupProps.cacheKey]),
            values: () => __panelSetupProps.items.map((item) => item.value),
            defaultValue: () => __panelSetupProps.defaultValue,
            requestedValue: () => __panelSetupProps.requestedValue,
            onActivate: (value) => ctx.emit('activate', value),
        });
        return () => (
            <div>
                <ElCard class={'cached-tabs'}>
                    <ElRadioGroup
                        model-value={unref(activeTab)}
                        onChange={($event?: any) => {
                            unref(select)($event);
                        }}
                    >
                        {(__panelSetupProps.items || []).map((item) => (
                            <ElRadioButton value={item.value} size="large" key={item.value}>
                                {item.label}
                            </ElRadioButton>
                        ))}
                    </ElRadioGroup>
                </ElCard>
                {ctx.slots['default']?.({ active: unref(activeTab) })}
            </div>
        );
    },
    options,
);
