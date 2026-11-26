import LogFile from '@/components/log/file/index';
import { reactive } from 'vue';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';

interface CodemodProps {
    [key: string]: any;
    taskID?: string;
    heightDiff?: number;
}

const emits = {};

const options = {
    name: 'log-without-dialog',
    props: {
        taskID: { type: String },
        heightDiff: { type: Number },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const config = reactive({
            taskID: __panelSetupProps.taskID,
            type: 'task',
            taskOperate: '',
            resourceID: 0,
            taskType: '',
            tail: false,
        });
        return () => (
            <div>
                <LogFile
                    config={config}
                    showTail={false}
                    showDownload={false}
                    heightDiff={__panelSetupProps.heightDiff}
                />
            </div>
        );
    },
    options,
);
