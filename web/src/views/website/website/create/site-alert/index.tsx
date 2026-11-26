import { $t } from '@/utils/i18n-t';

interface CodemodProps {
    [key: string]: any;
    websiteType?: string;
    versionNotMatch?: boolean;
}

const emits = {};

const options = {
    name: 'site-alert',
    props: {
        websiteType: {
            type: String,
            default: 'deployment',
        },
        versionNotMatch: {
            type: Boolean,
            default: false,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => (
            <div>
                {__panelSetupProps.websiteType == 'deployment' ? (
                    <ElAlert title={$t('website.websiteDeploymentHelper')} type="info" closable={false} />
                ) : null}
                {__panelSetupProps.websiteType == 'static' ? (
                    <ElAlert title={$t('website.websiteStatictHelper')} type="info" closable={false} />
                ) : null}
                {__panelSetupProps.websiteType == 'proxy' ? (
                    <ElAlert title={$t('website.websiteProxyHelper')} type="info" closable={false} />
                ) : null}
                {__panelSetupProps.websiteType == 'runtime' ? (
                    <ElAlert title={$t('website.runtimeProxyHelper')} type="info" closable={false} />
                ) : null}
                {__panelSetupProps.websiteType == 'subsite' ? (
                    <ElAlert title={$t('website.subsiteHelper')} type="info" closable={false} />
                ) : null}
                {__panelSetupProps.websiteType == 'stream' ? (
                    <ElAlert
                        title={
                            __panelSetupProps.versionNotMatch
                                ? $t('xpack.waf.openRestyAlert', ['1.27.1.2-2-3-focal'])
                                : $t('website.streamHelper')
                        }
                        type={__panelSetupProps.versionNotMatch ? 'error' : 'info'}
                        closable={false}
                    />
                ) : null}
            </div>
        );
    },
    options,
);
