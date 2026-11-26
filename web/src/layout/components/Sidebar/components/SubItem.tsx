import { $t } from '@/utils/i18n-t';
import { RouteRecordRaw } from 'vue-router';
import SvgIcon from '@/components/svg-icon/svg-icon';
import './SubItem.styles.css';

interface CodemodProps {
    [key: string]: any;
    menuList?: RouteRecordRaw[];
    level?: number;
}

const emits = {};

const options = {
    name: 'SubItem',
    props: {
        menuList: Array,
        level: Number,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-90739512',
};

const SubItem = defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () =>
            (__panelSetupProps.menuList || []).map((subItem) =>
                subItem?.children?.length > 1 ? (
                    <ElSubMenu
                        key={subItem.name}
                        index={subItem.path}
                        popper-class="sidebar-container-popper"
                        v-slots={{
                            title: () => (
                                <>
                                    {subItem.meta?.icon ? (
                                        <ElIcon>
                                            <SvgIcon iconName={subItem.meta?.icon as string} />
                                        </ElIcon>
                                    ) : null}
                                    <span>{$t(subItem.meta?.title as string, 2)}</span>
                                </>
                            ),
                        }}
                    >
                        <SubItem menuList={subItem.children} level={__panelSetupProps.level + 1} />
                    </ElSubMenu>
                ) : subItem?.children?.length === 1 ? (
                    <ElMenuItem
                        key={subItem.name}
                        index={subItem.children[0].path}
                        v-slots={{
                            title: () => (
                                <>
                                    <span>{$t(subItem.meta?.title as string, 2)}</span>
                                </>
                            ),
                        }}
                    >
                        {subItem.meta?.icon ? (
                            <ElIcon>
                                <SvgIcon iconName={subItem.meta?.icon as string} />
                            </ElIcon>
                        ) : null}
                    </ElMenuItem>
                ) : (
                    <ElMenuItem
                        key={subItem.name}
                        index={subItem.path}
                        v-slots={{
                            title: () => (
                                <>
                                    {subItem.meta?.icon && __panelSetupProps.level === 0 ? (
                                        <span>{$t(subItem.meta?.title as string, 2)}</span>
                                    ) : (
                                        <span style={'margin-left: 10px'}>{$t(subItem.meta?.title as string, 2)}</span>
                                    )}
                                </>
                            ),
                        }}
                    >
                        {subItem.meta?.icon && __panelSetupProps.level === 0 ? (
                            <ElIcon>
                                <SvgIcon iconName={subItem.meta?.icon as string} />
                            </ElIcon>
                        ) : null}
                    </ElMenuItem>
                ),
            );
    },
    options,
);

export default SubItem;
