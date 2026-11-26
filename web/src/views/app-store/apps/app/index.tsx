import { $t } from '@/utils/i18n-t';
import { getAppIconUrl } from '@/api/modules/app';
import { useGlobalStore } from '@/composables/useGlobalStore';
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import permissionDirective from '@/directives/modules/permission';
import { ElCard } from 'element-plus';
import { ElAvatar } from 'element-plus';
import { ElSpace } from 'element-plus';
import { ElTag } from 'element-plus';
import { ElButton } from 'element-plus';
import SvgIcon from '@/components/svg-icon/svg-icon';

interface CodemodProps {
    [key: string]: any;
    app?: Record<string, any>;
}

const emits = {
    openDetail: (...args: unknown[]) => true,
    openInstall: (...args: unknown[]) => true,
};

const options = {
    name: 'app',
    props: {
        app: {
            type: Object,
            default: () => ({}),
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-7412cb6a',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode } = useGlobalStore();
        const openDetail = (key: string) => {
            ctx.emit('openDetail', key);
        };
        const openInstall = (app: any) => {
            ctx.emit('openInstall', app);
        };
        return () => (
            <div class={'app'}>
                <ElCard>
                    <div
                        onClick={($event?: any) => {
                            openDetail(__panelSetupProps.app.key);
                        }}
                        class={'app-wrapper'}
                    >
                        <div class={'app-image'}>
                            <ElAvatar
                                shape="square"
                                size={60}
                                src={getAppIconUrl(
                                    __panelSetupProps.app.key,
                                    unref(currentNode),
                                    __panelSetupProps.app.icon,
                                )}
                            >
                                <SvgIcon iconName="p-appstore" />
                            </ElAvatar>
                        </div>
                        <div class={'app-content'}>
                            <div class={'content-top'}>
                                <ElSpace wrap size={1}>
                                    <span class={'app-title'}>{__panelSetupProps.app.name}</span>
                                    {__panelSetupProps.app.installed ? (
                                        <ElTag type="success" round size="small" class={'!ml-2'}>
                                            {$t('app.allReadyInstalled')}
                                        </ElTag>
                                    ) : null}
                                </ElSpace>
                            </div>
                            <div class={'content-middle'}>
                                <span class={'app-description'}>{__panelSetupProps.app.description}</span>
                            </div>
                            <div class={'content-bottom'}>
                                <div class={'app-tags'}>
                                    {(__panelSetupProps.app.tags || []).map((tag, ind) => (
                                        <ElTag type="info" key={ind}>
                                            <span>{tag}</span>
                                        </ElTag>
                                    ))}
                                    {__panelSetupProps.app.status === 'TakeDown' ? (
                                        <ElTag class={'p-mr-5'}>
                                            <span class={'text-red-500'}>{$t('app.takeDown')}</span>
                                        </ElTag>
                                    ) : null}
                                </div>
                                {withDirectives(
                                    <ElButton
                                        type="primary"
                                        size="small"
                                        plain
                                        round
                                        disabled={
                                            (__panelSetupProps.app.installed && __panelSetupProps.app.limit == 1) ||
                                            __panelSetupProps.app.status === 'TakeDown'
                                        }
                                        onClick={($event?: any) => {
                                            $event.stopPropagation();
                                            openInstall(__panelSetupProps.app);
                                        }}
                                    >
                                        {$t('commons.button.install')}
                                    </ElButton>,
                                    [[permissionDirective, true]],
                                )}
                            </div>
                        </div>
                    </div>
                </ElCard>
            </div>
        );
    },
    options,
);
