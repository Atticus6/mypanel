import { $t } from '@/utils/i18n-t';
import { ref } from 'vue';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import { MsgError, MsgWarning } from '@/utils/message';
import { jumpToPath } from '@/utils/router';
import { useRouter } from 'vue-router';
import { useGlobalStore } from '@/composables/useGlobalStore';
interface DialogProps {
    port: any;
    ip: string;
    protocol: string;
    path?: string;
    query?: string;
    hash?: string;
}
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElAlert } from 'element-plus';
import { ElLink } from 'element-plus';
import { ElButton } from 'element-plus';
import DialogPro from '@/components/dialog-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'port-jump',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNodeAddr, isMaster } = useGlobalStore();
        const router = useRouter();
        const open = ref();
        const acceptParams = async (params: DialogProps): Promise<void> => {
            if (Number(params.port) === 0) {
                MsgError(i18n.global.t('commons.msg.errPort'));
                return;
            }
            let protocol = params.protocol === 'https' ? 'https' : 'http';
            const res = await rpc.agentSetting.getInfo({});
            if (!res.systemIp) {
                if (!isMaster.value || currentNodeAddr.value != '127.0.0.1') {
                    res.systemIp = currentNodeAddr.value;
                } else {
                    open.value = true;
                    return;
                }
            }
            const buildUrl = (host: string) => {
                let url = `${protocol}://${host}:${params.port}`;
                if (params.path) {
                    url += params.path.startsWith('/') ? params.path : `/${params.path}`;
                }
                if (params.query) {
                    url += params.query.startsWith('?') ? params.query : `?${params.query}`;
                }
                if (params.hash) {
                    url += params.hash.startsWith('#') ? params.hash : `#${params.hash}`;
                }
                return url;
            };
            if (res.systemIp.indexOf(':') === -1) {
                if (params.ip && params.ip === 'ipv6') {
                    MsgWarning(i18n.global.t('setting.systemIPWarning1', ['IPv4']));
                    return;
                }
                window.open(buildUrl(res.systemIp), '_blank');
            } else {
                if (params.ip && params.ip === 'ipv4') {
                    MsgWarning(i18n.global.t('setting.systemIPWarning1', ['IPv6']));
                    return;
                }
                window.open(buildUrl(`[${res.systemIp}]`), '_blank');
            }
        };
        ctx.expose({ acceptParams });
        return () => (
            <div>
                <DialogPro
                    modelValue={unref(open)}
                    onUpdate:modelValue={($v) => {
                        open.value = $v as any;
                    }}
                    title={$t('app.checkTitle')}
                    size="small"
                    v-slots={{
                        footer: () => (
                            <>
                                <span class={'dialog-footer'}>
                                    <ElButton
                                        onClick={($event?: any) => {
                                            open.value = false;
                                        }}
                                    >
                                        {$t('commons.button.cancel')}
                                    </ElButton>
                                </span>
                            </>
                        ),
                    }}
                >
                    <ElAlert closable={false} title={$t('setting.systemIPWarning')} type="info">
                        <ElLink
                            icon="Position"
                            onClick={($event?: any) => {
                                jumpToPath(unref(router), '/settings/panel');
                            }}
                            type="primary"
                        >
                            {$t('firewall.quickJump')}
                        </ElLink>
                    </ElAlert>
                </DialogPro>
            </div>
        );
    },
    options,
);
