import { ref, onMounted, onUnmounted, computed } from 'vue';
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';

interface CodemodProps {
    [key: string]: any;
    heightDiff?: number;
}

const emits = {};

type SlotsShape = {
    default: (arg?: unknown) => VNode[];
};

const options = {
    name: 'MainDiv',
    props: {
        heightDiff: {
            type: Number,
            default: 0,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
    __scopeId: 'data-v-3bb273ad',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        const windowHeight = ref(window.innerHeight);
        const mainHeight = computed(() => windowHeight.value - __panelSetupProps.heightDiff);
        const updateHeight = () => {
            windowHeight.value = window.innerHeight;
        };
        onMounted(() => {
            window.addEventListener('resize', updateHeight);
        });
        onUnmounted(() => {
            window.removeEventListener('resize', updateHeight);
        });
        return () => (
            <div class={'main-div'} style={{ '--main-height': unref(mainHeight) + 'px' }}>
                {ctx.slots['default']?.(undefined)}
            </div>
        );
    },
    options,
);
