import http from '@/api';
import { Command } from '../interface/command';

// 命令 CSV 上传是 multipart 二进制通道，保留 HTTP 实现。
export const uploadCommands = (params: FormData) => {
    return http.upload<Array<Command.CommandInfo>>(`/core/commands/upload`, params);
};
