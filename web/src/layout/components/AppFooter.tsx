import { $t } from '@/utils/i18n-t';
import SystemUpgrade from '@/components/system-upgrade/index';
import FooterNavigation from '@/components/footer-navigation/index';
import { useGlobalStore } from '@/composables/useGlobalStore';
import './AppFooter.styles.css';
import { cn } from '@/utils/cn';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'AppFooter',
    props: {},
    emits: emits,
    __scopeId: 'data-v-02acda2e',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isIntl, isMobile } = useGlobalStore();
        const year = new Date().getFullYear();
        return () => (
            <div class={cn('footer', { 'footer--mobile': unref(isMobile) })}>
                <div class={'footer-content'}>
                    <div class={'footer-copyright'}>
                        {!unref(isIntl) ? (
                            <a href="https://fit2cloud.com/" target="_blank">
                                {' Copyright © 2014-'}
                                {year}
                                {$t('commons.fit2cloud')}
                            </a>
                        ) : (
                            <a href="https://1panel.pro/" target="_blank">
                                {' Copyright © '}
                                {year}
                                {$t('commons.lingxia')}
                            </a>
                        )}
                    </div>
                    <FooterNavigation class={'footer-navigation-panel'} />
                    <SystemUpgrade class={'footer-upgrade'} />
                </div>
            </div>
        );
    },
    options,
);
