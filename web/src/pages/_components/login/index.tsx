import LoginForm from './components/login-form';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { preloadImage } from '@/utils/browser';

interface CodemodProps {
    [key: string]: any;
    code?: string;
}

const emits = {};

const options = {
    name: 'Login',
    props: {
        code: {
            type: String,
            default: '',
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { entrance, isEnterprise, themeConfig } = useGlobalStore();
        const backgroundOpacity = ref(1);
        const defaultLoginImage = new URL('@/assets/images/1panel-login.jpg', import.meta.url).href;
        const defaultEnterpriseLoginImage = new URL('@/assets/images/1panel-login-enterprise.png', import.meta.url)
            .href;
        const defaultLoginBgImage = new URL('@/assets/images/1panel-login-bg.jpg', import.meta.url).href;
        const loadedLoginImage = ref<string | null>(null);
        const loadedBackgroundImage = ref<string | null>(null);
        const backgroundStyle = ref<{ backgroundImage?: string; backgroundColor?: string }>({});
        const imgLoaded = ref(false);
        const currentDefaultLoginImage = computed(() =>
            isEnterprise.value ? defaultEnterpriseLoginImage : defaultLoginImage,
        );
        function onImgLoad() {
            imgLoaded.value = true;
        }
        const getStatus = async () => {
            let code = __panelSetupProps.code;
            if (code != '') {
                entrance.value = code;
            }
        };
        const loadImage = (name: string) => {
            const { loginImage, loginBackground, loginBgType } = themeConfig.value;
            if (name === 'loginImage') {
                if (loginImage === 'loginImage') {
                    return loadedLoginImage.value || currentDefaultLoginImage.value;
                }
                if (loginImage) {
                    return loginImage;
                }
                return currentDefaultLoginImage.value;
            }
            if (name === 'loginBackground') {
                if (loginBgType === 'image') {
                    if (loginBackground === 'loginBackground') {
                        return loadedBackgroundImage.value || defaultLoginBgImage;
                    }
                    if (loginBackground) {
                        return loginBackground;
                    }
                    return defaultLoginBgImage;
                }
                if (loginBgType === 'color') {
                    return loginBackground;
                }
                return defaultLoginBgImage;
            }
            return '';
        };
        const onImgError = (event: any) => {
            event.target.src = currentDefaultLoginImage.value;
            imgLoaded.value = true;
        };
        onMounted(async () => {
            await getStatus();
            const loginImageUrl = `/api/v2/images/loginImage?t=${Date.now()}`;
            const backgroundImageUrl = `/api/v2/images/loginBackground?t=${Date.now()}`;
            if (themeConfig.value.loginImage === 'loginImage') {
                loadedLoginImage.value = await preloadImage(loginImageUrl);
            }
            if (themeConfig.value.loginBgType === 'image' && themeConfig.value.loginBackground === 'loginBackground') {
                loadedBackgroundImage.value = await preloadImage(backgroundImageUrl);
            }
            if (themeConfig.value.loginBgType === 'color') {
                backgroundStyle.value = {
                    backgroundColor: themeConfig.value.loginBackground,
                };
            } else {
                const img = new Image();
                const url = loadImage('loginBackground');
                img.onload = () => {
                    backgroundStyle.value = {
                        backgroundImage: `url(${url})`,
                    };
                };
                img.onerror = () => {
                    backgroundStyle.value = {
                        backgroundImage: `url(${defaultLoginBgImage})`,
                    };
                };
                img.src = url;
            }
        });
        const FIXED_WIDTH = 1000;
        const FIXED_HEIGHT = 415;
        const useWindowSize = () => {
            const width = ref(window.innerWidth);
            const height = ref(window.innerHeight);

            const updateSize = () => {
                width.value = window.innerWidth;
                height.value = window.innerHeight;
            };

            onMounted(() => window.addEventListener('resize', updateSize));
            onUnmounted(() => window.removeEventListener('resize', updateSize));

            return { width, height };
        };
        const { width } = useWindowSize();
        const showLogo = computed(() => width.value >= FIXED_WIDTH);
        const containerWidth = computed(() => `${FIXED_WIDTH}px`);
        const containerHeight = computed(() => `${FIXED_HEIGHT}px`);
        const loginGridStyle = computed(() => ({
            gridTemplateColumns: showLogo.value ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)',
        }));
        const loginFormClass = computed(() => {
            return showLogo.value
                ? 'flex items-center justify-center p-4 min-w-0'
                : 'flex items-center justify-center p-4 w-full min-w-0';
        });
        return () => (
            <div class={'relative flex min-h-screen items-center justify-center bg-gray-100'}>
                <div class={'absolute inset-0 bg-cover bg-center bg-no-repeat'} style={unref(backgroundStyle)} />
                <div
                    id="login-container"
                    class={'relative z-10 flex overflow-hidden border border-gray-200 bg-white shadow-lg'}
                    style={{
                        opacity: unref(backgroundOpacity),
                        width: unref(containerWidth),
                        height: unref(containerHeight),
                    }}
                >
                    <div class={'grid w-full items-stretch'} style={unref(loginGridStyle)}>
                        {unref(showLogo) ? (
                            <div class={'flex justify-center'} style={{ height: unref(containerHeight) }}>
                                <img
                                    src={loadImage('loginImage')}
                                    alt="1panel"
                                    onLoad={($event?: any) => {
                                        (onImgLoad as any)($event);
                                    }}
                                    onError={($event?: any) => {
                                        (onImgError as any)($event);
                                    }}
                                    class={'max-h-full max-w-full bg-cover bg-center object-cover'}
                                    style={[{}, { display: unref(imgLoaded) ? '' : 'none' }]}
                                />
                            </div>
                        ) : null}
                        <div class={unref(loginFormClass)}>
                            <LoginForm ref="loginRef" />
                        </div>
                    </div>
                </div>
            </div>
        );
    },
    options,
);
