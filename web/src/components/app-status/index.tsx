import { $t } from '@/utils/i18n-t';
import { onMounted, reactive, ref } from 'vue';
import Status from '@/components/status/index';
import { ElMessageBox } from 'element-plus';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import permissionDirective from '@/directives/modules/permission';
import { ElCard } from 'element-plus';
import { ElTag } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElDivider } from 'element-plus';
import { ElTooltip } from 'element-plus';
import { ElAlert } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
    appKey?: string;
    appName?: string;
    hideSetting?: boolean;
}

const emits = {
    setting: (...args: unknown[]) => true,
    isExist: (...args: unknown[]) => true,
    before: (...args: unknown[]) => true,
    after: (...args: unknown[]) => true,
    'update:loading': (...args: unknown[]) => true,
    'update:maskShow': (...args: unknown[]) => true,
    'update:appInstallID': (...args: unknown[]) => true,
};

const options = {
    name: 'app-status',
    props: {
        appKey: {
            type: String,
            default: 'openresty',
        },
        appName: {
            type: String,
            default: '',
        },
        hideSetting: {
            type: Boolean,
            default: false,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-8b21ab71',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        let key = ref('');
        let name = ref('');
        let data = ref({
            app: '',
            version: '',
            status: '',
            lastBackupAt: '',
            appInstallId: 0,
            isExist: false,
            containerName: '',
        });
        let operateReq = reactive({
            installId: 0,
            operate: '',
        });
        let refresh = ref(1);
        const httpPort = ref(0);
        const httpsPort = ref(0);
        const setting = () => {
            ctx.emit('setting', false);
        };
        const onCheck = async (key: any, name: any) => {
            await rpc.app
                .checkInstalled({ key, name })
                .then((res) => {
                    data.value = res;
                    ctx.emit('isExist', res);
                    ctx.emit('update:maskShow', res.status !== 'Running');
                    operateReq.installId = res.appInstallId;
                    ctx.emit('update:appInstallID', res.appInstallId);
                    httpPort.value = res.httpPort;
                    httpsPort.value = res.httpsPort;
                    refresh.value++;
                })
                .catch(() => {
                    ctx.emit('isExist', false);
                    refresh.value++;
                });
        };
        const onOperate = async (operation: string) => {
            operateReq.operate = operation;
            ElMessageBox.confirm(
                i18n.global.t('app.operatorHelper', [i18n.global.t('commons.operate.' + operation)]),
                i18n.global.t('commons.operate.' + operation),
                {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                    type: 'info',
                },
            ).then(() => {
                ctx.emit('update:maskShow', true);
                ctx.emit('update:loading', true);
                ctx.emit('before');
                rpc.app
                    .operate(operateReq)
                    .then(() => {
                        ctx.emit('update:loading', false);
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        onCheck(key.value, name.value);
                        ctx.emit('after');
                    })
                    .catch(() => {
                        ctx.emit('update:loading', false);
                    });
            });
        };
        onMounted(() => {
            key.value = __panelSetupProps.appKey;
            name.value = __panelSetupProps.appName;
            onCheck(key.value, name.value);
        });
        ctx.expose({
            onCheck,
            getHttpPort: () => httpPort.value,
            getHttpsPort: () => httpsPort.value,
        });
        return () =>
            unref(data).isExist ? (
                <div class={'app-status'}>
                    <ElCard>
                        <div class={'flex w-full flex-col gap-4 md:flex-row'}>
                            <div class={'flex flex-wrap gap-4 ml-3'}>
                                <ElTag effect="dark" type="success">
                                    {unref(data).app}
                                </ElTag>
                                <Status status={unref(data).status} class={'mt-0.5'} key={unref(refresh)} />
                                <ElTag>
                                    {$t('app.version')}
                                    {': '}
                                    {unref(data).version}
                                </ElTag>
                            </div>
                            <div class={'mt-0.5'}>
                                {unref(data).status != 'Running'
                                    ? withDirectives(
                                          <ElButton
                                              type="primary"
                                              link
                                              onClick={($event?: any) => {
                                                  onOperate('start');
                                              }}
                                              disabled={unref(data).status === 'Installing'}
                                          >
                                              {$t('commons.operate.start')}
                                          </ElButton>,
                                          [[permissionDirective, 'app_manage']],
                                      )
                                    : null}
                                {unref(data).status === 'Running'
                                    ? withDirectives(
                                          <ElButton
                                              type="primary"
                                              link
                                              onClick={($event?: any) => {
                                                  onOperate('stop');
                                              }}
                                          >
                                              {$t('commons.operate.stop')}
                                          </ElButton>,
                                          [[permissionDirective, 'app_manage']],
                                      )
                                    : null}
                                <ElDivider direction="vertical" />
                                {withDirectives(
                                    <ElButton
                                        type="primary"
                                        link
                                        disabled={unref(data).status === 'Installing'}
                                        onClick={($event?: any) => {
                                            onOperate('restart');
                                        }}
                                    >
                                        {$t('commons.operate.restart')}
                                    </ElButton>,
                                    [[permissionDirective, 'app_manage']],
                                )}
                                {!__panelSetupProps.hideSetting ? <ElDivider direction="vertical" /> : null}
                                {unref(data).app === 'OpenResty'
                                    ? withDirectives(
                                          <ElButton
                                              type="primary"
                                              link
                                              onClick={($event?: any) => {
                                                  onOperate('reload');
                                              }}
                                              disabled={unref(data).status !== 'Running'}
                                          >
                                              {$t('commons.operate.reload')}
                                          </ElButton>,
                                          [[permissionDirective, 'website_manage']],
                                      )
                                    : null}
                                {unref(data).app === 'OpenResty' ? <ElDivider direction="vertical" /> : null}
                                {!__panelSetupProps.hideSetting ? (
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            (setting as any)($event);
                                        }}
                                        link
                                        disabled={unref(data).status === 'Installing'}
                                    >
                                        {$t('commons.button.set')}
                                    </ElButton>
                                ) : null}
                            </div>
                            {unref(key) === 'openresty' && (unref(httpPort) != 80 || unref(httpsPort) != 443) ? (
                                <div class={'ml-5'}>
                                    <ElTooltip
                                        effect="dark"
                                        content={$t('website.openrestyHelper', [unref(httpPort), unref(httpsPort)])}
                                        placement="top-start"
                                    >
                                        <ElAlert
                                            title={$t('app.checkTitle')}
                                            closable={false}
                                            center
                                            type="warning"
                                            show-icon
                                            class={'h-6 check-title'}
                                        />
                                    </ElTooltip>
                                </div>
                            ) : null}
                        </div>
                    </ElCard>
                </div>
            ) : null;
    },
    options,
);
