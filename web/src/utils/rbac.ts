import { rpc } from '@/lib/rpc';
import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf';
import {
    CurrentUserSchema,
    UpdateCurrentUserRequestSchema,
} from '@/gen/panel/core/v1/auth_pb';

type Init<T extends DescMessage> = MessageInitShape<T>;

// 当前用户与用户资料表单类型来自 core AuthService proto。
export type AuthInfo = Omit<Init<typeof CurrentUserSchema>, 'mfaStatus' | 'nodeRoles' | 'apiKeyValidityTime'> & {
    id: number;
    mfaStatus: string;
    masterOnlyPermissions?: string[];
    nodeRoles: Array<{ nodeId: number; nodeName: string; roleId: number; roleName: string }>;
    apiKeyValidityTime: number;
};
export type AuthInfoUpdate = Init<typeof UpdateCurrentUserRequestSchema> & { id?: number };
import { getEnterpriseUserInfo } from '@/extensions/xpack';
import type { RouteMeta } from 'vue-router';
import { GlobalStore } from '@/store';

export type PermissionMetaValue = string | string[];

type RouteAccessMeta = {
    adminOnly?: boolean;
    protectedRoleOnly?: boolean;
    permission?: PermissionMetaValue;
};

type RouteAccessTarget = {
    matched: Array<{
        meta?: RouteMeta & RouteAccessMeta;
    }>;
};

export const syncAuthInfo = async (currentNode?: string): Promise<AuthInfo> => {
    const globalStore = GlobalStore();
    const storeCurrentNode = globalStore.currentNode;
    if (!globalStore.isEnterprise) {
        const res = await rpc.core.auth.current({});
        const authInfo: AuthInfo = {
            id: 0,
            name: res.name,
            mfaStatus: res.mfaStatus,
            mfaInterval: res.mfaInterval,
            role: res.role,
            permissions: res.permissions || [],
            masterOnlyPermissions: [],
            nodeRoles: res.nodeRoles || [],
            authSource: res.authSource,
            authSourceStatus: res.authSourceStatus,
            apiInterfaceStatus: res.apiInterfaceStatus,
            apiKey: res.apiKey,
            ipWhiteList: res.ipWhiteList,
            apiTrustedProxies: res.apiTrustedProxies,
            apiKeyValidityTime: res.apiKeyValidityTime,
        };
        globalStore.cacheUserID = `community:${res.name}`;
        globalStore.setAuthInfo({
            isAdmin: res.role === 'ADMIN',
            permissions: authInfo.permissions,
            masterOnlyPermissions: authInfo.masterOnlyPermissions,
            nodeRoles: authInfo.nodeRoles,
        });
        return authInfo;
    }
    const res = await getEnterpriseUserInfo(currentNode ?? storeCurrentNode);
    globalStore.cacheUserID = `enterprise:${res.data.id}`;
    globalStore.setAuthInfo({
        isAdmin: res.data.role === 'ADMIN',
        permissions: res.data.permissions || [],
        masterOnlyPermissions: res.data.masterOnlyPermissions || [],
        nodeRoles: res.data.nodeRoles || [],
    });
    return res.data;
};

export const hasPermission = (permission: string) => {
    return GlobalStore().hasPermission(permission);
};

export const hasPermissionMetaAccess = (permission?: PermissionMetaValue) => {
    if (!permission) {
        return true;
    }
    if (Array.isArray(permission)) {
        const permissions = permission.filter(Boolean);
        return permissions.length === 0 || permissions.some((item) => hasPermission(item));
    }
    return hasPermission(permission);
};

export const hasRouteRoleAccess = (meta?: RouteMeta & RouteAccessMeta) => {
    const globalStore = GlobalStore();

    if (!meta) {
        return true;
    }
    if (globalStore.isAdmin) {
        return true;
    }
    if (meta.adminOnly && !globalStore.isAdmin) {
        return false;
    }
    if (meta.protectedRoleOnly) {
        return globalStore.isNodeAdmin;
    }
    return true;
};

export const hasRoutePermissionAccess = (route: RouteAccessTarget) => {
    return route.matched.every((record) => hasPermissionMetaAccess(record.meta?.permission));
};

export const hasRouteAccess = (route: RouteAccessTarget) => {
    return route.matched.every((record) => hasRouteRoleAccess(record.meta)) && hasRoutePermissionAccess(route);
};
