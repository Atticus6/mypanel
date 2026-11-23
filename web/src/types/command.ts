import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf';
import { CommandEntrySchema } from '@/gen/panel/core/v1/command_pb';

type Init<T extends DescMessage> = MessageInitShape<T>;

export namespace Command {
    export type CommandInfo = Init<typeof CommandEntrySchema> & { groupID?: number };
    export type CommandOperate = Init<typeof CommandEntrySchema> & { groupID?: number };
}
