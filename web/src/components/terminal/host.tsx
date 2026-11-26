import { onMounted } from 'vue';
import Terminal from '@/components/terminal/index';
import { TerminalDockSessionStore, TerminalSessionStore, TerminalStore } from '@/store';
import { rpc } from '@/lib/rpc';
import { useGlobalStore } from '@/composables/useGlobalStore';
import './host.styles.css';
import { defineComponent, Fragment, Teleport, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'host',
    props: {},
    emits: emits,
    __scopeId: 'data-v-b1568ae1',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const pageStore = TerminalSessionStore();
        const dockStore = TerminalDockSessionStore();
        const terminalStore = TerminalStore();
        const stores = [pageStore, dockStore];
        const { isAdmin } = useGlobalStore();
        onMounted(async () => {
            try {
                const res = await rpc.core.setting.getTerminal({});
                terminalStore.showTerminalButton = res.showTerminalButton !== 'Disable';
            } catch {}
            if (isAdmin.value && terminalStore.showTerminalButton) await dockStore.restore();
        });
        return () => (
            <div aria-hidden="true" class={'terminal-host'}>
                {(stores || []).map((store) => (
                    <>
                        {(store.entries || []).map((item) => (
                            <>
                                <Teleport to={store.slots[item.key] || 'body'} disabled={!store.slots[item.key]}>
                                    <Terminal
                                        ref={(el: any) => store.setInstance(item.key, el)}
                                        onSession={($event?: any) => {
                                            (id: string) => store.setSessionId(item.key, id);
                                        }}
                                        onExpired={($event?: any) => {
                                            store.onExpired(item.key);
                                        }}
                                        onReconnect={($event?: any) => {
                                            store.reconnect(item.key);
                                        }}
                                    />
                                </Teleport>
                            </>
                        ))}
                    </>
                ))}
            </div>
        );
    },
    options,
);
