import { useGlobalStore } from '@/composables/useGlobalStore';
import PrimaryLogo from '@/assets/images/1panel-logo.svg?component';
import MenuLogo from '@/assets/images/1panel-menu-logo.svg?component';
import { routerToNameWithQuery } from '@/utils/router';
import './Logo.styles.css';

interface CodemodProps {
    [key: string]: any;
    isCollapse?: boolean;
}

const emits = {};

const options = {
    name: 'Logo',
    props: {
        isCollapse: Boolean,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-32a22a25',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const logoLoadFailed = ref(false);
        const logoWithTextLoadFailed = ref(false);
        const { themeConfig } = useGlobalStore();
        const goHome = () => {
            routerToNameWithQuery('home', { t: Date.now() });
        };
        return () => (
            <div
                onClick={($event?: any) => {
                    (goHome as any)($event);
                }}
                class={'logo'}
                style={'cursor: pointer'}
            >
                {__panelSetupProps.isCollapse ? (
                    <>
                        {unref(themeConfig).logo && !unref(logoLoadFailed) ? (
                            <img
                                src={`/api/v2/images/logo?t=${Date.now()}`}
                                alt="logo"
                                onError={($event?: any) => {
                                    logoLoadFailed.value = true;
                                }}
                                style={'cursor: pointer'}
                            />
                        ) : (
                            <MenuLogo />
                        )}
                    </>
                ) : (
                    <>
                        {unref(themeConfig).logoWithText && !unref(logoWithTextLoadFailed) ? (
                            <img
                                src={`/api/v2/images/logoWithText?t=${Date.now()}`}
                                alt="logo"
                                onError={($event?: any) => {
                                    logoWithTextLoadFailed.value = true;
                                }}
                                style={'cursor: pointer'}
                            />
                        ) : (
                            <PrimaryLogo />
                        )}
                    </>
                )}
            </div>
        );
    },
    options,
);
