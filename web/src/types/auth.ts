export namespace Login {
    export interface AuthInfo {
        id: number;
        name: string;
        mfaStatus: string;
        mfaInterval: number;
        role: string;
        permissions: string[];
        masterOnlyPermissions?: string[];
        nodeRoles: Array<{ nodeId: number; nodeName: string; roleId: number; roleName: string }>;
        authSource: string;
        authSourceStatus: string;

        apiInterfaceStatus: string;
        apiKey: string;
        ipWhiteList: string;
        apiTrustedProxies: string;
        apiKeyValidityTime: number;
    }
    export interface AuthInfoUpdate {
        id: number;
        name: string;
        password: string;
        oldPassword: string;
    }
    export interface ResLogin {
        name: string;
        role: string;
        token: string;
        mfaStatus: string;
        mfaSession: string;
    }
}
