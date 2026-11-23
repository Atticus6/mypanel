import http from '@/api';
import { ResPage } from '../interface';
import { Host } from '../interface/host';
import { TerminalSession } from '../interface/terminal';
import { encodeBase64Fields } from '@/utils/base64';
import { deepCopy } from '@/utils/misc';
export const searchHosts = (params: Host.SearchWithPage) => {
    return http.postLocalNode<ResPage<Host.Host>>(`/hosts/search`, params);
};
export const getHostByID = (id: number) => {
    return http.postLocalNode<Host.Host>(`/hosts/info`, { id: id });
};
export const getHostTree = (params: Host.ReqSearch) => {
    return http.postLocalNode<Array<Host.HostTree>>(`/hosts/tree`, params);
};
export const editHost = (params: Host.HostOperate) => {
    let request = deepCopy(params) as Host.HostOperate;
    encodeBase64Fields(request, ['password', 'privateKey']);
    return http.postLocalNode(`/hosts/update`, request);
};


