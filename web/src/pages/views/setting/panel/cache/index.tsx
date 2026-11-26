import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { applyPanelCacheSettings, defaultPanelCache } from '@/utils/panel-cache';
import { MsgSuccess } from '@/utils/message';
import i18n from '@/lang';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'cache',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { panelCache, isMobile } = useGlobalStore();
        const visible = ref(false);
        const loading = ref(false);
        const form = reactive({ ...defaultPanelCache });
        const categories = ['tabs', 'pagination', 'refresh', 'search'] as const;
        const durations = ['24h', 'week', 'month', 'forever'] as const;
        const acceptParams = () => {
            Object.assign(form, panelCache.value);
            visible.value = true;
        };
        const save = async () => {
            loading.value = true;
            try {
                const value = JSON.stringify(form);
                await rpc.core.setting.updateSetting({ key: 'PanelCache', value });
                applyPanelCacheSettings(value);
                visible.value = false;
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            } finally {
                loading.value = false;
            }
        };
        ctx.expose({ acceptParams });
        return () => (
            <DrawerPro
                modelValue={unref(visible)}
                onUpdate:modelValue={($v) => {
                    visible.value = $v as any;
                }}
                header={$t('setting.panelCache.title')}
                size="normal"
                v-slots={{
                    footer: () => (
                        <>
                            <ElButton
                                disabled={unref(loading)}
                                onClick={($event?: any) => {
                                    Object.assign(form, defaultPanelCache);
                                }}
                            >
                                {$t('commons.button.setDefault')}
                            </ElButton>
                            <ElButton
                                disabled={unref(loading)}
                                onClick={($event?: any) => {
                                    visible.value = false;
                                }}
                            >
                                {$t('commons.button.cancel')}
                            </ElButton>
                            <ElButton
                                loading={unref(loading)}
                                type="primary"
                                onClick={($event?: any) => {
                                    (save as any)($event);
                                }}
                            >
                                {$t('commons.button.confirm')}
                            </ElButton>
                        </>
                    ),
                }}
            >
                <ElCard shadow="never">
                    {(categories || []).map((key) => (
                        <div class={'flex items-center justify-between py-3'} key={key}>
                            <span>{$t(`setting.panelCache.${key}`)}</span>
                            <ElSwitch
                                modelValue={form[key]}
                                onUpdate:modelValue={($v) => {
                                    form[key] = $v as any;
                                }}
                                aria-label={$t(`setting.panelCache.${key}`)}
                            />
                        </div>
                    ))}
                    <div class={'mt-4 flex items-center justify-between gap-4'}>
                        <div class={'flex shrink-0 items-center gap-2'}>
                            <span>{$t('setting.panelCache.duration')}</span>
                            <ElTooltip
                                content={$t('setting.panelCache.helper')}
                                placement="top"
                                trigger={unref(isMobile) ? 'click' : 'hover'}
                                popper-style={{ maxWidth: 'min(360px, calc(100vw - 32px))' }}
                            >
                                <ElButton
                                    link
                                    type="info"
                                    icon="InfoFilled"
                                    aria-label={$t('setting.panelCache.helper')}
                                    onClick={($event?: any) => {
                                        $event.stopPropagation();
                                    }}
                                    class={'!ml-0 shrink-0'}
                                />
                            </ElTooltip>
                        </div>
                        <ElSelect
                            modelValue={form.duration}
                            onUpdate:modelValue={($v) => {
                                form.duration = $v as any;
                            }}
                            aria-label={$t('setting.panelCache.duration')}
                            class={'!w-40 min-w-0'}
                        >
                            {(durations || []).map((value) => (
                                <ElOption value={value} label={$t(`setting.panelCache.${value}`)} key={value} />
                            ))}
                        </ElSelect>
                    </div>
                </ElCard>
            </DrawerPro>
        );
    },
    options,
);
