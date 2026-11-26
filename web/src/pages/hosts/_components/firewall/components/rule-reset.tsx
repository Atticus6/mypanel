import { $t } from '@/utils/i18n-t';
import DialogPro from '@/components/dialog-pro/index';
import './rule-reset.styles.css';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    confirm: (arg0?: boolean) => true,
};

const options = {
    name: 'rule-reset',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const visible = ref(false);
        const provider = ref('');
        const message = ref('');
        const backup = ref(true);
        const confirmation = ref('');
        const acceptParams = (params: { provider: string; message: string }) => {
            provider.value = params.provider;
            message.value = params.message;
            backup.value = true;
            confirmation.value = '';
            visible.value = true;
        };
        const submit = () => {
            if (!visible.value || !provider.value || confirmation.value !== provider.value) return;
            visible.value = false;
            ctx.emit('confirm', backup.value);
        };
        ctx.expose({ acceptParams });
        return () => (
            <DialogPro
                modelValue={unref(visible)}
                onUpdate:modelValue={($v) => {
                    visible.value = $v as any;
                }}
                title={$t('commons.button.reset')}
                class={'firewall-rule-dialog'}
                v-slots={{
                    content: () => (
                        <>
                            <div class={'firewall-rule-dialog__content'}>
                                <ElAlert title={unref(message)} type="warning" closable={false} show-icon />
                                <ElRadioGroup
                                    modelValue={unref(backup)}
                                    onUpdate:modelValue={($v) => {
                                        backup.value = $v as any;
                                    }}
                                    class={'firewall-rule-dialog__choices'}
                                >
                                    <ElRadio value={true} border>
                                        <span class={'firewall-rule-dialog__choice-title'}>
                                            {$t('firewall.resetWithBackup')}
                                        </span>
                                        <span class={'firewall-rule-dialog__choice-description'}>
                                            {$t('firewall.resetWithBackupHelper')}
                                        </span>
                                    </ElRadio>
                                    <ElRadio value={false} border>
                                        <span class={'firewall-rule-dialog__choice-title'}>
                                            {$t('firewall.resetOnly')}
                                        </span>
                                        <span class={'firewall-rule-dialog__choice-description'}>
                                            {$t('firewall.resetOnlyHelper')}
                                        </span>
                                    </ElRadio>
                                </ElRadioGroup>
                                <div class={'firewall-rule-dialog__confirmation'}>
                                    <label for="firewall-reset-confirmation">
                                        {$t('commons.msg.operateConfirm')}
                                        <code>{unref(provider)}</code>
                                    </label>
                                    <ElInput
                                        id="firewall-reset-confirmation"
                                        modelValue={unref(confirmation)}
                                        onUpdate:modelValue={($v) => {
                                            confirmation.value = $v as any;
                                        }}
                                        placeholder={unref(provider)}
                                        autocomplete="off"
                                        onKeyup={($event?: any) => {
                                            if (!($event.key === 'Enter')) return;
                                            (submit as any)($event);
                                        }}
                                    />
                                </div>
                            </div>
                        </>
                    ),
                    footer: () => (
                        <>
                            <ElButton
                                onClick={($event?: any) => {
                                    visible.value = false;
                                }}
                            >
                                {$t('commons.button.cancel')}
                            </ElButton>
                            <ElButton
                                type="primary"
                                disabled={unref(confirmation) !== unref(provider)}
                                onClick={($event?: any) => {
                                    (submit as any)($event);
                                }}
                            >
                                {$t('commons.button.reset')}
                            </ElButton>
                        </>
                    ),
                }}
            />
        );
    },
    options,
);
