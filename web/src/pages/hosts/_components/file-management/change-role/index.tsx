import { $t } from '@/utils/i18n-t';
import { File } from '@/types/file';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import FileRole from '@/components/file-role/index';
import { MsgSuccess } from '@/utils/message';
interface RoleForm {
    path: string;
    isDir: boolean;
    mode: number;
    isLink?: boolean;
    sub?: boolean;
    name?: string;
}
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'change-role',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const open = ref(false);
        const form = ref<RoleForm>({ path: '', isDir: false, mode: 0o755 });
        const loading = ref(false);
        const mode = ref('0755');
        const name = ref('');
        const handleClose = () => {
            open.value = false;
            ctx.emit('close', false);
        };
        const acceptParams = (create: RoleForm) => {
            open.value = true;
            form.value.isDir = create.isDir;
            form.value.path = create.path;
            form.value.isLink = false;
            form.value.sub = false;
            name.value = create.name;

            mode.value = String(create.mode);
        };
        const getMode = (val: number) => {
            form.value.mode = val;
        };
        const submit = async () => {
            loading.value = true;
            rpc.file
                .changeMode({
                    path: form.value.path,
                    mode: BigInt(form.value.mode ?? 0),
                    sub: form.value.sub ?? false,
                })
                .then(() => {
                    MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                    handleClose();
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        ctx.expose({ acceptParams });
        return () => (
            <DrawerPro
                v-model={open.value}
                header={$t('file.editPermissions')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                resource={unref(name)}
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
                {
                    <FileRole
                        mode={unref(mode)}
                        onGetMode={($event?: any) => {
                            (getMode as any)($event);
                        }}
                        key={unref(open).toString()}
                        v-loading={unref(loading)}
                    />
                }
                {unref(form).isDir ? (
                    <ElFormItem>
                        <ElCheckbox v-model={unref(form).sub}>{$t('file.containSub')}</ElCheckbox>
                    </ElFormItem>
                ) : null}
            </DrawerPro>
        );
    },
    options,
);
