import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf';
import { OpenrestyStatusSchema } from '@/gen/panel/agent/v1/openresty_pb';

type Init<T extends DescMessage> = MessageInitShape<T>;

// Nginx 状态来自 OpenrestyService；配置请求仍为本地表单结构。
export namespace Nginx {
    export interface NginxConfigReq {
        operate: string;
        websiteId?: number;
        scope: string;
        params?: any;
    }
    export type NginxStatus = Init<typeof OpenrestyStatusSchema>;
}
