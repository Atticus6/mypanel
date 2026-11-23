import type { FileEntry, FileList } from '@/gen/panel/agent/v1/file_pb';

/**
 * 文件列表的视图模型。
 *
 * 页面沿用 1Panel 原有的字段名（itemTotal/isAppendOnly/favoriteID），
 * 协议侧仍然是 proto 的命名；转换只发生在视图边界。
 */
export interface FileEntryView {
    path: string;
    name: string;
    user: string;
    group: string;
    uid: string;
    gid: string;
    extension: string;
    content: string;
    size: number;
    isDir: boolean;
    isSymlink: boolean;
    isHidden: boolean;
    linkPath: string;
    type: string;
    mode: string;
    mimeType: string;
    updateTime: string;
    modTime: string;
    items: FileEntryView[];
    favoriteID: number;
    shareCode: string;
    isAppendOnly: boolean;
    isImmutable: boolean;
    dirSize?: number;
}

export interface FileListView {
    path: string;
    name: string;
    itemTotal: number;
    items: FileEntryView[];
    isAppendOnly: boolean;
    isImmutable: boolean;
}

/**
 * 把 proto 的文件条目转成页面使用的结构。
 *
 * int64 的 size 在响应里是 bigint，这里统一转 number；
 * dirSize 由页面自己的缓存补充，转换时保持 undefined。
 */
export function toFileEntryView(entry: FileEntry): FileEntryView {
    return {
        path: entry.path,
        name: entry.name,
        user: entry.user,
        group: entry.group,
        uid: entry.uid,
        gid: entry.gid,
        extension: entry.extension,
        content: entry.content,
        size: Number(entry.size),
        isDir: entry.isDir,
        isSymlink: entry.isSymlink,
        isHidden: entry.isHidden,
        linkPath: entry.linkPath,
        type: entry.type,
        mode: entry.mode,
        mimeType: entry.mimeType,
        updateTime: entry.updateTime,
        modTime: entry.modTime,
        items: entry.items.map((item) => toFileEntryView(item)),
        favoriteID: Number(entry.favoriteId),
        shareCode: entry.shareCode,
        isAppendOnly: entry.isAppendOnly,
        isImmutable: entry.isImmutable,
    };
}

/**
 * 把 proto 的目录列表转成页面使用的结构。
 */
export function toFileListView(list: FileList): FileListView {
    return {
        path: list.path,
        name: list.name,
        itemTotal: Number(list.itemTotal),
        items: list.items.map((item) => toFileEntryView(item)),
        isAppendOnly: list.isAppendOnly,
        isImmutable: list.isImmutable,
    };
}
