import { Document } from '@element-plus/icons-vue';
import LayoutContent from '@/components/layout-content/index';
import SystemUpgrade from '@/components/system-upgrade/index';
import SvgIcon from '@/components/svg-icon/svg-icon';
import PrimaryLogo from '@/assets/images/1panel-logo.svg?component';
import { useGlobalStore } from '@/composables/useGlobalStore';
import i18n from '@/lang';
import { rpc } from '@/lib/rpc';
import './index.styles.css';

const options = {
    name: 'AboutView',
    __scopeId: 'data-v-0b9b2881',
};

export default defineComponent(() => {
    const { docsUrl, themeConfig } = useGlobalStore();
    const loading = ref(false);
    const logoLoadFailed = ref(false);
    const t = i18n.global.t;

    const toDoc = () => {
        window.open(docsUrl.value.endsWith('/') ? docsUrl.value : `${docsUrl.value}/`, '_blank', 'noopener,noreferrer');
    };
    const toGithub = () => {
        window.open('https://github.com/1Panel-dev/1Panel', '_blank', 'noopener,noreferrer');
    };
    const toIssue = () => {
        window.open('https://github.com/1Panel-dev/1Panel/issues', '_blank', 'noopener,noreferrer');
    };
    const toGithubStar = () => {
        window.open('https://github.com/1Panel-dev/1Panel', '_blank', 'noopener,noreferrer');
    };

    onMounted(() => {
        rpc.core.setting.getSystemAvailable({});
    });

    return () => (
        <div>
            {withDirectives(
                <LayoutContent
                    title={t('setting.about')}
                    divider={true}
                    v-slots={{
                        main: () => (
                            <div style="text-align: center; margin-top: 20px">
                                <div style="justify-self: center" class="logo">
                                    {themeConfig.value.logo && !logoLoadFailed.value ? (
                                        <img
                                            style="width: 80px"
                                            src={`/api/v2/images/logo?t=${Date.now()}`}
                                            onError={() => (logoLoadFailed.value = true)}
                                            alt=""
                                        />
                                    ) : (
                                        <PrimaryLogo />
                                    )}
                                </div>
                                <h3 class="description">{themeConfig.value.title || t('setting.description')}</h3>
                                <div class="flex justify-center">
                                    <SystemUpgrade class="upgrade" />
                                </div>
                                <div class="my-5 flex w-full flex-wrap justify-center gap-4 md:flex-row">
                                    <ElLink onClick={toDoc} class="system-link">
                                        <ElIcon>
                                            <Document />
                                        </ElIcon>
                                        <span>{t('setting.doc2')}</span>
                                    </ElLink>
                                    <ElLink onClick={toGithub} class="system-link">
                                        <SvgIcon iconName="p-huaban88" />
                                        <span>{t('setting.project')}</span>
                                    </ElLink>
                                    <ElLink onClick={toIssue} class="system-link">
                                        <SvgIcon iconName="p-bug" />
                                        <span>{t('setting.issue')}</span>
                                    </ElLink>
                                    <ElLink onClick={toGithubStar} class="system-link">
                                        <SvgIcon iconName="p-star" />
                                        <span>{t('setting.star')}</span>
                                    </ElLink>
                                </div>
                            </div>
                        ),
                    }}
                />,
                [[vLoading, loading.value]],
            )}
        </div>
    );
}, options);
