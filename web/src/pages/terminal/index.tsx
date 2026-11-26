import HostTab from '@/pages/views/terminal/host/index';
import CommandTab from '@/pages/views/terminal/command/index';
import TerminalTab from '@/pages/views/terminal/terminal/index';
import SettingTab from '@/pages/views/terminal/setting/index';
import CachedTabs from '@/components/cached-tabs/index';
import i18n from '@/lang';
import { rpc } from '@/lib/rpc';
import { TerminalStore } from '@/store';
import { useGlobalStore } from '@/composables/useGlobalStore';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'terminal',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const terminalStore = TerminalStore();
        const { isAdmin } = useGlobalStore();
        const route = useRoute();
        const tabs = computed(() => [
            { value: 'terminal', label: i18n.global.t('menu.terminal', 2) },
            ...(isAdmin.value ? [{ value: 'host', label: i18n.global.t('terminal.host', 2) }] : []),
            { value: 'command', label: i18n.global.t('terminal.quickCommand', 2) },
            ...(isAdmin.value ? [{ value: 'setting', label: i18n.global.t('container.setting') }] : []),
        ]);
        const hostTabRef = ref();
        const commandTabRef = ref();
        const terminalTabRef = ref();
        const settingTabRef = ref();
        const handleChange = (tab: string) => {
            if (tab === 'host' && isAdmin.value) {
                hostTabRef.value?.acceptParams();
            }
            if (tab === 'command') {
                commandTabRef.value?.acceptParams();
            }
            if (tab === 'terminal') {
                terminalTabRef.value?.acceptParams();
            }
            if (tab === 'setting' && isAdmin.value) {
                settingTabRef.value?.acceptParams();
            }
        };
        const loadTerminalSetting = async () => {
            await rpc.core.setting.getTerminal({}).then((res) => {
                terminalStore.$patch({
                    showTerminalButton: res.showTerminalButton !== 'Disable',
                    lineHeight: Number(res.lineHeight),
                    letterSpacing: Number(res.letterSpacing),
                    fontSize: Number(res.fontSize),
                    fontFamily: res.fontFamily || "Monaco, Menlo, Consolas, 'Courier New', monospace",
                    backgroundColor: res.backgroundColor || '#000000',
                    foregroundColor: res.foregroundColor || '#f5f5f5',
                    cursorBlink: res.cursorBlink,
                    cursorStyle: res.cursorStyle,
                    scrollback: Number(res.scrollback),
                    scrollSensitivity: Number(res.scrollSensitivity),
                });
            });
        };
        onMounted(() => {
            loadTerminalSetting();
        });
        return () => (
            <CachedTabs
                items={unref(tabs)}
                default-value="terminal"
                cache-key="terminal/main"
                requested-value={unref(route).path === '/terminal' && unref(route).query.path ? 'terminal' : undefined}
                onActivate={($event?: any) => {
                    (handleChange as any)($event);
                }}
                v-slots={{
                    default: ({ active }) => (
                        <>
                            <div style={[{}, { display: active === 'terminal' ? '' : 'none' }]}>
                                <TerminalTab ref={terminalTabRef} />
                            </div>
                            {unref(isAdmin) && active === 'host' ? <HostTab ref={hostTabRef} /> : null}
                            {active === 'command' ? <CommandTab ref={commandTabRef} /> : null}
                            {unref(isAdmin) && active === 'setting' ? <SettingTab ref={settingTabRef} /> : null}
                        </>
                    ),
                }}
            />
        );
    },
    options,
);

definePage({
    name: 'Terminal',
    props: true,
    meta: { protectedRoleOnly: true },
});
