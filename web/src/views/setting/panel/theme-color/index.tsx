import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { initFavicon, updateXpackSettingByKey } from '@/utils/xpack';
import { setPrimaryColor } from '@/utils/theme';
import { useGlobalStore } from '@/composables/useGlobalStore';
interface DialogProps {
    themeColor: {
        light: string;
        dark: string;
        themePredefineColors: {
            light: string[];
            dark: string[];
        };
    };
    theme: '';
}
interface ThemeColor {
    light: string;
    dark: string;
    themePredefineColors: {
        light: string[];
        dark: string[];
    };
}
import './index.styles.css';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'theme-color',
    props: {},
    emits: emits,
    __scopeId: 'data-v-e06a41bd',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isXpackOrEE, themeConfig } = useGlobalStore();
        const drawerVisible = ref();
        const loading = ref();
        const form = reactive({
            themeColor: {} as ThemeColor,
            theme: '',
            light: '',
            dark: '',
        });
        const formRef = ref<FormInstance>();
        const STORAGE_KEY = 'theme-predefine-colors';
        const lightPredefineColors = ref([
            '#005eeb',
            '#238636',
            '#3D8EFF',
            '#F0BE96',
            '#00ced1',
            '#c71585',
            '#ff4500',
            '#ff8c00',
            '#ffd700',
            '#333539',
        ]);
        const darkPredefineColors = ref([
            '#238636',
            '#3D8EFF',
            '#005eeb',
            '#F0BE96',
            '#00ced1',
            '#c71585',
            '#ff4500',
            '#ff8c00',
            '#ffd700',
            '#333539',
        ]);
        const defaultDarkColors = [
            { color: '#3D8EFF', label: 'xpack.theme.classicBlue' },
            { color: '#F0BE96', label: 'xpack.theme.lingXiaGold' },
            { color: '#238636', label: 'xpack.theme.freshGreen' },
        ];
        const defaultLightColors = [
            { color: '#005eeb', label: 'xpack.theme.classicBlue' },
            { color: '#238636', label: 'xpack.theme.freshGreen' },
        ];
        let darkColors = [...defaultDarkColors];
        let lightColors = [...defaultLightColors];
        const addColorToTheme = (
            colors: { color: string; label: string }[],
            newColor: { color: string; label: string },
            baseCount = 3,
            maxNewColors = 2,
        ): { color: string; label: string }[] => {
            const updatedColors = [...colors];
            const extraCount = Math.max(0, colors.length - baseCount);
            if (extraCount >= maxNewColors) {
                updatedColors.splice(baseCount, 1);
            }
            updatedColors.push(newColor);
            return updatedColors;
        };
        const defaultColors = {
            light: lightPredefineColors.value,
            dark: darkPredefineColors.value,
        };
        const initThemeColors = () => {
            try {
                const storedColors = localStorage.getItem(STORAGE_KEY);
                themeColors.value = storedColors ? JSON.parse(storedColors) : { ...defaultColors };
            } catch (error) {
                console.error('Failed to parse theme colors from localStorage:', error);
                themeColors.value = { ...defaultColors };
            } finally {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(themeColors.value));
            }
        };
        const themeColors = ref({ ...defaultColors });
        const acceptParams = (params: DialogProps): void => {
            form.themeColor = params.themeColor;
            form.theme = params.theme;
            form.dark = form.themeColor.dark;
            form.light = form.themeColor.light;
            if (form.themeColor.themePredefineColors) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(form.themeColor.themePredefineColors));
            }
            initThemeColors();
            lightPredefineColors.value = themeColors.value['light'];
            darkPredefineColors.value = themeColors.value['dark'];
            lightColors = defaultLightColors;
            lightPredefineColors.value.slice(0, 2).forEach((color) => {
                const exists = lightColors.some((item) => item.color === color);
                if (!exists) {
                    lightColors.push({
                        color,
                        label: `xpack.theme.customColor`,
                    });
                }
            });
            darkColors = defaultDarkColors;
            darkPredefineColors.value.slice(0, 2).forEach((color) => {
                const exists = darkColors.some((item) => item.color === color);
                if (!exists) {
                    darkColors.push({
                        color,
                        label: `xpack.theme.customColor`,
                    });
                }
            });
            drawerVisible.value = true;
        };
        const updateThemeColors = (theme: 'light' | 'dark', newColors: string[]) => {
            themeColors.value[theme] = newColors;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(themeColors.value));
            lightPredefineColors.value = themeColors.value['light'];
            darkPredefineColors.value = themeColors.value['dark'];
        };
        const addAndRemoveColor = (theme: 'light' | 'dark', newColor: string) => {
            const colors = [...themeColors.value[theme]];
            colors.unshift(newColor);
            colors.pop();
            updateThemeColors(theme, colors);
        };
        const changeThemeColor = (theme: 'light' | 'dark', color: string) => {
            if (theme === 'light') {
                form.light = color;
                const newLightColor = { color: color, label: 'xpack.theme.customColor' };
                lightColors = addColorToTheme(lightColors, newLightColor, 2);
            } else {
                form.dark = color;
                const newDarkColor = { color: color, label: 'xpack.theme.customColor' };
                darkColors = addColorToTheme(darkColors, newDarkColor);
            }
            addAndRemoveColor(theme, color);
        };
        const changeLightColor = (color: string) => {
            form.light = color;
        };
        const changeDarkColor = (color: string) => {
            form.dark = color;
        };
        const onSave = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            ElMessageBox.confirm(i18n.global.t('xpack.theme.setHelper'), i18n.global.t('commons.button.save'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
                type: 'info',
            }).then(async () => {
                await formEl.validate(async (valid) => {
                    if (!valid) return;
                    form.themeColor = { light: form.light, dark: form.dark, themePredefineColors: themeColors.value };
                    if (isXpackOrEE.value) {
                        await updateXpackSettingByKey('ThemeColor', JSON.stringify(form.themeColor));
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        themeConfig.value.themeColor = JSON.stringify(form.themeColor);
                        loading.value = false;
                        let color: string;
                        if (form.theme === 'auto') {
                            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
                            color = prefersDark.matches ? form.dark : form.light;
                        } else {
                            color = form.theme === 'dark' ? form.dark : form.light;
                        }
                        themeConfig.value.primary = color;
                        setPrimaryColor(color);
                        initFavicon();
                        drawerVisible.value = false;
                        ctx.emit('search');
                    }
                });
            });
        };
        const onReSet = async () => {
            ElMessageBox.confirm(
                i18n.global.t('xpack.theme.setDefaultHelper'),
                i18n.global.t('commons.button.setDefault'),
                {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                    type: 'info',
                },
            ).then(async () => {
                form.themeColor = { light: '#005eeb', dark: '#F0BE96', themePredefineColors: themeColors.value };
                if (isXpackOrEE.value) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultColors));
                    themeColors.value = { ...defaultColors };
                    darkColors = [...defaultDarkColors];
                    lightColors = [...defaultLightColors];
                    await updateXpackSettingByKey('ThemeColor', JSON.stringify(form.themeColor));
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    loading.value = false;
                    themeConfig.value.themeColor = JSON.stringify(form.themeColor);
                    let color: string;
                    if (form.theme === 'auto') {
                        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
                        color = prefersDark.matches ? '#F0BE96' : '#005eeb';
                    } else {
                        color = form.theme === 'dark' ? '#F0BE96' : '#005eeb';
                    }
                    themeConfig.value.primary = color;
                    setPrimaryColor(color);
                    initFavicon();
                    drawerVisible.value = false;
                }
            });
        };
        const handleClose = () => {
            drawerVisible.value = false;
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                modelValue={unref(drawerVisible)}
                onUpdate:modelValue={($v) => {
                    drawerVisible.value = $v as any;
                }}
                header={$t('xpack.theme.customColor')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="small"
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        (onReSet as any)($event);
                                    }}
                                >
                                    {$t('commons.button.setDefault')}
                                </ElButton>
                                <ElButton
                                    onClick={($event?: any) => {
                                        drawerVisible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    disabled={unref(loading)}
                                    type="primary"
                                    onClick={($event?: any) => {
                                        onSave(unref(formRef));
                                    }}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            >
                {withDirectives(
                    <ElForm
                        ref={formRef}
                        label-position="top"
                        model={form}
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                    >
                        <ElRow type="flex" justify="center">
                            <ElCol span={22}>
                                <ElFormItem label={$t('setting.light')} prop="light">
                                    <div class={'flex flex-wrap items-center justify-between sm:items-start'}>
                                        <div class={'flex gap-1'}>
                                            {(lightColors || []).map((colorConfig) => (
                                                <>
                                                    <ElTooltip content={$t(colorConfig.label)} placement="top">
                                                        <ElButton
                                                            color={colorConfig.color}
                                                            circle
                                                            dark
                                                            onClick={($event?: any) => {
                                                                changeLightColor(colorConfig.color);
                                                            }}
                                                            class={
                                                                form.light === colorConfig.color ? 'selected-white' : ''
                                                            }
                                                        />
                                                    </ElTooltip>
                                                </>
                                            ))}
                                            <ElColorPicker
                                                modelValue={form.light}
                                                onUpdate:modelValue={($v) => {
                                                    form.light = $v as any;
                                                }}
                                                predefine={unref(lightPredefineColors)}
                                                show-alpha
                                                onChange={($event?: any) => {
                                                    changeThemeColor('light', form.light);
                                                }}
                                                class={'ml-4'}
                                            />
                                        </div>
                                    </div>
                                </ElFormItem>
                                <ElFormItem label={$t('setting.dark')} prop="dark">
                                    <div class={'flex flex-wrap items-center justify-between sm:items-start'}>
                                        <div class={'mt-4 flex flex-wrap items-center justify-between sm:mt-0'}>
                                            <div class={'flex gap-1'}>
                                                {(darkColors || []).map((colorConfig) => (
                                                    <>
                                                        <ElTooltip content={$t(colorConfig.label)} placement="top">
                                                            <ElButton
                                                                color={colorConfig.color}
                                                                circle
                                                                dark
                                                                onClick={($event?: any) => {
                                                                    changeDarkColor(colorConfig.color);
                                                                }}
                                                                class={
                                                                    form.dark === colorConfig.color
                                                                        ? 'selected-white'
                                                                        : ''
                                                                }
                                                            />
                                                        </ElTooltip>
                                                    </>
                                                ))}
                                                <ElColorPicker
                                                    modelValue={form.dark}
                                                    onUpdate:modelValue={($v) => {
                                                        form.dark = $v as any;
                                                    }}
                                                    predefine={unref(darkPredefineColors)}
                                                    show-alpha
                                                    onChange={($event?: any) => {
                                                        changeThemeColor('dark', form.dark);
                                                    }}
                                                    class={'ml-4'}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </ElFormItem>
                            </ElCol>
                        </ElRow>
                    </ElForm>,
                    [[vLoading, unref(loading)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
