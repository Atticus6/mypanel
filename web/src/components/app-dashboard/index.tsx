import { $t } from '@/utils/i18n-t';
import type { InstalledApp } from '@/gen/panel/agent/v1/app_pb';
import { rpc } from '@/lib/rpc';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { toLink } from '@/utils/browser';
import { routerToName } from '@/utils/router';
import './index.styles.css';

interface CodemodProps {
    [key: string]: any;
    appKey?: string;
    disabled?: boolean;
}

const emits = {
    notInstalled: () => true,
};

type SlotsShape = {
    default: (arg?: unknown) => VNode[];
    reference: (arg?: unknown) => VNode[];
};

const options = {
    name: 'app-dashboard',
    props: {
        appKey: String,
        disabled: Boolean,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
    __scopeId: 'data-v-d80a38e5',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        const { currentNodeAddr, isMaster } = useGlobalStore();
        const installed = ref<InstalledApp>();
        const host = ref('');
        const loaded = ref(false);
        const links = computed(() => {
            const app = installed.value;
            if (!app) return [];
            const urls: string[] = [];
            if (host.value) {
                const address =
                    host.value.includes(':') && !host.value.startsWith('[') ? `[${host.value}]` : host.value;
                if (app.httpPort > 0) urls.push(`http://${address}:${app.httpPort}`);
                if (app.httpsPort > 0) urls.push(`https://${address}:${app.httpsPort}`);
            }
            if (app.webUi) urls.push(app.webUi);
            return [...new Set(urls)];
        });
        const onClick = () => {
            if (loaded.value && !__panelSetupProps.disabled && !installed.value) ctx.emit('notInstalled');
        };
        onMounted(async () => {
            try {
                const settings = await rpc.agentSetting.getInfo({});
                host.value =
                    settings.systemIp ||
                    (!isMaster.value || currentNodeAddr.value !== '127.0.0.1' ? currentNodeAddr.value : '');
                let page = 1;
                let count = 0;
                let total = 0;
                do {
                    const res = await rpc.app.searchInstalled({ page: page++, pageSize: 100, type: '' });
                    const items = res.items || [];
                    installed.value = items.find((app) => app.appKey === __panelSetupProps.appKey);
                    count += items.length;
                    total = Number(res.total);
                    if (installed.value || !items.length) break;
                } while (count < total);
                loaded.value = true;
            } catch {
                // API errors are reported by the shared request handler; keep the button disabled.
            }
        });
        return () => (
            <ElPopover
                placement="right"
                trigger="hover"
                disabled={__panelSetupProps.disabled || !unref(installed)}
                popper-style={{ width: 'fit-content', maxWidth: 'min(92vw, 560px)' }}
                v-slots={{
                    reference: () => (
                        <>
                            {ctx.slots['reference']?.({
                                disabled: __panelSetupProps.disabled || !unref(loaded),
                                onClick,
                            }) ?? (
                                <>
                                    <ElButton
                                        type="primary"
                                        plain
                                        disabled={__panelSetupProps.disabled || !unref(loaded)}
                                        onClick={($event?: any) => {
                                            (onClick as any)($event);
                                        }}
                                    >
                                        {ctx.slots['default']?.(undefined)}
                                    </ElButton>
                                </>
                            )}
                        </>
                    ),
                }}
            >
                <div class={'dashboard-links'}>
                    {(unref(links) || []).map((link) => (
                        <ElButton
                            type="primary"
                            link
                            onClick={($event?: any) => {
                                toLink(link);
                            }}
                            key={link}
                        >
                            {link}
                        </ElButton>
                    ))}
                    {!unref(links).length ? (
                        <span>
                            {$t('app.webUIConfig')}
                            <ElLink
                                icon="Position"
                                type="primary"
                                onClick={($event?: any) => {
                                    routerToName('Panel');
                                }}
                            >
                                {$t('firewall.quickJump')}
                            </ElLink>
                        </span>
                    ) : null}
                </div>
            </ElPopover>
        );
    },
    options,
);
