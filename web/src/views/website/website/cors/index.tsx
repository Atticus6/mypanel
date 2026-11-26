import { $t } from '@/utils/i18n-t';
import { ref, watch } from 'vue';
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
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import permissionDirective from '@/directives/modules/permission';
import { ElSwitch } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElCollapseTransition } from 'element-plus';
import { ElInput } from 'element-plus';

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
                    <div class={'flex justify-between items-center py-3'}>
                        <div class={'flex flex-col gap-1'}>
                            <span class={'font-medium'}>{$t('website.enableCors')}</span>
                        </div>
                        {withDirectives(
                            <ElSwitch
                                modelValue={unref(corsEnabled)}
                                onUpdate:modelValue={($v) => {
                                    corsEnabled.value = $v as any;
                                }}
                                size="large"
                                onChange={($event?: any) => {
                                    (handleCorsChange as any)($event);
                                }}
                            />,
                            [[permissionDirective, true]],
                        )}
                    </div>
                ) : null}
                {__panelSetupProps.enableSize == 'small' ? (
                    <ElFormItem label={$t('website.enableCors')}>
                        {withDirectives(
                            <ElSwitch
                                modelValue={unref(corsEnabled)}
                                onUpdate:modelValue={($v) => {
                                    corsEnabled.value = $v as any;
                                }}
                                size="large"
                                onChange={($event?: any) => {
                                    (handleCorsChange as any)($event);
                                }}
                            />,
                            [[permissionDirective, true]],
                        )}
                    </ElFormItem>
                ) : null}
                <ElCollapseTransition>
                    {unref(corsEnabled) ? (
                        <div class={'mt-4'}>
                            <ElFormItem label={$t('website.allowOrigins')} prop="allowOrigins">
                                <ElInput
                                    modelValue={unref(corsConfig).allowOrigins}
                                    onUpdate:modelValue={($v) => {
                                        unref(corsConfig).allowOrigins = $v as any;
                                    }}
                                    type="textarea"
                                    placeholder="*"
                                    onInput={($event?: any) => {
                                        (emitUpdate as any)($event);
                                    }}
                                />
                            </ElFormItem>
                            <ElFormItem label={$t('website.allowMethods')} prop="allowMethods">
                                <ElInput
                                    modelValue={unref(corsConfig).allowMethods}
                                    onUpdate:modelValue={($v) => {
                                        unref(corsConfig).allowMethods = $v as any;
                                    }}
                                    type="textarea"
                                    placeholder="GET,POST,OPTIONS,PUT,DELETE"
                                    onInput={($event?: any) => {
                                        (emitUpdate as any)($event);
                                    }}
                                />
                            </ElFormItem>
                            <ElFormItem label={$t('website.allowHeaders')} prop="allowHeaders">
                                <ElInput
                                    modelValue={unref(corsConfig).allowHeaders}
                                    onUpdate:modelValue={($v) => {
                                        unref(corsConfig).allowHeaders = $v as any;
                                    }}
                                    type="textarea"
                                    onInput={($event?: any) => {
                                        (emitUpdate as any)($event);
                                    }}
                                />
                            </ElFormItem>
                            <ElFormItem label={$t('website.allowCredentials')} prop="allowCredentials">
                                {withDirectives(
                                    <ElSwitch
                                        modelValue={unref(corsConfig).allowCredentials}
                                        onUpdate:modelValue={($v) => {
                                            unref(corsConfig).allowCredentials = $v as any;
                                        }}
                                        onChange={($event?: any) => {
                                            (emitUpdate as any)($event);
                                        }}
                                    />,
                                    [[permissionDirective, true]],
                                )}
                            </ElFormItem>
                            <ElFormItem label={$t('website.preflight')} prop="preflight">
                                {withDirectives(
                                    <ElSwitch
                                        modelValue={unref(corsConfig).preflight}
                                        onUpdate:modelValue={($v) => {
                                            unref(corsConfig).preflight = $v as any;
                                        }}
                                        onChange={($event?: any) => {
                                            (emitUpdate as any)($event);
                                        }}
                                    />,
                                    [[permissionDirective, true]],
                                )}
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
