import { useI18n } from 'vue-i18n';

interface CodemodProps {
    [key: string]: any;
    streaming?: boolean;
    groupSessionScope?: string;
    requireMention?: string;
    allowInherit?: boolean;
}

const emits = {
    'update:streaming': (arg0?: boolean) => true,
    'update:groupSessionScope': (arg0?: string) => true,
    'update:requireMention': (arg0?: string) => true,
};

const options = {
    name: 'feishu-transition',
    props: {
        streaming: Boolean,
        groupSessionScope: String,
        requireMention: String,
        allowInherit: Boolean,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { t } = useI18n();
        return () => (
            <>
                <ElFormItem label={unref(t)('aiTools.agents.groupSessionScope')} prop="groupSessionScope">
                    <ElSelect
                        model-value={__panelSetupProps.groupSessionScope}
                        onUpdate:model-value={($event?: any) => {
                            ctx.emit('update:groupSessionScope', $event);
                        }}
                    >
                        <ElOption label={unref(t)('aiTools.agents.groupSessionScopeGroup')} value="group" />
                        <ElOption
                            label={unref(t)('aiTools.agents.groupSessionScopeGroupSender')}
                            value="group_sender"
                        />
                        <ElOption label={unref(t)('aiTools.agents.feishuSessionTopic')} value="group_topic" />
                        <ElOption
                            label={unref(t)('aiTools.agents.feishuSessionTopicSender')}
                            value="group_topic_sender"
                        />
                    </ElSelect>
                </ElFormItem>
                <ElFormItem label={unref(t)('aiTools.agents.streaming')}>
                    <ElSwitch
                        model-value={__panelSetupProps.streaming}
                        onUpdate:model-value={($event?: any) => {
                            ctx.emit('update:streaming', Boolean($event));
                        }}
                    />
                </ElFormItem>
                <ElFormItem label={unref(t)('aiTools.agents.requireMention')} prop="requireMention">
                    <ElSelect
                        model-value={__panelSetupProps.requireMention}
                        onUpdate:model-value={($event?: any) => {
                            ctx.emit('update:requireMention', $event);
                        }}
                    >
                        <ElOption label={unref(t)('aiTools.agents.requireMentionTrue')} value="true" />
                        <ElOption label={unref(t)('aiTools.agents.requireMentionFalse')} value="false" />
                        {__panelSetupProps.allowInherit ? (
                            <ElOption label={unref(t)('aiTools.agents.requireMentionOpen')} value="open" />
                        ) : null}
                    </ElSelect>
                </ElFormItem>
            </>
        );
    },
    options,
);
