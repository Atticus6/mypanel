import { $t } from '@/utils/i18n-t';
interface ExtraHost {
    hostname: string;
    ip: string;
}
import { Rules } from '@/global/form-rules';

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
                                <ElInput v-model={volume.hostname} placeholder={$t('toolbox.device.hostname')} />
                            </ElFormItem>
                        </ElCol>
                        <ElCol span={7}>
                            <ElFormItem prop={`volumes.${index}.ip`} rules={rules.ip}>
                                <ElInput v-model={volume.ip} placeholder={'IP'} />
                            </ElFormItem>
                        </ElCol>
                        <ElCol span={4}>
                            <ElFormItem>
                                {
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            removeEnv(index);
                                        }}
                                        link
                                        class={'mt-1'}
                                        v-permission={true}
                                    >
                                        {$t('commons.button.delete')}
                                    </ElButton>
                                }
                            </ElFormItem>
                        </ElCol>
                    </ElRow>
                ))}
                <ElRow gutter={20}>
                    <ElCol span={4}>
                        {
                            <ElButton
                                onClick={($event?: any) => {
                                    (addEnv as any)($event);
                                }}
                                v-permission={true}
                            >
                                {$t('commons.button.add')}
                            </ElButton>
                        }
                    </ElCol>
                </ElRow>
            </div>
        );
    },
    options,
);
