import { $t } from '@/utils/i18n-t';
import { Host } from '@/types/host';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { MsgError, MsgSuccess } from '@/utils/message';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { rpc } from '@/lib/rpc';
type FormInstance = InstanceType<typeof ElForm>;
interface DialogProps {
    isLocal: boolean;
    nodeName?: string;
}
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    'on-conn-terminal': (...args: unknown[]) => true,
    'on-new-local': (...args: unknown[]) => true,
    'load-host-tree': (...args: unknown[]) => true,
};

const options = {
    name: 'host-create',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode } = useGlobalStore();
        const targetNode = ref('local');
        const dialogVisible = ref();
        const isOK = ref(false);
        const hostRef = ref<FormInstance>();
        const groupList = ref();
        const defaultGroup = ref();
        let form = reactive<Host.HostOperate>({
            id: 0,
            name: '',
            groupID: 0,
            addr: '',
            port: 22,
            user: '',
            authMode: 'password',
            password: '',
            privateKey: '',
            passPhrase: '',
            rememberPassword: false,
            description: '',
            isLocal: false,
        });
        const rules = reactive({
            addr: [Rules.ipV4V6OrDomain],
            port: [Rules.requiredInput, Rules.port],
            user: [Rules.requiredInput],
            authMode: [Rules.requiredSelect],
            password: [Rules.requiredInput],
            privateKey: [Rules.requiredInput],
        });
        const acceptParams = (__panelSetupProps: DialogProps) => {
            isOK.value = false;
            form.isLocal = __panelSetupProps.isLocal;
            targetNode.value = __panelSetupProps.isLocal
                ? __panelSetupProps.nodeName || currentNode.value || 'local'
                : 'local';
            loadGroups();
            dialogVisible.value = true;
        };
        const handleClose = () => {
            dialogVisible.value = false;
        };
        const loadGroups = async () => {
            const res = await rpc.group.searchGroups({ type: 'host' });
            groupList.value = res.items;
            for (const item of groupList.value) {
                if (item.isDefault) {
                    defaultGroup.value = item.id;
                    break;
                }
            }
            if (form.isLocal) {
                loadLocal();
            } else {
                setDefault();
            }
        };
        const loadLocal = async () => {
            form.id = 0;
            form.addr = '127.0.0.1';
            form.port = 22;
            form.user = 'root';
            form.authMode = 'password';
            form.password = '';
            form.privateKey = '';
            form.passPhrase = '';
            form.rememberPassword = false;
        };
        const setDefault = () => {
            form.id = 0;
            form.addr = '';
            form.name = '';
            form.groupID = defaultGroup.value;
            form.port = 22;
            form.user = '';
            form.authMode = 'password';
            form.password = '';
            form.privateKey = '';
            form.passPhrase = '';
            form.rememberPassword = false;
            form.description = '';
        };
        const submitAddHost = (formEl: FormInstance | undefined, ops: string) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                switch (ops) {
                    case 'testConn':
                        const payload = {
                            name: form.name,
                            addr: form.addr,
                            port: Number(form.port) || 0,
                            user: form.user,
                            authMode: form.authMode,
                            password: form.password,
                            privateKey: form.privateKey,
                            passPhrase: form.passPhrase,
                            rememberPassword: !!form.rememberPassword,
                            description: form.description,
                            groupId: Number(form.groupID) || 0,
                        };
                        const test = form.isLocal
                            ? rpc.agentSetting.testConnByInfo(form as any)
                            : rpc.host.testByInfo(payload);
                        await test.then((res) => {
                            if (res.ok) {
                                isOK.value = true;
                                MsgSuccess(i18n.global.t('terminal.connTestOk'));
                            } else {
                                isOK.value = false;
                                MsgError(i18n.global.t('terminal.connTestFailed'));
                            }
                        });
                        break;
                    case 'saveAndConn':
                        let savedHost: { id: number; addr: string; port: number; name: string } | undefined;
                        if (form.isLocal) {
                            // 本地终端连接走 SSH 设置域（/settings/ssh），尚未迁移。
                            if (form.id == 0) {
                                await rpc.agentSetting.saveLocalConn(form as any);
                            } else {
                                await rpc.host.updateHost({
                                    id: form.id,
                                    groupId: form.groupID,
                                    name: form.name,
                                    addr: form.addr,
                                    port: form.port,
                                    user: form.user,
                                    authMode: form.authMode,
                                    password: form.password,
                                    privateKey: form.privateKey,
                                    passPhrase: form.passPhrase,
                                    rememberPassword: form.rememberPassword,
                                    description: form.description,
                                } as any);
                            }
                        } else if (form.id == 0) {
                            savedHost = await rpc.host.create({
                                name: form.name,
                                addr: form.addr,
                                port: Number(form.port) || 0,
                                user: form.user,
                                authMode: form.authMode,
                                password: form.password,
                                privateKey: form.privateKey,
                                passPhrase: form.passPhrase,
                                rememberPassword: !!form.rememberPassword,
                                description: form.description,
                                groupId: Number(form.groupID) || 0,
                            });
                        } else {
                            savedHost = await rpc.host.updateHost({
                                id: form.id,
                                name: form.name,
                                addr: form.addr,
                                port: Number(form.port) || 0,
                                user: form.user,
                                authMode: form.authMode,
                                password: form.password,
                                privateKey: form.privateKey,
                                passPhrase: form.passPhrase,
                                rememberPassword: !!form.rememberPassword,
                                description: form.description,
                                groupId: Number(form.groupID) || 0,
                            });
                        }
                        dialogVisible.value = false;
                        if (form.isLocal) {
                            ctx.emit('on-new-local', targetNode.value);
                            ctx.emit('load-host-tree');
                            return;
                        }
                        if (!savedHost) return;
                        let title = form.user + '@' + savedHost.addr + ':' + savedHost.port;
                        if (savedHost.name.length !== 0) {
                            title = savedHost.name + '-' + title;
                        }
                        ctx.emit('on-conn-terminal', title, savedHost.id);
                        ctx.emit('load-host-tree');
                        break;
                }
            });
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                v-model={dialogVisible.value}
                header={$t('terminal.addHost')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="large"
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        dialogVisible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    onClick={($event?: any) => {
                                        submitAddHost(unref(hostRef), 'testConn');
                                    }}
                                >
                                    {$t('terminal.testConn')}
                                </ElButton>
                                <ElButton
                                    type="primary"
                                    disabled={!unref(isOK)}
                                    onClick={($event?: any) => {
                                        submitAddHost(unref(hostRef), 'saveAndConn');
                                    }}
                                >
                                    {$t('terminal.saveAndConn')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            >
                <ElForm ref={hostRef} label-width="100px" label-position="top" model={form} rules={rules}>
                    {form.isLocal ? (
                        <ElAlert
                            center
                            title={$t('terminal.connLocalErr')}
                            closable={false}
                            type="warning"
                            class={'common-prompt'}
                        />
                    ) : null}
                    <ElFormItem label={$t('terminal.ip')} prop="addr">
                        <ElInput
                            onChange={($event?: any) => {
                                isOK.value = false;
                            }}
                            clearable
                            modelValue={form.addr}
                            onUpdate:modelValue={($v) => {
                                form.addr = typeof $v === 'string' ? $v.trim() : $v;
                            }}
                        />
                    </ElFormItem>
                    <ElFormItem label={$t('commons.login.username')} prop="user">
                        <ElInput
                            onChange={($event?: any) => {
                                isOK.value = false;
                            }}
                            clearable
                            v-model={form.user}
                        />
                    </ElFormItem>
                    <ElFormItem label={$t('terminal.authMode')} prop="authMode">
                        <ElRadioGroup
                            onChange={($event?: any) => {
                                isOK.value = false;
                            }}
                            v-model={form.authMode}
                        >
                            <ElRadio value="password">{$t('terminal.passwordMode')}</ElRadio>
                            <ElRadio value="key">{$t('terminal.keyMode')}</ElRadio>
                        </ElRadioGroup>
                    </ElFormItem>
                    {form.authMode === 'password' ? (
                        <ElFormItem label={$t('commons.login.password')} prop="password">
                            <ElInput
                                onChange={($event?: any) => {
                                    isOK.value = false;
                                }}
                                clearable
                                show-password
                                type="password"
                                v-model={form.password}
                            />
                        </ElFormItem>
                    ) : null}
                    {form.authMode === 'key' ? (
                        <ElFormItem label={$t('terminal.key')} prop="privateKey">
                            <ElInput
                                onChange={($event?: any) => {
                                    isOK.value = false;
                                }}
                                clearable
                                type="textarea"
                                v-model={form.privateKey}
                            />
                        </ElFormItem>
                    ) : null}
                    {form.authMode === 'key' ? (
                        <ElFormItem label={$t('terminal.keyPassword')} prop="passPhrase">
                            <ElInput
                                onChange={($event?: any) => {
                                    isOK.value = false;
                                }}
                                type="password"
                                show-password
                                clearable
                                v-model={form.passPhrase}
                            />
                        </ElFormItem>
                    ) : null}
                    <ElCheckbox
                        clearable
                        modelValue={form.rememberPassword}
                        onUpdate:modelValue={($v) => {
                            form.rememberPassword = $v === '' ? $v : Number($v);
                        }}
                    >
                        {$t('terminal.rememberPassword')}
                    </ElCheckbox>
                    <ElFormItem label={$t('commons.table.port')} prop="port" class={'mt-2.5'}>
                        <ElInput
                            onChange={($event?: any) => {
                                isOK.value = false;
                            }}
                            clearable
                            modelValue={form.port}
                            onUpdate:modelValue={($v) => {
                                form.port = $v === '' ? $v : Number($v);
                            }}
                        />
                    </ElFormItem>
                    {!form.isLocal ? (
                        <ElFormItem label={$t('commons.table.group')} prop="groupID">
                            <ElSelect filterable v-model={form.groupID} clearable style={'width: 100%'}>
                                {(unref(groupList) || []).map((item) => (
                                    <ElOption label={item.name} value={item.id} key={item.id} />
                                ))}
                            </ElSelect>
                        </ElFormItem>
                    ) : null}
                    {!form.isLocal ? (
                        <ElFormItem label={$t('commons.table.title')} prop="name">
                            <ElInput clearable v-model={form.name} />
                        </ElFormItem>
                    ) : null}
                    {!form.isLocal ? (
                        <ElFormItem label={$t('commons.table.description')} prop="description">
                            <ElInput clearable v-model={form.description} />
                        </ElFormItem>
                    ) : null}
                </ElForm>
            </DrawerPro>
        );
    },
    options,
);
