import ProviderLogo from '@/components/agent-provider-logo/index';
import { getAgentProviderDisplayName } from '@/utils/agent';
import './index.styles.css';

interface CodemodProps {
    [key: string]: any;
    provider?: string;
    displayName?: string;
    size?: number;
}

const emits = {};

const options = {
    name: 'agent-provider-label',
    props: {
        provider: String,
        displayName: String,
        size: Number,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-983b90f9',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const name = computed(() =>
            getAgentProviderDisplayName(__panelSetupProps.provider, __panelSetupProps.displayName),
        );
        return () => (
            <span class={'agent-provider-label'}>
                <ProviderLogo
                    provider={__panelSetupProps.provider}
                    display-name={unref(name)}
                    size={__panelSetupProps.size}
                />
                <span title={unref(name)} class={'agent-provider-label__name'}>
                    {unref(name)}
                </span>
            </span>
        );
    },
    options,
);
