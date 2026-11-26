import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { rpc } from '@/lib/rpc';
import { MsgSuccess } from '@/utils/message';
import { Group } from '@/types/group';
import { Rules } from '@/global/form-rules';
interface DialogProps {
    type: string;
}
import DrawerPro from '@/components/drawer-pro/index';
import ComplexTable from '@/components/table/complex/ComplexTable';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'agent-group',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const open = ref(false);
        const type = ref();
        const data = ref();
        const handleClose = () => {
            open.value = false;
            data.value = [];
            ctx.emit('search');
        };
        const groupForm = ref<FormInstance>();
        const acceptParams = (params: DialogProps): void => {
            type.value = params.type;
            open.value = true;
            search();
        };
        const search = () => {
            rpc.group.searchGroups({ type: type.value }).then((res) => {
                data.value = res.items || [];
            });
        };
        const saveGroup = async (formEl: FormInstance, group: Group.GroupInfo) => {
            if (!formEl) return;
            await formEl.validate((valid) => {
                if (!valid) {
                    return;
                }
                group.type = type.value;
                if (group.id == 0) {
                    rpc.group.createGroup({ id: group.id, name: group.name, type: group.type }).then(() => {
                        MsgSuccess(i18n.global.t('commons.msg.createSuccess'));
                        search();
                    });
                } else {
                    rpc.group
                        .updateGroup({ id: group.id, name: group.name, type: group.type, isDefault: group.isDefault })
                        .then(() => {
                            MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                            search();
                        });
                }
            });
        };
        const setDefault = (group: Group.GroupInfo) => {
            group.isDefault = true;
            group.type = type.value;
            rpc.group
                .updateGroup({ id: group.id, name: group.name, type: group.type, isDefault: group.isDefault })
                .then(() => {
                    MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                    search();
                });
        };
        const openCreate = () => {
            for (const d of data.value) {
                if (d.name == '') {
                    return;
                }
                if (d.edit) {
                    d.edit = false;
                }
            }
            const g = {
                id: 0,
                name: '',
                isDefault: false,
                edit: true,
                status: 'Enable',
            };
            data.value.unshift(g);
        };
        const removeGroup = (index: number) => {
            const group = data.value[index];

            if (group.id > 0) {
                rpc.group.deleteGroup({ id: group.id }).then(() => {
                    data.value.splice(index, 1);
                    MsgSuccess(i18n.global.t('commons.msg.deleteSuccess'));
                });
            } else {
                data.value.splice(index, 1);
            }
        };
        const editGroup = (index: number) => {
            for (const i in data.value) {
                const d = data.value[i];
                if (d.name == '') {
                    data.value.splice(Number(i), 1);
                }
                if (d.edit) {
                    d.edit = false;
                }
            }
            data.value[index].edit = true;
        };
        ctx.expose({ acceptParams });
        return () => (
            <DrawerPro
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
                header={$t('commons.table.group')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="large"
                back={handleClose}
                v-slots={{
                    content: () => (
                        <>
                            <ComplexTable
                                data={unref(data)}
                                onSearch={($event?: any) => {
                                    search();
                                }}
                                v-slots={{
                                    toolbar: () => (
                                        <>
                                            <ElButton
                                                type="primary"
                                                onClick={($event?: any) => {
                                                    (openCreate as any)($event);
                                                }}
                                            >
                                                {$t('website.createGroup')}
                                            </ElButton>
                                        </>
                                    ),
                                }}
                            >
                                <ElTableColumn
                                    label={$t('commons.table.name')}
                                    prop="name"
                                    v-slots={{
                                        default: ({ row }) => (
                                            <>
                                                {!row.edit ? (
                                                    <div>
                                                        <span>{row.name}</span>
                                                        {row.isDefault ? (
                                                            <ElTag type="success" size="small" class={'ml-2'}>
                                                                {' ('}
                                                                {$t('commons.table.default')}
                                                                {') '}
                                                            </ElTag>
                                                        ) : null}
                                                        {row.isDelete ? (
                                                            <ElTag type="warning" size="small" class={'ml-4'}>
                                                                {$t('app.takeDown')}
                                                            </ElTag>
                                                        ) : null}
                                                    </div>
                                                ) : null}
                                                {row.edit ? (
                                                    <ElForm
                                                        onSubmit={($event?: any) => {
                                                            $event.preventDefault();
                                                        }}
                                                        ref={groupForm}
                                                        model={row}
                                                    >
                                                        {row.edit ? (
                                                            <ElFormItem prop="name" rules={Rules.name}>
                                                                <div style={'margin-top: 20px; width: 100%'}>
                                                                    <ElInput
                                                                        modelValue={row.name}
                                                                        onUpdate:modelValue={($v) => {
                                                                            row.name = $v as any;
                                                                        }}
                                                                    />
                                                                </div>
                                                            </ElFormItem>
                                                        ) : null}
                                                    </ElForm>
                                                ) : null}
                                            </>
                                        ),
                                    }}
                                />
                                <ElTableColumn
                                    label={$t('commons.table.operate')}
                                    v-slots={{
                                        default: ({ row, $index }) => (
                                            <>
                                                <div>
                                                    {row.edit ? (
                                                        <ElButton
                                                            link
                                                            type="primary"
                                                            onClick={($event?: any) => {
                                                                saveGroup(unref(groupForm), row);
                                                            }}
                                                        >
                                                            {$t('commons.button.save')}
                                                        </ElButton>
                                                    ) : null}
                                                    {!row.edit ? (
                                                        <ElButton
                                                            link
                                                            type="primary"
                                                            onClick={($event?: any) => {
                                                                editGroup($index);
                                                            }}
                                                        >
                                                            {$t('commons.button.edit')}
                                                        </ElButton>
                                                    ) : null}
                                                    {!row.edit ? (
                                                        <ElButton
                                                            link
                                                            disabled={row.isDefault}
                                                            type="primary"
                                                            onClick={($event?: any) => {
                                                                removeGroup($index);
                                                            }}
                                                        >
                                                            {$t('commons.button.delete')}
                                                        </ElButton>
                                                    ) : null}
                                                    {row.edit ? (
                                                        <ElButton
                                                            link
                                                            type="primary"
                                                            onClick={($event?: any) => {
                                                                search();
                                                            }}
                                                        >
                                                            {$t('commons.button.cancel')}
                                                        </ElButton>
                                                    ) : null}
                                                    {!row.edit && !row.isDefault && !row.isDelete ? (
                                                        <ElButton
                                                            link
                                                            type="primary"
                                                            onClick={($event?: any) => {
                                                                setDefault(row);
                                                            }}
                                                        >
                                                            {$t('website.setDefault')}
                                                        </ElButton>
                                                    ) : null}
                                                </div>
                                            </>
                                        ),
                                    }}
                                />
                            </ComplexTable>
                        </>
                    ),
                }}
            />
        );
    },
    options,
);
