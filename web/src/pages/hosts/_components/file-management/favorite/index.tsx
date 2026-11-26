import { $t } from '@/utils/i18n-t';
import { TABLE_TOOLTIP_OPTIONS } from '@/components/table/shared';
import { readCachedPageSize } from '@/utils/panel-cache';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import { File } from '@/types/file';
import DrawerPro from '@/components/drawer-pro/index';
import ComplexTable from '@/components/table/complex/ComplexTable';
import SvgIcon from '@/components/svg-icon/svg-icon';
import FuTableOperations from '@/components/table/TableOperations';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
    jump: (...args: unknown[]) => true,
    'to-favorite': (...args: unknown[]) => true,
};

const options = {
    name: 'favorite',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const paginationConfig = reactive({
            cacheSizeKey: 'favorite-page-size',
            currentPage: 1,
            pageSize: readCachedPageSize('favorite-page-size') || 20,
            total: 0,
        });
        const req = reactive({
            page: 1,
            pageSize: 20,
        });
        const open = ref(false);
        const data = ref([]);
        const handleClose = () => {
            open.value = false;
            ctx.emit('close', false);
        };
        const toFavorite = (row: File.Favorite) => {
            open.value = false;
            ctx.emit('to-favorite', row);
        };
        const openDir = (url: string) => {
            open.value = false;
            ctx.emit('jump', url);
        };
        const acceptParams = () => {
            search();
        };
        const search = async () => {
            try {
                req.page = paginationConfig.currentPage;
                req.pageSize = paginationConfig.pageSize;
                const res = await rpc.file.searchFavorites({ page: req.page, pageSize: req.pageSize });
                data.value = res.items;
                paginationConfig.total = Number(res.total);
                open.value = true;
            } catch (error) {}
        };
        const singleDel = async (id: number) => {
            ElMessageBox.confirm(i18n.global.t('file.removeFavorite'), i18n.global.t('commons.msg.remove'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
            }).then(async () => {
                try {
                    await rpc.file.deleteFavorite({ id });
                    await search();
                } catch (error) {}
            });
        };
        const buttons = [
            {
                label: i18n.global.t('commons.button.open'),
                click: (row: any) => {
                    openDir(row.path);
                },
            },
            {
                label: i18n.global.t('commons.button.delete'),
                permission: true,
                nodeAdmin: true,
                click: (row: any) => {
                    singleDel(row.id);
                },
            },
        ];
        ctx.expose({ acceptParams });
        return () => (
            <DrawerPro
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
                header={$t('file.favorite')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="large"
                v-slots={{
                    content: () => (
                        <>
                            <ComplexTable
                                pagination-config={paginationConfig}
                                data={unref(data)}
                                onSearch={($event?: any) => {
                                    (search as any)($event);
                                }}
                            >
                                <ElTableColumn
                                    label={$t('file.path')}
                                    show-overflow-tooltip
                                    prop="path"
                                    v-slots={{
                                        default: ({ row }) => (
                                            <>
                                                <ElTooltip
                                                    effect="dark"
                                                    content={row.path}
                                                    {...TABLE_TOOLTIP_OPTIONS}
                                                    class={'box-item'}
                                                >
                                                    <span
                                                        onClick={($event?: any) => {
                                                            toFavorite(row);
                                                        }}
                                                        type="primary"
                                                        class={'table-link text-ellipsis'}
                                                    >
                                                        {row.isDir ? (
                                                            <SvgIcon className="table-icon" iconName="p-file-folder" />
                                                        ) : (
                                                            <SvgIcon className="table-icon" iconName="p-file-normal" />
                                                        )}
                                                        {row.name}
                                                    </span>
                                                </ElTooltip>
                                            </>
                                        ),
                                    }}
                                />
                                <FuTableOperations buttons={buttons} label={$t('commons.table.operate')} fix />
                            </ComplexTable>
                        </>
                    ),
                }}
            />
        );
    },
    options,
);
