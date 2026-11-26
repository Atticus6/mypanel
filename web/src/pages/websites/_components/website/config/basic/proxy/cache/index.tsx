import { $t } from '@/utils/i18n-t';
import { Units, sizeUnits } from '@/global/mimetype';
import { Rules, checkNumberRange } from '@/global/form-rules';
import { rpc } from '@/lib/rpc';
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
        const open = ref(false);
        const loading = ref(false);
        const proxyForm = ref<FormInstance>();
        const hasCache = ref(false);
        const req = reactive({
            open: false,
            cacheLimit: 1,
            cacheLimitUnit: 'g',
            shareCache: 5,
            shareCacheUnit: 'm',
            cacheExpire: 24,
            cacheExpireUnit: 'h',
            websiteID: 0,
        });
        const rules = {
            cacheLimit: [Rules.requiredInput, checkNumberRange(0, 9999)],
            shareCache: [Rules.requiredInput, checkNumberRange(0, 9999)],
            cacheExpire: [Rules.requiredInput, checkNumberRange(0, 9999)],
        };
        const handleClose = () => {
            open.value = false;
        };
        const acceptParams = (websiteID: number, cache: boolean) => {
            req.websiteID = websiteID;
            hasCache.value = cache;
            get();
            open.value = true;
        };
        const get = async () => {
            try {
                const res = await rpc.website.getProxyCache({ id: req.websiteID });
                req.open = res.open;
                if (req.open) {
                    req.cacheLimit = res.cacheLimit;
                    req.cacheLimitUnit = res.cacheLimitUnit;
                    req.shareCache = res.shareCache;
                    req.shareCacheUnit = res.shareCacheUnit;
                    req.cacheExpire = res.cacheExpire;
                    req.cacheExpireUnit = res.cacheExpireUnit;
                }
            } catch (error) {}
        };
        const submit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            await formEl.validate(async (valid) => {
                if (!valid) {
                    return;
                }
                try {
                    await rpc.website.updateProxyCache({
                        websiteId: req.websiteID,
                        open: req.open,
                        cacheLimit: req.cacheLimit,
                        cacheLimitUnit: req.cacheLimitUnit,
                        shareCache: req.shareCache,
                        shareCacheUnit: req.shareCacheUnit,
                        cacheExpire: req.cacheExpire,
                        cacheExpireUnit: req.cacheExpireUnit,
                    });
                    MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                    handleClose();
                } catch (error) {}
            });
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                v-model={open.value}
                header={$t('website.proxyCache')}
                size="normal"
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                v-slots={{
                    footer: () => (
                        <>
                            <ElButton
                                onClick={($event?: any) => {
                                    (handleClose as any)($event);
                                }}
                                disabled={unref(loading)}
                            >
                                {$t('commons.button.cancel')}
                            </ElButton>
                            {
                                <ElButton
                                    type="primary"
                                    onClick={($event?: any) => {
                                        submit(unref(proxyForm));
                                    }}
                                    disabled={unref(loading)}
                                    v-permission={true}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            }
                        </>
                    ),
                }}
            >
                {
                    <ElForm
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                        ref={proxyForm}
                        label-position="top"
                        model={req}
                        rules={rules}
                        validate-on-rule-change={false}
                        v-loading={unref(loading)}
                    >
                        <ElFormItem label={$t('commons.button.start')} prop="open">
                            <ElSwitch v-model={req.open} disabled={unref(hasCache)} />
                            {unref(hasCache) ? <span class={'input-help'}>{$t('website.cacheWarn')}</span> : null}
                        </ElFormItem>
                        <ElFormItem label={$t('website.cacheLimit')} prop="cacheLimit">
                            <ElInput
                                modelValue={req.cacheLimit}
                                onUpdate:modelValue={($v) => {
                                    req.cacheLimit = $v === '' ? $v : Number($v);
                                }}
                                class={'p-w-200'}
                                v-slots={{
                                    append: () => (
                                        <>
                                            <ElSelect v-model={req.cacheLimitUnit} class={'p-w-100'}>
                                                {(sizeUnits || []).map((unit, index) => (
                                                    <ElOption label={unit.label} value={unit.value} key={index} />
                                                ))}
                                            </ElSelect>
                                        </>
                                    ),
                                }}
                            />
                            <span class={'input-help'}>{$t('website.cacheLimitHelper')}</span>
                        </ElFormItem>
                        <ElFormItem label={$t('website.shareCache')} prop="shareCache">
                            <ElInput
                                modelValue={req.shareCache}
                                onUpdate:modelValue={($v) => {
                                    req.shareCache = $v === '' ? $v : Number($v);
                                }}
                                class={'p-w-200'}
                                v-slots={{
                                    append: () => (
                                        <>
                                            <ElSelect v-model={req.shareCacheUnit} class={'p-w-100'}>
                                                {(sizeUnits || []).map((unit, index) => (
                                                    <ElOption label={unit.label} value={unit.value} key={index} />
                                                ))}
                                            </ElSelect>
                                        </>
                                    ),
                                }}
                            />
                            <span class={'input-help'}>{$t('website.shareCacheHelper')}</span>
                        </ElFormItem>
                        <ElFormItem label={$t('website.cacheExpire')} prop="cacheExpire">
                            <ElInput
                                modelValue={req.cacheExpire}
                                onUpdate:modelValue={($v) => {
                                    req.cacheExpire = $v === '' ? $v : Number($v);
                                }}
                                class={'p-w-200'}
                                v-slots={{
                                    append: () => (
                                        <>
                                            <ElSelect v-model={req.cacheExpireUnit} class={'p-w-100'}>
                                                {(Units || []).map((unit, index) => (
                                                    <ElOption label={unit.label} value={unit.value} key={index} />
                                                ))}
                                            </ElSelect>
                                        </>
                                    ),
                                }}
                            />
                            <span class={'input-help'}>{$t('website.cacheExpireJHelper')}</span>
                        </ElFormItem>
                    </ElForm>
                }
            </DrawerPro>
        );
    },
    options,
);
