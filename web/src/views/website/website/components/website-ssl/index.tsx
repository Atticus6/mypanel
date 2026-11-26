import { $t } from '@/utils/i18n-t';
import { dateFormatSimple } from '@/utils/date';
import { getProvider } from '@/utils/ssl';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElDescriptions } from 'element-plus';
import { ElDescriptionsItem } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
    websiteSSL?: Record<string, any>;
}

const emits = {};

const options = {
    name: 'website-ssl',
    props: {
        websiteSSL: {
            type: Object,
            required: true,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => (
            <ElDescriptions column={7} border direction="vertical">
                <ElDescriptionsItem label={$t('website.primaryDomain')}>
                    {__panelSetupProps.websiteSSL.primaryDomain}
                </ElDescriptionsItem>
                <ElDescriptionsItem label={$t('website.otherDomains')}>
                    {__panelSetupProps.websiteSSL.domains}
                </ElDescriptionsItem>
                <ElDescriptionsItem label={$t('website.brand')}>
                    {__panelSetupProps.websiteSSL.organization}
                </ElDescriptionsItem>
                <ElDescriptionsItem label={$t('ssl.provider')}>
                    {getProvider(__panelSetupProps.websiteSSL.provider)}
                </ElDescriptionsItem>
                {__panelSetupProps.websiteSSL.acmeAccount && __panelSetupProps.websiteSSL.provider !== 'manual' ? (
                    <ElDescriptionsItem label={$t('ssl.acmeAccount')}>
                        {__panelSetupProps.websiteSSL.acmeAccount.email}
                    </ElDescriptionsItem>
                ) : null}
                <ElDescriptionsItem label={$t('website.expireDate')}>
                    {dateFormatSimple(__panelSetupProps.websiteSSL.expireDate)}
                </ElDescriptionsItem>
                <ElDescriptionsItem label={$t('website.remark')}>
                    {__panelSetupProps.websiteSSL.description}
                </ElDescriptionsItem>
            </ElDescriptions>
        );
    },
    options,
);
