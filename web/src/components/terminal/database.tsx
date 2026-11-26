import { $t } from '@/utils/i18n-t';
import Terminal from '@/components/terminal/index';
interface DialogProps {
    databaseType?: string;
    database?: string;
    resourceName?: string;
    command?: string;
    user?: string;
    containerID?: string;
    initCmd?: string;
    waitForPrompt?: string;
}
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'database',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const open = ref(false);
        const terminalRef = ref<InstanceType<typeof Terminal> | null>(null);
        const database = ref();
        const databaseType = ref();
        const resourceName = ref();
        const command = ref('/bin/sh');
        const user = ref('');
        const containerID = ref('');
        const initCmd = ref('');
        const waitForPrompt = ref('');
        const acceptParams = async (params: DialogProps): Promise<void> => {
            database.value = params.database || '';
            databaseType.value = params.databaseType || '';
            resourceName.value = params.resourceName || params.database || params.containerID || '';
            command.value = params.command || '/bin/sh';
            user.value = params.user || '';
            containerID.value = params.containerID || '';
            initCmd.value = params.initCmd || '';
            waitForPrompt.value = params.waitForPrompt || '';
            open.value = false;
            await initTerm();
        };
        const initTerm = async () => {
            open.value = true;
            await nextTick();
            const args = containerID.value
                ? `source=container&containerid=${containerID.value}&user=${user.value}&command=${command.value}`
                : `source=database&databaseType=${databaseType.value}&database=${database.value}`;
            terminalRef.value!.acceptParams({
                endpoint: '/api/v2/hosts/terminal/container',
                args,
                error: '',
                initCmd: initCmd.value,
                waitForPrompt: waitForPrompt.value,
            });
        };
        function handleClose() {
            terminalRef.value?.onClose();
            open.value = false;
        }
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
                header={$t('menu.terminal')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                resource={unref(resourceName)}
                autoClose={!unref(open)}
                size="large"
                fullScreen={true}
                v-slots={{
                    content: () => (
                        <>
                            <Terminal ref={terminalRef} style={'height: calc(100vh - 100px)'} />
                        </>
                    ),
                }}
            />
        );
    },
    options,
);
