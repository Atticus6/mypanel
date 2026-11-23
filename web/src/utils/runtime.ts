export interface CommonModel {
id: number;
createdAt?: string;
updatedAt?: string;
}

export interface Runtime extends CommonModel {
    name: string;
    appDetailID: number;
    image: string;
    workDir: string;
    dockerCompose: string;
    env: string;
    params: string;
    type: string;
    resource: string;
    version: string;
    status: string;
    codeDir: string;
    port: string;
    appID: number;
    remark: string;
}


export function disabledButton(row: Runtime, type: string): boolean {
    switch (type) {
        case 'stop':
            return (
                row.status === 'Recreating' ||
                row.status === 'Stopped' ||
                row.status === 'Building' ||
                row.resource == 'local'
            );
        case 'start':
            return (
                row.status === 'Starting' ||
                row.status === 'Recreating' ||
                row.status === 'Running' ||
                row.status === 'Building' ||
                row.resource == 'local'
            );
        case 'restart':
            return row.status === 'Recreating' || row.status === 'Building' || row.resource == 'local';
        case 'edit':
            return row.status === 'Recreating' || row.status === 'Building';
        case 'extension':
        case 'config':
            return row.status != 'Running';
        default:
            return false;
    }
}
