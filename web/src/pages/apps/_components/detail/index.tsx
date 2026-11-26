import { $t } from '@/utils/i18n-t';
import MarkDownEditor from '@/components/mkdown-editor/index';
import { getAppIconUrl } from '@/api/modules/app';
import { rpc } from '@/lib/rpc';
import Install from './install/index';
import { computeSizeFromMB } from '@/utils/size';
import { jumpToInstall } from '@/utils/app';
import { useGlobalStore } from '@/composables/useGlobalStore';
import './index.styles.css';
import DrawerPro from '@/components/drawer-pro/index';
import SvgIcon from '@/components/svg-icon/svg-icon';
import { Promotion } from '@element-plus/icons-vue';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'detail',
    props: {},
    emits: emits,
    __scopeId: 'data-v-787f760a',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode } = useGlobalStore();
        const app = ref<any>({});
        const appDetail = ref<any>({});
        const version = ref('');
        const loadingDetail = ref(false);
        const loadingApp = ref(false);
        const installRef = ref();
        const open = ref(false);
        const appKey = ref();
        const operate = ref();
        const architectures = ref([]);
        const acceptParams = async (key: string, op: string) => {
            appKey.value = key;
            operate.value = op;
            open.value = true;
            getApp();
        };
        const handleClose = () => {
            open.value = false;
        };
        const getApp = async () => {
            loadingApp.value = true;
            try {
                const res = await rpc.app.getApp({ key: appKey.value });
                app.value = res;
                version.value = app.value.versions[0];
                getDetail(app.value.id, version.value);
            } finally {
                loadingApp.value = false;
            }
        };
        const getDetail = async (id: number, version: string) => {
            loadingDetail.value = true;
            try {
                const res = await rpc.app.getAppDetail({ appId: id, version, type: 'app' });
                appDetail.value = JSON.parse(res.detailJson || '{}');
                if (appDetail.value.architectures != '') {
                    architectures.value = appDetail.value.architectures.split(',');
                }
            } finally {
                loadingDetail.value = false;
            }
        };
        const toLink = (link: string) => {
            window.open(link, '_blank');
        };
        const openInstall = () => {
            if (!jumpToInstall(app.value.type, app.value.key)) {
                const params = {
                    app: app.value,
                };
                installRef.value.acceptParams(params);
                open.value = false;
            }
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <>
                <DrawerPro
                    v-model={open.value}
                    header={$t('app.detail')}
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                    size="large"
                    v-slots={{
                        content: () => (
                            <>
                                {
                                    <div class={'brief'} v-loading={unref(loadingApp)}>
                                        <div class={'detail flex'}>
                                            <div class={'icon h-12 w-12 rounded p-1 shadow-md'}>
                                                <ElAvatar
                                                    src={getAppIconUrl(
                                                        unref(app).key,
                                                        unref(currentNode),
                                                        unref(app).icon,
                                                    )}
                                                    alt="App Icon"
                                                    shape="square"
                                                    fit="contain"
                                                    class={'!h-full !w-full rounded'}
                                                >
                                                    <SvgIcon iconName="p-appstore" />
                                                </ElAvatar>
                                            </div>
                                            <div class={'ml-4'}>
                                                <div class={'name mb-2'}>
                                                    <span>{unref(app).name}</span>
                                                </div>
                                                <div class={'description mb-4'}>
                                                    <span>{unref(app).description}</span>
                                                </div>
                                                <br />
                                                {!unref(loadingDetail) ? (
                                                    <div class={'mb-2'}>
                                                        {!unref(appDetail).enable ? (
                                                            <ElAlert
                                                                title={$t('app.limitHelper')}
                                                                type="warning"
                                                                show-icon
                                                                closable={false}
                                                            />
                                                        ) : null}
                                                    </div>
                                                ) : null}
                                                {unref(appDetail).enable && unref(operate) === 'install' ? (
                                                    <ElButton
                                                        round
                                                        onClick={($event?: any) => {
                                                            (openInstall as any)($event);
                                                        }}
                                                        type="primary"
                                                        class={'brief-button'}
                                                        v-permission={true}
                                                    >
                                                        {$t('commons.button.install')}
                                                    </ElButton>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div class={'descriptions'}>
                                            <ElDescriptions border size="large" direction="vertical">
                                                <ElDescriptionsItem label={$t('app.appOfficeWebsite')}>
                                                    <ElLink
                                                        onClick={($event?: any) => {
                                                            toLink(unref(app).website);
                                                        }}
                                                    >
                                                        {$t('app.link')}
                                                        <ElIcon class={'ml-1.5'}>
                                                            <Promotion />
                                                        </ElIcon>
                                                    </ElLink>
                                                </ElDescriptionsItem>
                                                <ElDescriptionsItem label={$t('app.github')}>
                                                    <ElLink
                                                        onClick={($event?: any) => {
                                                            toLink(unref(app).github);
                                                        }}
                                                    >
                                                        {$t('app.link')}
                                                        <ElIcon class={'ml-1.5'}>
                                                            <Promotion />
                                                        </ElIcon>
                                                    </ElLink>
                                                </ElDescriptionsItem>
                                                {unref(appDetail).memoryRequired > 0 ? (
                                                    <ElDescriptionsItem label={$t('app.requireMemory')}>
                                                        <span>
                                                            {computeSizeFromMB(unref(appDetail).memoryRequired)}
                                                        </span>
                                                    </ElDescriptionsItem>
                                                ) : null}
                                                {unref(architectures).length > 0 ? (
                                                    <ElDescriptionsItem label={$t('app.supportedArchitectures')}>
                                                        {(unref(architectures) || []).map((arch, index) => (
                                                            <ElTag class={'mx-1'} key={index}>
                                                                {arch}
                                                            </ElTag>
                                                        ))}
                                                    </ElDescriptionsItem>
                                                ) : null}
                                            </ElDescriptions>
                                        </div>
                                    </div>
                                }
                                <MarkDownEditor content={unref(app).readMe} />
                            </>
                        ),
                    }}
                />
                <Install ref={installRef} />
            </>
        );
    },
    options,
);
