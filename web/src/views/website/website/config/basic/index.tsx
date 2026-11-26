import { $t } from '@/utils/i18n-t';
import Domain from './domain/index';
import Default from './default-doc/index';
import LimitConn from './limit-conn/index';
import Other from './other/index';
import HTTPS from './https/index';
import SitePath from './site-folder/index';
import Rewrite from './rewrite/index';
import Proxy from './proxy/index';
import AuthBasic from './auth-basic/index';
import AntiLeech from './anti-Leech/index';
import Redirect from './redirect/index';
import LoadBalance from './load-balance/index';
import PHP from './php/index';
import RealIP from './real-ip/index';
import Resource from './resource/index';
import Cors from './cors/index';
import Stream from './stream/index';
import './index.styles.css';

interface CodemodProps {
    [key: string]: any;
    website?: Record<string, any>;
    heightDiff?: number;
}

const emits = {};

const options = {
    name: 'Basic',
    props: {
        website: {
            type: Object,
        },
        heightDiff: {
            type: Number,
            default: 0,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-35f5f2ad',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const windowHeight = ref(window.innerHeight);
        const mainHeight = computed(() => windowHeight.value - __panelSetupProps.heightDiff);
        const id = computed(() => {
            return __panelSetupProps.website.id;
        });
        const tabIndex = ref('0');
        const menuKey = ref('site-tabIndex-');
        watch(tabIndex, (newVal) => {
            localStorage.setItem(menuKey.value, newVal);
        });
        const handleResize = () => {
            windowHeight.value = window.innerHeight;
        };
        const tabsRef = ref();
        const handleScroll = (event: WheelEvent) => {
            if (!tabsRef.value) return;
            const tabContainer = tabsRef.value.$el.querySelector('.el-tabs__nav-scroll');
            if (!tabContainer) return;

            const currentScrollTop = tabContainer.scrollTop;
            if (currentScrollTop == 0) {
                return;
            }

            const target = event.target as HTMLElement;
            if (!target.classList.contains('el-tabs__item')) {
                return;
            }

            event.preventDefault();
            tabContainer.scrollTop += event.deltaY;
        };
        onMounted(() => {
            menuKey.value = 'site-tabIndex-' + __panelSetupProps.website.id;
            const storedTabIndex = localStorage.getItem(menuKey.value);
            if (storedTabIndex !== null) {
                tabIndex.value = storedTabIndex;
            } else {
                tabIndex.value = '0';
                if (__panelSetupProps.website.type == 'stream') {
                    tabIndex.value = '12';
                }
            }
            window.addEventListener('resize', handleResize);
            document.addEventListener('wheel', handleScroll, { passive: false });
        });
        onUnmounted(() => {
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('wheel', handleScroll);
        });
        return () => (
            <div style={{ '--main-height': unref(mainHeight) + 'px' }}>
                {unref(id) > 0 && __panelSetupProps.website.type != 'stream' ? (
                    <ElTabs
                        tab-position="left"
                        modelValue={unref(tabIndex)}
                        onUpdate:modelValue={($v) => {
                            tabIndex.value = $v as any;
                        }}
                        ref={tabsRef}
                        class={'custom-tabs'}
                    >
                        <ElTabPane label={$t('website.domainConfig')} name="0">
                            {unref(tabIndex) == '0' ? <Domain id={unref(id)} key={unref(id)} /> : null}
                        </ElTabPane>
                        <ElTabPane label={$t('website.sitePath')} name="1">
                            {unref(tabIndex) == '1' ? <SitePath id={unref(id)} /> : null}
                        </ElTabPane>
                        <ElTabPane label={$t('website.defaultDoc')} name="2">
                            {unref(tabIndex) == '2' ? <Default id={unref(id)} /> : null}
                        </ElTabPane>
                        <ElTabPane label={$t('website.rate')} name="3">
                            {unref(tabIndex) == '3' ? <LimitConn id={unref(id)} /> : null}
                        </ElTabPane>
                        <ElTabPane label={$t('website.proxy')} name="4">
                            {unref(tabIndex) == '4' ? <Proxy id={unref(id)} /> : null}
                        </ElTabPane>
                        <ElTabPane label={$t('website.loadBalance')} name="5">
                            {unref(tabIndex) == '5' ? <LoadBalance id={unref(id)} /> : null}
                        </ElTabPane>
                        <ElTabPane label={$t('website.basicAuth')} name="6">
                            {unref(tabIndex) == '6' ? <AuthBasic id={unref(id)} /> : null}
                        </ElTabPane>
                        <ElTabPane label={$t('website.cors')} name="16">
                            {unref(tabIndex) == '16' ? <Cors id={unref(id)} /> : null}
                        </ElTabPane>
                        <ElTabPane label={'HTTPS'} name="7">
                            {unref(tabIndex) == '7' ? <HTTPS id={unref(id)} /> : null}
                        </ElTabPane>
                        <ElTabPane label={$t('website.realIP')} name="8">
                            {unref(tabIndex) == '8' ? <RealIP id={unref(id)} /> : null}
                        </ElTabPane>
                        <ElTabPane label={$t('website.rewrite')} name="9">
                            {unref(tabIndex) == '9' ? <Rewrite id={unref(id)} /> : null}
                        </ElTabPane>
                        <ElTabPane label={$t('website.antiLeech')} name="10">
                            {unref(tabIndex) == '10' ? <AntiLeech id={unref(id)} /> : null}
                        </ElTabPane>
                        <ElTabPane label={$t('website.redirect')} name="11">
                            {unref(tabIndex) == '11' ? <Redirect id={unref(id)} /> : null}
                        </ElTabPane>
                        {(__panelSetupProps.website.type === 'runtime' &&
                            __panelSetupProps.website.runtimeType === 'php') ||
                        __panelSetupProps.website.type === 'static' ? (
                            <ElTabPane label={'PHP'} name="13">
                                {unref(tabIndex) == '13' ? <PHP id={unref(id)} /> : null}
                            </ElTabPane>
                        ) : null}
                        {__panelSetupProps.website.type === 'runtime' || __panelSetupProps.website.type === 'static' ? (
                            <ElTabPane label={$t('logs.resource')} name="14">
                                {unref(tabIndex) == '14' ? <Resource id={unref(id)} /> : null}
                            </ElTabPane>
                        ) : null}
                        <ElTabPane label={$t('website.other')} name="12">
                            {unref(tabIndex) == '12' ? <Other id={unref(id)} /> : null}
                        </ElTabPane>
                    </ElTabs>
                ) : null}
                {unref(id) > 0 && __panelSetupProps.website.type == 'stream' ? (
                    <ElTabs
                        tab-position="left"
                        modelValue={unref(tabIndex)}
                        onUpdate:modelValue={($v) => {
                            tabIndex.value = $v as any;
                        }}
                        ref={tabsRef}
                        class={'custom-tabs'}
                    >
                        <ElTabPane label={$t('website.other')} name="12">
                            {unref(tabIndex) == '12' ? <Other id={unref(id)} /> : null}
                        </ElTabPane>
                        <ElTabPane label={$t('website.stream')} name="13">
                            {unref(tabIndex) == '13' ? <Stream id={unref(id)} /> : null}
                        </ElTabPane>
                    </ElTabs>
                ) : null}
            </div>
        );
    },
    options,
);
