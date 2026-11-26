import { $t } from '@/utils/i18n-t';
import Basic from './basic/index';
import Resource from './resource/index';
import Log from './log/index';
import WebsiteStatus from '@/views/website/website/status/index';
import { routerToNameWithParams } from '@/utils/router';
import MainDiv from '@/components/main-div/index';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { useOperateNodeContext } from '@/composables/useOperateNodeContext';
import { rpc } from '@/lib/rpc';
import RouterButton from '@/components/router-button/index';
import LayoutContent from '@/components/layout-content/index';

interface CodemodProps {
    [key: string]: any;
    id?: string;
    tab?: string;
}

const emits = {};

const options = {
    name: 'config',
    props: {
        id: {
            type: String,
            default: '0',
        },
        tab: {
            type: String,
            default: 'basic',
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode } = useGlobalStore();
        useOperateNodeContext(currentNode);
        const id = ref(0);
        const index = ref('basic');
        const website = ref<any>({});
        const loading = ref(false);
        const configPHP = ref(false);
        watch(index, (curr, old) => {
            if (curr != old) {
                changeTab(curr);
            }
        });
        const changeTab = (index: string) => {
            routerToNameWithParams('WebsiteConfig', { id: id.value, tab: index });
        };
        onMounted(async () => {
            index.value = __panelSetupProps.tab;
            id.value = Number(__panelSetupProps.id);
            loading.value = true;
            const res = await rpc.website.getWebsite({ id: id.value });
            website.value = res;
            // 运行时能力已剔除，不再请求 runtime 详情。
            configPHP.value = false;
            loading.value = false;
        });
        return () => (
            <div>
                <RouterButton
                    buttons={[
                        {
                            label: $t('menu.website'),
                            path: '/websites',
                        },
                    ]}
                />
                {withDirectives(
                    <LayoutContent
                        title={$t('website.websiteConfig')}
                        back-name={'Website'}
                        v-slots={{
                            app: () => (
                                <>
                                    {unref(website).id > 0 ? (
                                        <WebsiteStatus
                                            primary-domain={unref(website).primaryDomain}
                                            status={unref(website).status}
                                            expire-date={unref(website).expireDate}
                                        />
                                    ) : null}
                                </>
                            ),
                            leftToolBar: () => (
                                <>
                                    <ElButton
                                        type="primary"
                                        plain={unref(index) !== 'basic'}
                                        onClick={($event?: any) => {
                                            changeTab('basic');
                                        }}
                                    >
                                        {$t('website.basic')}
                                    </ElButton>
                                    <ElButton
                                        type="primary"
                                        plain={unref(index) !== 'log'}
                                        onClick={($event?: any) => {
                                            changeTab('log');
                                        }}
                                    >
                                        {$t('commons.button.log')}
                                    </ElButton>
                                    <ElButton
                                        type="primary"
                                        plain={unref(index) !== 'resource'}
                                        onClick={($event?: any) => {
                                            changeTab('resource');
                                        }}
                                    >
                                        {$t('website.source', 2)}
                                    </ElButton>
                                </>
                            ),
                            main: () => (
                                <>
                                    <MainDiv heightDiff={260}>
                                        {unref(index) === 'basic' && unref(website).id ? (
                                            <Basic website={unref(website)} heightDiff={320} />
                                        ) : null}
                                        {unref(index) === 'log' ? <Log id={unref(id)} /> : null}
                                        {unref(index) === 'resource' ? <Resource id={unref(id)} /> : null}
                                    </MainDiv>
                                </>
                            ),
                        }}
                    />,
                    [[vLoading, unref(loading)]],
                )}
            </div>
        );
    },
    options,
);
