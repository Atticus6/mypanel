import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import { Rules } from '@/global/form-rules';
import { MsgError, MsgSuccess } from '@/utils/message';
import { routerToName } from '@/utils/router';
type FormInstance = InstanceType<typeof ElForm>;

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'expired',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        let isComplexity = ref(false);
        const passFormRef = ref<FormInstance>();
        const passRules = reactive({
            oldPass: [Rules.requiredInput, Rules.noSpace],
            newPass: [Rules.requiredInput, Rules.noSpace],
            newPassComplexity: [Rules.requiredInput, Rules.noSpace, Rules.password],
            rePass: [Rules.requiredInput, Rules.noSpace, { validator: checkPasswordSame, trigger: 'blur' }],
        });
        const passForm = reactive({
            oldPass: '',
            newPass: '',
            newPassComplexity: '',
            rePass: '',
        });
        function checkPasswordSame(rule: any, value: any, callback: any) {
            let password = !isComplexity.value ? passForm.newPass : passForm.newPassComplexity;
            if (password !== passForm.rePass) {
                return callback(new Error(i18n.global.t('commons.rule.rePassword')));
            }
            callback();
        }
        const submitChangePassword = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                let password = !isComplexity.value ? passForm.newPass : passForm.newPassComplexity;
                if (password === passForm.oldPass) {
                    MsgError(i18n.global.t('setting.duplicatePassword'));
                    return;
                }
                await rpc.core.auth.resetExpiredPassword({ oldPassword: passForm.oldPass, newPassword: password });
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                routerToName('home');
            });
        };
        const search = async () => {
            const res = await rpc.core.setting.getBaseInfo({});
            let settingForm = res;
            isComplexity.value = settingForm?.complexityVerification === 'Enable';
        };
        onMounted(() => {
            search();
        });
        return () => (
            <div>
                <ElCard
                    style={'margin-top: 20px'}
                    v-slots={{
                        header: () => (
                            <>
                                <div class={'card-header'}>
                                    <span style={'font-size: 14px; font-weight: 500'}>
                                        {$t('setting.expiredHelper')}
                                    </span>
                                </div>
                            </>
                        ),
                    }}
                >
                    <ElRow>
                        <ElCol span={1}>
                            <br />
                        </ElCol>
                        <ElCol span={10}>
                            <ElForm
                                model={passForm}
                                ref={passFormRef}
                                rules={passRules}
                                label-position="left"
                                label-width="160px"
                            >
                                <ElFormItem label={$t('setting.oldPassword')} prop="oldPass">
                                    <ElInput
                                        type="password"
                                        show-password
                                        clearable
                                        modelValue={passForm.oldPass}
                                        onUpdate:modelValue={($v) => {
                                            passForm.oldPass = typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                                {!unref(isComplexity) ? (
                                    <ElFormItem label={$t('setting.newPassword')} prop="newPass">
                                        <ElInput
                                            type="password"
                                            show-password
                                            clearable
                                            modelValue={passForm.newPass}
                                            onUpdate:modelValue={($v) => {
                                                passForm.newPass = typeof $v === 'string' ? $v.trim() : $v;
                                            }}
                                        />
                                    </ElFormItem>
                                ) : null}
                                {unref(isComplexity) ? (
                                    <ElFormItem label={$t('setting.newPassword')} prop="newPassComplexity">
                                        <ElInput
                                            type="password"
                                            show-password
                                            clearable
                                            modelValue={passForm.newPassComplexity}
                                            onUpdate:modelValue={($v) => {
                                                passForm.newPassComplexity = typeof $v === 'string' ? $v.trim() : $v;
                                            }}
                                        />
                                    </ElFormItem>
                                ) : null}
                                <ElFormItem label={$t('setting.retryPassword')} prop="rePass">
                                    <ElInput
                                        type="password"
                                        show-password
                                        clearable
                                        modelValue={passForm.rePass}
                                        onUpdate:modelValue={($v) => {
                                            passForm.rePass = typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                                <ElFormItem>
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            submitChangePassword(unref(passFormRef));
                                        }}
                                    >
                                        {$t('commons.button.confirm')}
                                    </ElButton>
                                </ElFormItem>
                            </ElForm>
                        </ElCol>
                    </ElRow>
                </ElCard>
            </div>
        );
    },
    options,
);
