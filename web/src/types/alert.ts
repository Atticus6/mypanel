import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf';
import type { CronjobAlertTriggerMode } from '@/utils/cronjob-alert';
import {
    AlertSchema,
    AlertDiskSchema,
    AlertLogEntrySchema,
    AlertClamSchema,
    AlertCronJobSchema,
    CreateAlertRequestSchema,
    UpdateAlertRequestSchema,
    UpdateAlertStatusRequestSchema,
    DeleteAlertRequestSchema,
    SearchAlertsRequestSchema,
    SearchAlertLogsRequestSchema,
    GetAlertCronJobsRequestSchema,
    AlertConfigEntrySchema,
    SearchAlertConfigsRequestSchema,
    GetAlertConfigRequestSchema,
    UpdateAlertConfigRequestSchema,
    UpdateAlertConfigStatusRequestSchema,
    TestAlertConfigRequestSchema,
    TestAlertConfigResponseSchema,
} from '@/gen/panel/agent/v1/alert_pb';

type Init<T extends DescMessage> = MessageInitShape<T>;

export namespace Alert {
    // 去掉 $typeName/$unknown，避免展开到其它 RPC 入参时携带错误的消息类型名。
    export type AlertInfo = Omit<Init<typeof AlertSchema>, '$typeName' | '$unknown'> & {
        type: string;
        title: string;
        subType: string;
        interval: number;
        sendMethod: string[];
        alertTriggerMode?: CronjobAlertTriggerMode;
    };

    // 告警详情由 alert_detail_json 透传，组件按字段自行展示。
    export interface AlertDetail {
        type: string;
        subType?: string;
        licenseId: string;
        title: string;
        project: string;
        method: string;
        params: { index: string; key: string; value: string }[] | string;
    }

    export type AlertUpdateStatusReq = Init<typeof UpdateAlertStatusRequestSchema>;

    export type AlertLog = Init<typeof AlertLogEntrySchema> & {
        alertDetail: AlertDetail;
        alertRule: AlertInfo;
    };

    // 容量字段在 proto 中为 uint64（bigint），展示层按 number 处理。
    export type DisksDTO = Omit<Init<typeof AlertDiskSchema>, 'total' | 'free' | 'used' | 'inodesTotal' | 'inodesUsed' | 'inodesFree'> & {
        total: number;
        free: number;
        used: number;
        inodesTotal: number;
        inodesUsed: number;
        inodesFree: number;
    };

    export type AlertSearch = Init<typeof SearchAlertsRequestSchema>;

    export type AlertCreateReq = Init<typeof CreateAlertRequestSchema> & { interval: number };

    export type AlertUpdateReq = Init<typeof UpdateAlertRequestSchema> & { interval: number };

    export type DelReq = Init<typeof DeleteAlertRequestSchema>;

    export type AlertLogSearch = Init<typeof SearchAlertLogsRequestSchema>;

    export interface AlertLogId {
        id: number;
    }

    export type ClamsDTO = Init<typeof AlertClamSchema>;

    export type CronJobDTO = Init<typeof AlertCronJobSchema>;

    export type CronJobReq = Init<typeof GetAlertCronJobsRequestSchema>;

    export interface AlertSmsReq {
        licenseId: string;
    }

    export interface AlertSmsDTO {
        name: string;
        total: number;
        used: number;
    }

    export type AlertConfigInfo = Init<typeof AlertConfigEntrySchema>;

    export type AlertConfigPageReq = Init<typeof SearchAlertConfigsRequestSchema>;

    export type AlertConfigFilterReq = Init<typeof GetAlertConfigRequestSchema>;

    export type AlertConfigUpdateReq = Init<typeof UpdateAlertConfigRequestSchema>;

    export type AlertConfigStatusReq = Init<typeof UpdateAlertConfigStatusRequestSchema>;

    export type AlertConfigTest = Init<typeof TestAlertConfigRequestSchema> & { type: 'email' };

    export interface AlertConfigCustomTest {
        id?: number;
        type: 'custom';
        config: string;
    }

    // duration 在 proto 中为 int64（bigint），展示层按 number 处理。
    export type AlertConfigCustomTestResult = Omit<Init<typeof TestAlertConfigResponseSchema>, 'duration'> & {
        duration?: number;
    };

    export interface CommonAlertConfig {
        id?: number;
        type: string;
        title: string;
        status: string;
        config: CommonConfig;
    }

    export interface CommonConfig {
        isOffline?: string;
        alertDailyNum?: number;
        alertSendTimeRange?: string;
    }

    export interface EmailConfig {
        id?: number;
        type: string;
        title: string;
        status: string;
        config: {
            status?: string;
            sender?: string;
            userName?: string;
            password?: string;
            displayName?: string;
            host?: string;
            port?: number;
            encryption?: string;
            recipient?: string;
            recipients?: string[];
        };
    }

    export interface SmsConfig {
        id?: number;
        type: string;
        title: string;
        status: string;
        config: {
            displayName?: string;
            phone?: string;
            alertDailyNum?: number;
        };
    }

    export interface WebhookConfig {
        id?: number;
        type: string;
        title: string;
        status: string;
        config: {
            displayName?: string;
            url?: string;
            webhooks?: WebhookItem[];
        };
    }

    export interface WebhookItem {
        displayName: string;
        url: string;
    }
}
