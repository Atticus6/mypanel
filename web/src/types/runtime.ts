import { CommonModel, ReqPage } from '.';
import { App } from '@/types/app';
export namespace Runtime {
    export interface ExtraHost {
        hostname: string;
        ip: string;
    }
    export interface Runtime extends CommonModel {
        name: string;
        appDetailID: number;
        image: string;
        workDir: string;
        dockerCompose: string;
        env: string;
        params: string;
        type: string;
        resource: string;
        version: string;
        status: string;
        codeDir: string;
        port: string;
        appID: number;
        remark: string;
    }
    export interface RuntimeDTO extends Runtime {
        appParams: App.InstallParams[];
        appID: number;
        source?: string;
        path?: string;
        exposedPorts?: ExposedPort[];
        environments?: Environment[];
        volumes?: Volume[];
        extraHosts?: ExtraHost[];
        container: string;
    }
    export interface RuntimeReq extends ReqPage {
        name?: string;
        status?: string;
        type?: string;
    }
    export interface ExposedPort {
        hostPort: number;
        containerPort: number;
        hostIP: string;
        protocol: string;
    }
    export interface Environment {
        key: string;
        value: string;
    }
    export interface Volume {
        source: string;
        target: string;
        mode: string;
    }
}
