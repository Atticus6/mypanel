import { $t } from '@/utils/i18n-t';

import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElCard } from 'element-plus';
import { ElText } from 'element-plus';
import { ElTooltip } from 'element-plus';
import { ElTag } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
    header?: string;
    description?: string;
    website?: boolean;
}

const emits = {};

type SlotsShape = {
    'header-r': (arg?: unknown) => VNode[];
    'content-r': (arg?: unknown) => VNode[];
    'content-form': (arg?: unknown) => VNode[];
};

const options = {
    name: 'ConfigCard',
    props: {
        header: { type: String },
        description: { type: String },
        website: { type: Boolean },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
    __scopeId: 'data-v-a2efb66d',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        return () => (
            <ElCard class={'config-card'}>
                <div class={'config-header'}>
                    <span>{__panelSetupProps.header}</span>
                    <div class={'header-r'}>{ctx.slots['header-r']?.(undefined)}</div>
                </div>
                <ElText type="info">{__panelSetupProps.description}</ElText>
                {__panelSetupProps.website ? (
                    <span class={'ml-5'}>
                        <ElTooltip content={$t('xpack.waf.websiteHelper')} placement="bottom">
                            <ElTag type="primary" size="small">
                                {$t('menu.website')}
                            </ElTag>
                        </ElTooltip>
                    </span>
                ) : null}
                <div class={'config-content'}>{ctx.slots['content-r']?.(undefined)}</div>
                <div class={'config-form'}>{ctx.slots['content-form']?.(undefined)}</div>
            </ElCard>
        );
    },
    options,
);
