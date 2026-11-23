import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf';
import { AI } from './ai';
import {
    AppDetailSchema,
    AppTagSchema,
    AppItemSchema,
    SearchAppsResponseSchema,
    SearchAppsRequestSchema,
    SearchInstalledAppsRequestSchema,
    InstallAppRequestSchema,
    InstalledAppSchema,
    InstalledInfoSchema,
    InstalledAppBriefSchema,
    AppInstalledCheckSchema,
    LoadAppConnInfoResponseSchema,
    AppResourceSchema,
    OperateAppRequestSchema,
    AppServiceItemSchema,
    AppVersionSchema,
    IgnoredAppSchema,
    UpdateVersionsRequestSchema,
    IgnoreAppUpgradeRequestSchema,
    CancelIgnoreAppUpgradeRequestSchema,
    SyncAppsRequestSchema,
    UpdateInstalledConfigRequestSchema,
    ChangeAppPortRequestSchema,
} from '@/gen/panel/agent/v1/app_pb';

type Init<T extends DescMessage> = MessageInitShape<T>;

interface Locale {
    zh: string;
    en: string;
    'zh-Hant': string;
    ja: string;
    ms: string;
    'pt-br': string;
    ru: string;
    ko: string;
    tr: string;
    'es-es': string;
    fa: string;
    lo: string;
}

export namespace App {
    export interface LocalAppSyncConfig {
        enabled: boolean;
    }

    // 应用展示信息：应用市场专有的文案字段不进入 proto，由展示层补充。
    export type App = Omit<Init<typeof AppDetailSchema>, 'tags'> & {
        tags: Tag[];
        shortDescZh: string;
        shortDescEn: string;
        author: string;
        source: string;
        website?: string;
        github?: string;
        batchInstallSupport: boolean;
        createdAt?: string;
        updatedAt?: string;
    };

    export type AppDTO = App & {
        versions: string[];
        installed: boolean;
        architectures: string;
    };

    export type Tag = Init<typeof AppTagSchema> & { sort: number };

    export type AppItem = Init<typeof AppItemSchema>;

    // total 在 proto 中为 int64（bigint），展示层按 number 处理。
    export type AppResPage = Omit<Init<typeof SearchAppsResponseSchema>, 'total'> & { total: number };

    export interface AppUpdateRes {
        version: string;
        canUpdate: boolean;
    }

    export interface AppDetail {
        id: number;
        appId: number;
        icon: string;
        version: string;
        readme: string;
        params: AppParams;
        dockerCompose: string;
        image: string;
        hostMode?: boolean;
        memoryRequired: number;
        architectures: string;
        gpuSupport: boolean;
        createdAt?: string;
        updatedAt?: string;
    }

    export type AppReq = Init<typeof SearchAppsRequestSchema>;

    export interface AppParams {
        formFields: FromField[];
    }

    export interface FromField {
        type: string;
        labelZh: string;
        labelEn: string;
        required: boolean;
        default: any;
        envKey: string;
        key?: string;
        values?: ServiceParam[];
        child?: FromFieldChild;
        params?: FromParam[];
        multiple?: boolean;
        allowCreate?: boolean;
        label: Locale;
        description: Locale;
    }

    export interface FromFieldChild extends FromField {
        services: App.AppService[];
    }

    export interface FromParam {
        type: string;
        key: string;
        value: string;
        envKey: string;
    }

    export interface ServiceParam {
        label: '';
        value: '';
        from?: '';
    }

    export type AppInstall = Init<typeof InstallAppRequestSchema> & {
        taskID: string;
        params: any;
        gpu?: AI.ModelGPUConfig;
        syncModelAccount?: boolean;
        modelAccountBaseURLType?: string;
        modelAccountBaseURL?: string;
    };

    export type AppInstallSearch = Init<typeof SearchInstalledAppsRequestSchema> & { sync?: boolean };

    export type ChangePort = Omit<Init<typeof ChangeAppPortRequestSchema>, 'port'> & { port: number };

    // appDetailId 在 proto 中为 uint32，展示层按字符串处理。
    export type AppInstalled = Omit<Init<typeof InstalledAppSchema>, 'appDetailId'> & {
        appID: number;
        appDetailId: string;
        webUI: string;
        env: string;
        description: string;
        app: App;
        serviceName: string;
        updatedAt?: string;
    };

    export type AppInstalledInfo = Init<typeof InstalledInfoSchema> & {
        env: { [key: string]: any };
    };

    export type AppInstallDto = Init<typeof InstalledAppSchema> & {
        taskID?: string;
        appID: number;
        appDetailID: number;
        ready: number;
        total: number;
        isEdit: boolean;
        dockerCompose: string;
        app: AppDetail;
        linkDB: boolean;
        resourceKeys?: string[];
        env?: { [key: string]: any };
    };

    export type AppInstalledOption = Init<typeof InstalledAppBriefSchema>;

    export type CheckInstalled = Init<typeof AppInstalledCheckSchema> & {
        taskID?: string;
        modelAccountBaseURLType: string;
        modelAccountBaseURL: string;
    };

    // port 在 proto 中为 int64（bigint），展示层按 number 处理。
    export type DatabaseConnInfo = Omit<Init<typeof LoadAppConnInfoResponseSchema>, 'port'> & {
        port: number;
        systemIP: string;
    };

    export type AppInstallResource = Init<typeof AppResourceSchema>;

    export type AppInstalledOp = Init<typeof OperateAppRequestSchema> & {
        taskID?: string;
        feishuTransition?: AI.AgentFeishuTransition;
    };

    export type AppInstalledSearch = Init<typeof SearchInstalledAppsRequestSchema>;

    export type AppService = Init<typeof AppServiceItemSchema> & { config?: object };

    export type VersionDetail = Init<typeof AppVersionSchema>;

    export interface InstallParams {
        labelZh: string;
        labelEn: string;
        value: any;
        edit: boolean;
        key: string;
        rule: string;
        type: string;
        values?: any;
        showValue?: string;
        required?: boolean;
        multiple?: boolean;
        label: Locale;
        showPassword: boolean;
    }

    export interface AppConfig {
        gpu?: AI.ModelGPUConfig;
        appKey: string;
        name: string;
        httpPort: number;
        syncModelAccount: boolean;
        modelAccountBaseURLType: string;
        modelAccountBaseURL: string;
        params: InstallParams[];
        rawCompose?: string;
        isEdit?: boolean;
        cpuQuota: number;
        memoryLimit: number;
        memoryUnit: string;
        containerName: string;
        allowPort: boolean;
        dockerCompose: string;
        hostMode?: boolean;
        type: string;
        webUI: string;
        specifyIP: string;
        restartPolicy: string;
    }

    export type IgnoredApp = Init<typeof IgnoredAppSchema> & { detailID: number };

    export type AppUpdateVersionReq = Init<typeof UpdateVersionsRequestSchema> & { appInstallID: number };

    export type AppIgnoreReq = Init<typeof IgnoreAppUpgradeRequestSchema> & {
        appID: number;
        appDetailID: number;
    };

    export type CancelAppIgnore = Init<typeof CancelIgnoreAppUpgradeRequestSchema>;

    export type AppStoreSync = Init<typeof SyncAppsRequestSchema> & { taskID: string };

    export type AppConfigUpdate = Init<typeof UpdateInstalledConfigRequestSchema> & {
        installID: number;
        webUI: string;
    };

    export interface AppStoreConfig {
        uninstallDeleteImage: string;
        uninstallDeleteBackup: string;
        upgradeBackup: string;
        upgradeDeleteImage: string;
        installAllowPort: string;
    }

    export interface AppStoreConfigUpdate {
        scope: string;
        status: string;
    }

    export interface CustomAppStoreConfig {
        status: string;
        imagePrefix: string;
    }

    export type InstallAppToNodes = AppInstall & {
        nodes: string[];
        appKey: string;
        version: string;
    };
}
