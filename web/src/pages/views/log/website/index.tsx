import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import LogFile from '@/components/log/file/index';
import MainDiv from '@/components/main-div/index';
import { rpc } from '@/lib/rpc';
import permissionDirective from '@/directives/modules/permission';
import { cn } from '@/utils/cn';
import LayoutContent from '@/components/layout-content/index';
import ConfirmDialog from '@/components/confirm-dialog/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'website',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const logConfig = reactive({
            type: 'website',
            id: undefined,
            name: 'access.log',
            colorMode: 'nginx',
        });
        const showLog = ref(false);
        const loading = ref(false);
        const websites = ref();
        const confirmDialogRef = ref();
        const tailLog = ref(false);
        const logRef = ref();
        const hasContent = ref(false);
        const searchLog = () => {
            showLog.value = false;
            nextTick(() => {
                showLog.value = true;
            });
        };
        const getWebsites = async () => {
            loading.value = true;
            await rpc.website
                .list({})
                .then((res) => {
                    websites.value = res.items || [];
                    if (websites.value.length > 0) {
                        logConfig.id = websites.value[0].id;
                        showLog.value = true;
                    }
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        const changeType = (type: string) => {
            logConfig.name = type;
            if (logConfig.id != undefined) {
                searchLog();
            }
        };
        const changeWebsite = () => {
            searchLog();
        };
        const onClean = async () => {
            const params = {
                header: i18n.global.t('logs.deleteLogs'),
                operationInfo: i18n.global.t('commons.msg.delete'),
                submitInputInfo: i18n.global.t('logs.deleteLogs'),
            };
            confirmDialogRef.value!.acceptParams(params);
        };
        const onDownload = async () => {
            logRef.value.onDownload();
        };
        const changeTail = () => {
            logRef.value.changeTail(true);
        };
        const onSubmitClean = async () => {
            const req = {
                id: logConfig.id,
                operate: 'delete',
                logType: logConfig.name,
            };
            loading.value = true;
            rpc.website
                .operateLog(req as any)
                .then(() => {
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    searchLog();
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        onMounted(() => {
            getWebsites();
        });
        return () => (
            <div>
                {withDirectives(
                    <LayoutContent
                        title={$t('logs.websiteLog')}
                        v-slots={{
                            search: () => (
                                <>
                                    <ElButton
                                        type={logConfig.name === 'access.log' ? 'primary' : ''}
                                        onClick={($event?: any) => {
                                            changeType('access.log');
                                        }}
                                        class={cn('tag-button', logConfig.name === 'access.log' ? '' : 'no-active')}
                                    >
                                        {$t('logs.runLog')}
                                    </ElButton>
                                    <ElButton
                                        type={logConfig.name === 'error.log' ? 'primary' : ''}
                                        onClick={($event?: any) => {
                                            changeType('error.log');
                                        }}
                                        class={cn('tag-button', logConfig.name === 'error.log' ? '' : 'no-active')}
                                    >
                                        {$t('logs.errLog')}
                                    </ElButton>
                                </>
                            ),
                            leftToolBar: () => (
                                <>
                                    <ElSelect
                                        modelValue={logConfig.id}
                                        onUpdate:modelValue={($v) => {
                                            logConfig.id = $v as any;
                                        }}
                                        onChange={($event?: any) => {
                                            changeWebsite();
                                        }}
                                        class={'p-w-200'}
                                        v-slots={{ prefix: () => <>{$t('menu.website')}</> }}
                                    >
                                        {(unref(websites) || []).map((website, index) => (
                                            <ElOption label={website.primaryDomain} value={website.id} key={index} />
                                        ))}
                                    </ElSelect>
                                    <ElButton>
                                        <ElCheckbox
                                            modelValue={unref(tailLog)}
                                            onUpdate:modelValue={($v) => {
                                                tailLog.value = $v as any;
                                            }}
                                            onChange={($event?: any) => {
                                                (changeTail as any)($event);
                                            }}
                                            disabled={logConfig.id == undefined}
                                        >
                                            {$t('commons.button.watch')}
                                        </ElCheckbox>
                                    </ElButton>
                                    {withDirectives(
                                        <ElButton
                                            onClick={($event?: any) => {
                                                (onDownload as any)($event);
                                            }}
                                            icon="Download"
                                            disabled={!unref(hasContent)}
                                        >
                                            {$t('commons.button.download')}
                                        </ElButton>,
                                        [[permissionDirective, true]],
                                    )}
                                    {withDirectives(
                                        <ElButton
                                            type="primary"
                                            plain
                                            onClick={($event?: any) => {
                                                onClean();
                                            }}
                                            disabled={!unref(hasContent)}
                                        >
                                            {$t('logs.deleteLogs')}
                                        </ElButton>,
                                        [[permissionDirective, true]],
                                    )}
                                </>
                            ),
                            main: () => (
                                <>
                                    <MainDiv heightDiff={330}>
                                        {unref(showLog) ? (
                                            <LogFile
                                                ref={logRef}
                                                config={logConfig}
                                                default-button={false}
                                                loading={unref(loading)}
                                                onUpdate:loading={($v) => {
                                                    loading.value = $v as any;
                                                }}
                                                hasContent={unref(hasContent)}
                                                onUpdate:hasContent={($v) => {
                                                    hasContent.value = $v as any;
                                                }}
                                            />
                                        ) : null}
                                    </MainDiv>
                                </>
                            ),
                        }}
                    />,
                    [[vLoading, unref(loading)]],
                )}
                <ConfirmDialog
                    ref={confirmDialogRef}
                    onConfirm={($event?: any) => {
                        (onSubmitClean as any)($event);
                    }}
                />
            </div>
        );
    },
    options,
);
