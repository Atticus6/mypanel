export namespace Nginx {
    export interface NginxConfigReq {
        operate: string;
        websiteId?: number;
        scope: string;
        params?: any;
    }
    export interface NginxStatus {
        accepts: number;
        handled: number;
        active: number;
        requests: number;
        reading: number;
        writing: number;
        waiting: number;
    }
}
