import { $t } from '@/utils/i18n-t';
import { reactive, ref } from 'vue';
import { FormInstance } from 'element-plus';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import { Rules } from '@/global/form-rules';
import { MsgError, MsgSuccess } from '@/utils/message';
import { routerToFileWithPath } from '@/utils/router';
interface DialogProps {
    names: Array<string>;
}
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElTag } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: (...args: unknown[]) => true,
};

const options = {
    name: 'import',
    props: {},
    emits: emits,
    __scopeId: 'data-v-889f5f1b',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const drawerVisible = ref(false);
        const loading = ref();
        const formRef = ref();
        const backupOptions = ref();
        const fileNames = ref();
        const existNames = ref();
        const backupPath = ref('');
        const localAccountID = ref(0);
        const form = reactive({
            backupAccountID: 0,
            names: [],
            description: '',
        });
        const rules = reactive({
            backupAccountID: [Rules.requiredSelect],
            names: [Rules.requiredSelect],
        });
        const acceptParams = (params: DialogProps): void => {
            form.backupAccountID = undefined;
            existNames.value = params.names;
            form.names = [] as Array<string>;
            loadBackups();
            loadBackupDir();
            drawerVisible.value = true;
        };
        const handleClose = () => {
            drawerVisible.value = false;
        };
        const checkDisable = (val: string) => {
            for (const item of existNames.value) {
                if (val === item + '.tar.gz') {
                    return true;
                }
            }
            return false;
        };
        const toFolder = async () => {
            const res = await rpc.file.checkFile({ path: backupPath.value, withInit: true });
            if (res.exists) {
                routerToFileWithPath(backupPath.value);
            } else {
                MsgError(i18n.global.t('file.noSuchFile'));
            }
        };
        const loadBackupDir = async () => {
            const res = await rpc.backup.getLocalBackupDir({});
            backupPath.value = `${res.dir}${res.dir.endsWith('/') ? '' : '/'}system_snapshot`;
        };
        const submitImport = async (formEl: FormInstance | undefined) => {
            loading.value = true;
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                await rpc.snapshot
                    .import({ ...form })
                    .then(() => {
                        ctx.emit('search');
                        loading.value = false;
                        drawerVisible.value = false;
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            });
        };
        const loadBackups = async () => {
            loading.value = true;
            await rpc.backup
                .loadBackupOptions({})
                .then((res) => {
                    loading.value = false;
                    backupOptions.value = [];
                    for (const item of res.items) {
                        if (item.type === 'LOCAL') {
                            localAccountID.value = item.id;
                        }
                        backupOptions.value.push({
                            id: item.id,
                            type: i18n.global.t('setting.' + item.type),
                            name: item.name,
                        });
                    }
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const loadFiles = async () => {
            form.names = [];
            const res = await rpc.backup.listBackupFiles({ id: form.backupAccountID });
            fileNames.value = res.files || [];
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
                header={$t('commons.button.sync')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="small"
                v-slots={{
                    footer: () => (
                        <>
                            <ElButton
                                disabled={unref(loading)}
                                onClick={($event?: any) => {
                                    drawerVisible.value = false;
                                }}
                            >
                                {$t('commons.button.cancel')}
                            </ElButton>
                            <ElButton
                                disabled={unref(loading)}
                                type="primary"
                                onClick={($event?: any) => {
                                    submitImport(unref(formRef));
                                }}
                            >
                                {$t('commons.button.confirm')}
                            </ElButton>
                        </>
                    ),
                }}
            >
                {withDirectives(
                    <ElForm ref={formRef} label-position="top" model={form} rules={rules}>
                        <ElFormItem label={$t('setting.backupAccount')} prop="from">
                            <ElSelect
                                onChange={($event?: any) => {
                                    loadFiles();
                                }}
                                modelValue={form.backupAccountID}
                                onUpdate:modelValue={($v) => {
                                    form.backupAccountID = $v as any;
                                }}
                                clearable
                            >
                                {(unref(backupOptions) || []).map((item) => (
                                    <div key={item.id}>
                                        {item.type !== $t('setting.LOCAL') ? (
                                            <ElOption value={item.id} label={item.name}>
                                                {item.name}
                                                <ElTag type="primary" class={'tagClass'}>
                                                    {item.type}
                                                </ElTag>
                                            </ElOption>
                                        ) : (
                                            <ElOption value={item.id} label={item.type} />
                                        )}
                                    </div>
                                ))}
                            </ElSelect>
                            {form.backupAccountID === unref(localAccountID) ? (
                                <div>
                                    <span class={'import-help'}>{$t('setting.importHelper')}</span>
                                    <span
                                        onClick={($event?: any) => {
                                            toFolder();
                                        }}
                                        class={'import-link-help'}
                                    >
                                        {unref(backupPath)}
                                    </span>
                                </div>
                            ) : null}
                        </ElFormItem>
                        <ElFormItem label={$t('commons.table.name')} prop="names">
                            <ElSelect
                                modelValue={form.names}
                                onUpdate:modelValue={($v) => {
                                    form.names = $v as any;
                                }}
                                multiple
                                clearable
                            >
                                {(unref(fileNames) || []).map((item) => (
                                    <ElOption disabled={checkDisable(item)} value={item} label={item} key={item} />
                                ))}
                            </ElSelect>
                        </ElFormItem>
                        <ElFormItem label={$t('commons.table.description')} prop="description">
                            <ElInput
                                type="textarea"
                                clearable
                                modelValue={form.description}
                                onUpdate:modelValue={($v) => {
                                    form.description = $v as any;
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
