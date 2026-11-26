import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import Upgrade from '@/components/system-upgrade/upgrade/index';
import Releases from '@/components/system-upgrade/releases/index';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { onMounted, ref } from 'vue';
import { useGlobalStore } from '@/composables/useGlobalStore';
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElLink } from 'element-plus';
import { ElBadge } from 'element-plus';
import { ElTag } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'system-upgrade',
    props: {},
    emits: emits,
    __scopeId: 'data-v-f8a0df33',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isOffline, isMasterPro, isEE, isIntl, isAdmin, hasNewVersion } = useGlobalStore();
        const upgradeRef = ref();
        const releasesRef = ref();
        const version = ref<string>('');
        const loading = ref(false);
        const upgradeInfo = ref();
        const upgradeVersion = ref();
        const search = async () => {
            const res = await rpc.core.setting.getBaseInfo({});
            version.value = res.systemVersion;
        };
        const getVersionLog = () => {
            if (isOffline.value) {
                return;
            }
            releasesRef.value.acceptParams();
        };
        const toLxware = () => {
            if (!isIntl.value) {
                window.open('https://www.lxware.cn/1panel' + '', '_blank', 'noopener,noreferrer');
            } else {
                window.open('https://1panel.pro/pricing' + '', '_blank', 'noopener,noreferrer');
            }
        };
        const to1Panel = () => {
            let url = isIntl.value ? 'https://1panel.pro' : 'https://1panel.cn';
            window.open(url, '_blank', 'noopener,noreferrer');
        };
        const toEdition = () => {
            if (!isIntl.value) {
                window.open('https://1panel.cn/versions.html' + '', '_blank', 'noopener,noreferrer');
            } else {
                window.open('https://1panel.pro/pricing' + '', '_blank', 'noopener,noreferrer');
            }
        };
        const onLoadUpgradeInfo = async () => {
            loading.value = true;
            await rpc.core.setting
                .getUpgradeInfo({})
                .then((res) => {
                    loading.value = false;
                    if (res.testVersion || res.newVersion || res.latestVersion) {
                        upgradeInfo.value = res;
                        if (upgradeInfo.value.latestVersion) {
                            upgradeVersion.value = upgradeInfo.value.latestVersion;
                        } else if (upgradeInfo.value.testVersion) {
                            upgradeVersion.value = upgradeInfo.value.testVersion;
                        } else if (upgradeInfo.value.newVersion) {
                            upgradeVersion.value = upgradeInfo.value.newVersion;
                        }
                        upgradeRef.value.acceptParams({
                            upgradeInfo: upgradeInfo.value,
                            upgradeVersion: upgradeVersion.value,
                        });
                    } else {
                        MsgSuccess(i18n.global.t('setting.noUpgrade'));
                        return;
                    }
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        onMounted(() => {
            search();
        });
        return () => (
            <div>
                <div class={'flex flex-wrap items-center'}>
                    <div class={'flex flex-wrap items-center'}>
                        {unref(isEE) ? (
                            <ElLink
                                underline="never"
                                type="primary"
                                onClick={($event?: any) => {
                                    (toEdition as any)($event);
                                }}
                            >
                                {$t('license.ee')}
                            </ElLink>
                        ) : unref(isMasterPro) ? (
                            <ElLink
                                underline="never"
                                type="primary"
                                onClick={($event?: any) => {
                                    (toLxware as any)($event);
                                }}
                            >
                                {$t('license.pro')}
                            </ElLink>
                        ) : unref(isOffline) ? (
                            <ElLink
                                underline="never"
                                type="primary"
                                onClick={($event?: any) => {
                                    (to1Panel as any)($event);
                                }}
                            >
                                {$t('license.offLine')}
                            </ElLink>
                        ) : (
                            <ElLink
                                underline="never"
                                type="primary"
                                onClick={($event?: any) => {
                                    (toEdition as any)($event);
                                }}
                            >
                                {$t('license.community')}
                            </ElLink>
                        )}
                        <ElLink
                            underline="never"
                            type="primary"
                            onClick={($event?: any) => {
                                getVersionLog();
                            }}
                            class={'version'}
                        >
                            {unref(version)}
                        </ElLink>
                        {unref(isAdmin) && !unref(isOffline) && !unref(isEE) ? (
                            <ElBadge
                                is-dot
                                hidden={unref(version) === 'Waiting' || !unref(hasNewVersion)}
                                class={'-mt-0.5'}
                            >
                                <ElLink
                                    underline="never"
                                    type="primary"
                                    onClick={($event?: any) => {
                                        (onLoadUpgradeInfo as any)($event);
                                    }}
                                    class={'ml-2'}
                                >
                                    {$t('commons.button.update')}
                                </ElLink>
                            </ElBadge>
                        ) : null}
                        {unref(version) === 'Waiting' ? (
                            <ElTag round class={'ml-2.5'}>
                                {$t('setting.upgrading')}
                            </ElTag>
                        ) : null}
                    </div>
                </div>
                <Upgrade
                    ref={upgradeRef}
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <Releases ref={releasesRef} />
            </div>
        );
    },
    options,
);
