import type { Container, Image } from '@/gen/panel/agent/v1/container_pb';

/**
 * 容器列表的视图模型。
 *
 * 页面沿用 1Panel 的字段名（containerID），协议生成类型是 containerId；
 * 这里做一次边界映射，避免整页替换字段名。
 */
export interface ContainerView extends Omit<Container, 'containerId' | 'imageId'> {
    containerID: string;
    imageID: string;
    hasLoad?: boolean;
    cpuPercent?: number;
    memoryPercent?: number;
}

/**
 * 把 proto 的容器转换成页面使用的结构。
 */
export function toContainerView(item: Container): ContainerView {
    return {
        ...item,
        containerID: item.containerId,
        imageID: item.imageId,
    };
}

/**
 * 镜像的视图模型：int64 的 size 转成 number，供 computeSize 使用。
 */
export function toImageView(item: Image) {
    return {
        ...item,
        size: Number(item.size),
    };
}
