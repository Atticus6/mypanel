import { $t } from '@/utils/i18n-t';
import AlertDash from '@/pages/views/setting/alert/dash/index';
import AlertLogs from '@/pages/views/setting/alert/log/index';
import AlertSetting from '@/pages/views/setting/alert/setting/index';
type AlertNoticeTabValue = '0' | '1' | '2';
import './index.styles.css';
import { cn } from '@/utils/cn';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'alert',
    props: {},
    emits: emits,
    __scopeId: 'data-v-13a27476',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const ALERT_NOTICE_TAB_STORAGE_KEY = 'alert-notice-tab';
        const ALERT_NOTICE_TAB = {
            tasks: '0',
            logs: '1',
            config: '2',
        } as const;
        const alertTabs = [
            { key: 'tasks', value: ALERT_NOTICE_TAB.tasks, label: 'xpack.alert.list' },
            { key: 'logs', value: ALERT_NOTICE_TAB.logs, label: 'xpack.alert.logs' },
            { key: 'config', value: ALERT_NOTICE_TAB.config, label: 'commons.button.set' },
        ];
        const index = ref<AlertNoticeTabValue>(ALERT_NOTICE_TAB.tasks);
        const isAlertNoticeTab = (value: string | null): value is AlertNoticeTabValue => {
            return alertTabs.some((item) => item.value === value);
        };
        const changeTab = (ind: AlertNoticeTabValue) => {
            index.value = ind;
            localStorage.setItem(ALERT_NOTICE_TAB_STORAGE_KEY, index.value);
        };
        onMounted(async () => {
            const tab = localStorage.getItem(ALERT_NOTICE_TAB_STORAGE_KEY);
            if (isAlertNoticeTab(tab)) {
                index.value = tab;
            }
        });
        return () => (
            <div>
                <div class={'content-container__search'}>
                    <ElCard>
                        <div>
                            {(alertTabs || []).map((item) => (
                                <ElButton
                                    type={unref(index) === item.value ? 'primary' : ''}
                                    onClick={($event?: any) => {
                                        changeTab(item.value);
                                    }}
                                    class={cn('tag-button', unref(index) === item.value ? '' : 'no-active')}
                                    key={item.key}
                                >
                                    {$t(item.label)}
                                </ElButton>
                            ))}
                        </div>
                    </ElCard>
                </div>
                {unref(index) === ALERT_NOTICE_TAB.tasks ? <AlertDash /> : null}
                {unref(index) === ALERT_NOTICE_TAB.logs ? <AlertLogs /> : null}
                {unref(index) === ALERT_NOTICE_TAB.config ? <AlertSetting /> : null}
            </div>
        );
    },
    options,
);
