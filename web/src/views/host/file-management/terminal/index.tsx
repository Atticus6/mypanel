import { $t } from '@/utils/i18n-t';
import { ref, nextTick } from 'vue';
import Terminal from '@/components/terminal/index';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    cwd: string;
    command: string;
}
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElAlert } from 'element-plus';
import { ElCascader } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'terminal',
    props: {},
    emits: emits,
    __scopeId: 'data-v-70c1ae79',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const terminalVisible = ref(false);
        const terminalRef = ref<InstanceType<typeof Terminal> | null>(null);
        let quickCmd = ref();
        const commandTree = ref();
        const acceptParams = async (params: DialogProps): Promise<void> => {
            terminalVisible.value = true;
            loadCommandTree();
            await initTerm(params.cwd);
        };
        const initTerm = async (cwd: string) => {
            await nextTick();
            terminalRef.value!.acceptParams({
                endpoint: '/api/v2/hosts/terminal/local',
                args: `command=${encodeURIComponent(`clear && cd "${cwd}"`)}`,
                error: '',
                initCmd: '',
            });
        };
        const loadCommandTree = async () => {
            const res = await rpc.core.command.tree({ type: 'command' });
            commandTree.value = res.items || [];
        };
        function quickInput(val: Array<string>) {
            if (val.length < 1) {
                return;
            }
            quickCmd.value = val[val.length - 1];
            terminalRef.value?.sendMsg(quickCmd.value + '\n');
            quickCmd.value = '';
        }
        const onClose = () => {
            terminalRef.value?.onClose();
        };
        function handleClose() {
            onClose();
            terminalVisible.value = false;
        }
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                modelValue={unref(terminalVisible)}
                onUpdate:modelValue={($v) => {
                    terminalVisible.value = $v as any;
                }}
                header={$t('menu.terminal')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="large"
                autoClose={false}
                fullScreen={true}
                v-slots={{
                    content: () => (
                        <>
                            <div class={'terminal-container'}>
                                <ElAlert closable={false} title={$t('terminal.localConnJump')} type="info" />
                                <Terminal ref={terminalRef} class={'terminal-content'} />
                                <div class={'quick-command'}>
                                    <ElCascader
                                        modelValue={unref(quickCmd)}
                                        onUpdate:modelValue={($v) => {
                                            quickCmd.value = $v as any;
                                        }}
                                        options={unref(commandTree)}
                                        onChange={($event?: any) => {
                                            (quickInput as any)($event);
                                        }}
                                        show-all-levels={false}
                                        placeholder=" "
                                        filterable
                                        class={'w-full'}
                                        v-slots={{ prefix: () => <>{$t('terminal.quickCommand')}</> }}
                                    />
                                </div>
                            </div>
                        </>
                    ),
                }}
            />
        );
    },
    options,
);
