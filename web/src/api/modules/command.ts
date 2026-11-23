import http from '@/api';
import { ResPage, SearchWithPage } from '../interface';
import { Command } from '../interface/command';

export const uploadCommands = (params: FormData) => {
    return http.upload<Array<Command.CommandInfo>>(`/core/commands/upload`, params);
};
export const deleteCommand = (params: { ids: number[] }) => {
    return http.post(`/core/commands/del`, params);
};
