import { $t } from '@/utils/i18n-t';
import { ref, nextTick } from 'vue';
import Terminal from '@/components/terminal/index';
import { useGlobalStore } from '@/composables/useGlobalStore';
interface DialogProps {
    scriptID: number;
    scriptName: string;
}
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'run',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode } = useGlobalStore();
        const terminalVisible = ref(false);
        const terminalRef = ref<InstanceType<typeof Terminal> | null>(null);
        const scriptID = ref();
        const scriptName = ref();
        const acceptParams = async (params: DialogProps): Promise<void> => {
            terminalVisible.value = true;
            scriptID.value = params.scriptID;
            scriptName.value = params.scriptName;
            initTerm();
        };
        const initTerm = async () => {
            await nextTick();
            terminalRef.value!.acceptParams({
                endpoint: '/api/v2/core/script/run',
                args: `script_id=${scriptID.value}&operateNode=${currentNode.value}`,
                error: '',
                initCmd: '',
            });
        };
        const onClose = () => {
            terminalRef.value?.onClose();
            terminalVisible.value = false;
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
                resource={unref(scriptName)}
                size="large"
                autoClose={false}
                fullScreen={true}
                v-slots={{
                    content: () => (
                        <>
                            <Terminal ref={terminalRef} style={'height: calc(100vh - 175px); margin-top: 18px'} />
                        </>
                    ),
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        onClose();
                                    }}
                                >
                                    {$t('commons.button.disConn')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            />
        );
    },
    options,
);
