import { $t } from '@/utils/i18n-t';
import { Alert } from '@/types/alert';
import { resolveAlertConfigExcludeTypes } from '@/api/modules/alert';
import { MsgSuccess } from '@/utils/message';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { routerToExtensionName, routerToName, type RouteName } from '@/utils/router';
import { checkCidr, checkCidrV6, checkIpV4V6 } from '@/utils/validate';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { getAlertConfigDisplayName } from '@/views/setting/alert/setting/drawer/secret-field';
import { cronjobAlertTypes, cronjobAlertModes, getCronjobAlertMode, setCronjobAlertMode } from '@/utils/cronjob-alert';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    title: string;
    rowData?: Alert.AlertInfo;
}
type FormInstance = InstanceType<typeof ElForm>;
import './index.styles.css';
import permissionDirective from '@/directives/modules/permission';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'task',
    props: {},
    emits: emits,
    __scopeId: 'data-v-36e7f894',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isMaster, isProductPro, isEE, isIntl } = useGlobalStore();
        const alertConfigs = ref<Alert.AlertConfigInfo[]>([]);
        const loadAlertConfigs = async () => {
            try {
                const res = await rpc.alert.getAlertConfig({
                    excludeTypes: resolveAlertConfigExcludeTypes(),
                });
                alertConfigs.value = (res.items || []).filter(
                    (item) => item.type !== 'common',
                ) as Alert.AlertConfigInfo[];
            } catch {}
        };
        onMounted(() => {
            loadAlertConfigs();
        });
        const ALL_SEND_METHOD = '__all__';
        const configOptions = computed(() => {
            return alertConfigs.value
                .filter((c) => c.type !== 'common')
                .map((c) => ({
                    value: String(c.id),
                    label: getConfigOptionLabel(c),
                    typeLabel: getConfigTypeLabel(c.type),
                    type: c.type,
                    disabled:
                        c.status !== 'Enable' ||
                        ((isIntl.value || !isProductPro.value) &&
                            ['weCom', 'dingTalk', 'feiShu', 'sms'].includes(c.type)),
                }))
                .sort((a, b) => Number(a.disabled) - Number(b.disabled));
        });
        const isLockedMethodOption = (opt: { value: string; disabled: boolean }) => {
            return opt.disabled && !dialogData.value.rowData?.sendMethod.includes(opt.value);
        };
        const allConfigValues = computed(() => configOptions.value.filter((c) => !c.disabled).map((c) => c.value));
        const legacyMethodTypeMap: Record<string, string> = {
            mail: 'email',
            email: 'email',
            sms: 'sms',
            bark: 'bark',
            weCom: 'weCom',
            dingTalk: 'dingTalk',
            feiShu: 'feiShu',
            webhook: 'custom',
            custom: 'custom',
        };
        const normalizeMethodValues = (methods: string[]) => {
            return methods.map((method) => {
                if (/^\d+$/.test(method)) return method;
                const configType = legacyMethodTypeMap[method];
                const matched = configOptions.value.find((item) => item.type === configType);
                return matched?.value || method;
            });
        };
        const isAllEnabledMethodsSelected = (methods: string[]) => {
            return (
                methods.length > 0 &&
                methods.every((item) => allConfigValues.value.includes(item)) &&
                allConfigValues.value.every((item) => methods.includes(item))
            );
        };
        const getConfigTypeLabel = (type: string): string => {
            return i18n.global.t(`xpack.alert.${type}`);
        };
        const getConfigOptionLabel = (c: Alert.AlertConfigInfo): string => {
            try {
                const cfg = JSON.parse(c.config || '{}') as Record<string, unknown>;
                return getAlertConfigDisplayName(c.type, cfg) || getConfigTypeLabel(c.type);
            } catch {}
            return getConfigTypeLabel(c.type);
        };
        const lastSendMethod = ref<string[]>([]);
        const handleSendMethodChange = (values: string[]) => {
            if (!dialogData.value.rowData) return;
            if (values.includes(ALL_SEND_METHOD)) {
                dialogData.value.rowData.sendMethod = [ALL_SEND_METHOD];
                lastSendMethod.value = [...allConfigValues.value];
                return;
            }
            const disabledValues = new Set(configOptions.value.filter((c) => c.disabled).map((c) => c.value));
            const prev = new Set(lastSendMethod.value);
            const filteredValues = values.filter((value) => !disabledValues.has(value) || prev.has(value));
            const nonAllValues = filteredValues.filter((item) => item !== ALL_SEND_METHOD);
            const hasLockedValues = nonAllValues.some((item) => disabledValues.has(item));

            if (!hasLockedValues && isAllEnabledMethodsSelected(nonAllValues)) {
                dialogData.value.rowData.sendMethod = [ALL_SEND_METHOD];
                lastSendMethod.value = [...allConfigValues.value];
                return;
            }
            dialogData.value.rowData.sendMethod = nonAllValues;
            lastSendMethod.value = [...nonAllValues];
        };
        const dialogData = ref<DialogProps>({
            title: '',
        });
        const { t } = i18n.global;
        const loading = ref(false);
        const visible = ref(false);
        const websiteOptions = ref();
        const sslOptions = ref([]);
        const diskOptions = ref([]);
        const clamsOptions = ref([]);
        const cronJobOptions = ref([]);
        const formRef = ref<FormInstance>();
        const timeTypes = ['ssl', 'siteEndTime', 'panelPwdEndTime'];
        const avgTypes = ['cpu', 'memory', 'load'];
        const ipTypes = ['sshLogin', 'panelLogin'];
        const noParamTypes = ['panelUpdate'];
        const intervalTypes = [
            'cpu',
            'memory',
            'load',
            'disk',
            'sshLogin',
            'panelLogin',
            'nodeException',
            'licenseException',
        ];
        const diskTypes = ['disk'];
        const cronjobTypes = cronjobAlertTypes;
        const acceptParams = (params: DialogProps): void => {
            dialogData.value = params;
            dialogData.value.rowData.sendMethod = [];
            lastSendMethod.value = [];
            if (dialogData.value.rowData.method != '') {
                const sendMethods = normalizeMethodValues(dialogData.value.rowData.method.split(',').filter(Boolean));
                if (isAllEnabledMethodsSelected(sendMethods)) {
                    dialogData.value.rowData.sendMethod = [ALL_SEND_METHOD];
                    lastSendMethod.value = [...allConfigValues.value];
                } else {
                    dialogData.value.rowData.sendMethod = sendMethods;
                    lastSendMethod.value = [...sendMethods];
                }
            }
            if (cronjobTypes.includes(dialogData.value.rowData.type)) {
                dialogData.value.rowData.subType = dialogData.value.rowData.type;
                dialogData.value.rowData.type = 'cronJob';
            }
            dialogData.value.rowData.alertTriggerMode = getCronjobAlertMode(dialogData.value.rowData.advancedParams);
            initOptions(dialogData.value.rowData.type, dialogData.value.rowData.subType);
            visible.value = true;
        };
        const rules = reactive({
            type: [Rules.requiredSelect],
            subType: [Rules.requiredSelect],
            project: [Rules.requiredSelect],
            cycle: [Rules.requiredInput, Rules.integerNumber, { validator: checkCycle, trigger: 'blur' }],
            count: [Rules.requiredInput, Rules.integerNumber, { validator: checkCount, trigger: 'blur' }],
            sendCount: [Rules.requiredInput, Rules.integerNumber, { validator: checkSendCount, trigger: 'blur' }],
            sendMethod: [Rules.requiredSelect],
            advancedParams: [{ required: false, validator: checkIPs, trigger: 'blur' }],
        });
        const allTaskOptions = [
            { value: 'panelPwdEndTime', label: 'xpack.alert.panelPwdEndTime', show: isMaster.value && !isEE.value },
            { value: 'sshLogin', label: 'xpack.alert.sshLogin', show: true },
            { value: 'panelLogin', label: 'xpack.alert.panelLogin', show: isMaster.value },
            {
                value: 'licenseException',
                label: 'xpack.alert.licenseException',
                show: isMaster.value && isProductPro.value && !isEE.value,
            },
            { value: 'ssl', label: 'xpack.alert.ssl', show: true },
            { value: 'siteEndTime', label: 'xpack.alert.siteEndTime', show: true },
            {
                value: 'nodeException',
                label: 'xpack.alert.nodeException',
                show: isMaster.value && isProductPro.value,
            },
            { value: 'cpu', label: 'xpack.alert.cpu', show: true },
            { value: 'memory', label: 'xpack.alert.memory', show: true },
            { value: 'disk', label: 'xpack.alert.disk', show: true },
            { value: 'load', label: 'xpack.alert.load', show: true },
            { value: 'cronJob', label: 'xpack.alert.cronjob', show: true },
            { value: 'clams', label: 'xpack.alert.clams', show: true },
            { value: 'panelUpdate', label: 'xpack.alert.panelUpdate', show: isMaster.value && !isEE.value },
        ];
        function checkRange(value: any, min: number, max: number, callback: any) {
            const num = Number(value);
            if (isNaN(num)) {
                return callback(new Error(i18n.global.t('commons.rule.number')));
            }
            if (num < min || num > max) {
                return callback(new Error(i18n.global.t('commons.rule.numberRange', [min, max])));
            }
            callback();
        }
        function checkCycle(rule: any, value: any, callback: any) {
            if (value === '') return callback();

            const type = dialogData.value.rowData.type;

            if (type === 'ssl') {
                return checkRange(value, 1, 60, callback);
            } else if (ipTypes.includes(type)) {
                return checkRange(value, 1, 200, callback);
            } else {
                return checkRange(value, 1, 30, callback);
            }
        }
        function checkCount(rule: any, value: any, callback: any) {
            if (value === '') return callback();

            const type = dialogData.value.rowData.type;
            const cycle = dialogData.value.rowData.cycle;

            if (avgTypes.includes(type) || ipTypes.includes(type)) {
                return checkRange(value, 1, 100, callback);
            }
            if (type === 'disk' && cycle === 2) {
                return checkRange(value, 1, 100, callback);
            }
            callback();
        }
        function checkSendCount(rule: any, value: any, callback: any) {
            if (value === '') return callback();

            const type = dialogData.value.rowData.type;
            const cycle = dialogData.value.rowData.cycle;

            if (type === 'disk' || avgTypes.includes(type) || ipTypes.includes(type)) {
                return checkRange(value, 1, 50, callback);
            } else if (noParamTypes.includes(type)) {
                return checkRange(value, 1, 30, callback);
            } else {
                if (cycle > 0) {
                    return checkRange(value, 1, cycle, callback);
                }
            }
            callback();
        }
        function checkIPs(rule: any, value: any, callback: any) {
            if (!ipTypes.includes(dialogData.value.rowData.type)) return callback();
            if (typeof value === 'string' && value.trim() !== '') {
                let addr = value.split('\n');
                for (const item of addr) {
                    if (item === '') {
                        continue;
                    }
                    if (item.includes('0.0.0.0') || item.includes('::')) {
                        return callback(new Error(i18n.global.t('firewall.addressFormatError')));
                    }
                    if (item.indexOf('/') !== -1) {
                        if (item.indexOf(':') !== -1) {
                            if (checkCidrV6(item)) {
                                return callback(new Error(i18n.global.t('firewall.addressFormatError')));
                            }
                        } else if (checkCidr(item)) {
                            return callback(new Error(i18n.global.t('firewall.addressFormatError')));
                        }
                    } else if (checkIpV4V6(item)) {
                        return callback(new Error(i18n.global.t('firewall.addressFormatError')));
                    }
                }
            }
            callback();
        }
        const initOptions = (type: string, subType: string) => {
            if (type === 'ssl') {
                loadSSLs();
            }
            if (type === 'siteEndTime') {
                loadWebsites();
            }
            if (diskTypes.includes(type)) {
                loadDisks();
            }
            if (type === 'clams') {
                loadClams();
            }
            if (type === 'cronJob' && cronjobTypes.includes(subType)) {
                loadCronJob(subType);
            }
        };
        const handleClose = () => {
            visible.value = false;
            cronJobOptions.value = [];
        };
        const changeType = () => {
            const typeToCycleMap = {
                ssl: 15,
                siteEndTime: 15,
                panelPwdEndTime: 15,
                panelUpdate: 0,
                disk: 2,
                cpu: 5,
                load: 5,
                memory: 5,
                clams: 0,
                app: 0,
                website: 0,
                database: 0,
                directory: 0,
                log: 0,
                snapshot: 0,
                shell: 0,
                curl: 0,
                cutWebsiteLog: 0,
                clean: 0,
                ntp: 0,
                sshLogin: 30,
                panelLogin: 30,
                nodeException: 0,
                licenseException: 0,
            };

            const typeToCountMap = {
                ssl: 0,
                siteEndTime: 0,
                panelPwdEndTime: 0,
                panelUpdate: 0,
                disk: 80,
                cpu: 80,
                load: 80,
                memory: 80,
                clams: 0,
                app: 0,
                website: 0,
                database: 0,
                directory: 0,
                log: 0,
                snapshot: 0,
                shell: 0,
                curl: 0,
                cutWebsiteLog: 0,
                clean: 0,
                ntp: 0,
                sshLogin: 3,
                panelLogin: 3,
                nodeException: 0,
                licenseException: 0,
            };
            const typeToProjectMap = {
                ssl: 'all',
                siteEndTime: 'all',
                panelPwdEndTime: 'all',
                panelUpdate: 'all',
                disk: 'all',
                cpu: 'all',
                load: 'all',
                memory: 'all',
                clams: '',
                app: '',
                website: '',
                database: '',
                directory: '',
                log: '',
                snapshot: '',
                shell: '',
                curl: '',
                cutWebsiteLog: '',
                clean: '',
                ntp: '',
                sshLogin: 'all',
                panelLogin: 'all',
                nodeException: 'all',
                licenseException: 'all',
            };

            const rowData = dialogData.value.rowData;
            if (rowData) {
                let type = rowData.type;
                let subType = rowData.type;
                if (dialogData.value.rowData.type === 'cronJob') {
                    subType = typeof rowData.subType === 'undefined' ? 'shell' : rowData.subType;
                    type = subType;
                    rowData.subType = subType;
                }
                if (cronjobTypes.includes(type)) {
                    rowData.project = '';
                    rowData.cycle = 0;
                    rowData.count = 0;
                    rowData.alertTriggerMode = rowData.alertTriggerMode || 'failed';
                }
                rowData.project =
                    typeof typeToProjectMap[type] !== 'undefined' ? typeToProjectMap[type] : rowData.project;
                rowData.cycle = typeof typeToCycleMap[type] !== 'undefined' ? typeToCycleMap[type] : rowData.cycle;
                rowData.count = typeof typeToCountMap[type] !== 'undefined' ? typeToCountMap[type] : rowData.count;

                rowData.sendCount = 3;
                formRef.value.validate();
                initOptions(rowData.type, subType);
            }
        };
        const changeCycle = () => {
            if (diskTypes.includes(dialogData.value.rowData.type)) {
                dialogData.value.rowData.count = dialogData.value.rowData.cycle == 1 ? 30 : 80;
                formRef.value.validate();
            }
        };
        const loadWebsites = async () => {
            const res = await rpc.website.list({});
            websiteOptions.value = (res.items || []) as any;
        };
        const loadSSLs = async () => {
            const res = await rpc.ssl.list({});
            sslOptions.value = (res.items || []) as any;
        };
        const loadDisks = async () => {
            diskOptions.value = (await rpc.alert.getAlertDisks({})).items;
        };
        const loadClams = async () => {
            clamsOptions.value = (await rpc.alert.getAlertClams({})).items;
            dialogData.value.rowData.project = dialogData.value.rowData.project || String(clamsOptions.value[0].id);
        };
        const loadCronJob = async (jobType: string) => {
            cronJobOptions.value = (
                await rpc.alert.getAlertCronJobs({
                    type: jobType,
                    name: '',
                    status: '',
                })
            ).items;
            dialogData.value.rowData.project =
                dialogData.value.rowData.project || String(cronJobOptions.value[0]?.id || '');
        };
        const formatTitle = (row: Alert.AlertInfo) => {
            const type = row.type === 'cronJob' ? row.subType : row.type;
            if (cronjobTypes.includes(type)) {
                return t('xpack.alert.notificationTitle', [
                    t('cronjob.' + type),
                    formatCronJobName(Number(row.project)),
                ]);
            }
            const titleTemplates = {
                ssl: () => {
                    return row.project === 'all'
                        ? t('xpack.alert.allSslTitle')
                        : t('xpack.alert.sslTitle', [formatSSLName(Number(row.project))]);
                },
                siteEndTime: () => {
                    return row.project === 'all'
                        ? t('xpack.alert.allSiteEndTimeTitle')
                        : t('xpack.alert.siteEndTimeTitle', [formatWebsiteName(Number(row.project))]);
                },
                panelPwdEndTime: () => t('xpack.alert.panelPwdEndTimeTitle'),
                panelUpdate: () => t('xpack.alert.panelUpdateTitle'),
                cpu: () => t('xpack.alert.cpuTitle'),
                memory: () => t('xpack.alert.memoryTitle'),
                load: () => t('xpack.alert.loadTitle'),
                disk: () => {
                    return row.project === 'all'
                        ? t('xpack.alert.allDiskTitle')
                        : t('xpack.alert.diskTitle', [row.project]);
                },
                clams: () => t('xpack.alert.clamsTitle', [formatClamName(Number(row.project))]),
                nodeException: () => t('xpack.alert.nodeException'),
                licenseException: () => t('xpack.alert.licenseException'),
                panelLogin: () => t('xpack.alert.panelLogin'),
                sshLogin: () => t('xpack.alert.sshLogin'),
            };

            return titleTemplates[row.type] ? titleTemplates[row.type]() : '';
        };
        const formatSSLName = (id: number) => {
            const sslObject = sslOptions.value.find((item) => item.id === id);
            return sslObject ? sslObject.primaryDomain : undefined;
        };
        const formatWebsiteName = (id: number) => {
            const websiteOption = websiteOptions.value.find((item: { id: number }) => item.id === id);
            return websiteOption ? websiteOption.primaryDomain : undefined;
        };
        const formatClamName = (id: number) => {
            const clamObject = clamsOptions.value.find((item) => item.id === id);
            return clamObject ? clamObject.name : undefined;
        };
        const formatCronJobName = (id: number) => {
            const cronJobOption = cronJobOptions.value.find((item: { id: number }) => item.id === id);
            return cronJobOption ? cronJobOption.name : undefined;
        };
        const onSubmit = async (formEl: FormInstance | undefined) => {
            if (loading.value) return;
            if (!formEl) return;
            loading.value = true;
            await formEl.validate(async (valid) => {
                if (!valid || !dialogData.value.rowData) {
                    loading.value = false;
                    return;
                }
                const sendMethods = dialogData.value.rowData.sendMethod.includes(ALL_SEND_METHOD)
                    ? allConfigValues.value
                    : dialogData.value.rowData.sendMethod;
                const payload = {
                    ...dialogData.value.rowData,
                    method: sendMethods.join(','),
                    title: formatTitle(dialogData.value.rowData),
                };
                if (payload.type === 'cronJob') {
                    payload.type = payload.subType;
                    payload.advancedParams = setCronjobAlertMode(
                        payload.advancedParams,
                        payload.alertTriggerMode || 'failed',
                    );
                }
                try {
                    if (dialogData.value.title === 'create') {
                        await rpc.alert.createAlert(payload);
                        MsgSuccess(i18n.global.t('commons.msg.createSuccess'));
                    } else if (dialogData.value.title === 'edit') {
                        await rpc.alert.updateAlert(payload);
                        MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                    }
                    ctx.emit('search');
                    visible.value = false;
                } catch (err) {
                } finally {
                    loading.value = false;
                }
            });
        };
        const isEver = (time: string) => {
            const expireDate = new Date(time);
            return expireDate < new Date('1970-01-02');
        };
        const quickJump = (name: RouteName) => {
            handleClose();
            routerToName(name);
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                modelValue={unref(visible)}
                onUpdate:modelValue={($v) => {
                    visible.value = $v as any;
                }}
                header={unref(dialogData).title === 'create' ? $t('xpack.alert.addTask') : $t('xpack.alert.editTask')}
                resource={unref(dialogData).title === 'create' ? unref(dialogData).rowData?.title : ''}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="large"
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    disabled={unref(loading)}
                                    onClick={($event?: any) => {
                                        visible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                {withDirectives(
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            onSubmit(unref(formRef));
                                        }}
                                        disabled={
                                            unref(dialogData).rowData?.type === 'panelPwdEndTime' && unref(loading)
                                        }
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
                <ElForm ref={formRef} label-position="top" model={unref(dialogData).rowData} rules={rules}>
                    <ElRow type="flex" justify="center">
                        <ElCol span={22}>
                            <ElFormItem label={$t('xpack.alert.taskType')} prop="type">
                                <ElSelect
                                    onChange={($event?: any) => {
                                        (changeType as any)($event);
                                    }}
                                    modelValue={unref(dialogData).rowData!.type}
                                    onUpdate:modelValue={($v) => {
                                        unref(dialogData).rowData!.type = $v as any;
                                    }}
                                    disabled={unref(dialogData).title === 'edit'}
                                    class={'selectClass'}
                                >
                                    {(allTaskOptions || []).map((item) => (
                                        <>
                                            {item.show ? (
                                                <ElOption value={item.value} label={$t(item.label)} key={item.value} />
                                            ) : null}
                                        </>
                                    ))}
                                </ElSelect>
                                {unref(dialogData).rowData!.type === 'panelPwdEndTime' && !unref(isEE) ? (
                                    <span class={'input-help'}>
                                        {$t('xpack.alert.panelPwdEndTimeRulesHelper')}
                                        <ElLink
                                            icon="Position"
                                            onClick={($event?: any) => {
                                                quickJump('Safe');
                                            }}
                                            type="primary"
                                            style={'font-size: 12px; margin-left: 5px'}
                                        >
                                            {$t('firewall.quickJump')}
                                        </ElLink>
                                    </span>
                                ) : null}
                            </ElFormItem>
                            {unref(dialogData).rowData!.type === 'cronJob' ? (
                                <ElFormItem label={$t('xpack.alert.cronJobType')} prop="subType">
                                    <ElSelect
                                        onChange={($event?: any) => {
                                            (changeType as any)($event);
                                        }}
                                        modelValue={unref(dialogData).rowData!.subType}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.subType = $v as any;
                                        }}
                                        disabled={unref(dialogData).title === 'edit'}
                                        class={'selectClass'}
                                    >
                                        <ElOption value="shell" label={$t('cronjob.shell')} />
                                        <ElOption value="app" label={$t('cronjob.app')} />
                                        <ElOption value="website" label={$t('cronjob.website')} />
                                        <ElOption value="database" label={$t('cronjob.database')} />
                                        <ElOption value="directory" label={$t('cronjob.directory')} />
                                        <ElOption value="log" label={$t('cronjob.log')} />
                                        <ElOption value="curl" label={$t('cronjob.curl')} />
                                        <ElOption value="cutWebsiteLog" label={$t('cronjob.cutWebsiteLog')} />
                                        <ElOption value="clean" label={$t('setting.diskClean')} />
                                        <ElOption value="snapshot" label={$t('cronjob.snapshot')} />
                                        <ElOption value="ntp" label={$t('cronjob.ntp')} />
                                        <ElOption value="syncIpGroup" label={$t('cronjob.syncIpGroup')} />
                                        <ElOption value="cleanLog" label={$t('cronjob.cleanLog')} />
                                    </ElSelect>
                                </ElFormItem>
                            ) : null}
                            {unref(dialogData).rowData!.type === 'ssl' ? (
                                <ElFormItem label={$t('xpack.alert.certificate')} prop="project">
                                    <ElSelect
                                        modelValue={unref(dialogData).rowData!.project}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.project = $v as any;
                                        }}
                                        class={'selectClass'}
                                    >
                                        <ElOption
                                            disabled={unref(sslOptions).length === 0}
                                            label={$t('commons.table.all')}
                                            value="all"
                                        />
                                        {(unref(sslOptions) || []).map((item, index) => (
                                            <ElOption value={item.id + ''} label={item.primaryDomain} key={index}>
                                                <span>{item.primaryDomain}</span>
                                                {item.autoRenew ? (
                                                    <ElTag class={'tagClass'}>{$t('xpack.alert.autoRenew')}</ElTag>
                                                ) : null}
                                            </ElOption>
                                        ))}
                                    </ElSelect>
                                    <span class={'input-help'}>{$t('xpack.alert.autoRenewRulesHelper')}</span>
                                </ElFormItem>
                            ) : null}
                            {unref(dialogData).rowData!.type === 'siteEndTime' ? (
                                <ElFormItem label={$t('menu.website')} prop="project">
                                    <ElSelect
                                        modelValue={unref(dialogData).rowData!.project}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.project = $v as any;
                                        }}
                                        class={'selectClass'}
                                    >
                                        <ElOption
                                            disabled={unref(websiteOptions) && unref(websiteOptions).length === 0}
                                            label={$t('commons.table.all')}
                                            value="all"
                                        />
                                        {(unref(websiteOptions) || []).map((item, index) => (
                                            <>
                                                {!isEver(item.expireDate) ? (
                                                    <ElOption
                                                        value={item.id + ''}
                                                        label={item.primaryDomain}
                                                        key={index}
                                                    >
                                                        <span>{item.primaryDomain}</span>
                                                        <ElTag class={'tagClass'}>{item.alias}</ElTag>
                                                    </ElOption>
                                                ) : null}
                                            </>
                                        ))}
                                    </ElSelect>
                                    <span class={'input-help'}>{$t('xpack.alert.siteEndTimeRulesHelper')}</span>
                                </ElFormItem>
                            ) : null}
                            {diskTypes.includes(unref(dialogData).rowData!.type) ? (
                                <ElFormItem label={$t('xpack.alert.diskInfo')} prop="project">
                                    <ElSelect
                                        modelValue={unref(dialogData).rowData!.project}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.project = $v as any;
                                        }}
                                        class={'selectClass'}
                                    >
                                        <ElOption
                                            disabled={unref(diskOptions).length === 0}
                                            label={$t('commons.table.all')}
                                            value="all"
                                        />
                                        {(unref(diskOptions) || []).map((item, index) => (
                                            <ElOption value={item.path} label={item.path} key={index}>
                                                <span>{item.path}</span>
                                            </ElOption>
                                        ))}
                                    </ElSelect>
                                </ElFormItem>
                            ) : null}
                            {unref(dialogData).rowData!.type === 'clams' ? (
                                <ElFormItem label={$t('xpack.alert.taskName')} prop="project">
                                    <ElSelect
                                        default-first-option
                                        modelValue={unref(dialogData).rowData!.project}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.project = $v as any;
                                        }}
                                        class={'selectClass'}
                                    >
                                        {(unref(clamsOptions) || []).map((item, index) => (
                                            <ElOption value={String(item.id)} label={item.name} key={index}>
                                                <span>{item.name}</span>
                                                <ElTag class={'tagClass'}>{item.path}</ElTag>
                                            </ElOption>
                                        ))}
                                    </ElSelect>
                                </ElFormItem>
                            ) : null}
                            {unref(dialogData).rowData!.type === 'cronJob' &&
                            cronjobTypes.includes(unref(dialogData).rowData!.subType) ? (
                                <ElFormItem label={$t('xpack.alert.taskName')} prop="project">
                                    <ElSelect
                                        default-first-option
                                        modelValue={unref(dialogData).rowData!.project}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.project = $v as any;
                                        }}
                                        class={'selectClass'}
                                    >
                                        {(unref(cronJobOptions) || []).map((item, index) => (
                                            <ElOption value={String(item.id)} label={item.name} key={index}>
                                                <span>{item.name}</span>
                                            </ElOption>
                                        ))}
                                    </ElSelect>
                                </ElFormItem>
                            ) : null}
                            {unref(dialogData).rowData!.type === 'clams' && unref(clamsOptions).length === 0 ? (
                                <span class={'input-help'}>
                                    {$t('xpack.alert.clamsRulesHelper')}
                                    <ElLink
                                        icon="Position"
                                        onClick={($event?: any) => {
                                            routerToExtensionName('Clam');
                                        }}
                                        type="primary"
                                        style={'font-size: 12px; margin-left: 5px'}
                                    >
                                        {$t('firewall.quickJump')}
                                    </ElLink>
                                </span>
                            ) : null}
                            {cronjobTypes.includes(unref(dialogData).rowData!.type) &&
                            unref(cronJobOptions).length === 0 ? (
                                <span class={'input-help'}>
                                    {$t('xpack.alert.cronJobRulesHelper')}
                                    <ElLink
                                        icon="Position"
                                        onClick={($event?: any) => {
                                            quickJump('Cronjob');
                                        }}
                                        type="primary"
                                        style={'font-size: 12px; margin-left: 5px'}
                                    >
                                        {$t('firewall.quickJump')}
                                    </ElLink>
                                </span>
                            ) : null}
                            {timeTypes.includes(unref(dialogData).rowData!.type) ? (
                                <ElFormItem label={$t('xpack.alert.remainingDays')} prop="cycle">
                                    <ElInput
                                        modelValue={unref(dialogData).rowData!.cycle}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.cycle = $v === '' ? $v : Number($v);
                                        }}
                                    />
                                </ElFormItem>
                            ) : null}
                            {diskTypes.includes(unref(dialogData).rowData!.type) ? (
                                <ElFormItem label={$t('xpack.alert.monitoringType')} prop="cycle">
                                    <ElRadioGroup
                                        onChange={($event?: any) => {
                                            (changeCycle as any)($event);
                                        }}
                                        modelValue={unref(dialogData).rowData!.cycle}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.cycle = $v as any;
                                        }}
                                    >
                                        <ElRadioButton label={$t('xpack.alert.useDisk')} value={1} />
                                        <ElRadioButton label={$t('xpack.alert.usePercentage')} value={2} />
                                    </ElRadioGroup>
                                </ElFormItem>
                            ) : null}
                            {avgTypes.includes(unref(dialogData).rowData!.type) ? (
                                <ElFormItem label={$t('xpack.alert.specifiedTime')} prop="cycle">
                                    <ElSelect
                                        disabled
                                        modelValue={unref(dialogData).rowData!.cycle}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.cycle = $v === '' ? $v : Number($v);
                                        }}
                                        class={'selectClass'}
                                    >
                                        <ElOption value={1} label={1 + $t('commons.units.minute')} />
                                        <ElOption value={5} label={5 + $t('commons.units.minute')} />
                                        <ElOption value={15} label={15 + $t('commons.units.minute')} />
                                    </ElSelect>
                                </ElFormItem>
                            ) : null}
                            {diskTypes.includes(unref(dialogData).rowData!.type) ? (
                                <ElFormItem label={$t('xpack.alert.useExceed')} prop="count">
                                    <ElInput
                                        modelValue={unref(dialogData).rowData!.count}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.count = $v === '' ? $v : Number($v);
                                        }}
                                        v-slots={{
                                            append: () => <>{unref(dialogData).rowData!.cycle === 1 ? 'GB' : ' % '}</>,
                                        }}
                                    />
                                    <span class={'input-help'}>{$t('xpack.alert.useExceedRulesHelper')}</span>
                                </ElFormItem>
                            ) : null}
                            {avgTypes.includes(unref(dialogData).rowData!.type) ? (
                                <ElFormItem
                                    label={$t('xpack.alert.' + unref(dialogData).rowData!.type + 'UseExceedAvg')}
                                    prop="count"
                                >
                                    <ElInput
                                        modelValue={unref(dialogData).rowData!.count}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.count = $v === '' ? $v : Number($v);
                                        }}
                                        v-slots={{ append: () => <>{'%'}</> }}
                                    />
                                    <span class={'input-help'}>
                                        {$t('xpack.alert.' + unref(dialogData).rowData!.type + 'UseExceedAvgHelper')}
                                    </span>
                                </ElFormItem>
                            ) : null}
                            {ipTypes.includes(unref(dialogData).rowData!.type) ? (
                                <ElFormItem label={$t('xpack.alert.triggerCondition')} prop="count">
                                    <div
                                        class={
                                            'flex w-full flex-row flex-wrap items-center justify-between gap-2 sm:flex-nowrap md:flex-nowrap'
                                        }
                                    >
                                        <ElFormItem prop="cycle" class={'sm:flex-1 md:flex-1'}>
                                            <ElInput
                                                modelValue={unref(dialogData).rowData!.cycle}
                                                onUpdate:modelValue={($v) => {
                                                    unref(dialogData).rowData!.cycle = $v === '' ? $v : Number($v);
                                                }}
                                                max={200}
                                                v-slots={{ append: () => <>{$t('commons.units.minute')}</> }}
                                            />
                                        </ElFormItem>
                                        <span class={'input-help !w-[5rem] whitespace-nowrap'}>
                                            {$t('xpack.alert.loginFail')}
                                        </span>
                                        <ElFormItem prop="count" class={'sm:flex-1 md:flex-1'}>
                                            <ElInput
                                                modelValue={unref(dialogData).rowData!.count}
                                                onUpdate:modelValue={($v) => {
                                                    unref(dialogData).rowData!.count = $v === '' ? $v : Number($v);
                                                }}
                                                v-slots={{ append: () => <>{$t('commons.units.time')}</> }}
                                            />
                                        </ElFormItem>
                                    </div>
                                </ElFormItem>
                            ) : null}
                            {ipTypes.includes(unref(dialogData).rowData!.type) ? (
                                <ElFormItem label={$t('setting.ipWhiteList')} prop="advancedParams">
                                    <ElInput
                                        type="textarea"
                                        placeholder={$t('setting.ipWhiteListEgs')}
                                        rows={4}
                                        modelValue={unref(dialogData).rowData!.advancedParams}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.advancedParams = $v as any;
                                        }}
                                    />
                                    <span class={'input-help'}>{$t('xpack.alert.ipWhiteListHelper')}</span>
                                </ElFormItem>
                            ) : null}
                            {unref(dialogData).rowData!.type === 'cronJob' ? (
                                <ElFormItem label={$t('xpack.alert.alertTriggerMode')} prop="alertTriggerMode">
                                    <ElSelect
                                        modelValue={unref(dialogData).rowData!.alertTriggerMode}
                                        onUpdate:modelValue={($v) => {
                                            unref(dialogData).rowData!.alertTriggerMode = $v as any;
                                        }}
                                        class={'selectClass'}
                                    >
                                        {(cronjobAlertModes || []).map((item) => (
                                            <ElOption value={item.value} label={$t(item.label)} key={item.value} />
                                        ))}
                                    </ElSelect>
                                    <span class={'input-help'}>{$t('xpack.alert.alertNotificationHelper')}</span>
                                </ElFormItem>
                            ) : null}
                            <ElFormItem label={$t('xpack.alert.sendCount')} prop="sendCount">
                                <ElInput
                                    modelValue={unref(dialogData).rowData!.sendCount}
                                    onUpdate:modelValue={($v) => {
                                        unref(dialogData).rowData!.sendCount = $v === '' ? $v : Number($v);
                                    }}
                                />
                                <span class={'input-help'}>
                                    {timeTypes.includes(unref(dialogData).rowData!.type)
                                        ? $t('xpack.alert.sendCountRulesHelper')
                                        : noParamTypes.includes(unref(dialogData).rowData!.type)
                                          ? $t('xpack.alert.panelUpdateRulesHelper')
                                          : $t('xpack.alert.oneDaySendCountRulesHelper')}
                                </span>
                            </ElFormItem>
                            <ElFormItem label={$t('xpack.alert.alertMethod')} prop="sendMethod">
                                <ElSelect
                                    popper-class="alert-config-method-dropdown"
                                    modelValue={unref(dialogData).rowData!.sendMethod}
                                    onUpdate:modelValue={($v) => {
                                        unref(dialogData).rowData!.sendMethod = $v as any;
                                    }}
                                    multiple
                                    cleanable
                                    collapse-tags
                                    collapse-tags-tooltip
                                    max-collapse-tags={3}
                                    onChange={($event?: any) => {
                                        (handleSendMethodChange as any)($event);
                                    }}
                                    class={'selectClass'}
                                >
                                    <ElOption value={ALL_SEND_METHOD} label={$t('commons.table.all')}>
                                        <div class={'alert-config-option alert-config-option--all'}>
                                            <span class={'alert-config-option__name'}>{$t('commons.table.all')}</span>
                                        </div>
                                    </ElOption>
                                    {(unref(configOptions) || []).map((opt) => (
                                        <ElOption
                                            value={opt.value}
                                            label={opt.label}
                                            disabled={isLockedMethodOption(opt)}
                                            key={opt.value}
                                        >
                                            <div class={'alert-config-option'}>
                                                <span title={opt.label} class={'alert-config-option__name'}>
                                                    {opt.label}
                                                </span>
                                                <ElTag
                                                    effect="light"
                                                    size="small"
                                                    round
                                                    class={'alert-config-option__tag'}
                                                >
                                                    {opt.typeLabel}
                                                </ElTag>
                                            </div>
                                        </ElOption>
                                    ))}
                                </ElSelect>
                                <span class={'input-help'}>
                                    {intervalTypes.includes(unref(dialogData).rowData!.type)
                                        ? $t('xpack.alert.resourceAlertRulesHelper')
                                        : ''}
                                </span>
                            </ElFormItem>
                            {unref(dialogData).title === 'edit' && unref(isEE) ? (
                                <ElFormItem label={$t('commons.table.updater')}>
                                    <ElInput
                                        model-value={unref(dialogData).rowData?.updateUser || '-'}
                                        readonly
                                        disabled
                                    />
                                </ElFormItem>
                            ) : null}
                        </ElCol>
                    </ElRow>
                </ElForm>
            </DrawerPro>
        );
    },
    options,
);
