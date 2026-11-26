import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { getRandomStr } from '@/utils/id';
import { clearDashboardCacheByPrefix } from '@/utils/dashboardCache';
interface DialogProps {
    securityEntrance: string;
}
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'entrance',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { entrance, showEntranceWarn } = useGlobalStore();
        const drawerVisible = ref();
        const loading = ref();
        const show = ref();
        const form = reactive({
            securityEntrance: '',
        });
        const formRef = ref<FormInstance>();
        const rules = reactive({
            securityEntrance: [{ validator: checkSecurityEntrance, trigger: 'blur' }],
        });
        function checkSecurityEntrance(rule: any, value: any, callback: any) {
            if (form.securityEntrance !== '') {
                const reg = /^[A-Za-z0-9]{5,116}$/;
                if (!reg.test(form.securityEntrance)) {
                    return callback(new Error(i18n.global.t('setting.entranceError')));
                }
            }
            callback();
        }
        const acceptParams = (params: DialogProps): void => {
            form.securityEntrance = params.securityEntrance;
            show.value = showEntranceWarn.value;
            drawerVisible.value = true;
        };
        const random = async () => {
            form.securityEntrance = getRandomStr(10);
        };
        const submitEntrance = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                let param = {
                    key: 'SecurityEntrance',
                    value: form.securityEntrance,
                };
                loading.value = true;
                await rpc.core.setting
                    .updateSetting(param)
                    .then(() => {
                        clearDashboardCacheByPrefix(['safeStatus']);
                        showEntranceWarn.value = show.value;
                        entrance.value = form.securityEntrance;
                        loading.value = false;
                        drawerVisible.value = false;
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        ctx.emit('search');
                    })
                    .catch(() => {
                        loading.value = false;
                    });
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
                header={$t('setting.entrance')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="small"
                v-slots={{
                    footer: () => (
                        <>
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
                                    submitEntrance(unref(formRef));
                                }}
                            >
                                {$t('commons.button.confirm')}
                            </ElButton>
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
                        rules={rules}
                    >
                        <ElFormItem label={$t('setting.entrance')} prop="securityEntrance">
                            <ElInput
                                clearable
                                modelValue={form.securityEntrance}
                                onUpdate:modelValue={($v) => {
                                    form.securityEntrance = $v as any;
                                }}
                                v-slots={{
                                    append: () => (
                                        <>
                                            <ElButton
                                                onClick={($event?: any) => {
                                                    (random as any)($event);
                                                }}
                                            >
                                                {$t('setting.randomGenerate')}
                                            </ElButton>
                                        </>
                                    ),
                                }}
                            />
                            <span class={'input-help'}>{$t('setting.entranceInputHelper')}</span>
                        </ElFormItem>
                        <ElFormItem>
                            <ElCheckbox
                                modelValue={unref(show)}
                                onUpdate:modelValue={($v) => {
                                    show.value = $v as any;
                                }}
                                label={$t('setting.showEntrance')}
                            />
                        </ElFormItem>
                    </ElForm>,
                    [[vLoading, unref(loading)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
