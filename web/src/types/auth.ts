import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf';
import {
    CurrentUserSchema,
    LoginResponseSchema,
    UpdateCurrentUserRequestSchema,
} from '@/gen/panel/core/v1/auth_pb';

type Init<T extends DescMessage> = MessageInitShape<T>;

// 认证相关 DTO 来自 core AuthService 的 proto 消息；仅保留旧页面使用的兼容字段。
export namespace Login {
    export type AuthInfo = Omit<Init<typeof CurrentUserSchema>, 'mfaStatus' | 'nodeRoles' | 'apiKeyValidityTime'> & {
        id: number;
        mfaStatus: string;
        masterOnlyPermissions?: string[];
        nodeRoles: Array<{ nodeId: number; nodeName: string; roleId: number; roleName: string }>;
        apiKeyValidityTime: number;
    };
    export type AuthInfoUpdate = Init<typeof UpdateCurrentUserRequestSchema> & { id?: number };
    export type ResLogin = Init<typeof LoginResponseSchema>;
}
