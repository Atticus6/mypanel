import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf';
import {
    GroupSchema,
    CreateGroupRequestSchema,
    UpdateGroupRequestSchema,
} from '@/gen/panel/agent/v1/group_pb';

type Init<T extends DescMessage> = MessageInitShape<T>;

export namespace Group {
    export type GroupInfo = Init<typeof GroupSchema> & { isDelete?: boolean };
    export type GroupCreate = Init<typeof CreateGroupRequestSchema>;
    export type GroupUpdate = Init<typeof UpdateGroupRequestSchema>;
}
