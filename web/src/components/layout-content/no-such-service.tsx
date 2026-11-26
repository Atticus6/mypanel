import { $t } from '@/utils/i18n-t';
import asset_no_app from '@/assets/images/no_app.svg';
import { routerToNameWithQuery } from '@/utils/router';
import './no-such-service.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElIcon } from 'element-plus';
import LayoutContent from '@/components/layout-content/index';
import { Position } from '@element-plus/icons-vue';

interface CodemodProps {
    [key: string]: any;
    name?: string;
}

const emits = {};

type SlotsShape = {
    default: (arg?: unknown) => VNode[];
};

const options = {
    name: 'no-such-service',
    props: {
        name: { type: String },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
    __scopeId: 'data-v-57dab4a7',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        const toDoc = () => {
            routerToNameWithQuery('Library', { uncached: 'true' });
        };
        return () => (
            <div>
                <LayoutContent
                    divider={true}
                    v-slots={{
                        main: () => (
                            <>
                                <div class={'app-warn'}>
                                    <div class={'flex flex-col gap-2 items-center justify-center w-full sm:flex-row'}>
                                        {ctx.slots['default']?.(undefined) ?? (
                                            <>
                                                <span>{$t('cronjob.library.noSuchApp', [__panelSetupProps.name])}</span>
                                                <span
                                                    onClick={($event?: any) => {
                                                        (toDoc as any)($event);
                                                    }}
                                                    class={'flex items-center justify-center gap-0.5'}
                                                >
                                                    <ElIcon>
                                                        <Position />
                                                    </ElIcon>
                                                    {$t('firewall.quickJump')}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                    <div>
                                        <img src={asset_no_app} />
                                    </div>
                                </div>
                            </>
                        ),
                    }}
                />
            </div>
        );
    },
    options,
);
