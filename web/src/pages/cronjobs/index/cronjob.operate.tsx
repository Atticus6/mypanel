import { $t } from '@/utils/i18n-t';
import FileList from '@/components/file-list/index';
import CodemirrorPro from '@/components/codemirror-pro/index';
import InputTag from '@/components/input-tag/index';
import LayoutCol from '@/components/layout-col/form';
import CleanLogConfig from '@/pages/views/cronjob/cronjob/config/clean-log';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { Cronjob } from '@/types/cronjob';
import { MsgError, MsgSuccess } from '@/utils/message';
import { Alert } from '@/types/alert';
import { resolveAlertConfigExcludeTypes } from '@/api/modules/alert';
import {
    loadDefaultSpec,
    loadDefaultSpecCustom,
    specOptions,
    transObjToSpec,
    transSpecToObj,
    weekOptions,
    cronjobTypes,
} from '@/pages/views/cronjob/cronjob/helper';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { splitTimeFromSecond, transferTimeToSecond } from '@/utils/validate';
import { routerToName, routerToPath } from '@/utils/router';
import { rpc } from '@/lib/rpc';
import { getAlertConfigDisplayName } from '@/pages/views/setting/alert/setting/drawer/secret-field';
import { cronjobAlertModes, normalizeCronjobAlertMode } from '@/utils/cronjob-alert';
type FormInstance = InstanceType<typeof ElForm>;
import '@/pages/views/cronjob/cronjob/operate/index.styles.css';
import LayoutContent from '@/components/layout-content/index';
import Status from '@/components/status/index';
import ComplexTable from '@/components/table/complex/ComplexTable';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'cronjob.operate',
    props: {},
    emits: emits,
    __scopeId: 'data-v-1778be94',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const router = useRouter();
        const { docsUrl, isProductPro } = useGlobalStore();
        const scriptFileRef = ref();
        const dirRef = ref();
        const fileRef = ref();
        const loading = ref();
        const nextTimes = ref([]);
        const baseDir = ref();
        const isCreate = ref();
        const defaultGroupID = ref();
        const alertConfigs = ref<Alert.AlertConfigInfo[]>([]);
        const loadAlertConfigs = async () => {
            try {
                const res = await rpc.alert.getAlertConfig({ excludeTypes: resolveAlertConfigExcludeTypes() });
                alertConfigs.value = res.items.filter((item: Alert.AlertConfigInfo) => item.type !== 'common') || [];
            } catch {}
        };
        onMounted(() => {
            loadAlertConfigs();
        });
        const alertConfigOptions = computed(() => {
            return alertConfigs.value
                .filter((c) => c.status === 'Enable' && c.type !== 'common')
                .map((c) => ({
                    value: String(c.id),
                    label: getAlertConfigOptionLabel(c),
                    type: c.type,
                }));
        });
        const legacyAlertMethodTypeMap: Record<string, string> = {
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
        const normalizeAlertMethodItems = (methods: string[]) => {
            return methods.map((method) => {
                if (/^\d+$/.test(method)) return method;
                const configType = legacyAlertMethodTypeMap[method];
                const matched = alertConfigOptions.value.find((item) => item.type === configType);
                return matched?.value || method;
            });
        };
        const groupedAlertConfigOptions = computed(() => {
            const typeMap = new Map<string, { value: string; label: string }[]>();
            for (const opt of alertConfigOptions.value) {
                if (!typeMap.has(opt.type)) typeMap.set(opt.type, []);
                typeMap.get(opt.type)!.push({ value: opt.value, label: opt.label });
            }
            const groups: {
                type: string;
                options: { value: string; label: string; typeLabel: string }[];
            }[] = [];
            const typeOrder = ['email', 'sms', 'weCom', 'dingTalk', 'feiShu', 'bark', 'custom'];
            for (const t of typeOrder) {
                if (typeMap.has(t)) {
                    const typeLabel = getConfigTypeLabel(t);
                    groups.push({
                        type: t,
                        options: typeMap.get(t)!.map((item) => ({
                            ...item,
                            typeLabel,
                        })),
                    });
                }
            }
            for (const [type, options] of typeMap) {
                if (typeOrder.includes(type)) continue;
                const typeLabel = getConfigTypeLabel(type);
                groups.push({
                    type,
                    options: options.map((item) => ({ ...item, typeLabel })),
                });
            }
            return groups;
        });
        const getConfigTypeLabel = (type: string): string => {
            return i18n.global.t(`xpack.alert.${type === 'email' ? 'mail' : type}`);
        };
        const getAlertConfigOptionLabel = (c: Alert.AlertConfigInfo): string => {
            try {
                const cfg = JSON.parse(c.config || '{}') as Record<string, unknown>;
                return (
                    getAlertConfigDisplayName(c.type, cfg) ||
                    i18n.global.t(`xpack.alert.${c.type === 'email' ? 'mail' : c.type}`)
                );
            } catch {
                return i18n.global.t(`xpack.alert.${c.type === 'email' ? 'mail' : c.type}`);
            }
        };
        const form = reactive<Cronjob.CronjobInfo>({
            id: 0,
            name: '',
            type: 'shell',
            groupID: null,
            specCustom: false,
            spec: '',
            specs: ['0 0 * * *'],
            specObjs: [{ specType: 'perMonth', week: 1, day: 3, hour: 1, minute: 30, second: 30 }],

            executor: '',
            isExecutorCustom: false,
            script: '',
            scriptMode: 'input',
            isCustom: false,
            command: '',
            inContainer: false,
            containerName: '',
            user: '',

            scriptID: null,
            appID: '',
            website: '',
            ignoreFiles: [],
            exclusionRules: '',
            dbType: '',
            dbName: '',
            dbNameList: [],
            url: '',
            urlItems: [{ url: '', header: '' }],
            isDir: true,
            files: [],
            sourceDir: '',
            snapshotRule: { withImage: false, ignoreAppIDs: [] },
            ignoreAppIDs: [],
            withImage: false,

            sourceAccounts: [],
            downloadAccount: '',
            sourceAccountIDs: '',
            downloadAccountID: 0,
            sourceAccountItems: [],

            websiteList: [],
            appIdList: [],

            retainCopies: 7,
            ignoreErr: false,
            retryTimes: 3,
            timeout: 3600,
            timeoutItem: 3600,
            timeoutUnit: 's',
            status: '',
            secret: '',
            hasAlert: false,
            alertCount: 3,
            alertTriggerMode: 'failed',
            alertTitle: '',
            alertMethod: '',
            alertMethodItems: [],

            scopes: [],
            args: '',
            argItems: [],
        });
        const search = async () => {
            if (!isCreate.value) {
                loading.value = true;
                await rpc.cronjob
                    .get({ id: form.id })
                    .then((res) => {
                        const info = JSON.parse(res.infoJson) as Cronjob.CronjobInfo;
                        loading.value = false;
                        form.name = info.name;
                        form.groupID = info.groupID || defaultGroupID.value;
                        form.type = info.type;
                        form.specCustom = info.specCustom;
                        form.spec = info.spec;
                        form.specs = info.specs || [];
                        if (!form.specCustom && form.spec) {
                            let objs = [];
                            for (const item of info.spec.split('&&')) {
                                objs.push(transSpecToObj(item));
                            }
                            form.specObjs = objs || [];
                        }
                        if (form.specCustom && form.spec) {
                            form.specs = form.spec.split('&&') || [];
                        }

                        form.script = info.script;
                        form.scriptMode = info.scriptMode;
                        form.urlItems =
                            info.urlItems?.map((item) => ({ ...item })) ??
                            (info.url || '')
                                .split(',')
                                .filter(Boolean)
                                .map((url) => ({ url, header: '' }));

                        form.containerName = info.containerName;
                        form.user = info.user;
                        if (form.containerName.length !== 0) {
                            form.inContainer = true;
                            form.command = info.command || 'sh';
                            form.isCustom = form.command !== 'sh' && form.command !== 'bash' && form.command !== 'ash';
                        } else {
                            form.executor = info.executor || 'bash';
                            form.isCustom =
                                form.executor !== 'sh' &&
                                form.executor !== 'bash' &&
                                form.executor !== 'python' &&
                                form.executor !== 'python3';
                        }

                        form.scriptID = info.scriptID || null;
                        form.appID = info.appID;
                        form.appIdList = info.appID ? info.appID.split(',') : [];
                        form.website = info.website;
                        form.websiteList = info.website ? info.website.split(',') : [];
                        form.exclusionRules = info.exclusionRules;
                        form.ignoreFiles = info.exclusionRules ? info.exclusionRules.split(',') : [];
                        form.url = info.url;
                        form.withImage = info.snapshotRule.withImage;
                        form.ignoreAppIDs = info.snapshotRule.ignoreAppIDs;

                        form.isDir = info.isDir;
                        form.sourceDir = info.sourceDir;
                        if (!form.isDir) {
                            let files = form.sourceDir?.split(',') || [];
                            for (const item of files) {
                                form.files.push({ val: item });
                            }
                        }

                        form.sourceAccountIDs = info.sourceAccountIDs;
                        form.downloadAccountID = info.downloadAccountID;
                        if (form.sourceAccountIDs) {
                            let list = [];
                            form.sourceAccountItems = [];
                            list = form.sourceAccountIDs.split(',');
                            for (const item of list) {
                                if (item) {
                                    form.sourceAccountItems.push(Number(item));
                                }
                            }
                        }

                        form.ignoreErr = info.ignoreErr;
                        form.retainCopies = info.retainCopies;
                        form.retryTimes = info.retryTimes;

                        form.timeout = info.timeout || 3600;
                        const item = splitTimeFromSecond(form.timeout);
                        form.timeoutItem = item.timeItem;
                        form.timeoutUnit = item.timeUnit;

                        form.secret = info.secret;
                        form.hasAlert = info.alertCount > 0;
                        form.alertCount = info.alertCount || 3;
                        form.alertTriggerMode = normalizeCronjobAlertMode(info.alertTriggerMode);
                        form.alertTitle = info.alertTitle;
                        if (info.alertMethod) {
                            form.alertMethodItems = normalizeAlertMethodItems(info.alertMethod.split(',') || []);
                        } else {
                            form.alertMethodItems = [];
                        }
                        form.scopes = info.scopes;
                        form.argItems = info.args ? info.args.split(',') : [];
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            }
            loadBackups();
            loadAppInstalls();
            loadUserOptions(true);
            loadWebsites();
            loadContainers();
            loadScripts();
        };
        const goRouter = async (path: string) => {
            routerToPath(path);
        };
        const goWafIpGroup = async () => {
            localStorage.setItem('black-white-tab', '3');
            routerToPath('/xpack/waf/blackwhite');
        };
        const containerOptions = ref([]);
        const websiteOptions = ref([]);
        const backupOptions = ref([]);
        const accountOptions = ref([]);
        const appOptions = ref([]);
        const userOptions = ref([]);
        const scriptOptions = ref([]);
        const groupOptions = ref([]);
        const verifyScript = (rule: any, value: any, callback: any) => {
            if (!form.script || form.script.length === 0) {
                callback(new Error(i18n.global.t('commons.rule.requiredInput')));
                return;
            }
            callback();
        };
        const verifyUrlItems = () => {
            if (!form.urlItems || form.urlItems.length === 0) {
                return false;
            }
            for (const item of form.urlItems) {
                if (!item.url.trim()) {
                    return false;
                }
            }
            return true;
        };
        const verifySpec = (rule: any, value: any, callback: any) => {
            if (form.specCustom) {
                if (form.specs.length === 0) {
                    callback(new Error(i18n.global.t('commons.rule.requiredInput')));
                    return;
                }
                for (let i = 0; i < form.specs.length; i++) {
                    if (form.specs[i] && form.specs[i].split(' ').length === 5) {
                        continue;
                    }
                    callback(new Error(i18n.global.t('cronjob.cronSpecRule', [i + 1])));
                    return;
                }
                callback();
                return;
            }
            if (form.specObjs.length === 0) {
                callback(new Error(i18n.global.t('commons.rule.requiredInput')));
            }
            for (let i = 0; i < form.specObjs.length; i++) {
                let item = form.specObjs[i];
                if (
                    !Number.isInteger(item.day) ||
                    !Number.isInteger(item.hour) ||
                    !Number.isInteger(item.minute) ||
                    !Number.isInteger(item.second) ||
                    !Number.isInteger(item.week)
                ) {
                    callback(new Error(i18n.global.t('cronjob.cronSpecRule', [i + 1])));
                    return;
                }
                switch (item.specType) {
                    case 'perMonth':
                        if (
                            item.day < 0 ||
                            item.day > 31 ||
                            item.hour < 0 ||
                            item.hour > 23 ||
                            item.minute < 0 ||
                            item.minute > 59
                        ) {
                            callback(new Error(i18n.global.t('cronjob.cronSpecRule', [i + 1])));
                            return;
                        }
                        break;
                    case 'perNDay':
                        if (
                            item.day < 0 ||
                            item.day > 366 ||
                            item.hour < 0 ||
                            item.hour > 23 ||
                            item.minute < 0 ||
                            item.minute > 59
                        ) {
                            callback(new Error(i18n.global.t('cronjob.cronSpecRule', [i + 1])));
                            return;
                        }
                        break;
                    case 'perWeek':
                        if (
                            item.week < 0 ||
                            item.week > 6 ||
                            item.hour < 0 ||
                            item.hour > 23 ||
                            item.minute < 0 ||
                            item.minute > 59
                        ) {
                            callback(new Error(i18n.global.t('cronjob.cronSpecRule', [i + 1])));
                            return;
                        }
                        break;
                    case 'perDay':
                        if (item.hour < 0 || item.hour > 23 || item.minute < 0 || item.minute > 59) {
                            callback(new Error(i18n.global.t('cronjob.cronSpecRule', [i + 1])));
                            return;
                        }
                        break;
                    case 'perNHour':
                        if (item.hour < 0 || item.hour > 8784 || item.minute < 0 || item.minute > 59) {
                            callback(new Error(i18n.global.t('cronjob.cronSpecRule', [i + 1])));
                            return;
                        }
                        break;
                    case 'perHour':
                        if (item.minute < 0 || item.minute > 59) {
                            callback(new Error(i18n.global.t('cronjob.cronSpecRule', [i + 1])));
                            return;
                        }
                    case 'perNMinute':
                        if (item.minute < 0 || item.minute > 527040) {
                            callback(new Error(i18n.global.t('cronjob.cronSpecRule', [i + 1])));
                            return;
                        }
                        break;
                    case 'perNSecond':
                        if (item.second < 0 || item.second > 31622400) {
                            callback(new Error(i18n.global.t('cronjob.cronSpecRule', [i + 1])));
                            return;
                        }
                        break;
                }
            }
            callback();
        };
        const verifyFiles = (rule: any, value: any, callback: any) => {
            if (!form.files || form.files.length === 0) {
                callback(new Error(i18n.global.t('commons.rule.requiredInput')));
                return;
            }
            callback();
        };
        const checkSendCount = (rule: any, value: any, callback: any) => {
            if (value === '') {
                callback();
            }
            const regex = /^(?:[1-9]|[12][0-9]|30)$/;
            if (!regex.test(value)) {
                return callback(new Error(i18n.global.t('commons.rule.numberRange', [1, 30])));
            }
            callback();
        };
        const rules = reactive({
            name: [Rules.requiredInput, Rules.noSpace, Rules.linuxName],
            type: [Rules.requiredSelect],
            spec: [
                { validator: verifySpec, trigger: 'blur', required: true },
                { validator: verifySpec, trigger: 'change', required: true },
            ],

            script: [{ validator: verifyScript, trigger: 'blur', required: true }],
            scriptID: [Rules.requiredSelect],
            containerName: [Rules.requiredSelect],
            websiteList: [Rules.requiredSelect],
            appIdList: [Rules.requiredSelect],
            files: [{ validator: verifyFiles, trigger: 'blur', required: true }],
            sourceDir: [Rules.requiredInput],
            sourceAccountItems: [Rules.requiredSelect],
            downloadAccountID: [Rules.requiredSelect],
            retainCopies: [Rules.number],
            retryTimes: [Rules.number],
            timeoutItem: [Rules.integerNumber],
            timeoutUnit: [Rules.requiredSelect],
            alertCount: [Rules.integerNumber, { validator: checkSendCount, trigger: 'blur' }],
            alertMethodItems: [Rules.requiredSelect],
            scopes: [Rules.requiredSelect],
        });
        const formRef = ref<FormInstance>();
        const toDoc = () => {
            window.open(docsUrl.value + '/user_manual/cronjobs/', '_blank', 'noopener,noreferrer');
        };
        const loadDir = async (path: string) => {
            form.sourceDir = path;
        };
        const loadScriptDir = async (path: string) => {
            form.script = path;
        };
        const loadItemDir = () => {
            if (form.type === 'directory' && form.isDir) {
                return form.sourceDir;
            }
            return baseDir.value;
        };
        const loadInstallDir = async () => {
            const pathRes = await rpc.agentSetting.getBaseDir({});
            baseDir.value = pathRes.path;
        };
        const loadGroups = async () => {
            const res = await rpc.core.group.list({ type: 'cronjob' });
            groupOptions.value = (res.items as any) || [];
            for (const item of groupOptions.value) {
                if (item.isDefault) {
                    defaultGroupID.value = item.id;
                    break;
                }
            }
            if (isCreate.value) {
                form.groupID = defaultGroupID.value;
            }
        };
        const goBack = () => {
            routerToName('CronjobItem');
        };
        const loadFile = async (path: string) => {
            for (const item of form.files) {
                if (item.val === path) {
                    return;
                }
            }
            form.files.push({ val: path });
        };
        const hasDay = (item: any) => {
            return item.specType === 'perMonth' || item.specType === 'perNDay';
        };
        const hasHour = (item: any) => {
            return item.specType !== 'perHour' && item.specType !== 'perNMinute' && item.specType !== 'perNSecond';
        };
        const isWebsite = () => {
            return form.type === 'website' || form.type === 'cutWebsiteLog';
        };
        const isDir = () => {
            return form.type === 'directory';
        };
        const loadNext = async (spec: any) => {
            nextTimes.value = [];
            let specItem = '';
            if (!form.specCustom) {
                specItem = transObjToSpec(spec.specType, spec.week, spec.day, spec.hour, spec.minute, spec.second);
            } else {
                specItem = spec;
            }
            if (!specItem) {
                MsgError(i18n.global.t('cronjob.cronSpecRule2'));
                return;
            }
            const res = await rpc.cronjob.loadNextHandle({ spec: specItem });
            nextTimes.value = res.items || [];
        };
        const loadScripts = async () => {
            const res = await rpc.cronjob.loadScriptOptions({});
            scriptOptions.value = res.items || [];
        };
        const changeType = () => {
            form.specObjs = [loadDefaultSpec(form.type)];
            form.specs = [loadDefaultSpecCustom(form.type)];
            if (form.type === 'cleanLog') {
                form.name = i18n.global.t('cronjob.cleanLog');
            }
        };
        const changeSpecType = (index: number) => {
            let item = form.specObjs[index];
            switch (item.specType) {
                case 'perMonth':
                case 'perNDay':
                    item.day = 3;
                    item.hour = 1;
                    item.minute = 30;
                    break;
                case 'perWeek':
                    item.week = 1;
                    item.hour = 1;
                    item.minute = 30;
                    break;
                case 'perDay':
                case 'perNHour':
                    item.hour = 2;
                    item.minute = 30;
                    break;
                case 'perHour':
                case 'perNMinute':
                    item.minute = 30;
                    break;
                case 'perNSecond':
                    item.second = 30;
                    break;
            }
        };
        const handleSpecAdd = () => {
            let item = {
                specType: 'perWeek',
                week: 1,
                day: 0,
                hour: 1,
                minute: 30,
                second: 0,
            };
            form.specObjs.push(item);
        };
        const handleSpecCustomAdd = () => {
            form.specs.push('');
        };
        const handleSpecDelete = (index: number) => {
            form.specObjs.splice(index, 1);
        };
        const handleSpecCustomDelete = (index: number) => {
            form.specs.splice(index, 1);
        };
        const handleFileDelete = (index: number) => {
            form.files.splice(index, 1);
        };
        const loadBackups = async () => {
            const res = await rpc.backup.loadBackupOptions({});
            let options = res.items || [];
            backupOptions.value = [];
            let local = 0;
            for (const item of options) {
                if (item.id === 0) {
                    continue;
                }
                if (item.type == 'LOCAL') {
                    local = item.id;
                }
                backupOptions.value.push({ id: item.id, type: i18n.global.t('setting.' + item.type), name: item.name });
            }
            if (!form.sourceAccountItems) {
                form.sourceAccountItems = local === 0 ? [local] : [];
            }
            changeAccount();
        };
        const changeAccount = async () => {
            accountOptions.value = [];
            let isInAccounts = false;
            for (const item of backupOptions.value) {
                let exist = false;
                for (const ac of form.sourceAccountItems) {
                    if (item.id == ac) {
                        exist = true;
                        break;
                    }
                }
                if (exist) {
                    if (item.id === form.downloadAccountID) {
                        isInAccounts = true;
                    }
                    accountOptions.value.push(item);
                }
            }
            if (!isInAccounts) {
                form.downloadAccountID = form.sourceAccountItems.length === 0 ? undefined : form.sourceAccountItems[0];
            }
        };
        const loadUserOptions = async (isInit: boolean) => {
            userOptions.value = [];
            if (!form.inContainer) {
                // 主机用户列表复用文件服务的系统用户/组接口，不再调用已剔除的 Toolbox 通道。
                const res = await rpc.file.getUsersAndGroups({});
                userOptions.value = (res.users || []).map((item) => item.username);
            } else {
                if (!isInit) {
                    form.user = '';
                }
                if (form.containerName) {
                    const res = await rpc.container.getContainerUsers({ name: form.containerName });
                    userOptions.value = res.items || [];
                }
            }
        };
        const loadAppInstalls = async () => {
            const res = await rpc.app.listInstalled({});
            appOptions.value = res.items || [];
        };
        const loadWebsites = async () => {
            const res = await rpc.website.options({});
            websiteOptions.value = (res.items || []) as any;
        };
        const loadContainers = async () => {
            const res = await rpc.container.listContainers({});
            containerOptions.value = res.items || [];
        };
        function isBackup() {
            return (
                form.type === 'app' ||
                form.type === 'website' ||
                form.type === 'directory' ||
                form.type === 'snapshot' ||
                form.type === 'log'
            );
        }
        function hasExclusionRules() {
            return (
                form.type === 'app' ||
                form.type === 'website' ||
                form.type === 'snapshot' ||
                (form.type === 'directory' && form.isDir)
            );
        }
        function hasIgnore() {
            return form.type === 'app' || form.type === 'website';
        }
        function hasScript() {
            return form.type === 'shell';
        }
        const onSubmit = async (formEl: FormInstance | undefined) => {
            let specs = [];
            if (form.type === 'curl' && (form.urlItems.length === 0 || !verifyUrlItems())) {
                MsgError(i18n.global.t('cronjob.urlHelper'));
                return;
            }
            if (form.type === 'curl' && form.urlItems.some((item) => /[\r\n\0]/.test(item.header))) {
                MsgError(i18n.global.t('cronjob.userAgentInvalid'));
                return;
            }
            if (!form.specCustom) {
                for (const item of form.specObjs) {
                    const itemSpec = transObjToSpec(
                        item.specType,
                        item.week,
                        item.day,
                        item.hour,
                        item.minute,
                        item.second,
                    );
                    if (itemSpec === '') {
                        MsgError(i18n.global.t('cronjob.cronSpecHelper'));
                        return;
                    }
                    specs.push(itemSpec);
                }
            } else {
                specs = form.specs;
            }
            if (!form.isDir) {
                let files = [];
                for (const item of form.files) {
                    files.push(item.val);
                }
                form.sourceDir = files.join(',');
            }
            form.url = form.urlItems.map((item) => item.url.trim()).join(',');
            form.sourceAccountIDs = form.sourceAccountItems.join(',');
            form.spec = specs.join('&&');
            form.args = form.argItems.join(',');
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                if (!form.inContainer) {
                    form.containerName = '';
                }
                form.timeout = transferTimeToSecond(form.timeoutItem + form.timeoutUnit);
                if (form.appIdList) {
                    form.appID = form.appIdList.join(',');
                }
                if (form.websiteList) {
                    form.website = form.websiteList.join(',');
                }
                form.exclusionRules = form.ignoreFiles.join(',');
                form.snapshotRule = { withImage: form.withImage, ignoreAppIDs: form.ignoreAppIDs };
                form.alertCount = form.hasAlert ? form.alertCount : 0;
                form.alertMethod = form.alertMethodItems.join(',');
                form.alertTitle = form.hasAlert
                    ? i18n.global.t('xpack.alert.notificationTitle', [i18n.global.t('cronjob.' + form.type), form.name])
                    : '';
                if (!form) return;

                if (isCreate.value) {
                    await rpc.cronjob.createCronjob({ payloadJson: JSON.stringify(form) });
                } else {
                    await rpc.cronjob.updateCronjob({ id: form.id, payloadJson: JSON.stringify(form) });
                }

                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                goBack();
            });
        };
        onMounted(() => {
            if (router.currentRoute.value.query.id) {
                isCreate.value = false;
                form.id = Number(router.currentRoute.value.query.id);
            } else {
                isCreate.value = true;
            }
            loadGroups();
            search();
            loadInstallDir();
        });
        return () => (
            <>
                <LayoutContent
                    back-name="CronjobItem"
                    title={
                        unref(isCreate) ? $t('commons.button.create') : $t('commons.button.edit') + ' - ' + form.name
                    }
                    v-slots={{
                        main: () => (
                            <>
                                <ElForm ref={formRef} label-position="top" model={form} rules={rules}>
                                    <ElRow type="flex" justify="center" gutter={20}>
                                        <ElCol span={20}>
                                            <ElCard>
                                                <ElFormItem label={$t('cronjob.taskType')} prop="type">
                                                    {unref(isCreate) ? (
                                                        <ElSelect
                                                            onChange={($event?: any) => {
                                                                (changeType as any)($event);
                                                            }}
                                                            modelValue={form.type}
                                                            onUpdate:modelValue={($v) => {
                                                                form.type = $v as any;
                                                            }}
                                                            class={'mini-form-item'}
                                                        >
                                                            {(cronjobTypes || []).map((item) => (
                                                                <ElOption
                                                                    value={item.value}
                                                                    label={item.label}
                                                                    key={item.value}
                                                                />
                                                            ))}
                                                        </ElSelect>
                                                    ) : (
                                                        <div class={'w-full'}>
                                                            <ElTag>{$t('cronjob.' + form.type)}</ElTag>
                                                        </div>
                                                    )}
                                                    {form.type === 'log' ? (
                                                        <span class={'input-help logText'}>
                                                            {$t('cronjob.logHelper1')}
                                                            <ElLink
                                                                icon="Position"
                                                                onClick={($event?: any) => {
                                                                    goRouter('/logs/system');
                                                                }}
                                                                type="primary"
                                                                class={'link'}
                                                            >
                                                                {$t('firewall.quickJump')}
                                                            </ElLink>
                                                        </span>
                                                    ) : null}
                                                    {form.type === 'log' ? (
                                                        <span class={'input-help logText'}>
                                                            {$t('cronjob.logHelper2')}
                                                            <ElLink
                                                                icon="Position"
                                                                onClick={($event?: any) => {
                                                                    goRouter('/logs/ssh');
                                                                }}
                                                                type="primary"
                                                                class={'link'}
                                                            >
                                                                {$t('firewall.quickJump')}
                                                            </ElLink>
                                                        </span>
                                                    ) : null}
                                                    {form.type === 'log' ? (
                                                        <span class={'input-help logText'}>
                                                            {$t('cronjob.logHelper3')}
                                                            <ElLink
                                                                icon="Position"
                                                                onClick={($event?: any) => {
                                                                    goRouter('/logs/website');
                                                                }}
                                                                type="primary"
                                                                class={'link'}
                                                            >
                                                                {$t('firewall.quickJump')}
                                                            </ElLink>
                                                        </span>
                                                    ) : null}
                                                    {form.type === 'ntp' ? (
                                                        <span class={'input-help logText'}>
                                                            {$t('cronjob.ntp_helper')}
                                                            <ElLink
                                                                icon="Position"
                                                                onClick={($event?: any) => {
                                                                    goRouter('/toolbox/device');
                                                                }}
                                                                type="primary"
                                                                class={'link'}
                                                            >
                                                                {$t('firewall.quickJump')}
                                                            </ElLink>
                                                        </span>
                                                    ) : null}
                                                    {form.type === 'syncIpGroup' ? (
                                                        <span class={'input-help logText'}>
                                                            {$t('cronjob.syncIpGroupHelper')}
                                                            <ElLink
                                                                icon="Position"
                                                                onClick={($event?: any) => {
                                                                    (goWafIpGroup as any)($event);
                                                                }}
                                                                type="primary"
                                                                class={'link'}
                                                            >
                                                                {$t('firewall.quickJump')}
                                                            </ElLink>
                                                        </span>
                                                    ) : null}
                                                </ElFormItem>
                                                <ElRow gutter={20}>
                                                    <LayoutCol>
                                                        <ElFormItem label={$t('cronjob.taskName')} prop="name">
                                                            <ElInput
                                                                disabled={!unref(isCreate)}
                                                                clearable
                                                                modelValue={form.name}
                                                                onUpdate:modelValue={($v) => {
                                                                    form.name = typeof $v === 'string' ? $v.trim() : $v;
                                                                }}
                                                            />
                                                        </ElFormItem>
                                                    </LayoutCol>
                                                    <LayoutCol>
                                                        <ElFormItem label={$t('commons.table.group')} prop="groupID">
                                                            <ElSelect
                                                                filterable
                                                                modelValue={form.groupID}
                                                                onUpdate:modelValue={($v) => {
                                                                    form.groupID = $v as any;
                                                                }}
                                                                clearable
                                                            >
                                                                {(unref(groupOptions) || []).map((item) => (
                                                                    <ElOption
                                                                        label={item.name}
                                                                        value={item.id}
                                                                        key={item.id}
                                                                    />
                                                                ))}
                                                            </ElSelect>
                                                        </ElFormItem>
                                                    </LayoutCol>
                                                </ElRow>
                                            </ElCard>
                                            {form.type == 'cleanLog' ? (
                                                <CleanLogConfig
                                                    modelValue={form.scopes}
                                                    onUpdate:modelValue={($v) => {
                                                        form.scopes = $v as any;
                                                    }}
                                                    class={'mt-5'}
                                                />
                                            ) : null}
                                            <ElCard class={'mt-5'}>
                                                <ElFormItem label={$t('cronjob.cronSpec')} prop="specCustom">
                                                    <ElCheckbox
                                                        label={$t('container.custom')}
                                                        modelValue={form.specCustom}
                                                        onUpdate:modelValue={($v) => {
                                                            form.specCustom = $v as any;
                                                        }}
                                                    />
                                                </ElFormItem>
                                                {!form.specCustom ? (
                                                    <div>
                                                        <ElFormItem prop="spec">
                                                            {(form.specObjs || []).map((specObj, index) => (
                                                                <div style={'width: 100%'} key={index}>
                                                                    <ElSelect
                                                                        modelValue={specObj.specType}
                                                                        onUpdate:modelValue={($v) => {
                                                                            specObj.specType = $v as any;
                                                                        }}
                                                                        onChange={($event?: any) => {
                                                                            changeSpecType(index);
                                                                        }}
                                                                        class={'specTypeClass'}
                                                                    >
                                                                        {(specOptions || []).map((item) => (
                                                                            <ElOption
                                                                                value={item.value}
                                                                                label={item.label}
                                                                                key={item.label}
                                                                            />
                                                                        ))}
                                                                    </ElSelect>
                                                                    {specObj.specType === 'perWeek' ? (
                                                                        <ElSelect
                                                                            modelValue={specObj.week}
                                                                            onUpdate:modelValue={($v) => {
                                                                                specObj.week = $v as any;
                                                                            }}
                                                                            class={'specClass'}
                                                                        >
                                                                            {(weekOptions || []).map((item) => (
                                                                                <ElOption
                                                                                    value={item.value}
                                                                                    label={item.label}
                                                                                    key={item.label}
                                                                                />
                                                                            ))}
                                                                        </ElSelect>
                                                                    ) : null}
                                                                    {hasDay(specObj) ? (
                                                                        <ElInput
                                                                            modelValue={specObj.day}
                                                                            onUpdate:modelValue={($v) => {
                                                                                specObj.day =
                                                                                    $v === '' ? $v : Number($v);
                                                                            }}
                                                                            class={'specClass'}
                                                                            v-slots={{
                                                                                append: () => (
                                                                                    <>
                                                                                        <div class={'append'}>
                                                                                            {$t('cronjob.day')}
                                                                                        </div>
                                                                                    </>
                                                                                ),
                                                                            }}
                                                                        />
                                                                    ) : null}
                                                                    {hasHour(specObj) ? (
                                                                        <ElInput
                                                                            modelValue={specObj.hour}
                                                                            onUpdate:modelValue={($v) => {
                                                                                specObj.hour =
                                                                                    $v === '' ? $v : Number($v);
                                                                            }}
                                                                            class={'specClass'}
                                                                            v-slots={{
                                                                                append: () => (
                                                                                    <>
                                                                                        <div class={'append'}>
                                                                                            {$t('commons.units.hour')}
                                                                                        </div>
                                                                                    </>
                                                                                ),
                                                                            }}
                                                                        />
                                                                    ) : null}
                                                                    {specObj.specType !== 'perNSecond' ? (
                                                                        <ElInput
                                                                            modelValue={specObj.minute}
                                                                            onUpdate:modelValue={($v) => {
                                                                                specObj.minute =
                                                                                    $v === '' ? $v : Number($v);
                                                                            }}
                                                                            class={'specClass'}
                                                                            v-slots={{
                                                                                append: () => (
                                                                                    <>
                                                                                        <div class={'append'}>
                                                                                            {$t('commons.units.minute')}
                                                                                        </div>
                                                                                    </>
                                                                                ),
                                                                            }}
                                                                        />
                                                                    ) : null}
                                                                    {specObj.specType === 'perNSecond' ? (
                                                                        <ElInput
                                                                            modelValue={specObj.second}
                                                                            onUpdate:modelValue={($v) => {
                                                                                specObj.second =
                                                                                    $v === '' ? $v : Number($v);
                                                                            }}
                                                                            class={'specClass'}
                                                                            v-slots={{
                                                                                append: () => (
                                                                                    <>
                                                                                        <div class={'append'}>
                                                                                            {$t('commons.units.second')}
                                                                                        </div>
                                                                                    </>
                                                                                ),
                                                                            }}
                                                                        />
                                                                    ) : null}
                                                                    <ElPopover
                                                                        placement="top-start"
                                                                        title={$t('cronjob.nextTime')}
                                                                        width="200"
                                                                        trigger="click"
                                                                        v-slots={{
                                                                            reference: () => (
                                                                                <>
                                                                                    <ElButton
                                                                                        onClick={($event?: any) => {
                                                                                            loadNext(specObj);
                                                                                        }}
                                                                                        link
                                                                                        type="primary"
                                                                                        class={'ml-5'}
                                                                                    >
                                                                                        {$t('commons.button.preview')}
                                                                                    </ElButton>
                                                                                </>
                                                                            ),
                                                                        }}
                                                                    >
                                                                        {(unref(nextTimes) || []).map(
                                                                            (time, index_t) => (
                                                                                <div key={index_t}>
                                                                                    <ElTag class={'mt-2'}>{time}</ElTag>
                                                                                </div>
                                                                            ),
                                                                        )}
                                                                    </ElPopover>
                                                                    {form.specObjs.length > 1 ? (
                                                                        <ElButton
                                                                            link
                                                                            type="primary"
                                                                            onClick={($event?: any) => {
                                                                                handleSpecDelete(index);
                                                                            }}
                                                                            class={'ml-2.5'}
                                                                        >
                                                                            {$t('commons.button.delete')}
                                                                        </ElButton>
                                                                    ) : null}
                                                                    {form.specObjs.length > 1 ? (
                                                                        <ElDivider class={'divider'} />
                                                                    ) : null}
                                                                </div>
                                                            ))}
                                                        </ElFormItem>
                                                        <ElButton
                                                            onClick={($event?: any) => {
                                                                handleSpecAdd();
                                                            }}
                                                            class={'mb-3'}
                                                        >
                                                            {$t('commons.button.add')}
                                                        </ElButton>
                                                    </div>
                                                ) : null}
                                                {form.specCustom ? (
                                                    <div>
                                                        <ElFormItem prop="spec">
                                                            {(form.specs || []).map((spec, index) => (
                                                                <div class={'w-full'} key={index}>
                                                                    <ElInput
                                                                        modelValue={form.specs[index]}
                                                                        onUpdate:modelValue={($v) => {
                                                                            form.specs[index] = $v as any;
                                                                        }}
                                                                        class={'specCustom'}
                                                                    />
                                                                    <ElPopover
                                                                        placement="top-start"
                                                                        title={$t('cronjob.nextTime')}
                                                                        width="200"
                                                                        trigger="click"
                                                                        v-slots={{
                                                                            reference: () => (
                                                                                <>
                                                                                    <ElButton
                                                                                        onClick={($event?: any) => {
                                                                                            loadNext(spec);
                                                                                        }}
                                                                                        link
                                                                                        type="primary"
                                                                                        class={'ml-2.5'}
                                                                                    >
                                                                                        {$t('commons.button.preview')}
                                                                                    </ElButton>
                                                                                </>
                                                                            ),
                                                                        }}
                                                                    >
                                                                        {(unref(nextTimes) || []).map(
                                                                            (time, index_t) => (
                                                                                <div key={index_t}>
                                                                                    <ElTag class={'mt-2'}>{time}</ElTag>
                                                                                </div>
                                                                            ),
                                                                        )}
                                                                    </ElPopover>
                                                                    {form.specs.length > 1 ? (
                                                                        <ElButton
                                                                            link
                                                                            type="primary"
                                                                            onClick={($event?: any) => {
                                                                                handleSpecCustomDelete(index);
                                                                            }}
                                                                            class={'ml-2.5'}
                                                                        >
                                                                            {$t('commons.button.delete')}
                                                                        </ElButton>
                                                                    ) : null}
                                                                    {form.specs.length > 1 ? (
                                                                        <ElDivider class={'divider'} />
                                                                    ) : null}
                                                                </div>
                                                            ))}
                                                            <span class={'input-help logText'}>
                                                                {$t('cronjob.cronSpecDoc')}
                                                                <ElLink
                                                                    icon="Position"
                                                                    onClick={($event?: any) => {
                                                                        (toDoc as any)($event);
                                                                    }}
                                                                    type="primary"
                                                                    class={'link'}
                                                                >
                                                                    {$t('firewall.quickJump')}
                                                                </ElLink>
                                                            </span>
                                                        </ElFormItem>
                                                        <ElButton
                                                            onClick={($event?: any) => {
                                                                handleSpecCustomAdd();
                                                            }}
                                                            class={'mb-3'}
                                                        >
                                                            {$t('commons.button.add')}
                                                        </ElButton>
                                                    </div>
                                                ) : null}
                                            </ElCard>
                                            <ElCard class={'mt-5'}>
                                                <ElRow gutter={20}>
                                                    {isWebsite() ? (
                                                        <LayoutCol>
                                                            <ElFormItem
                                                                label={
                                                                    form.type === 'website'
                                                                        ? $t('cronjob.website')
                                                                        : $t('menu.website')
                                                                }
                                                                prop="websiteList"
                                                            >
                                                                <ElSelect
                                                                    modelValue={form.websiteList}
                                                                    onUpdate:modelValue={($v) => {
                                                                        form.websiteList = $v as any;
                                                                    }}
                                                                    multiple
                                                                    onChange={($event?: any) => {
                                                                        form.websiteList = form.websiteList.includes(
                                                                            'all',
                                                                        )
                                                                            ? ['all']
                                                                            : form.websiteList;
                                                                    }}
                                                                >
                                                                    <ElOption
                                                                        label={$t('commons.table.all')}
                                                                        value="all"
                                                                    />
                                                                    {(unref(websiteOptions) || []).map(
                                                                        (item, index) => (
                                                                            <ElOption
                                                                                value={item.id + ''}
                                                                                label={item.primaryDomain}
                                                                                key={index}
                                                                            >
                                                                                <div class={'option-content'}>
                                                                                    <ElTooltip
                                                                                        content={item.primaryDomain}
                                                                                        placement="top"
                                                                                        open-delay={500}
                                                                                        effect="dark"
                                                                                    >
                                                                                        <span class={'domain-text'}>
                                                                                            {item.primaryDomain}
                                                                                        </span>
                                                                                    </ElTooltip>
                                                                                    <ElTag class={'tagClass'}>
                                                                                        {item.alias}
                                                                                    </ElTag>
                                                                                </div>
                                                                            </ElOption>
                                                                        ),
                                                                    )}
                                                                </ElSelect>
                                                                {form.type === 'cutWebsiteLog' ? (
                                                                    <span class={'input-help'}>
                                                                        {$t('cronjob.cutWebsiteLogHelper')}
                                                                    </span>
                                                                ) : null}
                                                            </ElFormItem>
                                                        </LayoutCol>
                                                    ) : null}
                                                    {form.type === 'app' ? (
                                                        <LayoutCol>
                                                            <ElFormItem label={$t('cronjob.app')} prop="appIdList">
                                                                <ElSelect
                                                                    clearable
                                                                    modelValue={form.appIdList}
                                                                    onUpdate:modelValue={($v) => {
                                                                        form.appIdList = $v as any;
                                                                    }}
                                                                    multiple
                                                                    onChange={($event?: any) => {
                                                                        form.appIdList = form.appIdList.includes('all')
                                                                            ? ['all']
                                                                            : form.appIdList;
                                                                    }}
                                                                >
                                                                    <ElOption
                                                                        label={$t('commons.table.all')}
                                                                        value="all"
                                                                    />
                                                                    {(unref(appOptions) || []).map((item) => (
                                                                        <div key={item.id}>
                                                                            <ElOption
                                                                                value={item.id + ''}
                                                                                label={item.name}
                                                                            >
                                                                                <span>{item.name}</span>
                                                                                <ElTag class={'tagClass'}>
                                                                                    {item.key}
                                                                                </ElTag>
                                                                            </ElOption>
                                                                        </div>
                                                                    ))}
                                                                </ElSelect>
                                                            </ElFormItem>
                                                        </LayoutCol>
                                                    ) : null}
                                                    {form.type === 'directory' ? (
                                                        <LayoutCol>
                                                            <ElFormItem label={$t('commons.button.backup')}>
                                                                <ElRadioGroup
                                                                    modelValue={form.isDir}
                                                                    onUpdate:modelValue={($v) => {
                                                                        form.isDir = $v as any;
                                                                    }}
                                                                    class={'w-full'}
                                                                >
                                                                    <ElRadio value={true}>{$t('file.dir')}</ElRadio>
                                                                    <ElRadio value={false}>{$t('menu.files')}</ElRadio>
                                                                </ElRadioGroup>
                                                            </ElFormItem>
                                                        </LayoutCol>
                                                    ) : null}
                                                    {form.type === 'curl' ? (
                                                        <LayoutCol span={20}>
                                                            <ElFormItem label={$t('cronjob.url')} prop="urlItems">
                                                                {(form.urlItems || []).map((item, index) => (
                                                                    <div class={'curl-url-group'} key={index}>
                                                                        <ElInput
                                                                            modelValue={item.url}
                                                                            onUpdate:modelValue={($v) => {
                                                                                item.url = $v as any;
                                                                            }}
                                                                            aria-label={$t('cronjob.url')}
                                                                            placeholder={$t('cronjob.url')}
                                                                        />
                                                                        <ElInput
                                                                            modelValue={item.header}
                                                                            onUpdate:modelValue={($v) => {
                                                                                item.header = $v as any;
                                                                            }}
                                                                            type="textarea"
                                                                            autosize={{ minRows: 1, maxRows: 4 }}
                                                                            aria-label="User-Agent"
                                                                            placeholder="User-Agent"
                                                                        />
                                                                        <ElButton
                                                                            link
                                                                            icon="Delete"
                                                                            aria-label={$t('commons.button.delete')}
                                                                            disabled={form.urlItems.length <= 1}
                                                                            onClick={($event?: any) => {
                                                                                form.urlItems.length > 1 &&
                                                                                    form.urlItems.splice(index, 1);
                                                                            }}
                                                                        />
                                                                    </div>
                                                                ))}
                                                                <ElButton
                                                                    onClick={($event?: any) => {
                                                                        form.urlItems.push({ url: '', header: '' });
                                                                    }}
                                                                    class={'mt-2'}
                                                                >
                                                                    {$t('commons.button.add')}
                                                                </ElButton>
                                                            </ElFormItem>
                                                        </LayoutCol>
                                                    ) : null}
                                                </ElRow>
                                                <ElRow gutter={20}>
                                                    {hasScript() ? (
                                                        <ElCol span={24}>
                                                            <ElFormItem>
                                                                <ElCheckbox
                                                                    onChange={($event?: any) => {
                                                                        loadUserOptions(false);
                                                                    }}
                                                                    modelValue={form.inContainer}
                                                                    onUpdate:modelValue={($v) => {
                                                                        form.inContainer = $v as any;
                                                                    }}
                                                                >
                                                                    {$t('cronjob.containerCheckBox')}
                                                                </ElCheckbox>
                                                            </ElFormItem>
                                                            {form.inContainer ? (
                                                                <ElRow gutter={20}>
                                                                    <LayoutCol>
                                                                        <ElFormItem
                                                                            label={$t('cronjob.containerName')}
                                                                            prop="containerName"
                                                                        >
                                                                            <ElSelect
                                                                                modelValue={form.containerName}
                                                                                onUpdate:modelValue={($v) => {
                                                                                    form.containerName = $v as any;
                                                                                }}
                                                                                onChange={($event?: any) => {
                                                                                    loadUserOptions(false);
                                                                                }}
                                                                            >
                                                                                {(unref(containerOptions) || []).map(
                                                                                    (item) => (
                                                                                        <div key={item.name}>
                                                                                            <ElOption
                                                                                                value={item.name}
                                                                                                label={item.name}
                                                                                            >
                                                                                                {item.name}
                                                                                                <Status
                                                                                                    status={item.state}
                                                                                                    class={
                                                                                                        'float-right'
                                                                                                    }
                                                                                                    key={item.state}
                                                                                                />
                                                                                            </ElOption>
                                                                                        </div>
                                                                                    ),
                                                                                )}
                                                                            </ElSelect>
                                                                        </ElFormItem>
                                                                    </LayoutCol>
                                                                    <LayoutCol>
                                                                        <ElFormItem
                                                                            label={$t('container.command')}
                                                                            prop="command"
                                                                            rules={Rules.requiredInput}
                                                                        >
                                                                            <ElCheckbox
                                                                                border
                                                                                modelValue={form.isCustom}
                                                                                onUpdate:modelValue={($v) => {
                                                                                    form.isCustom = $v as any;
                                                                                }}
                                                                            >
                                                                                {$t('container.custom')}
                                                                            </ElCheckbox>
                                                                            {!form.isCustom ? (
                                                                                <ElSelect
                                                                                    filterable
                                                                                    clearable
                                                                                    modelValue={form.command}
                                                                                    onUpdate:modelValue={($v) => {
                                                                                        form.command = $v as any;
                                                                                    }}
                                                                                    style={'width: calc(100% - 100px)'}
                                                                                >
                                                                                    <ElOption
                                                                                        value="ash"
                                                                                        label="/bin/ash"
                                                                                    />
                                                                                    <ElOption
                                                                                        value="bash"
                                                                                        label="/bin/bash"
                                                                                    />
                                                                                    <ElOption
                                                                                        value="sh"
                                                                                        label="/bin/sh"
                                                                                    />
                                                                                </ElSelect>
                                                                            ) : (
                                                                                <ElInput
                                                                                    clearable
                                                                                    modelValue={form.command}
                                                                                    onUpdate:modelValue={($v) => {
                                                                                        form.command = $v as any;
                                                                                    }}
                                                                                    style={'width: calc(100% - 100px)'}
                                                                                />
                                                                            )}
                                                                        </ElFormItem>
                                                                    </LayoutCol>
                                                                </ElRow>
                                                            ) : null}
                                                            <ElRow gutter={20}>
                                                                <LayoutCol>
                                                                    <ElFormItem
                                                                        label={$t('commons.table.user')}
                                                                        prop="user"
                                                                    >
                                                                        <ElSelect
                                                                            filterable
                                                                            modelValue={form.user}
                                                                            onUpdate:modelValue={($v) => {
                                                                                form.user = $v as any;
                                                                            }}
                                                                        >
                                                                            {(unref(userOptions) || []).map((item) => (
                                                                                <div key={item}>
                                                                                    <ElOption
                                                                                        value={item}
                                                                                        label={item}
                                                                                    />
                                                                                </div>
                                                                            ))}
                                                                        </ElSelect>
                                                                    </ElFormItem>
                                                                </LayoutCol>
                                                                {!form.inContainer ? (
                                                                    <LayoutCol>
                                                                        <ElFormItem
                                                                            label={$t('cronjob.executor')}
                                                                            prop="executor"
                                                                        >
                                                                            <ElCheckbox
                                                                                border
                                                                                modelValue={form.isCustom}
                                                                                onUpdate:modelValue={($v) => {
                                                                                    form.isCustom = $v as any;
                                                                                }}
                                                                            >
                                                                                {$t('container.custom')}
                                                                            </ElCheckbox>
                                                                            {!form.isCustom ? (
                                                                                <ElSelect
                                                                                    modelValue={form.executor}
                                                                                    onUpdate:modelValue={($v) => {
                                                                                        form.executor = $v as any;
                                                                                    }}
                                                                                    style={'width: calc(100% - 100px)'}
                                                                                >
                                                                                    <ElOption
                                                                                        value="bash"
                                                                                        label="bash"
                                                                                    />
                                                                                    <ElOption value="sh" label="sh" />
                                                                                    <ElOption
                                                                                        value="python"
                                                                                        label="python"
                                                                                    />
                                                                                    <ElOption
                                                                                        value="python2"
                                                                                        label="python2"
                                                                                    />
                                                                                    <ElOption
                                                                                        value="python3"
                                                                                        label="python3"
                                                                                    />
                                                                                </ElSelect>
                                                                            ) : (
                                                                                <ElInput
                                                                                    clearable
                                                                                    modelValue={form.executor}
                                                                                    onUpdate:modelValue={($v) => {
                                                                                        form.executor = $v as any;
                                                                                    }}
                                                                                    style={'width: calc(100% - 100px)'}
                                                                                />
                                                                            )}
                                                                        </ElFormItem>
                                                                    </LayoutCol>
                                                                ) : null}
                                                            </ElRow>
                                                            <ElFormItem
                                                                label={$t('cronjob.shellContent')}
                                                                prop="scriptMode"
                                                            >
                                                                <ElRadioGroup
                                                                    onChange={($event?: any) => {
                                                                        form.script = '';
                                                                    }}
                                                                    modelValue={form.scriptMode}
                                                                    onUpdate:modelValue={($v) => {
                                                                        form.scriptMode = $v as any;
                                                                    }}
                                                                >
                                                                    <ElRadio value="input">
                                                                        {$t('commons.button.edit')}
                                                                    </ElRadio>
                                                                    <ElRadio value="library">
                                                                        {$t('cronjob.library.library')}
                                                                    </ElRadio>
                                                                    <ElRadio value="select">
                                                                        {$t('container.pathSelect')}
                                                                    </ElRadio>
                                                                </ElRadioGroup>
                                                            </ElFormItem>
                                                            {form.scriptMode === 'input' ? (
                                                                <ElFormItem prop="script" class={'-mt-4'}>
                                                                    <CodemirrorPro
                                                                        modelValue={form.script}
                                                                        onUpdate:modelValue={($v) => {
                                                                            form.script = $v as any;
                                                                        }}
                                                                        placeholder="#Define or paste the content of your shell file here"
                                                                        mode="javascript"
                                                                        heightDiff={400}
                                                                    />
                                                                </ElFormItem>
                                                            ) : null}
                                                            <ElRow gutter={20} class={'-mt-4'}>
                                                                <LayoutCol>
                                                                    {form.scriptMode === 'library' ? (
                                                                        <ElFormItem prop="scriptID">
                                                                            <ElSelect
                                                                                filterable
                                                                                modelValue={form.scriptID}
                                                                                onUpdate:modelValue={($v) => {
                                                                                    form.scriptID = $v as any;
                                                                                }}
                                                                            >
                                                                                {(unref(scriptOptions) || []).map(
                                                                                    (item) => (
                                                                                        <ElOption
                                                                                            value={item.id}
                                                                                            label={item.name}
                                                                                            key={item.id}
                                                                                        />
                                                                                    ),
                                                                                )}
                                                                            </ElSelect>
                                                                        </ElFormItem>
                                                                    ) : null}
                                                                    {form.scriptMode === 'select' ? (
                                                                        <ElFormItem prop="script">
                                                                            <ElInput
                                                                                placeholder={
                                                                                    $t('commons.example') +
                                                                                    '/tmp/test.sh'
                                                                                }
                                                                                modelValue={form.script}
                                                                                onUpdate:modelValue={($v) => {
                                                                                    form.script = $v as any;
                                                                                }}
                                                                                v-slots={{
                                                                                    prepend: () => (
                                                                                        <>
                                                                                            <ElButton
                                                                                                icon="Folder"
                                                                                                onClick={(
                                                                                                    $event?: any,
                                                                                                ) => {
                                                                                                    unref(
                                                                                                        scriptFileRef,
                                                                                                    ).acceptParams({
                                                                                                        dir: false,
                                                                                                    });
                                                                                                }}
                                                                                            />
                                                                                        </>
                                                                                    ),
                                                                                }}
                                                                            />
                                                                        </ElFormItem>
                                                                    ) : null}
                                                                </LayoutCol>
                                                            </ElRow>
                                                        </ElCol>
                                                    ) : null}
                                                    {isDir() && form.isDir ? (
                                                        <LayoutCol>
                                                            <ElFormItem
                                                                label={$t('cronjob.backupContent')}
                                                                prop="sourceDir"
                                                            >
                                                                <ElInput
                                                                    modelValue={form.sourceDir}
                                                                    onUpdate:modelValue={($v) => {
                                                                        form.sourceDir = $v as any;
                                                                    }}
                                                                    v-slots={{
                                                                        prepend: () => (
                                                                            <>
                                                                                <ElButton
                                                                                    icon="Folder"
                                                                                    onClick={($event?: any) => {
                                                                                        unref(dirRef).acceptParams({
                                                                                            dir: true,
                                                                                            path: form.sourceDir,
                                                                                        });
                                                                                    }}
                                                                                />
                                                                            </>
                                                                        ),
                                                                    }}
                                                                />
                                                            </ElFormItem>
                                                        </LayoutCol>
                                                    ) : null}
                                                    {isDir() && !form.isDir ? (
                                                        <LayoutCol>
                                                            <ElFormItem
                                                                label={$t('cronjob.backupContent')}
                                                                prop="files"
                                                            >
                                                                <ElInput
                                                                    v-slots={{
                                                                        prepend: () => (
                                                                            <>
                                                                                <ElButton
                                                                                    icon="Folder"
                                                                                    onClick={($event?: any) => {
                                                                                        unref(fileRef).acceptParams({
                                                                                            dir: false,
                                                                                        });
                                                                                    }}
                                                                                />
                                                                            </>
                                                                        ),
                                                                    }}
                                                                />
                                                                <div class={'w-full'}>
                                                                    {form.files ? (
                                                                        <ComplexTable
                                                                            show-header={false}
                                                                            data={form.files}
                                                                        >
                                                                            <ElTableColumn prop="val" />
                                                                            <ElTableColumn
                                                                                width="60"
                                                                                v-slots={{
                                                                                    default: (scope) => (
                                                                                        <>
                                                                                            <ElButton
                                                                                                link
                                                                                                type="primary"
                                                                                                onClick={(
                                                                                                    $event?: any,
                                                                                                ) => {
                                                                                                    handleFileDelete(
                                                                                                        scope.$index,
                                                                                                    );
                                                                                                }}
                                                                                            >
                                                                                                {$t(
                                                                                                    'commons.button.delete',
                                                                                                )}
                                                                                            </ElButton>
                                                                                        </>
                                                                                    ),
                                                                                }}
                                                                            />
                                                                        </ComplexTable>
                                                                    ) : null}
                                                                </div>
                                                            </ElFormItem>
                                                        </LayoutCol>
                                                    ) : null}
                                                </ElRow>
                                                {form.type === 'snapshot' ? (
                                                    <ElRow gutter={20}>
                                                        <LayoutCol>
                                                            <ElFormItem prop="withImage">
                                                                <ElCheckbox
                                                                    modelValue={form.withImage}
                                                                    onUpdate:modelValue={($v) => {
                                                                        form.withImage = $v as any;
                                                                    }}
                                                                    label={$t('cronjob.withImage')}
                                                                />
                                                            </ElFormItem>
                                                        </LayoutCol>
                                                    </ElRow>
                                                ) : null}
                                                {form.type === 'snapshot' ? (
                                                    <ElRow gutter={20}>
                                                        <LayoutCol>
                                                            <ElFormItem
                                                                label={$t('cronjob.ignoreApp')}
                                                                prop="ignoreAppIDs"
                                                            >
                                                                <ElSelect
                                                                    modelValue={form.ignoreAppIDs}
                                                                    onUpdate:modelValue={($v) => {
                                                                        form.ignoreAppIDs = $v as any;
                                                                    }}
                                                                    multiple
                                                                    cleanable
                                                                >
                                                                    {(unref(appOptions) || []).map((item) => (
                                                                        <div key={item.id}>
                                                                            <ElOption value={item.id} label={item.name}>
                                                                                <span>{item.name}</span>
                                                                                <ElTag class={'tagClass'}>
                                                                                    {item.key}
                                                                                </ElTag>
                                                                            </ElOption>
                                                                        </div>
                                                                    ))}
                                                                </ElSelect>
                                                            </ElFormItem>
                                                        </LayoutCol>
                                                    </ElRow>
                                                ) : null}
                                                <ElRow gutter={20}>
                                                    {isBackup() ? (
                                                        <LayoutCol>
                                                            <ElFormItem
                                                                label={$t('setting.backupAccount')}
                                                                prop="sourceAccountItems"
                                                            >
                                                                <ElSelect
                                                                    multiple
                                                                    modelValue={form.sourceAccountItems}
                                                                    onUpdate:modelValue={($v) => {
                                                                        form.sourceAccountItems = $v as any;
                                                                    }}
                                                                    onChange={($event?: any) => {
                                                                        (changeAccount as any)($event);
                                                                    }}
                                                                >
                                                                    {(unref(backupOptions) || []).map((item) => (
                                                                        <div key={item.id}>
                                                                            {item.type !== $t('setting.LOCAL') ? (
                                                                                <ElOption
                                                                                    value={item.id}
                                                                                    label={item.name}
                                                                                >
                                                                                    {item.name}
                                                                                    <ElTag
                                                                                        type="primary"
                                                                                        class={'tagClass'}
                                                                                    >
                                                                                        {item.type}
                                                                                    </ElTag>
                                                                                </ElOption>
                                                                            ) : (
                                                                                <ElOption
                                                                                    value={item.id}
                                                                                    label={item.type}
                                                                                />
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </ElSelect>
                                                                <span class={'input-help logText'}>
                                                                    {$t('cronjob.targetHelper')}
                                                                    <ElLink
                                                                        icon="Position"
                                                                        onClick={($event?: any) => {
                                                                            goRouter('/settings/backupaccount');
                                                                        }}
                                                                        type="primary"
                                                                        class={'link'}
                                                                    >
                                                                        {$t('firewall.quickJump')}
                                                                    </ElLink>
                                                                </span>
                                                            </ElFormItem>
                                                        </LayoutCol>
                                                    ) : null}
                                                    {isBackup() ? (
                                                        <LayoutCol>
                                                            <ElFormItem
                                                                label={$t('cronjob.default_download_path')}
                                                                prop="downloadAccountID"
                                                            >
                                                                <ElSelect
                                                                    modelValue={form.downloadAccountID}
                                                                    onUpdate:modelValue={($v) => {
                                                                        form.downloadAccountID = $v as any;
                                                                    }}
                                                                >
                                                                    {(unref(accountOptions) || []).map((item) => (
                                                                        <div key={item.id}>
                                                                            {item.type !== $t('setting.LOCAL') ? (
                                                                                <ElOption
                                                                                    value={item.id}
                                                                                    label={item.name}
                                                                                >
                                                                                    {item.name}
                                                                                    <ElTag
                                                                                        type="primary"
                                                                                        class={'tagClass'}
                                                                                    >
                                                                                        {item.type}
                                                                                    </ElTag>
                                                                                </ElOption>
                                                                            ) : (
                                                                                <ElOption
                                                                                    value={item.id}
                                                                                    label={item.type}
                                                                                />
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </ElSelect>
                                                            </ElFormItem>
                                                        </LayoutCol>
                                                    ) : null}
                                                </ElRow>
                                                <ElRow gutter={20}>
                                                    {isBackup() ? (
                                                        <LayoutCol>
                                                            <ElFormItem
                                                                label={$t('setting.compressPassword')}
                                                                prop="secret"
                                                            >
                                                                <ElInput
                                                                    type="password"
                                                                    show-password
                                                                    modelValue={form.secret}
                                                                    onUpdate:modelValue={($v) => {
                                                                        form.secret = $v as any;
                                                                    }}
                                                                />
                                                            </ElFormItem>
                                                        </LayoutCol>
                                                    ) : null}
                                                    <LayoutCol>
                                                        <ElFormItem
                                                            label={$t('cronjob.retainCopies')}
                                                            prop="retainCopies"
                                                        >
                                                            <ElInputNumber
                                                                min={1}
                                                                precision={0}
                                                                step-strictly
                                                                step={1}
                                                                modelValue={form.retainCopies}
                                                                onUpdate:modelValue={($v) => {
                                                                    form.retainCopies = $v === '' ? $v : Number($v);
                                                                }}
                                                                class={'selectClass'}
                                                            />
                                                            {isBackup() ? (
                                                                <span class={'input-help'}>
                                                                    {$t('cronjob.retainCopiesHelper1')}
                                                                </span>
                                                            ) : (
                                                                <span class={'input-help'}>
                                                                    {$t('cronjob.retainCopiesHelper')}
                                                                </span>
                                                            )}
                                                        </ElFormItem>
                                                    </LayoutCol>
                                                </ElRow>
                                                <ElRow gutter={20}>
                                                    {hasExclusionRules() ? (
                                                        <LayoutCol span={20}>
                                                            <ElFormItem
                                                                label={$t('cronjob.exclusionRules')}
                                                                prop="exclusionRules"
                                                            >
                                                                <InputTag
                                                                    tags={form.ignoreFiles}
                                                                    onUpdate:tags={($v) => {
                                                                        form.ignoreFiles = $v as any;
                                                                    }}
                                                                    withFile={true}
                                                                    baseDir={loadItemDir()}
                                                                    egHelp={$t('cronjob.exclusionRulesHelper')}
                                                                    class={'w-full'}
                                                                />
                                                            </ElFormItem>
                                                        </LayoutCol>
                                                    ) : null}
                                                </ElRow>
                                            </ElCard>
                                            <ElCard class={'mt-5'}>
                                                <ElRow gutter={20}>
                                                    <LayoutCol span={20}>
                                                        <ElFormItem prop="hasAlert">
                                                            <ElCheckbox
                                                                modelValue={form.hasAlert}
                                                                onUpdate:modelValue={($v) => {
                                                                    form.hasAlert = $v as any;
                                                                }}
                                                                label={$t('xpack.alert.isAlert')}
                                                            />
                                                            <span class={'input-help'}>
                                                                {$t('xpack.alert.alertNotificationHelper')}
                                                            </span>
                                                        </ElFormItem>
                                                    </LayoutCol>
                                                </ElRow>
                                                {form.hasAlert ? (
                                                    <ElRow gutter={20}>
                                                        <LayoutCol>
                                                            <ElFormItem
                                                                label={$t('xpack.alert.alertTriggerMode')}
                                                                prop="alertTriggerMode"
                                                            >
                                                                <ElSelect
                                                                    modelValue={form.alertTriggerMode}
                                                                    onUpdate:modelValue={($v) => {
                                                                        form.alertTriggerMode = $v as any;
                                                                    }}
                                                                    class={'selectClass'}
                                                                >
                                                                    {(cronjobAlertModes || []).map((item) => (
                                                                        <ElOption
                                                                            value={item.value}
                                                                            label={$t(item.label)}
                                                                            key={item.value}
                                                                        />
                                                                    ))}
                                                                </ElSelect>
                                                            </ElFormItem>
                                                        </LayoutCol>
                                                    </ElRow>
                                                ) : null}
                                                <ElRow gutter={20}>
                                                    <LayoutCol>
                                                        {form.hasAlert ? (
                                                            <ElFormItem
                                                                label={$t('xpack.alert.alertMethod')}
                                                                prop="alertMethodItems"
                                                            >
                                                                <ElSelect
                                                                    popper-class="alert-config-method-dropdown"
                                                                    modelValue={form.alertMethodItems}
                                                                    onUpdate:modelValue={($v) => {
                                                                        form.alertMethodItems = $v as any;
                                                                    }}
                                                                    multiple
                                                                    cleanable
                                                                    collapse-tags
                                                                    collapse-tags-tooltip
                                                                    max-collapse-tags={3}
                                                                    class={'selectClass'}
                                                                >
                                                                    {(unref(groupedAlertConfigOptions) || []).map(
                                                                        (group) => (
                                                                            <ElOptionGroup
                                                                                label={i18n.global.t(
                                                                                    'xpack.alert.' +
                                                                                        (group.type === 'email'
                                                                                            ? 'mail'
                                                                                            : group.type),
                                                                                )}
                                                                                key={group.type}
                                                                            >
                                                                                {(group.options || []).map((opt) => (
                                                                                    <ElOption
                                                                                        value={opt.value}
                                                                                        label={opt.label}
                                                                                        key={opt.value}
                                                                                    >
                                                                                        <div
                                                                                            class={
                                                                                                'alert-config-option'
                                                                                            }
                                                                                        >
                                                                                            <span
                                                                                                title={opt.label}
                                                                                                class={
                                                                                                    'alert-config-option__name'
                                                                                                }
                                                                                            >
                                                                                                {opt.label}
                                                                                            </span>
                                                                                            <ElTag
                                                                                                effect="light"
                                                                                                size="small"
                                                                                                round
                                                                                                class={
                                                                                                    'alert-config-option__tag'
                                                                                                }
                                                                                            >
                                                                                                {opt.typeLabel}
                                                                                            </ElTag>
                                                                                        </div>
                                                                                    </ElOption>
                                                                                ))}
                                                                            </ElOptionGroup>
                                                                        ),
                                                                    )}
                                                                </ElSelect>
                                                            </ElFormItem>
                                                        ) : null}
                                                    </LayoutCol>
                                                    <LayoutCol>
                                                        {form.hasAlert ? (
                                                            <ElFormItem
                                                                prop="alertCount"
                                                                label={$t('xpack.alert.alertCount')}
                                                            >
                                                                <ElInputNumber
                                                                    min={1}
                                                                    precision={0}
                                                                    step-strictly
                                                                    step={1}
                                                                    modelValue={form.alertCount}
                                                                    onUpdate:modelValue={($v) => {
                                                                        form.alertCount = $v === '' ? $v : Number($v);
                                                                    }}
                                                                    class={'selectClass'}
                                                                />
                                                                <span class={'input-help'}>
                                                                    {$t('xpack.alert.alertCountHelper')}
                                                                </span>
                                                            </ElFormItem>
                                                        ) : null}
                                                    </LayoutCol>
                                                </ElRow>
                                            </ElCard>
                                            <ElCard class={'mt-5'}>
                                                <ElRow gutter={20}>
                                                    {hasIgnore() ? (
                                                        <LayoutCol span={20}>
                                                            <ElFormItem>
                                                                <ElCheckbox
                                                                    modelValue={form.ignoreErr}
                                                                    onUpdate:modelValue={($v) => {
                                                                        form.ignoreErr = $v as any;
                                                                    }}
                                                                    label={$t('cronjob.ignoreErr')}
                                                                />
                                                                <span class={'input-help'}>
                                                                    {$t('cronjob.ignoreErrHelper')}
                                                                </span>
                                                            </ElFormItem>
                                                        </LayoutCol>
                                                    ) : null}
                                                    <LayoutCol>
                                                        <ElFormItem label={$t('cronjob.timeout')} prop="timeoutItem">
                                                            <ElInput
                                                                type="number"
                                                                modelValue={form.timeoutItem}
                                                                onUpdate:modelValue={($v) => {
                                                                    form.timeoutItem = $v === '' ? $v : Number($v);
                                                                }}
                                                                class={'selectClass'}
                                                                v-slots={{
                                                                    append: () => (
                                                                        <>
                                                                            <ElSelect
                                                                                modelValue={form.timeoutUnit}
                                                                                onUpdate:modelValue={($v) => {
                                                                                    form.timeoutUnit = $v as any;
                                                                                }}
                                                                                style={'width: 80px'}
                                                                            >
                                                                                <ElOption
                                                                                    label={$t('commons.units.second')}
                                                                                    value="s"
                                                                                />
                                                                                <ElOption
                                                                                    label={$t('commons.units.minute')}
                                                                                    value="m"
                                                                                />
                                                                                <ElOption
                                                                                    label={$t('commons.units.hour')}
                                                                                    value="h"
                                                                                />
                                                                            </ElSelect>
                                                                        </>
                                                                    ),
                                                                }}
                                                            />
                                                        </ElFormItem>
                                                    </LayoutCol>
                                                    <LayoutCol>
                                                        <ElFormItem label={$t('cronjob.retryTimes')} prop="retryTimes">
                                                            <ElInputNumber
                                                                min={0}
                                                                precision={0}
                                                                step-strictly
                                                                step={1}
                                                                modelValue={form.retryTimes}
                                                                onUpdate:modelValue={($v) => {
                                                                    form.retryTimes = $v === '' ? $v : Number($v);
                                                                }}
                                                                class={'selectClass'}
                                                            />
                                                            <span class={'input-help'}>
                                                                {$t('cronjob.retryTimesHelper')}
                                                            </span>
                                                        </ElFormItem>
                                                    </LayoutCol>
                                                </ElRow>
                                            </ElCard>
                                            <ElFormItem class={'mt-5'}>
                                                <ElButton
                                                    disabled={unref(loading)}
                                                    onClick={($event?: any) => {
                                                        (goBack as any)($event);
                                                    }}
                                                >
                                                    {$t('commons.button.back')}
                                                </ElButton>
                                                <ElButton
                                                    disabled={unref(loading)}
                                                    type="primary"
                                                    onClick={($event?: any) => {
                                                        onSubmit(unref(formRef));
                                                    }}
                                                >
                                                    {$t('commons.button.confirm')}
                                                </ElButton>
                                            </ElFormItem>
                                        </ElCol>
                                    </ElRow>
                                </ElForm>
                            </>
                        ),
                    }}
                />
                <FileList
                    ref={scriptFileRef}
                    onChoose={($event?: any) => {
                        (loadScriptDir as any)($event);
                    }}
                />
                <FileList
                    ref={dirRef}
                    onChoose={($event?: any) => {
                        (loadDir as any)($event);
                    }}
                />
                <FileList
                    ref={fileRef}
                    onChoose={($event?: any) => {
                        (loadFile as any)($event);
                    }}
                />
            </>
        );
    },
    options,
);

definePage({
    name: 'CronjobOperate',
    meta: { activeMenu: '/cronjobs', ignoreTab: true, permission: 'cronjob_view', hidden: true },
});
