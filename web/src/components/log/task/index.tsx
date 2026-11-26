import { reactive, ref } from 'vue';
import bus from '@/global/bus';
import LogFile from '@/components/log/file/index';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import DialogPro from '@/components/dialog-pro/index';

interface CodemodProps {
    [key: string]: any;
    showClose?: boolean;
    width?: string;
    tail?: boolean;
}

const emits = {
    close: (...args: unknown[]) => true,
};

type SlotsShape = {
    'task-footer': (arg?: unknown) => VNode[];
};

const options = {
    name: 'task',
    props: {
        showClose: {
            type: Boolean,
            default: true,
        },
        width: {
            type: String,
            default: '50%',
        },
        tail: {
            type: Boolean,
            default: true,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        const config = reactive({
            id: 0,
            name: '',
            taskID: '',
            type: 'task',
            taskOperate: '',
            resourceID: 0,
            taskType: '',
            tail: true,
            colorMode: 'task',

            operateNode: '',
        });
        const open = ref(false);
        const showTail = ref(true);
        const openWithTaskID = (id: string, tail?: boolean, operateNode?: string) => {
            config.taskID = id;
            config.type = 'task';
            config.taskType = '';
            config.taskOperate = '';
            config.resourceID = 0;
            if (tail === undefined) {
                config.tail = true;
            } else {
                config.tail = tail;
            }
            config.operateNode = operateNode || '';
            open.value = true;
            bus.emit('refreshTask', true);
        };
        const openWithResourceID = (
            taskType: string,
            taskOperate: string,
            resourceID: number,
            operateNode?: string,
        ) => {
            config.taskID = '';
            config.type = 'task';
            config.taskType = taskType;
            config.resourceID = resourceID;
            config.taskOperate = taskOperate;
            config.operateNode = operateNode || '';
            open.value = true;
        };
        const handleClose = () => {
            open.value = false;
        };
        const handleClosed = () => {
            ctx.emit('close', true);
            bus.emit('refreshTask', true);
            bus.emit('refreshApp', true);
        };
        ctx.expose({ openWithResourceID, openWithTaskID, handleClose });
        return () => (
            <DialogPro
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
                show-close={__panelSetupProps.showClose}
                close-on-click-modal={true}
                onClosed={($event?: any) => {
                    (handleClosed as any)($event);
                }}
                width={__panelSetupProps.width}
                v-slots={{
                    content: () => (
                        <>
                            {unref(open) ? (
                                <div>
                                    <LogFile config={config} showTail={unref(showTail)} />
                                </div>
                            ) : null}
                        </>
                    ),
                    footer: () => <>{ctx.slots['task-footer']?.(undefined)}</>,
                }}
            />
        );
    },
    options,
);
