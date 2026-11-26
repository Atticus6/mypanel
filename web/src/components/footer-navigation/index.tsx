import { $t } from '@/utils/i18n-t';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { getEnterpriseFooterSetting } from '@/extensions/footer-setting';
import { useGlobalStore } from '@/composables/useGlobalStore';
import {
    createDefaultFooterNavigationLinks,
    footerNavigationKeys,
    isSafeExternalUrl,
    mergeFooterNavigationLinks,
} from './model';
import type { FooterNavigationKey, FooterNavigationSetting } from './model';
import { FOOTER_NAVIGATION_REFRESH_EVENT } from './event';
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElLink } from 'element-plus';
import { ElDivider } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'footer-navigation',
    props: {},
    emits: emits,
    __scopeId: 'data-v-cb87ad58',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { docsUrl, isEE, isIntl } = useGlobalStore();
        const setting = ref<FooterNavigationSetting | null>(null);
        let loadGeneration = 0;
        const defaults = computed(() => createDefaultFooterNavigationLinks(isIntl.value, docsUrl.value));
        const links = computed(() => mergeFooterNavigationLinks(setting.value, defaults.value));
        const labels: Record<FooterNavigationKey, string> = {
            learnMore: 'license.knowMorePro',
            forum: 'setting.forum',
            documentation: 'setting.doc2',
            project: 'setting.project',
        };
        const visibleLinks = computed(() => {
            return footerNavigationKeys
                .filter((key) => links.value[key].visible)
                .map((key) => ({
                    key,
                    label: labels[key],
                    url: links.value[key].url,
                }));
        });
        const loadSetting = async () => {
            const generation = ++loadGeneration;
            if (!isEE.value) {
                setting.value = null;
                return;
            }
            try {
                const res = await getEnterpriseFooterSetting(true);
                if (generation !== loadGeneration || !isEE.value) {
                    return;
                }
                setting.value = res?.data || null;
            } catch {
                if (generation !== loadGeneration || !isEE.value) {
                    return;
                }
                setting.value = null;
            }
        };
        const openLink = (url: string) => {
            if (!isSafeExternalUrl(url)) {
                return;
            }
            window.open(url, '_blank', 'noopener,noreferrer');
        };
        watch(isEE, loadSetting, { immediate: true });
        onMounted(() => {
            window.addEventListener(FOOTER_NAVIGATION_REFRESH_EVENT, loadSetting);
        });
        onBeforeUnmount(() => {
            loadGeneration += 1;
            window.removeEventListener(FOOTER_NAVIGATION_REFRESH_EVENT, loadSetting);
        });
        return () =>
            unref(visibleLinks).length ? (
                <div class={'footer-navigation'}>
                    {(unref(visibleLinks) || []).map((item, index) => (
                        <>
                            <ElLink
                                type="primary"
                                underline="never"
                                onClick={($event?: any) => {
                                    openLink(item.url);
                                }}
                            >
                                <span class={'font-normal'}>{$t(item.label)}</span>
                            </ElLink>
                            {index < unref(visibleLinks).length - 1 ? <ElDivider direction="vertical" /> : null}
                        </>
                    ))}
                    <ElDivider direction="vertical" class={'footer-navigation__tail'} />
                </div>
            ) : null;
    },
    options,
);
