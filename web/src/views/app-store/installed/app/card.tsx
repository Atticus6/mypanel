import AppIcon from '@/views/app-store/installed/app/icon';
import AppHeader from '@/views/app-store/installed/app/header';
import AppInfo from '@/views/app-store/installed/app/info';
import { App } from '@/types/app';
interface Props {
    installed: App.AppInstalled;
    mode: string;
    defaultLink: string;
    currentNode: string;
    sortMode?: boolean;
}
import './card.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElCard } from 'element-plus';
import { ElRow } from 'element-plus';
import { ElCol } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
    installed?: App.AppInstalled;
    mode?: string;
    defaultLink?: string;
    currentNode?: string;
    sortMode?: boolean;
}

const emits = {
    toFolder: (...args: unknown[]) => true,
    openUploads: (...args: unknown[]) => true,
    openDetail: (...args: unknown[]) => true,
    openBackups: (...args: unknown[]) => true,
    openLog: (...args: unknown[]) => true,
    openTerminal: (...args: unknown[]) => true,
    openOperate: (...args: unknown[]) => true,
    favoriteInstall: (...args: unknown[]) => true,
    jumpToPath: (...args: unknown[]) => true,
    ignoreApp: (...args: unknown[]) => true,
    toContainer: (...args: unknown[]) => true,
};

type SlotsShape = {
    buttons: (arg?: unknown) => VNode[];
};

const options = {
    name: 'card',
    props: {
        installed: { type: null },
        mode: String,
        defaultLink: String,
        currentNode: String,
        sortMode: Boolean,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
    __scopeId: 'data-v-1f2e4564',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        return () => (
            <div class={'install-card'}>
                <ElCard class={'e-card'}>
                    <ElRow gutter={10} class={'install-card-row'}>
                        <ElCol xs={3} sm={3} md={3} lg={4} xl={3} class={'install-card-icon-col'}>
                            <AppIcon
                                onOpenDetail={($event?: any) => {
                                    ctx.emit('openDetail');
                                }}
                                appKey={__panelSetupProps.installed.appKey}
                                icon={__panelSetupProps.installed.icon}
                                currentNode={__panelSetupProps.currentNode}
                            />
                        </ElCol>
                        <ElCol xs={21} sm={21} md={21} lg={20} xl={21} class={'install-card-detail-col'}>
                            <div class={'a-detail'}>
                                <AppHeader
                                    installed={__panelSetupProps.installed}
                                    mode={__panelSetupProps.mode}
                                    defaultLink={__panelSetupProps.defaultLink}
                                    sortMode={__panelSetupProps.sortMode}
                                    onOpenBackups={($event?: any) => {
                                        ctx.emit('openBackups');
                                    }}
                                    onOpenLog={($event?: any) => {
                                        ctx.emit('openLog');
                                    }}
                                    onOpenTerminal={($event?: any) => {
                                        ctx.emit('openTerminal');
                                    }}
                                    onOpenOperate={($event?: any) => {
                                        ctx.emit('openOperate');
                                    }}
                                    onFavoriteInstall={($event?: any) => {
                                        ctx.emit('favoriteInstall');
                                    }}
                                    onToFolder={($event?: any) => {
                                        ctx.emit('toFolder');
                                    }}
                                    onOpenUploads={($event?: any) => {
                                        ctx.emit('openUploads');
                                    }}
                                    onIgnoreApp={($event?: any) => {
                                        ctx.emit('ignoreApp');
                                    }}
                                    onToContainer={($event?: any) => {
                                        ctx.emit('toContainer');
                                    }}
                                />
                                <AppInfo
                                    installed={__panelSetupProps.installed}
                                    defaultLink={__panelSetupProps.defaultLink}
                                    onJumpToPath={($event?: any) => {
                                        ctx.emit('jumpToPath', '/settings/panel');
                                    }}
                                />
                                <div class={'app-divider'} />
                                {ctx.slots['buttons']?.(undefined)}
                            </div>
                        </ElCol>
                    </ElRow>
                </ElCard>
            </div>
        );
    },
    options,
);
