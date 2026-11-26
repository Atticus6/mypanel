import { $t } from '@/utils/i18n-t';
import { routerToName, type RouteName } from '@/utils/router';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { cn } from '@/utils/cn';

interface CodemodProps {
    [key: string]: any;
    current?: string;
}

const emits = {};

const options = {
    name: 'router',
    props: {
        current: {
            type: String,
            default: 'LoginLog',
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isAdmin } = useGlobalStore();
        const onChangeRoute = async (addr: RouteName) => {
            routerToName(addr);
        };
        return () => (
            <div>
                <ElButton
                    type={__panelSetupProps.current === 'OperationLog' ? 'primary' : ''}
                    onClick={($event?: any) => {
                        onChangeRoute('OperationLog');
                    }}
                    class={cn('tag-button', __panelSetupProps.current != 'OperationLog' ? 'no-active' : '')}
                >
                    {$t('logs.operation')}
                </ElButton>
                {unref(isAdmin) ? (
                    <ElButton
                        type={__panelSetupProps.current === 'LoginLog' ? 'primary' : ''}
                        onClick={($event?: any) => {
                            onChangeRoute('LoginLog');
                        }}
                        class={cn('tag-button', __panelSetupProps.current != 'LoginLog' ? 'no-active' : '')}
                    >
                        {$t('logs.login')}
                    </ElButton>
                ) : null}
                <ElButton
                    type={__panelSetupProps.current === 'SystemLog' ? 'primary' : ''}
                    onClick={($event?: any) => {
                        onChangeRoute('SystemLog');
                    }}
                    class={cn('tag-button', __panelSetupProps.current != 'SystemLog' ? 'no-active' : '')}
                >
                    {$t('logs.system')}
                </ElButton>
                <ElButton
                    type={__panelSetupProps.current === 'Task' ? 'primary' : ''}
                    onClick={($event?: any) => {
                        onChangeRoute('Task');
                    }}
                    class={cn('tag-button', __panelSetupProps.current != 'Task' ? 'no-active' : '')}
                >
                    {$t('logs.task')}
                </ElButton>
            </div>
        );
    },
    options,
);
