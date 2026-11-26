import { $t } from '@/utils/i18n-t';
import { ref } from 'vue';
import { Units, sizeUnits } from '@/global/mimetype';
import { Rules, checkNumberRange } from '@/global/form-rules';
import { FormInstance } from 'element-plus';
import { rpc } from '@/lib/rpc';
import { MsgSuccess } from '@/utils/message';
import i18n from '@/lang';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import permissionDirective from '@/directives/modules/permission';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElSwitch } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElButton } from 'element-plus';
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
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
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
                            {withDirectives(
                                <ElButton
                                    type="primary"
                                    onClick={($event?: any) => {
                                        submit(unref(proxyForm));
                                    }}
                                    disabled={unref(loading)}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>,
                                [[permissionDirective, true]],
                            )}
                        </>
                    ),
                }}
            >
                {withDirectives(
                    <ElForm
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                        ref={proxyForm}
                        label-position="top"
                        model={req}
                        rules={rules}
                        validate-on-rule-change={false}
                    >
                        <ElFormItem label={$t('commons.button.start')} prop="open">
                            <ElSwitch
                                modelValue={req.open}
                                onUpdate:modelValue={($v) => {
                                    req.open = $v as any;
                                }}
                                disabled={unref(hasCache)}
                            />
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
                                            <ElSelect
                                                modelValue={req.cacheLimitUnit}
                                                onUpdate:modelValue={($v) => {
                                                    req.cacheLimitUnit = $v as any;
                                                }}
                                                class={'p-w-100'}
                                            >
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
                                            <ElSelect
                                                modelValue={req.shareCacheUnit}
                                                onUpdate:modelValue={($v) => {
                                                    req.shareCacheUnit = $v as any;
                                                }}
                                                class={'p-w-100'}
                                            >
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
                                            <ElSelect
                                                modelValue={req.cacheExpireUnit}
                                                onUpdate:modelValue={($v) => {
                                                    req.cacheExpireUnit = $v as any;
                                                }}
                                                class={'p-w-100'}
                                            >
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
                    </ElForm>,
                    [[vLoading, unref(loading)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
