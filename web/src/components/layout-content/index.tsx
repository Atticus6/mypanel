import { computed, useSlots } from 'vue';
import FormButton from './form-button';
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { cn } from '@/utils/cn';
import { ElCard } from 'element-plus';
import BackButton from '@/components/back-button/index';

interface CodemodProps {
    [key: string]: any;
    title?: string;
    backPath?: string;
    backName?: string;
    backTo?: Record<string, any>;
    reload?: boolean;
    divider?: boolean;
}

const emits = {};

type SlotsShape = {
    app: (arg?: unknown) => VNode[];
    search: (arg?: unknown) => VNode[];
    button: (arg?: unknown) => VNode[];
    form: (arg?: unknown) => VNode[];
    leftToolBar: (arg?: unknown) => VNode[];
    rightToolBar: (arg?: unknown) => VNode[];
    toolbar: (arg?: unknown) => VNode[];
    title: (arg?: unknown) => VNode[];
    prompt: (arg?: unknown) => VNode[];
    main: (arg?: unknown) => VNode[];
    default: (arg?: unknown) => VNode[];
};

const options = {
    name: 'LayoutContent',
    props: {
        title: { type: String },
        backPath: { type: String },
        backName: { type: String },
        backTo: { type: Object },
        reload: { type: Boolean },
        divider: { type: Boolean },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
    __scopeId: 'data-v-e0a895c3',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        const slots = useSlots();
        const showBack = computed(() => {
            const { backPath, backName, backTo, reload } = __panelSetupProps;
            return backPath || backName || backTo || reload;
        });
        const hasTitleContent = () => {
            return Boolean(
                slots.title ||
                slots.leftToolBar ||
                slots.rightToolBar ||
                slots.toolbar ||
                __panelSetupProps.divider ||
                showBack.value,
            );
        };
        const hasMainTopGap = () => hasTitleContent() || Boolean(slots.prompt);
        return () => (
            <div class={'main-box'}>
                {unref(slots).app ? <div class={'content-container__app'}>{ctx.slots['app']?.(undefined)}</div> : null}
                {unref(slots).search ? (
                    <div class={'content-container__search'}>
                        <ElCard>{ctx.slots['search']?.(undefined)}</ElCard>
                    </div>
                ) : null}
                <div class={'content-container_form'}>
                    {ctx.slots['form']?.(undefined) ?? (
                        <>
                            <FormButton>{ctx.slots['button']?.(undefined)}</FormButton>
                        </>
                    )}
                </div>
                {unref(slots).main ? (
                    <div class={'content-container__main'}>
                        <ElCard>
                            {hasTitleContent() ? (
                                <div class={'content-container__title'}>
                                    {ctx.slots['title']?.(undefined) ?? (
                                        <>
                                            {unref(showBack) ? (
                                                <div class={'flex flex-wrap gap-4 sm:justify-between'}>
                                                    <BackButton
                                                        path={__panelSetupProps.backPath}
                                                        name={__panelSetupProps.backName}
                                                        to={__panelSetupProps.backTo}
                                                        header={__panelSetupProps.title}
                                                        reload={__panelSetupProps.reload}
                                                        v-slots={{
                                                            buttons: () => (
                                                                <>
                                                                    <div
                                                                        class={
                                                                            'flex flex-wrap gap-2 items-center justify-start'
                                                                        }
                                                                    >
                                                                        {unref(slots).leftToolBar
                                                                            ? ctx.slots['leftToolBar']?.(undefined)
                                                                            : null}
                                                                    </div>
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                    <div class={'flex flex-wrap gap-3'}>
                                                        {unref(slots).rightToolBar
                                                            ? ctx.slots['rightToolBar']?.(undefined)
                                                            : null}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div class={'flex flex-wrap gap-4 sm:justify-between'}>
                                                    <div class={'flex gap-2 flex-wrap items-center justify-start'}>
                                                        {unref(slots).leftToolBar
                                                            ? ctx.slots['leftToolBar']?.(undefined)
                                                            : null}
                                                    </div>
                                                    {unref(slots).rightToolBar ? (
                                                        <div class={'flex flex-wrap gap-3'}>
                                                            {ctx.slots['rightToolBar']?.(undefined)}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            )}
                                            {unref(slots).toolbar ? (
                                                <span>{ctx.slots['toolbar']?.(undefined)}</span>
                                            ) : null}
                                            {__panelSetupProps.divider ? (
                                                <div>
                                                    <div class={'divider'} />
                                                </div>
                                            ) : null}
                                        </>
                                    )}
                                </div>
                            ) : null}
                            {unref(slots).prompt ? (
                                <div class={'prompt'}>{ctx.slots['prompt']?.(undefined)}</div>
                            ) : null}
                            <div class={cn('main-content', { 'main-content--compact': !hasMainTopGap() })}>
                                {ctx.slots['main']?.(undefined)}
                            </div>
                        </ElCard>
                    </div>
                ) : null}
                {ctx.slots['default']?.(undefined)}
            </div>
        );
    },
    options,
);
