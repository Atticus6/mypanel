import { $t } from '@/utils/i18n-t';
import Source from './source/index';
import ContainerLog from '@/components/log/container/index';
import NginxPer from './performance/index';
import Status from './status/index';
import Module from './module/index';
import Other from './other/index';
import LayoutContent from '@/components/layout-content/index';

interface CodemodProps {
    [key: string]: any;
    containerName?: string;
    status?: string;
}

const emits = {};

const options = {
    name: 'nginx',
    props: {
        containerName: {
            type: String,
            default: '',
        },
        status: {
            type: String,
            default: 'Running',
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const activeName = ref('1');
        const changeTab = (index: string) => {
            activeName.value = index;
        };
        onMounted(() => {
            if (__panelSetupProps.status != 'Running') {
                activeName.value = '2';
            }
        });
        return () => (
            <LayoutContent
                title={$t('commons.button.set')}
                reload={true}
                v-slots={{
                    leftToolBar: () => (
                        <>
                            <ElButton
                                type="primary"
                                plain={unref(activeName) !== '1'}
                                onClick={($event?: any) => {
                                    changeTab('1');
                                }}
                                disabled={__panelSetupProps.status != 'Running'}
                            >
                                {$t('nginx.status')}
                            </ElButton>
                            <ElButton
                                type="primary"
                                plain={unref(activeName) !== '2'}
                                onClick={($event?: any) => {
                                    changeTab('2');
                                }}
                            >
                                {$t('nginx.configResource')}
                            </ElButton>
                            <ElButton
                                type="primary"
                                plain={unref(activeName) !== '3'}
                                onClick={($event?: any) => {
                                    changeTab('3');
                                }}
                                disabled={__panelSetupProps.status != 'Running'}
                            >
                                {$t('website.nginxPer')}
                            </ElButton>
                            <ElButton
                                type="primary"
                                plain={unref(activeName) !== '4'}
                                onClick={($event?: any) => {
                                    changeTab('4');
                                }}
                                disabled={__panelSetupProps.status != 'Running'}
                            >
                                {$t('commons.button.log')}
                            </ElButton>
                            <ElButton
                                type="primary"
                                plain={unref(activeName) !== '5'}
                                onClick={($event?: any) => {
                                    changeTab('5');
                                }}
                            >
                                {$t('runtime.module')}
                            </ElButton>
                            <ElButton
                                type="primary"
                                plain={unref(activeName) !== '6'}
                                onClick={($event?: any) => {
                                    changeTab('6');
                                }}
                                disabled={__panelSetupProps.status != 'Running'}
                            >
                                {$t('website.other')}
                            </ElButton>
                        </>
                    ),
                    main: () => (
                        <>
                            {unref(activeName) === '1' ? <Status status={__panelSetupProps.status} /> : null}
                            {unref(activeName) === '2' ? <Source /> : null}
                            {unref(activeName) === '3' ? <NginxPer /> : null}
                            {unref(activeName) === '4' ? (
                                <ContainerLog container={__panelSetupProps.containerName} highlightDiff={350} />
                            ) : null}
                            {unref(activeName) === '5' ? <Module /> : null}
                            {unref(activeName) === '6' ? <Other /> : null}
                        </>
                    ),
                }}
            />
        );
    },
    options,
);
