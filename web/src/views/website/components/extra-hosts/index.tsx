import { $t } from '@/utils/i18n-t';
interface ExtraHost {
    hostname: string;
    ip: string;
}
import { reactive } from 'vue';
import { FormRules } from 'element-plus';
import { Rules } from '@/global/form-rules';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import permissionDirective from '@/directives/modules/permission';
import { ElRow } from 'element-plus';
import { ElCol } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElButton } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
    extraHosts?: ExtraHost[];
}

const emits = {};

const options = {
    name: 'extra-hosts',
    props: {
        extraHosts: {
            type: Array<ExtraHost>,
            required: true,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const rules = reactive<FormRules>({
            value: [Rules.requiredInput],
        });
        const addEnv = () => {
            __panelSetupProps.extraHosts.push({
                hostname: '',
                ip: '',
            });
        };
        const removeEnv = (index: number) => {
            __panelSetupProps.extraHosts.splice(index, 1);
        };
        return () => (
            <div class={'mt-1.5'}>
                {(__panelSetupProps.extraHosts || []).map((volume, index) => (
                    <ElRow gutter={20} key={index}>
                        <ElCol span={7}>
                            <ElFormItem prop={`volumes.${index}.hostname`} rules={rules.hostname}>
                                <ElInput
                                    modelValue={volume.hostname}
                                    onUpdate:modelValue={($v) => {
                                        volume.hostname = $v as any;
                                    }}
                                    placeholder={$t('toolbox.device.hostname')}
                                />
                            </ElFormItem>
                        </ElCol>
                        <ElCol span={7}>
                            <ElFormItem prop={`volumes.${index}.ip`} rules={rules.ip}>
                                <ElInput
                                    modelValue={volume.ip}
                                    onUpdate:modelValue={($v) => {
                                        volume.ip = $v as any;
                                    }}
                                    placeholder={'IP'}
                                />
                            </ElFormItem>
                        </ElCol>
                        <ElCol span={4}>
                            <ElFormItem>
                                {withDirectives(
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            removeEnv(index);
                                        }}
                                        link
                                        class={'mt-1'}
                                    >
                                        {$t('commons.button.delete')}
                                    </ElButton>,
                                    [[permissionDirective, true]],
                                )}
                            </ElFormItem>
                        </ElCol>
                    </ElRow>
                ))}
                <ElRow gutter={20}>
                    <ElCol span={4}>
                        {withDirectives(
                            <ElButton
                                onClick={($event?: any) => {
                                    (addEnv as any)($event);
                                }}
                            >
                                {$t('commons.button.add')}
                            </ElButton>,
                            [[permissionDirective, true]],
                        )}
                    </ElCol>
                </ElRow>
            </div>
        );
    },
    options,
);
