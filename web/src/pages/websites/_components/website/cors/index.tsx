import { $t } from '@/utils/i18n-t';
interface CorsConfig {
    allowOrigins: string;
    allowMethods: string;
    allowHeaders: string;
    allowCredentials: boolean;
    preflight: boolean;
}
interface Props {
    modelValue: boolean;
    config: CorsConfig;
    enableSize: string;
}

interface CodemodProps {
    [key: string]: any;
    modelValue?: boolean;
    config?: CorsConfig;
    enableSize?: string;
}

const emits = {
    'update:modelValue': (...args: unknown[]) => true,
    'update:config': (...args: unknown[]) => true,
};

const options = {
    name: 'cors',
    props: {
        modelValue: Boolean,
        config: { type: null },
        enableSize: String,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const corsEnabled = ref(__panelSetupProps.modelValue);
        const corsConfig = ref<CorsConfig>({ ...__panelSetupProps.config });
        watch(
            () => __panelSetupProps.modelValue,
            (val) => {
                corsEnabled.value = val;
            },
        );
        watch(
            () => __panelSetupProps.config,
            (val) => {
                corsConfig.value = { ...val };
            },
            { deep: true },
        );
        const handleCorsChange = (enabled: boolean) => {
            ctx.emit('update:modelValue', enabled);

            if (enabled) {
                corsConfig.value = {
                    allowOrigins: '*',
                    allowMethods: 'GET,POST,OPTIONS,PUT,DELETE',
                    allowHeaders: '',
                    allowCredentials: false,
                    preflight: true,
                };
            } else {
                corsConfig.value = {
                    allowOrigins: '',
                    allowMethods: '',
                    allowHeaders: '',
                    allowCredentials: false,
                    preflight: true,
                };
            }
            emitUpdate();
        };
        const emitUpdate = () => {
            ctx.emit('update:config', corsConfig.value);
        };
        return () => (
            <div>
                {__panelSetupProps.enableSize == 'large' ? (
                    <div class={'flex items-center justify-between py-3'}>
                        <div class={'flex flex-col gap-1'}>
                            <span class={'font-medium'}>{$t('website.enableCors')}</span>
                        </div>
                        {
                            <ElSwitch
                                v-model={corsEnabled.value}
                                size="large"
                                onChange={($event?: any) => {
                                    (handleCorsChange as any)($event);
                                }}
                                v-permission={true}
                            />
                        }
                    </div>
                ) : null}
                {__panelSetupProps.enableSize == 'small' ? (
                    <ElFormItem label={$t('website.enableCors')}>
                        {
                            <ElSwitch
                                v-model={corsEnabled.value}
                                size="large"
                                onChange={($event?: any) => {
                                    (handleCorsChange as any)($event);
                                }}
                                v-permission={true}
                            />
                        }
                    </ElFormItem>
                ) : null}
                <ElCollapseTransition>
                    {unref(corsEnabled) ? (
                        <div class={'mt-4'}>
                            <ElFormItem label={$t('website.allowOrigins')} prop="allowOrigins">
                                <ElInput
                                    v-model={unref(corsConfig).allowOrigins}
                                    type="textarea"
                                    placeholder="*"
                                    onInput={($event?: any) => {
                                        (emitUpdate as any)($event);
                                    }}
                                />
                            </ElFormItem>
                            <ElFormItem label={$t('website.allowMethods')} prop="allowMethods">
                                <ElInput
                                    v-model={unref(corsConfig).allowMethods}
                                    type="textarea"
                                    placeholder="GET,POST,OPTIONS,PUT,DELETE"
                                    onInput={($event?: any) => {
                                        (emitUpdate as any)($event);
                                    }}
                                />
                            </ElFormItem>
                            <ElFormItem label={$t('website.allowHeaders')} prop="allowHeaders">
                                <ElInput
                                    v-model={unref(corsConfig).allowHeaders}
                                    type="textarea"
                                    onInput={($event?: any) => {
                                        (emitUpdate as any)($event);
                                    }}
                                />
                            </ElFormItem>
                            <ElFormItem label={$t('website.allowCredentials')} prop="allowCredentials">
                                {
                                    <ElSwitch
                                        v-model={unref(corsConfig).allowCredentials}
                                        onChange={($event?: any) => {
                                            (emitUpdate as any)($event);
                                        }}
                                        v-permission={true}
                                    />
                                }
                            </ElFormItem>
                            <ElFormItem label={$t('website.preflight')} prop="preflight">
                                {
                                    <ElSwitch
                                        v-model={unref(corsConfig).preflight}
                                        onChange={($event?: any) => {
                                            (emitUpdate as any)($event);
                                        }}
                                        v-permission={true}
                                    />
                                }
                                <span class={'input-help'}>{$t('website.preflightHleper')}</span>
                            </ElFormItem>
                        </div>
                    ) : null}
                </ElCollapseTransition>
            </div>
        );
    },
    options,
);
