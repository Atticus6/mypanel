import { $t } from '@/utils/i18n-t';
import MarkDownEditor from '@/components/mkdown-editor/index';
import { rpc } from '@/lib/rpc';
import { ref } from 'vue';
import { FormInstance } from 'element-plus';
import { MsgSuccess } from '@/utils/message';
import i18n from '@/lang';
import { Rules } from '@/global/form-rules';
import { useGlobalStore } from '@/composables/useGlobalStore';
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElInputNumber } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElCollapse } from 'element-plus';
import { ElCollapseItem } from 'element-plus';
import { ElEmpty } from 'element-plus';
import { ElLink } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';
import CopyButton from '@/components/copy-button/index';
import SvgIcon from '@/components/svg-icon/svg-icon';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'releases',
    props: {},
    emits: emits,
    __scopeId: 'data-v-e952c508',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isMobile } = useGlobalStore();
        const drawerVisible = ref(false);
        const currentVersion = ref(0);
        const notes = ref([]);
        const loading = ref();
        const formRef = ref();
        const form = reactive({
            version: '',
            backupCopies: 0,
        });
        const rules = reactive({
            version: [Rules.requiredInput],
            backupCopies: [Rules.integerNumberWith0],
        });
        const acceptParams = (): void => {
            search();
            loadInfo();
            drawerVisible.value = true;
        };
        const loadInfo = async () => {
            const res = await rpc.core.setting.getBaseInfo({});
            form.version = res.systemVersion;
            form.backupCopies = Number(res.upgradeBackupCopies) || 0;
        };
        const onSave = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                loading.value = true;
                await rpc.core.setting
                    .updateSetting({ key: 'UpgradeBackupCopies', value: form.backupCopies + '' })
                    .then(() => {
                        loading.value = false;
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    })
                    .finally(() => {
                        loading.value = false;
                    });
            });
        };
        const handleClose = () => {
            drawerVisible.value = false;
        };
        const openReleasesPage = () => {
            window.open('https://github.com/Atticus6/mypanel/releases', '_blank', 'noopener,noreferrer');
        };
        const search = async () => {
            loading.value = true;
            await rpc.core.setting
                .listReleases({})
                .then((res) => {
                    notes.value = res.items || [];
                    loading.value = false;
                })
                .catch(() => {
                    loading.value = false;
                });
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
                header={$t('setting.release')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="large"
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        drawerVisible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            >
                {withDirectives(
                    <div class={'note'}>
                        <ElForm ref={formRef} model={form} rules={rules}>
                            <div class={'release-settings'}>
                                <ElFormItem
                                    label={$t('setting.versionItem')}
                                    prop="version"
                                    class={'compact-form-item'}
                                >
                                    <div class={'setting-control'}>
                                        <ElInput
                                            disabled
                                            modelValue={form.version}
                                            onUpdate:modelValue={($v) => {
                                                form.version = $v as any;
                                            }}
                                        />
                                        <CopyButton
                                            isIcon={false}
                                            content={form.version}
                                            type="primary"
                                            class={'setting-action-btn'}
                                        />
                                    </div>
                                </ElFormItem>
                                <ElFormItem
                                    label={$t('setting.backupCopies')}
                                    prop="backupCopies"
                                    class={'compact-form-item'}
                                >
                                    <div class={'setting-control'}>
                                        <ElInputNumber
                                            modelValue={form.backupCopies}
                                            onUpdate:modelValue={($v) => {
                                                form.backupCopies = $v as any;
                                            }}
                                            min={0}
                                            controls-position="right"
                                        />
                                        <ElButton
                                            onClick={($event?: any) => {
                                                onSave(unref(formRef));
                                            }}
                                            type="primary"
                                            class={'setting-action-btn'}
                                        >
                                            {$t('commons.button.save')}
                                        </ElButton>
                                    </div>
                                    <span class={'input-help'}>{$t('setting.backupCopiesHelper')}</span>
                                </ElFormItem>
                            </div>
                        </ElForm>
                        {unref(notes) && unref(notes).length !== 0 ? (
                            <ElCollapse
                                modelValue={unref(currentVersion)}
                                onUpdate:modelValue={($v) => {
                                    currentVersion.value = $v as any;
                                }}
                                accordion={true}
                            >
                                {(unref(notes) || []).map((item, index) => (
                                    <div key={index}>
                                        <ElCollapseItem
                                            name={index}
                                            v-slots={{
                                                title: () => (
                                                    <>
                                                        <span class={'version'}>{item.version}</span>
                                                        {!unref(isMobile) ? (
                                                            <span class={'date'}>{item.createdAt}</span>
                                                        ) : null}
                                                        <SvgIcon iconName="p-featureshitu" class={'icon'} />
                                                        <span class={'icon-span'}>{item.newCount}</span>
                                                        <SvgIcon iconName="p-youhuawendang" class={'icon'} />
                                                        <span class={'icon-span'}>{item.optimizationCount}</span>
                                                        <SvgIcon iconName="p-bug" class={'icon'} />
                                                        <span class={'icon-span'}>{item.fixCount}</span>
                                                    </>
                                                ),
                                            }}
                                        >
                                            <div class={'panel-MdEditor'}>
                                                <MarkDownEditor content={item.content} />
                                            </div>
                                        </ElCollapseItem>
                                    </div>
                                ))}
                            </ElCollapse>
                        ) : (
                            <ElEmpty
                                v-slots={{
                                    description: () => (
                                        <>
                                            <span class={'input-help'}>
                                                {$t('setting.releaseHelper')}
                                                <ElLink
                                                    icon="Position"
                                                    type="primary"
                                                    onClick={($event?: any) => {
                                                        (openReleasesPage as any)($event);
                                                    }}
                                                    class={'pageRoute'}
                                                >
                                                    {$t('firewall.quickJump')}
                                                </ElLink>
                                            </span>
                                        </>
                                    ),
                                }}
                            />
                        )}
                    </div>,
                    [[vLoading, unref(loading)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
