import { $t } from '@/utils/i18n-t';
import { App } from '@/types/app';
import { getAge } from '@/utils/date';
import { toLink } from '@/utils/browser';
interface Props {
    installed: App.AppInstalled;
    defaultLink: string;
}
import './info.styles.css';

interface CodemodProps {
    [key: string]: any;
    installed?: App.AppInstalled;
    defaultLink?: string;
}

const emits = {
    jumpToPath: (...args: unknown[]) => true,
};

const options = {
    name: 'info',
    props: {
        installed: { type: null },
        defaultLink: String,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-d26526ee',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const hasLinkButton = (installed: any) => {
            return (
                (installed.appType == 'website' || installed.appKey?.startsWith('local')) &&
                (installed.httpPort > 0 || installed.httpsPort > 0 || installed.webUI != '')
            );
        };
        const linkPopoverStyle = {
            width: 'fit-content',
            maxWidth: 'min(92vw, 560px)',
        };
        return () => (
            <div>
                <div class={'d-description flex flex-wrap items-center justify-start gap-1.5'}>
                    <ElButton plain size="small" class={'mr-1'}>
                        {$t('app.version')}
                        {$t('commons.colon')}
                        {__panelSetupProps.installed.version}
                    </ElButton>
                    {__panelSetupProps.installed.httpPort > 0 ? (
                        <ElButton plain size="small" class={'mr-1'}>
                            {$t('commons.table.port')}
                            {$t('commons.colon')}
                            {__panelSetupProps.installed.httpPort}
                        </ElButton>
                    ) : null}
                    {__panelSetupProps.installed.httpsPort > 0 ? (
                        <ElButton plain size="small">
                            {$t('commons.table.port')}
                            {'：'}
                            {__panelSetupProps.installed.httpsPort}
                        </ElButton>
                    ) : null}
                    {hasLinkButton(__panelSetupProps.installed) ? (
                        <ElPopover
                            placement="right"
                            trigger="hover"
                            popper-class="app-link-popover"
                            popper-style={linkPopoverStyle}
                            v-slots={{
                                reference: () => (
                                    <>
                                        <ElButton plain icon="Promotion" size="small">
                                            {$t('app.toLink')}
                                        </ElButton>
                                    </>
                                ),
                            }}
                        >
                            <table>
                                <tbody>
                                    {__panelSetupProps.defaultLink != '' ? (
                                        <tr>
                                            {__panelSetupProps.installed.httpPort > 0 ? (
                                                <td>
                                                    <ElButton
                                                        type="primary"
                                                        link
                                                        onClick={($event?: any) => {
                                                            toLink(
                                                                'http://' +
                                                                    __panelSetupProps.defaultLink +
                                                                    ':' +
                                                                    __panelSetupProps.installed.httpPort,
                                                            );
                                                        }}
                                                    >
                                                        {'http://' +
                                                            __panelSetupProps.defaultLink +
                                                            ':' +
                                                            __panelSetupProps.installed.httpPort}
                                                    </ElButton>
                                                </td>
                                            ) : null}
                                        </tr>
                                    ) : null}
                                    {__panelSetupProps.defaultLink != '' ? (
                                        <tr>
                                            {__panelSetupProps.installed.httpsPort > 0 ? (
                                                <td>
                                                    <ElButton
                                                        type="primary"
                                                        link
                                                        onClick={($event?: any) => {
                                                            toLink(
                                                                'https://' +
                                                                    __panelSetupProps.defaultLink +
                                                                    ':' +
                                                                    __panelSetupProps.installed.httpsPort,
                                                            );
                                                        }}
                                                    >
                                                        {'https://' +
                                                            __panelSetupProps.defaultLink +
                                                            ':' +
                                                            __panelSetupProps.installed.httpsPort}
                                                    </ElButton>
                                                </td>
                                            ) : null}
                                        </tr>
                                    ) : null}
                                    {__panelSetupProps.installed.webUI != '' ? (
                                        <tr>
                                            <td>
                                                <ElButton
                                                    type="primary"
                                                    link
                                                    onClick={($event?: any) => {
                                                        toLink(__panelSetupProps.installed.webUI);
                                                    }}
                                                >
                                                    {__panelSetupProps.installed.webUI}
                                                </ElButton>
                                            </td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                            {__panelSetupProps.defaultLink == '' && __panelSetupProps.installed.webUI == '' ? (
                                <span>
                                    {$t('app.webUIConfig')}
                                    <ElLink
                                        icon="Position"
                                        onClick={($event?: any) => {
                                            ctx.emit('jumpToPath');
                                        }}
                                        type="primary"
                                    >
                                        {$t('firewall.quickJump')}
                                    </ElLink>
                                </span>
                            ) : null}
                        </ElPopover>
                    ) : null}
                </div>
                <div class={'description'}>
                    <span>
                        {$t('app.alreadyRun')}
                        {$t('commons.colon')}
                        {getAge(__panelSetupProps.installed.createdAt)}
                    </span>
                </div>
            </div>
        );
    },
    options,
);
