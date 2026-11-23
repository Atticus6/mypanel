// MCP 面板设置的 UI 类型；协议端点本身保留 HTTP，类型无对应 proto。
export namespace PanelMCP {
    export interface Catalog {
        contractVersion: number;
        tools: Tool[];
        scope: 'nodes';
        toolNodeIds: Record<string, string[]>;
    }
    export type Client = 'generic' | 'codex' | 'claude';
    export interface Credential extends EditableCredential {
        id: string;
        keyHint: string;
        status: CredentialStatus;
        revision: number;
        createdAt: string;
        ownerName: string;
        staleTools: string[];
    }
    export type CredentialStatus = 'Enable' | 'Disable' | 'Revoked' | 'Expired';
    export interface EditableCredential {
        name: string;
        description: string;
        expiresAt: string | null;
        tools: string[];
        toolPolicies: Record<string, string>;
        toolReadOnly: Record<string, boolean>;
        nodeIds: string[];
    }
    export interface Node {
        id: string;
        name: string;
        status: string;
        isLocal: boolean;
    }
    export interface Settings {
        runtimeType: RuntimeType;
        dockerImage: string;
        enabled: boolean;
        listenPort: number;
        externalUrl: string;
        revision: number;
        accessPolicy: 'inherit' | 'restricted' | 'all';
        allowedIPs: string[];
    }
    export interface Tool {
        toolId: string;
        schemaVersion: number;
        name: string;
        description: string;
        categoryId: string;
        categoryName: string;
        categoryOrder: number;
        readOnly: boolean;
        risk: string;
        inputSchema: Record<string, unknown>;
        operations: ToolOperation[];
        policyHash: string;
    }
    export interface ToolOperation {
        id: string;
        method: string;
        path: string;
        bodySchema: Record<string, unknown>;
        responseFields: string[];
    }
    export interface WebsiteDraft {
        requested: boolean;
        domain: string;
        enableSSL: boolean;
        sslID: number;
    }
    export type RuntimeType = 'docker';
}
