import { $t } from '@/utils/i18n-t';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { MsgError, MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    title: string;
    rowData?: any;
    getTableList?: () => Promise<any>;
}
type FormInstance = InstanceType<typeof ElForm>;
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'operate',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref();
        const isOK = ref(false);
        const title = ref<string>('');
        const drawerVisible = ref(false);
        const dialogData = ref<DialogProps>({
            title: '',
        });
        const groupList = ref();
        const acceptParams = (params: DialogProps): void => {
            dialogData.value = params;
            title.value = i18n.global.t('commons.button.' + dialogData.value.title);
            drawerVisible.value = true;
            loadGroups();
        };
        const handleClose = () => {
            drawerVisible.value = false;
        };
        const hostInfoRef = ref<FormInstance>();
        const rules = reactive({
            groupID: [Rules.requiredSelect],
            addr: [Rules.ipV4V6OrDomain],
            port: [Rules.requiredInput, Rules.port],
            user: [Rules.requiredInput],
            authMode: [Rules.requiredSelect],
        });
        const loadGroups = async () => {
            const res = await rpc.group.searchGroups({ type: 'host' });
            groupList.value = res.items;
            if (dialogData.value.title === 'create') {
                for (const item of groupList.value) {
                    if (item.isDefault) {
                        dialogData.value.rowData.groupID = item.id;
                        break;
                    }
                }
            }
        };
        const hostPayload = (row: any) => ({
            name: row.name,
            addr: row.addr,
            port: Number(row.port) || 0,
            user: row.user,
            authMode: row.authMode,
            password: row.password,
            privateKey: row.privateKey,
            passPhrase: row.passPhrase,
            rememberPassword: !!row.rememberPassword,
            description: row.description,
            groupId: Number(row.groupID) || 0,
        });
        const submitAddHost = (formEl: FormInstance | undefined, ops: string) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                if (ops === 'create') {
                    loading.value = true;
                    await rpc.host
                        .create(hostPayload(dialogData.value.rowData))
                        .then(() => {
                            loading.value = false;
                            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                            drawerVisible.value = false;
                            ctx.emit('search');
                        })
                        .catch(() => {
                            loading.value = false;
                        });
                }
                if (ops === 'edit') {
                    loading.value = true;
                    await rpc.host
                        .updateHost({ ...hostPayload(dialogData.value.rowData), id: dialogData.value.rowData.id })
                        .then(() => {
                            loading.value = false;
                            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                            drawerVisible.value = false;
                            ctx.emit('search');
                        })
                        .catch(() => {
                            loading.value = false;
                        });
                }
                if (ops === 'testconn') {
                    loading.value = true;
                    await rpc.host
                        .testByInfo(hostPayload(dialogData.value.rowData))
                        .then((res) => {
                            loading.value = false;
                            if (res.ok) {
                                isOK.value = true;
                                MsgSuccess(i18n.global.t('terminal.connTestOk'));
                            } else {
                                isOK.value = false;
                                MsgError(i18n.global.t('terminal.connTestFailed'));
                            }
                        })
                        .catch(() => {
                            loading.value = false;
                        });
                }
            });
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                modelValue={unref(drawerVisible)}
                onUpdate:modelValue={($v) => {
                    drawerVisible.value = $v as any;
                }}
                header={$t('terminal.host')}
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
                                        drawerVisible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    onClick={($event?: any) => {
                                        submitAddHost(unref(hostInfoRef), 'testconn');
                                    }}
                                >
                                    {$t('terminal.testConn')}
                                </ElButton>
                                <ElButton
                                    type="primary"
                                    disabled={!unref(isOK)}
                                    onClick={($event?: any) => {
                                        submitAddHost(unref(hostInfoRef), unref(dialogData).title);
                                    }}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            >
                {withDirectives(
                    <ElForm ref={hostInfoRef} label-position="top" model={unref(dialogData).rowData} rules={rules}>
                        <ElFormItem label={$t('terminal.ip')} prop="addr">
                            <ElInput
                                onChange={($event?: any) => {
                                    isOK.value = false;
                                }}
                                clearable
                                modelValue={unref(dialogData).rowData!.addr}
                                onUpdate:modelValue={($v) => {
                                    unref(dialogData).rowData!.addr = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                            />
                        </ElFormItem>
                        <ElFormItem label={$t('commons.login.username')} prop="user">
                            <ElInput
                                onChange={($event?: any) => {
                                    isOK.value = false;
                                }}
                                clearable
                                modelValue={unref(dialogData).rowData!.user}
                                onUpdate:modelValue={($v) => {
                                    unref(dialogData).rowData!.user = $v as any;
                                }}
                            />
                        </ElFormItem>
                        <ElFormItem label={$t('terminal.authMode')} prop="authMode">
                            <ElRadioGroup
                                onChange={($event?: any) => {
                                    isOK.value = false;
                                }}
                                modelValue={unref(dialogData).rowData!.authMode}
                                onUpdate:modelValue={($v) => {
                                    unref(dialogData).rowData!.authMode = $v as any;
                                }}
                            >
                                <ElRadio value="password">{$t('terminal.passwordMode')}</ElRadio>
                                <ElRadio value="key">{$t('terminal.keyMode')}</ElRadio>
                            </ElRadioGroup>
                        </ElFormItem>
                        {unref(dialogData).rowData!.authMode === 'password' ? (
                            <ElFormItem label={$t('commons.login.password')} prop="password">
                                <ElInput
                                    onChange={($event?: any) => {
                                        isOK.value = false;
                                    }}
                                    clearable
                                    show-password
                                    type="password"
                                    modelValue={unref(dialogData).rowData!.password}
                                    onUpdate:modelValue={($v) => {
                                        unref(dialogData).rowData!.password = $v as any;
                                    }}
                                />
                            </ElFormItem>
                        ) : null}
                        {unref(dialogData).rowData!.authMode === 'key' ? (
                            <ElFormItem label={$t('terminal.key')} prop="privateKey">
                                <ElInput
                                    onChange={($event?: any) => {
                                        isOK.value = false;
                                    }}
                                    clearable
                                    type="textarea"
                                    modelValue={unref(dialogData).rowData!.privateKey}
                                    onUpdate:modelValue={($v) => {
                                        unref(dialogData).rowData!.privateKey = $v as any;
                                    }}
                                />
                            </ElFormItem>
                        ) : null}
                        {unref(dialogData).rowData!.authMode === 'key' ? (
                            <ElFormItem label={$t('terminal.keyPassword')} prop="passPhrase">
                                <ElInput
                                    onChange={($event?: any) => {
                                        isOK.value = false;
                                    }}
                                    type="password"
                                    show-password
                                    clearable
                                    modelValue={unref(dialogData).rowData!.passPhrase}
                                    onUpdate:modelValue={($v) => {
                                        unref(dialogData).rowData!.passPhrase = $v as any;
                                    }}
                                />
                            </ElFormItem>
                        ) : null}
                        <ElCheckbox
                            clearable
                            modelValue={unref(dialogData).rowData!.rememberPassword}
                            onUpdate:modelValue={($v) => {
                                unref(dialogData).rowData!.rememberPassword = $v === '' ? $v : Number($v);
                            }}
                        >
                            {$t('terminal.rememberPassword')}
                        </ElCheckbox>
                        <ElFormItem label={$t('commons.table.port')} prop="port" style={'margin-top: 10px'}>
                            <ElInput
                                onChange={($event?: any) => {
                                    isOK.value = false;
                                }}
                                clearable
                                modelValue={unref(dialogData).rowData!.port}
                                onUpdate:modelValue={($v) => {
                                    unref(dialogData).rowData!.port = $v === '' ? $v : Number($v);
                                }}
                            />
                        </ElFormItem>
                        <ElFormItem label={$t('commons.table.group')} prop="groupID">
                            <ElSelect
                                filterable
                                modelValue={unref(dialogData).rowData!.groupID}
                                onUpdate:modelValue={($v) => {
                                    unref(dialogData).rowData!.groupID = $v as any;
                                }}
                                clearable
                                style={'width: 100%'}
                            >
                                {(unref(groupList) || []).map((item) => (
                                    <ElOption label={item.name} value={item.id} key={item.id} />
                                ))}
                            </ElSelect>
                        </ElFormItem>
                        <ElFormItem label={$t('commons.table.title')} prop="name">
                            <ElInput
                                clearable
                                modelValue={unref(dialogData).rowData!.name}
                                onUpdate:modelValue={($v) => {
                                    unref(dialogData).rowData!.name = $v as any;
                                }}
                            />
                        </ElFormItem>
                        <ElFormItem label={$t('commons.table.description')} prop="description">
                            <ElInput
                                clearable
                                type="textarea"
                                modelValue={unref(dialogData).rowData!.description}
                                onUpdate:modelValue={($v) => {
                                    unref(dialogData).rowData!.description = $v as any;
                                }}
                            />
                        </ElFormItem>
                    </ElForm>,
                    [[vLoading, unref(loading)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
