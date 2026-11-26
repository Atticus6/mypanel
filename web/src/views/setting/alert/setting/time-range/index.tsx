import { $t } from '@/utils/i18n-t';
import { computed, ComputedRef, ref } from 'vue';
import i18n from '@/lang';
import { MsgError, MsgSuccess } from '@/utils/message';
import { FormInstance } from 'element-plus';
import { rpc } from '@/lib/rpc';
import { Alert } from '@/types/alert';
import { useGlobalStore } from '@/composables/useGlobalStore';
interface Option {
    key: string;
    label: string;
    disabled: boolean;
}
interface NoticeAlert {
    sendTimeRange: string;
    type: string[];
}
interface ResourceAlert {
    sendTimeRange: string;
    type: string[];
}
interface SendTimeRange {
    noticeAlert: NoticeAlert;
    resourceAlert: ResourceAlert;
}
interface DialogProps {
    id: any;
    sendTimeRange: SendTimeRange;
    isOffline: string;
}
interface ConfigInfo {
    alertSendTimeRange: SendTimeRange;
    isOffline: string;
}
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import permissionDirective from '@/directives/modules/permission';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElTransfer } from 'element-plus';
import { ElTimePicker } from 'element-plus';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'time-range',
    props: {},
    emits: emits,
    __scopeId: 'data-v-243425e4',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isProductPro, isIntl, isEE } = useGlobalStore();
        const drawerVisible = ref(false);
        const loading = ref(false);
        const isOffline = ref();
        const id = ref();
        const configInfo = ref<ConfigInfo>({
            isOffline: '',
            alertSendTimeRange: {
                noticeAlert: { sendTimeRange: '', type: [] },
                resourceAlert: { sendTimeRange: '', type: [] },
            },
        });
        const config = ref<Alert.AlertConfigUpdateReq>({
            id: 0,
            type: '',
            title: '',
            status: '',
            config: '',
            displayName: '',
        });
        const defaultResourceValue = [
            'clams',
            'cronJob',
            'cpu',
            'memory',
            'load',
            'disk',
            'nodeException',
            'licenseException',
            'panelLogin',
            'sshLogin',
        ];
        const noticeDefaultTime: [Date, Date] = [new Date(0, 0, 1, 8, 0, 0), new Date(0, 0, 1, 23, 59, 59)];
        const resourceDefaultTime: [Date, Date] = [new Date(0, 0, 1, 0, 0, 0), new Date(0, 0, 1, 23, 59, 59)];
        const noticeTimeRange = ref(noticeDefaultTime);
        const resourceTimeRange = ref(resourceDefaultTime);
        const generateData = (): Option[] => {
            const data: Option[] = [];
            if (!isEE.value) {
                data.push({
                    key: 'panelPwdEndTime',
                    label: i18n.global.t('xpack.alert.panelPwdEndTime'),
                    disabled: false,
                });
            }
            data.push({ key: 'panelLogin', label: i18n.global.t('xpack.alert.panelLogin'), disabled: false });
            data.push({ key: 'sshLogin', label: i18n.global.t('xpack.alert.sshLogin'), disabled: false });
            if (isProductPro.value && !isIntl.value && !isEE.value) {
                data.push({
                    key: 'licenseException',
                    label: i18n.global.t('xpack.alert.licenseException'),
                    disabled: false,
                });
            }
            data.push({ key: 'nodeException', label: i18n.global.t('xpack.alert.nodeException'), disabled: false });
            data.push({ key: 'ssl', label: i18n.global.t('xpack.alert.ssl'), disabled: false });
            data.push({ key: 'siteEndTime', label: i18n.global.t('xpack.alert.siteEndTime'), disabled: false });
            data.push({ key: 'cpu', label: i18n.global.t('xpack.alert.cpu'), disabled: false });
            data.push({ key: 'memory', label: i18n.global.t('xpack.alert.memory'), disabled: false });
            data.push({ key: 'disk', label: i18n.global.t('xpack.alert.disk'), disabled: false });
            data.push({ key: 'load', label: i18n.global.t('xpack.alert.load'), disabled: false });
            data.push({ key: 'clams', label: i18n.global.t('xpack.alert.clams'), disabled: false });
            data.push({ key: 'cronJob', label: i18n.global.t('xpack.alert.cronjob'), disabled: false });
            if (!isEE.value) {
                data.push({ key: 'panelUpdate', label: i18n.global.t('xpack.alert.panelUpdate'), disabled: false });
            }
            return data;
        };
        const data = computed(() => generateData());
        const dataKeySet = computed(() => new Set(data.value.map((item) => item.key)));
        const resourceValue = ref(defaultResourceValue.filter((item) => dataKeySet.value.has(item)));
        const formRef = ref<FormInstance>();
        const noticeValue: ComputedRef<string[]> = computed(() => {
            return data.value.filter((item) => !resourceValue.value.includes(item.key)).map((item) => item.key);
        });
        const acceptParams = (params: DialogProps): void => {
            if (typeof params.sendTimeRange === 'object' && params.sendTimeRange !== null) {
                noticeTimeRange.value = parseTimeRange(params.sendTimeRange.noticeAlert.sendTimeRange);
                resourceTimeRange.value = parseTimeRange(params.sendTimeRange.resourceAlert.sendTimeRange);
                resourceValue.value = params.sendTimeRange.resourceAlert.type.filter((item) =>
                    dataKeySet.value.has(item),
                );
            }
            isOffline.value = params.isOffline;
            id.value = params.id;
            drawerVisible.value = true;
        };
        const onSave = async () => {
            if (
                typeof noticeTimeRange.value === 'object' &&
                noticeTimeRange.value !== null &&
                typeof resourceTimeRange.value === 'object' &&
                resourceTimeRange.value !== null
            ) {
                loading.value = true;
                configInfo.value.alertSendTimeRange = {
                    noticeAlert: { sendTimeRange: stringifyTimeRange(noticeTimeRange.value), type: noticeValue.value },
                    resourceAlert: {
                        sendTimeRange: stringifyTimeRange(resourceTimeRange.value),
                        type: resourceValue.value,
                    },
                };
                configInfo.value.isOffline = isOffline.value;
                try {
                    config.value.id = id.value;
                    config.value.type = 'common';
                    config.value.title = 'xpack.alert.commonConfig';
                    config.value.status = 'Enable';
                    config.value.config = JSON.stringify(configInfo.value);
                    config.value.displayName = i18n.global.t('xpack.alert.commonConfig');
                    await rpc.alert.updateAlertConfig(config.value);

                    loading.value = false;
                    handleClose();
                    ctx.emit('search');
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                } catch (error) {
                    loading.value = false;
                }
            } else {
                MsgError(
                    i18n.global.t('commons.msg.confirmNoNull', [i18n.global.t('xpack.alert.timeRange').toLowerCase()]),
                );
            }
        };
        const parseTimeRange = (timeRangeStr: string): [Date, Date] => {
            return timeRangeStr.split(' - ').map((time) => {
                const [hours, minutes, seconds] = time.split(':').map(Number);
                return new Date(0, 0, 1, hours, minutes, seconds);
            }) as [Date, Date];
        };
        const stringifyTimeRange = (timeRange: [Date, Date]): string => {
            return timeRange
                .map(
                    (date) =>
                        `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(
                            date.getSeconds(),
                        ).padStart(2, '0')}`,
                )
                .join(' - ');
        };
        const handleClose = () => {
            drawerVisible.value = false;
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                modelValue={unref(drawerVisible)}
                onUpdate:modelValue={($v) => {
                    drawerVisible.value = $v as any;
                }}
                header={$t('xpack.alert.sendTimeRange')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="736"
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        drawerVisible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                {withDirectives(
                                    <ElButton
                                        disabled={unref(loading)}
                                        type="primary"
                                        onClick={($event?: any) => {
                                            onSave();
                                        }}
                                    >
                                        {$t('commons.button.confirm')}
                                    </ElButton>,
                                    [[permissionDirective, true]],
                                )}
                            </span>
                        </>
                    ),
                }}
            >
                {withDirectives(
                    <ElForm
                        ref={formRef}
                        label-position="top"
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                    >
                        <ElFormItem label={$t('xpack.alert.sendTimeRange')} prop="sendTimeRange">
                            <div class={'text-center'}>
                                <ElTransfer
                                    modelValue={unref(resourceValue)}
                                    onUpdate:modelValue={($v) => {
                                        resourceValue.value = $v as any;
                                    }}
                                    titles={[$t('xpack.alert.noticeAlert'), $t('xpack.alert.resourceAlert')]}
                                    format={{
                                        noChecked: '${total}',
                                        hasChecked: '${checked}/${total}',
                                    }}
                                    data={unref(data)}
                                    class={'inline-block text-left'}
                                    v-slots={{
                                        'left-footer': () => (
                                            <>
                                                <ElFormItem prop="noticeTimeRange">
                                                    <ElTimePicker
                                                        modelValue={unref(noticeTimeRange)}
                                                        onUpdate:modelValue={($v) => {
                                                            noticeTimeRange.value = $v as any;
                                                        }}
                                                        is-range
                                                        start-placeholder={$t('commons.search.timeStart')}
                                                        end-placeholder={$t('commons.search.timeEnd')}
                                                        class={'mx-1 mt-1 !w-[235px]'}
                                                    />
                                                    <span class={'input-help ml-2'}>
                                                        {$t('xpack.alert.sendTimeRangeHelper', [
                                                            $t('xpack.alert.noticeAlert').toLowerCase(),
                                                        ])}
                                                    </span>
                                                </ElFormItem>
                                            </>
                                        ),
                                        'right-footer': () => (
                                            <>
                                                <ElFormItem prop="resourceTimeRange">
                                                    <ElTimePicker
                                                        modelValue={unref(resourceTimeRange)}
                                                        onUpdate:modelValue={($v) => {
                                                            resourceTimeRange.value = $v as any;
                                                        }}
                                                        is-range
                                                        start-placeholder={$t('commons.search.timeStart')}
                                                        end-placeholder={$t('commons.search.timeEnd')}
                                                        class={'mx-1 mt-1 !w-[235px]'}
                                                    />
                                                    <span class={'input-help ml-2'}>
                                                        {$t('xpack.alert.sendTimeRangeHelper', [
                                                            $t('xpack.alert.resourceAlert').toLowerCase(),
                                                        ])}
                                                    </span>
                                                </ElFormItem>
                                            </>
                                        ),
                                    }}
                                />
                            </div>
                        </ElFormItem>
                    </ElForm>,
                    [[vLoading, unref(loading)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
