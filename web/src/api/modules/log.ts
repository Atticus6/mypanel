import http from '@/api';
import { ResPage } from '../interface';
import { Log } from '../interface/log';
import { TimeoutEnum } from '@/enums/http-enum';



export const getSystemFiles = (node?: string) => {
    const params = node ? `?operateNode=${node}` : '';
    return http.get<Array<string>>(`/logs/system/files${params}`);
};

export const getSystemLogStatus = (node?: string) => {
    const query = node ? `?operateNode=${node}` : '';
    return http.get<Log.SystemLogStatus>(`/logs/system/status${query}`);
};

export const readSystemLogs = (params: Log.SystemLogSearch, node?: string) => {
    const query = node ? `?operateNode=${node}` : '';
    return http.post<Log.SystemLog>(`/logs/system/read${query}`, params);
};

export const listRunningServices = (node?: string) => {
    const query = node ? `?operateNode=${node}` : '';
    return http.get<string[]>(`/logs/system/services${query}`);
};


export const searchTasks = (req: Log.SearchTaskReq, node?: string) => {
    const params = node ? `?operateNode=${node}` : '';
    return http.post<ResPage<Log.Task>>(`/logs/tasks/search${params}`, req);
};

export const readTaskLogByLine = (req: Log.TaskLogReadReq, node?: string) => {
    const params = node ? `?operateNode=${node}` : '';
    return http.post<any>(`/logs/tasks/read${params}`, req, TimeoutEnum.T_40S);
};

export const countExecutingTask = () => {
    return http.get<number>(`/logs/tasks/executing/count`);
};
