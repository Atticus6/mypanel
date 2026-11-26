import { $t } from '@/utils/i18n-t';
import { Host } from '@/types/host';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { rpc } from '@/lib/rpc';
import './disk-card.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import permissionDirective from '@/directives/modules/permission';
import { nodeAdminDirective } from '@/directives/modules/permission';
import { ElCard } from 'element-plus';
import { ElTag } from 'element-plus';
import { ElText } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElTable } from 'element-plus';
import { ElTableColumn } from 'element-plus';
import { ElProgress } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
    diskInfo?: Host.DiskInfo;
    scope?: string;
}

const emits = {
    partition: (...args: unknown[]) => true,
    search: (...args: unknown[]) => true,
    mount: (...args: unknown[]) => true,
};

const options = {
    name: 'disk-card',
    props: {
        diskInfo: {
            type: Object as () => Host.DiskInfo,
            required: true,
        },
        scope: {
            type: String,
            required: false,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-943a3c0b',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isMobile } = useGlobalStore();
        const handlePartition = (diskInfo: Host.DiskInfo) => {
            ctx.emit('partition', diskInfo);
        };
        const columnMinWidth = (desktop: number, mobile: number) => (isMobile.value ? mobile : desktop);
        const mount = (diskInfo: Host.DiskInfo) => {
            ctx.emit('mount', diskInfo);
        };
        const unmount = (diskInfo: Host.DiskInfo) => {
            ElMessageBox.confirm(
                i18n.global.t('disk.unmountHelper', [diskInfo.device.split('/').pop()]),
                i18n.global.t('disk.unmount'),
                {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                },
            ).then(async () => {
                rpc.host.unmountDisk({ mountPoint: diskInfo.mountPoint }).then(() => {
                    MsgSuccess(i18n.global.t('disk.unmount') + i18n.global.t('commons.status.success'));
                    ctx.emit('search');
                });
            });
        };
        return () => (
            <ElCard class={'disk-card shadow-sm'}>
                <div class={'border-b pb-4'}>
                    <div class={'flex items-center space-x-4'}>
                        <div>
                            <h3 class={'disk-title text-lg'}>
                                <span class={'disk-title__name'}>
                                    {$t('home.disk')}
                                    {$t('commons.table.name')}
                                    {': '}
                                    {__panelSetupProps.diskInfo.device}
                                </span>
                                {__panelSetupProps.scope === 'system' ? (
                                    <ElTag size="small" type="warning">
                                        {$t('disk.systemDisk')}
                                    </ElTag>
                                ) : null}
                                {__panelSetupProps.scope == 'unpartitioned' &&
                                __panelSetupProps.diskInfo.partitions == undefined &&
                                __panelSetupProps.diskInfo.mountPoint == '' ? (
                                    <ElTag size="small" type="warning">
                                        {$t('disk.unpartitionedDisk')}
                                    </ElTag>
                                ) : null}
                            </h3>
                            <div class={'disk-summary text-sm'}>
                                <ElText type="info" class={'disk-summary__item'}>
                                    {$t('container.size')}
                                    {': '}
                                    {__panelSetupProps.diskInfo.size}
                                </ElText>
                                <ElText type="info" class={'disk-summary__item'}>
                                    {$t('disk.partition')}
                                    {': '}
                                    {__panelSetupProps.diskInfo.partitions ? (
                                        <span>{__panelSetupProps.diskInfo.partitions?.length}</span>
                                    ) : (
                                        <span>{'0'}</span>
                                    )}
                                </ElText>
                                {__panelSetupProps.diskInfo.diskType ? (
                                    <ElText type="info" class={'disk-summary__item'}>
                                        {$t('disk.diskType')}
                                        {': '}
                                        <ElTag size="small" type="info" class={'ml-2'}>
                                            {__panelSetupProps.diskInfo.diskType}
                                        </ElTag>
                                    </ElText>
                                ) : null}
                                {__panelSetupProps.diskInfo.model ? (
                                    <ElText type="info" class={'disk-summary__item'}>
                                        {$t('disk.model')}
                                        {': '}
                                        <span class={'disk-summary__value ml-2'}>
                                            {__panelSetupProps.diskInfo.model}
                                        </span>
                                    </ElText>
                                ) : null}
                                {__panelSetupProps.diskInfo.serial ? (
                                    <ElText type="info" class={'disk-summary__item'}>
                                        {$t('disk.serial')}
                                        {': '}
                                        <span class={'disk-summary__value ml-2'}>
                                            {__panelSetupProps.diskInfo.serial}
                                        </span>
                                    </ElText>
                                ) : null}
                                {__panelSetupProps.scope == 'unpartitioned' &&
                                __panelSetupProps.diskInfo.partitions == undefined &&
                                __panelSetupProps.diskInfo.mountPoint == '' ? (
                                    <div>
                                        {withDirectives(
                                            <ElButton
                                                type="primary"
                                                size="small"
                                                onClick={($event?: any) => {
                                                    handlePartition(__panelSetupProps.diskInfo);
                                                }}
                                            >
                                                {$t('disk.handlePartition')}
                                            </ElButton>,
                                            [
                                                [permissionDirective, true],
                                                [nodeAdminDirective, true],
                                            ],
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
                {__panelSetupProps.diskInfo.partitions && __panelSetupProps.diskInfo.partitions.length > 0 ? (
                    <div>
                        <ElTable
                            data={__panelSetupProps.diskInfo.partitions}
                            scrollbar-always-on={unref(isMobile)}
                            class={'w-full'}
                        >
                            <ElTableColumn
                                prop="device"
                                label={$t('disk.partition') + $t('commons.table.name')}
                                min-width={columnMinWidth(100, 120)}
                                v-slots={{
                                    default: ({ row }) => (
                                        <>
                                            <span class={'font-medium'}>{row.device.split('/').pop()}</span>
                                        </>
                                    ),
                                }}
                            />
                            <ElTableColumn
                                prop="size"
                                label={$t('container.size')}
                                min-width={columnMinWidth(40, 80)}
                            />
                            <ElTableColumn prop="used" label={$t('home.used')} min-width={columnMinWidth(40, 80)} />
                            <ElTableColumn
                                prop="avail"
                                label={$t('home.available')}
                                min-width={columnMinWidth(40, 80)}
                            />
                            <ElTableColumn
                                prop="usePercent"
                                label={$t('home.percent')}
                                min-width={columnMinWidth(60, 120)}
                                v-slots={{
                                    default: ({ row }) => (
                                        <>
                                            <ElProgress
                                                percentage={row.usePercent}
                                                status={row.usePercent >= 90 ? 'exception' : 'success'}
                                                text-inside={true}
                                                stroke-width={14}
                                            />
                                        </>
                                    ),
                                }}
                            />
                            <ElTableColumn
                                prop="mountPoint"
                                label={$t('disk.mountPoint')}
                                min-width={columnMinWidth(120, 160)}
                                v-slots={{
                                    default: ({ row }) => (
                                        <>
                                            {row.mountPoint != '' ? (
                                                <span>{row.mountPoint}</span>
                                            ) : (
                                                <ElTag size="small" type="warning">
                                                    {$t('disk.unmounted')}
                                                </ElTag>
                                            )}
                                        </>
                                    ),
                                }}
                            />
                            <ElTableColumn
                                prop="filesystem"
                                label={$t('disk.filesystem')}
                                min-width={columnMinWidth(80, 100)}
                                v-slots={{
                                    default: ({ row }) => (
                                        <>
                                            {row.filesystem != '' ? (
                                                <ElTag size="small" type="info">
                                                    {row.filesystem}
                                                </ElTag>
                                            ) : null}
                                        </>
                                    ),
                                }}
                            />
                            <ElTableColumn
                                label={$t('commons.table.operate')}
                                width="150"
                                v-slots={{
                                    default: ({ row }) => (
                                        <>
                                            {__panelSetupProps.scope === 'system' ? (
                                                <ElText type="info">{$t('disk.cannotOperate')}</ElText>
                                            ) : row.mountPoint != '' ? (
                                                withDirectives(
                                                    <ElButton
                                                        type="primary"
                                                        link
                                                        onClick={($event?: any) => {
                                                            unmount(row);
                                                        }}
                                                    >
                                                        {$t('disk.unmount')}
                                                    </ElButton>,
                                                    [
                                                        [permissionDirective, true],
                                                        [nodeAdminDirective, true],
                                                    ],
                                                )
                                            ) : (
                                                withDirectives(
                                                    <ElButton
                                                        type="primary"
                                                        link
                                                        onClick={($event?: any) => {
                                                            mount(row);
                                                        }}
                                                    >
                                                        {$t('disk.mount')}
                                                    </ElButton>,
                                                    [
                                                        [permissionDirective, true],
                                                        [nodeAdminDirective, true],
                                                    ],
                                                )
                                            )}
                                        </>
                                    ),
                                }}
                            />
                        </ElTable>
                        {__panelSetupProps.scope === 'system' ? <ElText>{$t('disk.systemDiskHelper')}</ElText> : null}
                    </div>
                ) : null}
                {__panelSetupProps.diskInfo.partitions == undefined && __panelSetupProps.diskInfo.mountPoint != '' ? (
                    <div>
                        <ElTable
                            data={[__panelSetupProps.diskInfo]}
                            scrollbar-always-on={unref(isMobile)}
                            class={'w-full'}
                        >
                            <ElTableColumn
                                prop="device"
                                label={$t('disk.partition') + $t('commons.table.name')}
                                min-width={columnMinWidth(100, 120)}
                                v-slots={{
                                    default: ({ row }) => (
                                        <>
                                            <span class={'font-medium'}>{row.device.split('/').pop()}</span>
                                        </>
                                    ),
                                }}
                            />
                            <ElTableColumn
                                prop="size"
                                label={$t('container.size')}
                                min-width={columnMinWidth(40, 80)}
                            />
                            <ElTableColumn prop="used" label={$t('home.used')} min-width={columnMinWidth(40, 80)} />
                            <ElTableColumn
                                prop="avail"
                                label={$t('home.available')}
                                min-width={columnMinWidth(40, 80)}
                            />
                            <ElTableColumn
                                prop="usePercent"
                                label={$t('home.percent')}
                                min-width={columnMinWidth(60, 120)}
                                v-slots={{
                                    default: ({ row }) => (
                                        <>
                                            <ElProgress
                                                percentage={row.usePercent}
                                                status={row.usePercent >= 90 ? 'exception' : 'success'}
                                                text-inside={true}
                                                stroke-width={14}
                                            />
                                        </>
                                    ),
                                }}
                            />
                            <ElTableColumn
                                prop="mountPoint"
                                label={$t('disk.mountPoint')}
                                min-width={columnMinWidth(120, 160)}
                                v-slots={{
                                    default: ({ row }) => (
                                        <>
                                            {row.mountPoint != '' ? (
                                                <span>{row.mountPoint}</span>
                                            ) : (
                                                <ElTag size="small" type="warning">
                                                    {$t('disk.unmounted')}
                                                </ElTag>
                                            )}
                                        </>
                                    ),
                                }}
                            />
                            <ElTableColumn
                                prop="filesystem"
                                label={$t('disk.filesystem')}
                                min-width={columnMinWidth(80, 100)}
                                v-slots={{
                                    default: ({ row }) => (
                                        <>
                                            {row.filesystem != '' ? (
                                                <ElTag size="small" type="info">
                                                    {row.filesystem}
                                                </ElTag>
                                            ) : null}
                                        </>
                                    ),
                                }}
                            />
                            <ElTableColumn
                                label={$t('commons.table.operate')}
                                width="150"
                                v-slots={{
                                    default: ({ row }) => (
                                        <>
                                            {__panelSetupProps.scope === 'system' ? (
                                                <ElText type="info">{$t('disk.cannotOperate')}</ElText>
                                            ) : row.mountPoint != '' ? (
                                                withDirectives(
                                                    <ElButton
                                                        type="primary"
                                                        link
                                                        onClick={($event?: any) => {
                                                            unmount(row);
                                                        }}
                                                    >
                                                        {$t('disk.unmount')}
                                                    </ElButton>,
                                                    [
                                                        [permissionDirective, true],
                                                        [nodeAdminDirective, true],
                                                    ],
                                                )
                                            ) : (
                                                withDirectives(
                                                    <ElButton
                                                        type="primary"
                                                        link
                                                        onClick={($event?: any) => {
                                                            mount(row);
                                                        }}
                                                    >
                                                        {$t('disk.mount')}
                                                    </ElButton>,
                                                    [
                                                        [permissionDirective, true],
                                                        [nodeAdminDirective, true],
                                                    ],
                                                )
                                            )}
                                        </>
                                    ),
                                }}
                            />
                        </ElTable>
                    </div>
                ) : null}
            </ElCard>
        );
    },
    options,
);
