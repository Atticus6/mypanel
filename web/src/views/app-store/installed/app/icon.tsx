import { getAppIconUrl } from '@/api/modules/app';
interface Props {
    currentNode: string;
    appKey: string;
    icon?: string;
}
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElAvatar } from 'element-plus';
import SvgIcon from '@/components/svg-icon/svg-icon';

interface CodemodProps {
    [key: string]: any;
    currentNode?: string;
    appKey?: string;
    icon?: string;
}

const emits = {
    'openDetail': (...args: unknown[]) => true,
};



const options = {
        name: "icon",
        props: {
    "currentNode": String,
    "appKey": String,
    "icon": String,
} as unknown as ComponentObjectPropsOptions<CodemodProps>,
        emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        
        return () => (
            <div class={"icon"}><ElAvatar onClick={($event?: any) => { ctx.emit('openDetail'); }} shape="square" size={77} src={getAppIconUrl(__panelSetupProps.appKey, __panelSetupProps.currentNode, __panelSetupProps.icon)}><SvgIcon iconName="p-appstore" /></ElAvatar></div>
        );
    },
    options,
);
