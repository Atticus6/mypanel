import { $t } from '@/utils/i18n-t';
import { Rules } from '@/global/form-rules';
import Terminal from '@/components/terminal/index';
import { useGlobalStore } from '@/composables/useGlobalStore';
interface DialogProps {
    containerID: string;
    title: string;
    node?: string;
}
import DrawerPro from '@/components/drawer-pro/index';

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
        const { currentNode } = useGlobalStore();
        const title = ref();
        const terminalVisible = ref(false);
        const terminalOpen = ref(false);
        const form = reactive({
            isCustom: false,
            command: '',
            user: '',
            containerID: '',
            containerIDList: [],
            node: '',
        });
        const formRef = ref();
        const terminalRef = ref<InstanceType<typeof Terminal> | null>(null);
        const acceptParams = async (params: DialogProps): Promise<void> => {
            terminalVisible.value = true;
            form.containerIDList = params.containerID.split(',');
            form.containerID = form.containerIDList[0];
            title.value = params.title;
            form.isCustom = false;
            form.user = '';
            form.command = '/bin/sh';
            form.node = params.node || currentNode.value;
            terminalOpen.value = false;
        };
        const onChangeCommand = async () => {
            form.command = '';
        };
        const initTerm = (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                terminalOpen.value = true;
                await nextTick();
                let args = `source=container&containerid=${form.containerID}&user=${form.user}&command=${form.command}`;
                if (form.node) {
                    args += `&operateNode=${form.node}`;
                }
                terminalRef.value!.acceptParams({
                    endpoint: '/api/v2/hosts/terminal/container',
                    args: args,
                    error: '',
                    initCmd: '',
                });
            });
        };
        const onClose = () => {
            terminalRef.value?.onClose();
            terminalOpen.value = false;
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
                v-model={terminalVisible.value}
                header={$t('menu.terminal')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                resource={unref(title)}
                autoClose={!unref(terminalOpen)}
                size="large"
                fullScreen={true}
                v-slots={{
                    content: () => (
                        <>
                            <ElForm ref={formRef} model={form} label-position="top">
                                {form.containerIDList.length > 1 ? (
                                    <ElFormItem label={$t('menu.container')} prop="containerID">
                                        <ElSelect placeholder="container" clearable v-model={form.containerID}>
                                            {(form.containerIDList || []).map((item) => (
                                                <ElOption label={item} value={item} key={item} />
                                            ))}
                                        </ElSelect>
                                    </ElFormItem>
                                ) : null}
                                <ElFormItem label={$t('commons.table.user')} prop="user">
                                    <ElInput placeholder="root" clearable v-model={form.user} />
                                </ElFormItem>
                                {form.isCustom ? (
                                    <ElFormItem
                                        label={$t('container.command')}
                                        prop="command"
                                        rules={Rules.requiredInput}
                                    >
                                        <ElCheckbox
                                            border
                                            v-model={form.isCustom}
                                            onChange={($event?: any) => {
                                                (onChangeCommand as any)($event);
                                            }}
                                            class={'p-w-100'}
                                        >
                                            {$t('container.custom')}
                                        </ElCheckbox>
                                        <ElInput clearable v-model={form.command} style={'width: calc(100% - 100px)'} />
                                    </ElFormItem>
                                ) : null}
                                {!form.isCustom ? (
                                    <ElFormItem
                                        label={$t('container.command')}
                                        prop="command"
                                        rules={Rules.requiredSelect}
                                    >
                                        <ElCheckbox
                                            border
                                            v-model={form.isCustom}
                                            onChange={($event?: any) => {
                                                (onChangeCommand as any)($event);
                                            }}
                                            class={'p-w-100'}
                                        >
                                            {$t('container.custom')}
                                        </ElCheckbox>
                                        <ElSelect
                                            filterable
                                            clearable
                                            v-model={form.command}
                                            style={'width: calc(100% - 100px)'}
                                        >
                                            <ElOption value="/bin/ash" label="/bin/ash" />
                                            <ElOption value="/bin/bash" label="/bin/bash" />
                                            <ElOption value="/bin/sh" label="/bin/sh" />
                                        </ElSelect>
                                    </ElFormItem>
                                ) : null}
                                {!unref(terminalOpen) ? (
                                    <ElButton
                                        onClick={($event?: any) => {
                                            initTerm(unref(formRef));
                                        }}
                                    >
                                        {$t('commons.button.conn')}
                                    </ElButton>
                                ) : (
                                    <ElButton
                                        onClick={($event?: any) => {
                                            onClose();
                                        }}
                                    >
                                        {$t('commons.button.disConn')}
                                    </ElButton>
                                )}
                                {unref(terminalOpen) ? (
                                    <Terminal
                                        ref={terminalRef}
                                        style={'height: calc(100vh - 312px); margin-top: 18px'}
                                    />
                                ) : null}
                            </ElForm>
                        </>
                    ),
                }}
            />
        );
    },
    options,
);
