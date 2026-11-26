import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { ref } from 'vue';
import { rpc } from '@/lib/rpc';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';
import CodemirrorPro from '@/components/codemirror-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'auth-keys',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const conf = ref();
        const loading = ref();
        const open = ref();
        const acceptParams = async (): Promise<void> => {
            loadFile();
            open.value = true;
        };
        const loadFile = async () => {
            const res = await rpc.ssh.loadFile({ name: 'authKeys' });
            conf.value = res.content || '';
        };
        const onSaveFile = async () => {
            ElMessageBox.confirm(i18n.global.t('ssh.authKeysHelper'), i18n.global.t('ssh.authKeys'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
                type: 'info',
            }).then(async () => {
                loading.value = true;
                await rpc.ssh
                    .updateFile({ key: 'authKeys', value: conf.value })
                    .then(() => {
                        loading.value = false;
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        open.value = false;
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            });
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <div>
                <DrawerPro
                    modelValue={unref(open)}
                    onUpdate:modelValue={($v) => {
                        open.value = $v as any;
                    }}
                    header={$t('ssh.authKeys')}
                    size="large"
                    v-slots={{
                        footer: () => (
                            <>
                                <span class={'dialog-footer'}>
                                    <ElButton
                                        disabled={unref(loading)}
                                        type="primary"
                                        onClick={($event?: any) => {
                                            (onSaveFile as any)($event);
                                        }}
                                    >
                                        {$t('commons.button.save')}
                                    </ElButton>
                                </span>
                            </>
                        ),
                    }}
                >
                    {withDirectives(
                        <div>
                            <CodemirrorPro
                                heightDiff={160}
                                modelValue={unref(conf)}
                                onUpdate:modelValue={($v) => {
                                    conf.value = $v as any;
                                }}
                                lineWrapping={true}
                                placeholder="# The authorized_keys file does not exist or is empty (~/ssh/authorized_keys)"
                            />
                        </div>,
                        [[vLoading, unref(loading)]],
                    )}
                </DrawerPro>
            </div>
        );
    },
    options,
);
