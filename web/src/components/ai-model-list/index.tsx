import { $t } from '@/utils/i18n-t';
import CopyButton from '@/components/copy-button/index';
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { cn } from '@/utils/cn';
import { ElTag } from 'element-plus';
import { ElPopover } from 'element-plus';
import { ElButton } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
    models?: string[];
    visibleCount?: number;
    copyable?: boolean;
    tagType?: 'primary' | 'success' | 'warning' | 'info' | 'danger';
}

const emits = {};

type SlotsShape = {
    footer: (arg?: unknown) => VNode[];
};

const options = {
    name: 'ai-model-list',
    props: {
        models: Array,
        visibleCount: Number,
        copyable: Boolean,
        tagType: { type: null },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
    __scopeId: 'data-v-d295ad2e',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        return () => (
            <div class={cn('ai-model-list', { 'ai-model-list--single': __panelSetupProps.visibleCount === 1 })}>
                {(__panelSetupProps.models.slice(0, __panelSetupProps.visibleCount) || []).map((model, index) => (
                    <span class={'model-preview'} key={index}>
                        <ElTag size="small" type={__panelSetupProps.tagType} class={'model-tag'}>
                            <span title={model}>{model}</span>
                        </ElTag>
                        {__panelSetupProps.copyable ? <CopyButton content={model} /> : null}
                    </span>
                ))}
                {__panelSetupProps.models.length > __panelSetupProps.visibleCount ? (
                    <ElPopover
                        trigger="click"
                        placement="bottom-start"
                        width={360}
                        popper-options={{
                            modifiers: [{ name: 'preventOverflow', options: { padding: 16, altAxis: true } }],
                        }}
                        popper-style={{ maxWidth: 'calc(100vw - 32px)', padding: '12px' }}
                        v-slots={{
                            reference: () => (
                                <>
                                    <ElButton
                                        size="small"
                                        aria-label={
                                            $t('aiTools.model.model') +
                                            ' +' +
                                            (__panelSetupProps.models.length - __panelSetupProps.visibleCount)
                                        }
                                        onClick={($event?: any) => {
                                            $event.stopPropagation();
                                        }}
                                        class={'model-more'}
                                    >
                                        {' +'}
                                        {__panelSetupProps.models.length - __panelSetupProps.visibleCount}
                                    </ElButton>
                                </>
                            ),
                        }}
                    >
                        <div
                            onClick={($event?: any) => {
                                $event.stopPropagation();
                            }}
                            class={'model-popover'}
                        >
                            <div class={'model-popover__header'}>
                                <span>{$t('aiTools.model.model')}</span>
                                <ElTag size="small" type="info" round>
                                    {__panelSetupProps.models.length}
                                </ElTag>
                            </div>
                            <ul tabindex="0" aria-label={$t('aiTools.model.model')} class={'model-popover__list'}>
                                {(__panelSetupProps.models || []).map((model, index) => (
                                    <li key={index}>
                                        <span class={'model-popover__name'}>{model}</span>
                                        {__panelSetupProps.copyable ? (
                                            <CopyButton content={model} aria-label={$t('commons.button.copy')} />
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                            {ctx.slots.footer ? (
                                <div class={'model-popover__footer'}>{ctx.slots['footer']?.(undefined)}</div>
                            ) : null}
                        </div>
                    </ElPopover>
                ) : null}
            </div>
        );
    },
    options,
);
