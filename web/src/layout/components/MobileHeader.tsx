import { MenuStore } from '@/store';
import './MobileHeader.styles.css';
import SvgIcon from '@/components/svg-icon/svg-icon';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'MobileHeader',
    props: {},
    emits: emits,
    __scopeId: 'data-v-8374f437',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const menuStore = MenuStore();
        return () => (
            <div class={'mobile-header'}>
                <SvgIcon
                    iconName="p-caidan"
                    onClick={($event?: any) => {
                        menuStore.setCollapse();
                    }}
                    class={'mobile-menu'}
                />
            </div>
        );
    },
    options,
);
