import { $t } from '@/utils/i18n-t';
import { useSearchState } from '@/utils/search-reset';
import FireRouter from '@/pages/hosts/_components/ssh/index';
import i18n from '@/lang';
import { MsgError, MsgSuccess } from '@/utils/message';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { checkStreamAuth } from '@/utils/stream-auth';
import { rpc } from '@/lib/rpc';
import LayoutContent from '@/components/layout-content/index';
import TableSearch from '@/components/table/TableSearch';
import ComplexTable from '@/components/table/complex/ComplexTable';
import FuTableOperations from '@/components/table/TableOperations';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'ssh.session',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode: globalCurrentNode } = useGlobalStore();
        const sshSearch = reactive({
            type: 'ssh',
            loginUser: '',
        });
        useSearchState(
            'host/ssh/session/index',
            { search: toRef(sshSearch, 'loginUser') },
            { onRevisit: () => search() },
        );
        const buttons = [
            {
                label: i18n.global.t('commons.button.disConn'),
                permission: true,
                nodeAdmin: true,
                click: function (row: any) {
                    stop(row.PID);
                },
            },
        ];
        let processSocket: WebSocket | null = null;
        let sendTimer: ReturnType<typeof setInterval> | null = null;
        let initProcessToken = 0;
        const data = ref([]);
        const loading = ref(false);
        const tableRef = ref();
        const isWsOpen = () => {
            return processSocket?.readyState === WebSocket.OPEN;
        };
        const clearSendTimer = () => {
            if (sendTimer) {
                clearInterval(sendTimer);
                sendTimer = null;
            }
        };
        const closeSocket = () => {
            clearSendTimer();
            if (isWsOpen()) {
                processSocket.close();
            }
            processSocket = null;
        };
        const onOpenProcess = () => {};
        const onMessage = (message: any) => {
            let result: any[] = JSON.parse(message.data);
            data.value = result;
            loading.value = false;
        };
        const onerror = () => {};
        const onClose = () => {
            closeSocket();
        };
        const initProcess = async () => {
            const token = ++initProcessToken;
            let href = window.location.href;
            let protocol = href.split('//')[0] === 'http:' ? 'ws' : 'wss';
            let ipLocal = href.split('//')[1].split('/')[0];
            let currentNode = globalCurrentNode.value;
            const url = `${protocol}://${ipLocal}/api/v2/process/ws?operateNode=${currentNode}`;
            const authError = await checkStreamAuth(url, currentNode);
            if (token !== initProcessToken) {
                return;
            }
            if (authError) {
                loading.value = false;
                MsgError(authError);
                return;
            }
            closeSocket();
            processSocket = new WebSocket(url);
            processSocket.onopen = onOpenProcess;
            processSocket.onmessage = onMessage;
            processSocket.onerror = onerror;
            processSocket.onclose = onClose;
            search();
            sendMsg();
        };
        const sendMsg = () => {
            loading.value = true;
            clearSendTimer();
            sendTimer = setInterval(() => {
                search();
            }, 3000);
        };
        const search = () => {
            if (isWsOpen()) {
                processSocket.send(JSON.stringify(sshSearch));
            }
        };
        const stop = async (PID: number) => {
            ElMessageBox.confirm(i18n.global.t('ssh.stopSSHWarn'), i18n.global.t('commons.button.disConn'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
                type: 'info',
            })
                .then(async () => {
                    try {
                        await rpc.process.stopProcess({ pid: PID });
                        data.value = data.value.filter((item: any) => item.PID !== PID);
                        search();
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    } catch (error) {
                        MsgError(error);
                    }
                })
                .catch(() => {});
        };
        onMounted(() => {
            initProcess();
        });
        onUnmounted(() => {
            initProcessToken++;
            closeSocket();
        });
        return () => (
            <div>
                <FireRouter />
                <LayoutContent
                    title={$t('ssh.session', 2)}
                    v-slots={{
                        rightToolBar: () => (
                            <>
                                <TableSearch
                                    onSearch={($event?: any) => {
                                        search();
                                    }}
                                    searchName={sshSearch.loginUser}
                                    onUpdate:searchName={($v) => {
                                        sshSearch.loginUser = $v as any;
                                    }}
                                />
                            </>
                        ),
                        main: () => (
                            <>
                                {withDirectives(
                                    <ComplexTable data={unref(data)} ref={tableRef} heightDiff={260}>
                                        <ElTableColumn label={$t('commons.table.user')} fix prop="username" />
                                        <ElTableColumn label={'TTY'} fix prop="terminal" />
                                        <ElTableColumn label={$t('ssh.loginIP')} fix prop="host" />
                                        <ElTableColumn
                                            label={$t('ssh.loginTime')}
                                            fix
                                            prop="loginTime"
                                            min-width="120px"
                                        />
                                        <FuTableOperations
                                            ellipsis={10}
                                            buttons={buttons}
                                            label={$t('commons.table.operate')}
                                            fix
                                        />
                                    </ComplexTable>,
                                    [[vLoading, unref(loading)]],
                                )}
                            </>
                        ),
                    }}
                />
            </div>
        );
    },
    options,
);

definePage({
    name: 'SSHSession',
    meta: {
        parent: 'menu.ssh',
        title: 'ssh.session',
        activeMenu: '/hosts/ssh/ssh',
        permission: 'host_ssh_view',
        hidden: true,
    },
});
