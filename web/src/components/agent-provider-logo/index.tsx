import { computed } from 'vue';
import { getAgentProviderLogo } from '@/utils/agent-provider-logo';
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';

interface CodemodProps {
    [key: string]: any;
    provider?: string;
    displayName?: string;
    size?: number;
}

const emits = {};

const options = {
    name: 'agent-provider-logo',
    props: {
        provider: String,
        displayName: String,
        size: Number,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-7a9f7a18',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const logo = computed(() => getAgentProviderLogo(__panelSetupProps.provider, __panelSetupProps.displayName));
        const logoStyle = computed(() => ({
            width: `${__panelSetupProps.size}px`,
            height: `${__panelSetupProps.size}px`,
            minWidth: `${__panelSetupProps.size}px`,
            background: logo.value.background,
            color: logo.value.color,
            fontSize: `${Math.max(10, Math.floor(__panelSetupProps.size * 0.48))}px`,
        }));
        return () => (
            <span
                aria-label={`${__panelSetupProps.displayName || __panelSetupProps.provider} unref(logo)`}
                role="img"
                class={'agent-provider-logo'}
                style={unref(logoStyle)}
            >
                {unref(logo).src ? (
                    <img
                        src={unref(logo).src}
                        alt={__panelSetupProps.displayName || __panelSetupProps.provider}
                        class={'agent-provider-logo__image'}
                    />
                ) : (
                    <span>{unref(logo).mark}</span>
                )}
            </span>
        );
    },
    options,
);
