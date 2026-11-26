import { GlobalStore } from '@/store';

export interface NodeItem {
    id: number;
    groupID?: number;
    groupBelong?: string;
    addr: string;
    status: string;
    version: string;
    isXpack: boolean;
    isBound: boolean;
    isFavorite?: boolean;
    name: string;
}

export const changeToLocal = async () => {
    const globalStore = GlobalStore();
    let nodes = await listNodes('all');
    if (nodes.length === 0) {
        setDefaultNodeInfo();
        return;
    }
    if (globalStore.isAdmin) {
        for (const item of nodes) {
            if (item.name === 'local') {
                globalStore.currentNode = 'local';
                globalStore.currentNodeAddr = item.addr;
                return;
            }
        }
    }
    globalStore.currentNode = nodes[0].name;
    globalStore.currentNodeAddr = nodes[0].addr;
};

/**
 * 返回可用节点列表。
 *
 * 迁移后只保留单进程本地节点，多节点是 xpack 能力，已随 xpack 一并剔除；
 * 这里直接返回本地节点，避免再去请求不存在的 /core/nodes 接口。
 */
export async function listNodes(_type?: string): Promise<Array<NodeItem>> {
    return [localNode()];
}

// localNode 是本机节点的固定描述，字段与旧接口返回保持一致。
export function localNode(): NodeItem {
    return {
        id: 0,
        addr: '127.0.0.1',
        status: 'Running',
        version: '',
        isXpack: false,
        isBound: true,
        isFavorite: true,
        name: 'local',
    };
}

export const setDefaultNodeInfo = () => {
    const globalStore = GlobalStore();
    globalStore.currentNode = 'local';
    globalStore.currentNodeAddr = '127.0.0.1';
};
