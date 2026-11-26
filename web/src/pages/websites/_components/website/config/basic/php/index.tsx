import { $t } from '@/utils/i18n-t';
interface ReqPage {
    page: number;
    pageSize: number;
}
interface RuntimeReq extends ReqPage {
    name?: string;
    status?: string;
    type?: string;
}
import { Website } from '@/types/website';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import Composer from './composer/index';
import { rpc } from '@/lib/rpc';

interface CodemodProps {
    [key: string]: any;
    id?: number;
}

const emits = {};

const options = {
    name: 'php',
    props: {
        id: {
            type: Number,
            default: 0,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const runtimeReq = reactive<RuntimeReq>({ page: 1, pageSize: 200, type: 'php' });
        const versionReq = reactive<Website.PHPVersionChange>({
            websiteID: undefined,
            runtimeID: undefined,
        });
        const versions = ref([]);
        const loading = ref(false);
        const oldRuntimeID = ref(0);
        const website = ref({
            type: '',
            openBaseDir: false,
            runtimeType: '',
        });
        const openBaseDir = ref(false);
        const tabIndex = ref('0');
        const getRuntimes = async () => {
            try {
                loading.value = true;
                // 运行时能力已剔除，不再请求 runtime 列表。
                const items: any[] = [];
                for (const item of items) {
                    versions.value.push({
                        value: item.id,
                        label: item.name + ' [' + i18n.global.t('app.version') + ':' + item.params['PHP_VERSION'] + ']',
                    });
                }
            } catch (error) {}
            loading.value = false;
        };
        const submit = async () => {
            try {
                ElMessageBox.confirm(
                    i18n.global.t('website.changePHPVersionWarn'),
                    i18n.global.t('website.changeVersion'),
                    {
                        confirmButtonText: i18n.global.t('commons.button.confirm'),
                        cancelButtonText: i18n.global.t('commons.button.cancel'),
                    },
                ).then(async () => {
                    loading.value = true;
                    try {
                        await rpc.website.changePHPVersion({
                            websiteId: versionReq.websiteID,
                            runtimeId: Number(versionReq.runtimeID) || 0,
                        });
                        MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                        getWebsiteDetail();
                    } catch (error) {}
                    loading.value = false;
                });
            } catch (error) {}
        };
        const getWebsiteDetail = async () => {
            const res = await rpc.website.getWebsite({ id: __panelSetupProps.id });
            versionReq.runtimeID = res.runtimeId;
            oldRuntimeID.value = res.runtimeId;
            website.value = res as any;
            openBaseDir.value = (res as any).openBaseDir || false;
        };
        const operateCrossSite = async () => {
            try {
                await rpc.website.operateCrossSite({
                    websiteId: __panelSetupProps.id,
                    operation: openBaseDir.value ? 'Enable' : 'Disable',
                });
                MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                getWebsiteDetail();
            } catch (error) {}
        };
        onMounted(() => {
            versionReq.websiteID = __panelSetupProps.id;
            getWebsiteDetail();
            getRuntimes();
        });
        return () => (
            <div v-loading={unref(loading)}>
                <ElTabs type="border-card" v-model={tabIndex.value}>
                    <ElTabPane label={$t('website.changeVersion')}>
                        {unref(tabIndex) == '0' ? (
                            <ElForm label-position="right" label-width="100px">
                                {unref(website).type === 'static' ? (
                                    <ElFormItem>
                                        <ElText type="info">{$t('website.staticChangePHPHelper')}</ElText>
                                    </ElFormItem>
                                ) : null}
                                <ElFormItem label={$t('website.changeVersion')}>
                                    <ElRow gutter={20}>
                                        <ElCol span={20}>
                                            <ElSelect v-model={versionReq.runtimeID} class={'p-w-200'}>
                                                <ElOption label={$t('website.static')} value={0} key={-1} />
                                                {(unref(versions) || []).map((item, index) => (
                                                    <ElOption label={item.label} value={item.value} key={index} />
                                                ))}
                                            </ElSelect>
                                        </ElCol>
                                        <ElCol span={4}>
                                            {
                                                <ElButton
                                                    type="primary"
                                                    onClick={($event?: any) => {
                                                        submit();
                                                    }}
                                                    disabled={versionReq.runtimeID === unref(oldRuntimeID)}
                                                    v-permission={true}
                                                >
                                                    {$t('commons.button.save')}
                                                </ElButton>
                                            }
                                        </ElCol>
                                    </ElRow>
                                </ElFormItem>
                            </ElForm>
                        ) : null}
                    </ElTabPane>
                    {unref(website).type === 'runtime' && unref(website).runtimeType == 'php' ? (
                        <ElTabPane label={$t('website.openBaseDir')}>
                            {unref(tabIndex) == '1' ? (
                                <ElForm label-position="right" label-width="100px">
                                    <ElFormItem label={$t('website.openBaseDir')}>
                                        {
                                            <ElSwitch
                                                v-model={openBaseDir.value}
                                                onChange={($event?: any) => {
                                                    (operateCrossSite as any)($event);
                                                }}
                                                v-permission={true}
                                            />
                                        }
                                        <span class={'input-help'}>{$t('website.openBaseDirHelper')}</span>
                                    </ElFormItem>
                                </ElForm>
                            ) : null}
                        </ElTabPane>
                    ) : null}
                    {unref(website).type === 'runtime' && unref(website).runtimeType == 'php' ? (
                        <ElTabPane label={'Composer'}>
                            {unref(tabIndex) == '2' ? <Composer websiteID={__panelSetupProps.id} /> : null}
                        </ElTabPane>
                    ) : null}
                </ElTabs>
            </div>
        );
    },
    options,
);
