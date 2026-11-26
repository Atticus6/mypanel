import { $t } from '@/utils/i18n-t';
import { File } from '@/types/file';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import FileRole from '@/components/file-role/index';
import { MsgSuccess } from '@/utils/message';
import { Rules } from '@/global/form-rules';
interface BatchRoleProps {
    files: File.File[];
}
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'batch-role',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const open = ref(false);
        const loading = ref(false);
        const mode = ref('0755');
        const files = ref<File.File[]>([]);
        const users = ref<File.UserInfo[]>([]);
        const groups = ref<string[]>([]);
        const rules = reactive<FormRules>({
            user: [Rules.requiredInput],
            group: [Rules.requiredInput],
        });
        const handleClose = () => {
            open.value = false;
            ctx.emit('close', false);
        };
        const addForm = reactive({
            paths: [] as string[],
            mode: BigInt(755),
            user: '',
            group: '',
            sub: false,
        });
        const acceptParams = (__panelSetupProps: BatchRoleProps) => {
            addForm.paths = [];
            files.value = __panelSetupProps.files;
            files.value.forEach((file) => {
                addForm.paths.push(file.path);
            });
            addForm.mode = BigInt(Number.parseInt(String(__panelSetupProps.files[0].mode), 8));
            addForm.group = __panelSetupProps.files[0].group || __panelSetupProps.files[0].gid + '';
            addForm.user = __panelSetupProps.files[0].user || __panelSetupProps.files[0].uid + '';
            addForm.sub = true;

            mode.value = String(__panelSetupProps.files[0].mode);
            open.value = true;
        };
        const getUserAndGroup = async () => {
            try {
                const res = await rpc.file.getUsersAndGroups({});
                users.value = res.users;
                groups.value = res.groups;
            } catch (error) {
                console.error('Failed to fetch user and group:', error);
            }
        };
        const handleUserChange = (val: string) => {
            const found = users.value.find((u) => u.username === val);
            if (found) {
                addForm.group = found.group;
            }
        };
        const getMode = (val: number) => {
            addForm.mode = BigInt(val);
        };
        const submit = async () => {
            const regFilePermission = /^[0-7]{3,4}$/;
            if (!regFilePermission.test(addForm.mode.toString(8))) {
                return;
            }
            loading.value = true;

            rpc.file
                .batchChangeRole(addForm)
                .then(() => {
                    MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                    handleClose();
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        onMounted(() => {
            getUserAndGroup();
        });
        ctx.expose({ acceptParams });
        return () => (
            <DrawerPro
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
                header={$t('file.editPermissions')}
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
                                        (handleClose as any)($event);
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    type="primary"
                                    onClick={($event?: any) => {
                                        submit();
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
                    <div>
                        <FileRole
                            mode={unref(mode)}
                            onGetMode={($event?: any) => {
                                (getMode as any)($event);
                            }}
                            key={unref(open).toString()}
                        />
                        <ElForm ref="fileForm" label-position="left" model={addForm} label-width="100px" rules={rules}>
                            <ElFormItem label={$t('commons.table.user')} prop="user">
                                <ElSelect
                                    modelValue={addForm.user}
                                    onUpdate:modelValue={($v) => {
                                        addForm.user = $v as any;
                                    }}
                                    onChange={($event?: any) => {
                                        (handleUserChange as any)($event);
                                    }}
                                    filterable
                                    allow-create
                                >
                                    {(unref(users) || []).map((item) => (
                                        <ElOption label={item.username} value={item.username} key={item.username} />
                                    ))}
                                </ElSelect>
                            </ElFormItem>
                            <ElFormItem label={$t('file.group')} prop="group">
                                <ElSelect
                                    modelValue={addForm.group}
                                    onUpdate:modelValue={($v) => {
                                        addForm.group = $v as any;
                                    }}
                                    filterable
                                    allow-create
                                >
                                    {(unref(groups) || []).map((group) => (
                                        <ElOption label={group} value={group} key={group} />
                                    ))}
                                </ElSelect>
                            </ElFormItem>
                            <ElFormItem>
                                <ElCheckbox
                                    modelValue={addForm.sub}
                                    onUpdate:modelValue={($v) => {
                                        addForm.sub = $v as any;
                                    }}
                                >
                                    {$t('file.containSub')}
                                </ElCheckbox>
                            </ElFormItem>
                        </ElForm>
                    </div>,
                    [[vLoading, unref(loading)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
