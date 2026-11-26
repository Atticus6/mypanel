import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf';
import {
    BatchChangeRoleRequestSchema,
    ChangeFileNameRequestSchema,
    ChangeOwnerRequestSchema,
    CheckFileRequestSchema,
    CompressFilesRequestSchema,
    ConvertFilesRequestSchema,
    ConvertFileItemSchema,
    CreateFileRequestSchema,
    CreateShareRequestSchema,
    DecompressFilesRequestSchema,
    DeleteFilesRequestSchema,
    DeleteHistoryRequestSchema,
    DepthSizeSchema,
    FileEntrySchema,
    FileHistoryEntrySchema,
    FileShareInfoSchema,
    FileTreeNodeSchema,
    GetDepthSizeRequestSchema,
    GetFileRequestSchema,
    GetHistoryContentResponseSchema,
    GetPublicShareResponseSchema,
    GetSizeRequestSchema,
    GetUsersAndGroupsResponseSchema,
    ListFilesRequestSchema,
    MoveFilesRequestSchema,
    PreviewFileRequestSchema,
    ReadFileLinesRequestSchema,
    RecycleEntrySchema,
    RestoreRecycleRequestSchema,
    SaveFileRequestSchema,
    SearchConvertLogsResponseSchema,
    SearchFileHistoryRequestSchema,
    SearchUploadRequestSchema,
    SetRemarkRequestSchema,
    StopCompressRequestSchema,
    StopDecompressRequestSchema,
    StopMoveRequestSchema,
    SystemUserSchema,
    UploadEntrySchema,
    WgetRequestSchema,
    WgetResponseSchema,
} from '@/gen/panel/agent/v1/file_pb';
import {
    CreateDownloadTicketRequestSchema,
    CreateUploadTicketRequestSchema,
} from '@/gen/panel/agent/v1/file_transfer_pb';

type Init<T extends DescMessage> = MessageInitShape<T>;

// 文件域 DTO 统一来自 proto 生成类型；这里只保留 AI 搜索（已剔除能力）
// 的本地结构与少量展示层字段的兼容别名。
export namespace File {
    export type File = Omit<
        Init<typeof FileEntrySchema>,
        'size' | 'favoriteId' | 'updateTime' | 'modTime' | 'items'
    > & {
        size: number;
        favoriteId: number;
        updateTime: string;
        modTime: string;
        items?: File[];
        dirSize?: number;
        remark?: string;
    };

    export type ReqFile = Init<typeof ListFilesRequestSchema>;
    export type ReqNodeFile = Init<typeof ListFilesRequestSchema> & { node: string };

    export type PreviewContentReq = Init<typeof PreviewFileRequestSchema>;
    export type SearchUploadInfo = Init<typeof SearchUploadRequestSchema>;
    export type UploadInfo = { name: string; size: number; createdAt: string };
    export type FileTree = Init<typeof FileTreeNodeSchema>;

    export type FileCreate = Init<typeof CreateFileRequestSchema> & { isAppendOnly?: boolean };
    export type FileDelete = Init<typeof DeleteFilesRequestSchema>;
    export type FileBatchDelete = { paths: string[]; isDir?: boolean };
    export type FileCompress = Init<typeof CompressFilesRequestSchema>;
    export type FileCompressStopReq = Init<typeof StopCompressRequestSchema>;
    export type FileDeCompress = Init<typeof DecompressFilesRequestSchema>;
    export type FileDeCompressStopReq = Init<typeof StopDecompressRequestSchema>;
    export type FileEdit = Init<typeof SaveFileRequestSchema>;
    export type FileHistorySearchReq = Init<typeof SearchFileHistoryRequestSchema>;
    export type FileHistoryInfo = Init<typeof FileHistoryEntrySchema> &
        Partial<Init<typeof GetHistoryContentResponseSchema>>;
    export type FileHistoryDeleteReq = { ids: number[] };
    export type FileRename = Init<typeof ChangeFileNameRequestSchema>;
    export type FileOwner = Init<typeof ChangeOwnerRequestSchema>;
    export type FileWget = Init<typeof WgetRequestSchema>;
    export type FileWgetRes = Init<typeof WgetResponseSchema>;
    export type FileKeys = { keys: string[] };
    export type FileMove = Init<typeof MoveFilesRequestSchema>;
    export type FileMoveStopReq = Init<typeof StopMoveRequestSchema>;
    export type FileDownload = Init<typeof CreateDownloadTicketRequestSchema>;
    export type FileChunkDownload = Init<typeof CreateUploadTicketRequestSchema>;
    export type DirSizeReq = Init<typeof GetSizeRequestSchema> | Init<typeof GetFileRequestSchema>;
    export type DirSizeRes = { size: number };
    export type DepthDirSizeRes = { path: string; size: number };
    export type FilePath = { path: string };
    export type ExistFileInfo = { name: string; path: string; size: number; isDir: boolean; modTime?: string };
    export type RecycleBin = Omit<Init<typeof RecycleEntrySchema>, 'size'> & { size: number };
    export type RecycleBinReduce = Init<typeof RestoreRecycleRequestSchema>;
    export type FileReadByLine = Init<typeof ReadFileLinesRequestSchema>;
    export type Favorite = { id: number; name: string; path: string; type: string; isDir: boolean; isTxt: boolean };
    export type FileRole = Init<typeof BatchChangeRoleRequestSchema>;
    export type FileRemarkUpdate = Init<typeof SetRemarkRequestSchema>;
    export type FileRemarkBatch = { paths: string[] };
    export type FileRemarksRes = { remarks: Record<string, string> };
    export type UserGroupResponse = Init<typeof GetUsersAndGroupsResponseSchema>;
    export type UserInfo = Init<typeof SystemUserSchema>;
    export type ConvertFile = Init<typeof ConvertFileItemSchema>;
    export type ConvertFileRequest = Init<typeof ConvertFilesRequestSchema>;
    export type ConvertLogResponse = Init<typeof SearchConvertLogsResponseSchema>['items'][number];
    export type FileShareCreate = Init<typeof CreateShareRequestSchema>;
    export type FileShareCheck = { code: string; password?: string };
    export type FileShareInfo = Omit<Init<typeof FileShareInfoSchema>, 'expiresAt'> & { expiresAt: number };
    export type FileSharePublicInfo = Omit<Init<typeof GetPublicShareResponseSchema>, 'expiresAt'> & {
        expiresAt: number;
    };

    // 文件 AI 搜索已剔除，以下结构只供抽屉组件的本地空桩使用。

    export type CheckFileReq = Init<typeof CheckFileRequestSchema>;
}
