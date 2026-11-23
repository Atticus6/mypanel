import { Group } from '../interface/group';
import http from '@/api';


export const getAgentGroupList = (type: string, nodeName?: string) => {
    return http.post<Array<Group.GroupInfo>>(
        `/groups/search`,
        { type: type },
        undefined,
        nodeName ? { CurrentNode: nodeName } : undefined,
    );
};
export const createAgentGroup = (params: Group.GroupCreate) => {
    return http.post<Group.GroupCreate>(`/groups`, params);
};
export const updateAgentGroup = (params: Group.GroupUpdate) => {
    return http.post(`/groups/update`, params);
};
export const deleteAgentGroup = (id: number) => {
    return http.post(`/groups/del`, { id: id });
};
