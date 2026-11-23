import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf';
import {
    CronjobRecordSchema,
    CronjobSchema,
    DeleteCronjobsRequestSchema,
    ScriptOptionSchema,
    SearchCronjobRecordsRequestSchema,
    SearchCronjobsRequestSchema,
    UpdateCronjobStatusRequestSchema,
} from '@/gen/panel/agent/v1/cronjob_pb';
import type { CronjobAlertTriggerMode } from '@/utils/cronjob-alert';

type Init<T extends DescMessage> = MessageInitShape<T>;

// 计划任务域 DTO 由 proto 生成类型派生；specObjs、urlItems 等展示层结构没有 proto 对应物，保留为本地字段。
export namespace Cronjob {
    export interface URLItem {
        url: string;
        header: string;
    }

    export type Search = Init<typeof SearchCronjobsRequestSchema> & { groupIDs?: Array<number> };

    export type CronjobInfo = Omit<Init<typeof CronjobSchema>, 'retainCopies' | 'alertTriggerMode'> & {
        groupID: number;
        scriptID: number;
        appID: string;
        retainCopies: number;
        alertTriggerMode?: CronjobAlertTriggerMode;

        specs: Array<string>;
        specObjs: Array<SpecObj>;
        isExecutorCustom: boolean;
        isCustom: boolean;
        inContainer: boolean;
        exclusionRules: string;
        ignoreFiles: Array<string>;
        url: string;
        urlItems: Array<URLItem>;
        isDir: boolean;
        files: Array<Item>;
        snapshotRule: snapshotRule;
        ignoreAppIDs: Array<number>;
        withImage: boolean;

        websiteList: Array<string>;
        appIdList: Array<string>;
        dbNameList: Array<string>;

        sourceAccounts: Array<string>;
        downloadAccount: string;
        sourceAccountIDs: string;
        downloadAccountID: number;
        sourceAccountItems: Array<number>;

        timeoutItem: number;
        timeoutUnit: string;
        secret: string;
        hasAlert: boolean;
        alertTitle: string;
        alertMethod: string;
        alertMethodItems: Array<string>;

        scopes: string[];
        args: string;
        argItems: Array<string>;
    };
    export interface Item {
        val: string;
    }

    export type CronjobOperate = Omit<Init<typeof CronjobSchema>, 'retainCopies' | 'alertTriggerMode'> & {
        groupID: number;
        scriptID: number;
        appID: string;
        retainCopies: number;
        alertTriggerMode?: CronjobAlertTriggerMode;

        specs: Array<string>;
        specObjs: Array<SpecObj>;
        exclusionRules: string;
        url: string;
        urlItems?: Array<URLItem>;
        isDir: boolean;
        snapshotRule: snapshotRule;
        sourceAccountIDs: string;
        downloadAccountID: number;
        secret: string;
        alertTitle: string;
        alertMethod: string;
        scopes?: string[];
        args: string;
    };

    export interface CronjobTrans {
        name: string;
        type: string;
        specCustom: boolean;
        spec: string;
        group: string;

        executor: string;
        scriptMode: string;
        script: string;
        command: string;
        containerName: string;
        user: string;
        url: string;
        urlItems?: Array<URLItem>;

        scriptName: string;
        apps: Array<TransHelper>;
        websites: Array<string>;
        dbType: string;
        dbNames: Array<TransHelper>;

        exclusionRules: string;

        isDir: boolean;
        sourceDir: string;

        retainCopies: number;
        retryTimes: number;
        timeout: number;
        ignoreErr: boolean;
        snapshotRule: string;
        secret: string;

        sourceAccounts: Array<string>;
        downloadAccount: string;

        alertCount: number;
        alertTriggerMode?: CronjobAlertTriggerMode;
    }
    export interface TransHelper {
        name: string;
        detailName: string;
    }
    export interface snapshotTransHelper {
        withImage: boolean;
        ignoreApps: Array<TransHelper>;
    }
    export interface snapshotRule {
        withImage: boolean;
        ignoreAppIDs: Array<number>;
    }
    export interface SpecObj {
        specType: string;
        week: number;
        day: number;
        hour: number;
        minute: number;
        second: number;
    }

    export type CronjobDelete = Init<typeof DeleteCronjobsRequestSchema>;
    export type UpdateStatus = Init<typeof UpdateCronjobStatusRequestSchema>;
    export interface Download {
        recordID: number;
        backupAccountID: number;
    }
    export type ScriptOptions = Init<typeof ScriptOptionSchema> & { script?: string };

    export type SearchRecord = Init<typeof SearchCronjobRecordsRequestSchema> & {
        cronjobID?: number;
        startTime: string | Date;
        endTime: string | Date;
    };
    export type Record = Init<typeof CronjobRecordSchema> & {
        taskID?: string;
        cronjobName?: string;
    };

    export interface ScriptInfo {
        id: number;
        name: string;
        script: string;
        groups: string;
        isInteractive: boolean;
        groupList: Array<number>;
        groupBelong: Array<string>;
        description: string;
        createdAt: Date;
    }
    export interface ScriptOperate {
        id: number;
        name: string;
        script: string;
        groups: string;
        description: string;
    }
}
