import { computed, type PropType } from 'vue';
import type { Step, Stepper } from './Stepper';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElSteps } from 'element-plus';
import { ElStep } from 'element-plus';
import { ElCollapseTransition } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
    stepper?: Stepper;
    steps?: Step[];
    disable?: (index: number) => boolean;
}

const emits = {
    active: (...args: unknown[]) => true,
};

type SlotsShape = {
    default: (arg?: unknown) => VNode[];
};

const options = {
    name: 'FuVerticalNavigation',
    props: {
        stepper: { type: Object as PropType<Stepper> },
        steps: { type: Array as PropType<Step[]> },
        disable: { type: Function as PropType<(index: number) => boolean> },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        const active = computed(() => __panelSetupProps.stepper?.index ?? 0);
        const heightStyle = computed(() => {
            const height = Number.parseInt(String(__panelSetupProps.stepper?.height ?? ''), 10);
            return Number.isFinite(height) ? { height: `${height}px` } : undefined;
        });
        const handleClick = (index: number) => {
            if (!__panelSetupProps.disable?.(index)) {
                ctx.emit('active', index);
            }
        };
        return () => (
            <ElSteps active={unref(active)} {...__panelSetupProps.stepper} direction="vertical">
                {(__panelSetupProps.steps || []).map((step, index) => (
                    <ElStep
                        {...step}
                        onClick={($event?: any) => {
                            handleClick(index);
                        }}
                        class={__panelSetupProps.disable?.(index) && 'fu-step--disable'}
                        key={index}
                        v-slots={{
                            description: () => (
                                <>
                                    <span>{step.description}</span>
                                    <ElCollapseTransition>
                                        {index === unref(active) ? (
                                            <div class={'fu-steps__container'} style={unref(heightStyle)}>
                                                {ctx.slots['default']?.({ step })}
                                            </div>
                                        ) : null}
                                    </ElCollapseTransition>
                                </>
                            ),
                        }}
                    />
                ))}
            </ElSteps>
        );
    },
    options,
);
