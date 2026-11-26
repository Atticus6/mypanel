import { $t } from '@/utils/i18n-t';
import asset_no_app from '@/assets/images/no_app.svg';
import TaskList from '@/components/task-list/index';
import { Position } from '@element-plus/icons-vue';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'no-app',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const taskListRef = ref();
        const openTask = () => {
            taskListRef.value.acceptParams();
        };
        return () => (
            <>
                <div class={'app-warn'}>
                    <div class={'flex w-full flex-col items-center justify-center gap-2 sm:flex-row'}>
                        <span>{$t('app.noAppHelper')}</span>
                        <span
                            onClick={($event?: any) => {
                                (openTask as any)($event);
                            }}
                            class={'flex items-center justify-center gap-0.5'}
                        >
                            <ElIcon>
                                <Position />
                            </ElIcon>
                            {$t('website.check')}
                        </span>
                    </div>
                    <div>
                        <img src={asset_no_app} />
                    </div>
                </div>
                <TaskList ref={taskListRef} />
            </>
        );
    },
    options,
);
