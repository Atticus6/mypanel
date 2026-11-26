import { $t } from '@/utils/i18n-t';
import { TABLE_TOOLTIP_OPTIONS } from '@/components/table/shared';
import { readCachedPageSize } from '@/utils/panel-cache';
import { rpc } from '@/lib/rpc';
import { File } from '@/types/file';
import i18n from '@/lang';
import { dateFormat as formatDateTime } from '@/utils/date';
import { computed, reactive, ref } from 'vue';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElTableColumn } from 'element-plus';
import { ElTooltip } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';
import ComplexTable from '@/components/table/complex/ComplexTable';
import SvgIcon from '@/components/svg-icon/svg-icon';
import FuTableOperations from '@/components/table/TableOperations';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
    detail: (...args: unknown[]) => true,
};

const options = {
    name: 'share-list',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const paginationConfig = reactive({
            cacheSizeKey: 'share-page-size',
            currentPage: 1,
            pageSize: readCachedPageSize('share-page-size') || 20,
            total: 0,
        });
        const req = reactive({
            page: 1,
            pageSize: 20,
        });
        const open = ref(false);
        const data = ref<File.FileShareInfo[]>([]);
        const permanentText = computed(() => String(i18n.global.t('website.ever')));
        const handleClose = () => {
            open.value = false;
            ctx.emit('close', false);
        };
        const formatExpire = (row: File.FileShareInfo) => {
            if (row.permanent || row.expiresAt === 0) {
                return permanentText.value;
            }
            return formatDateTime(null, null, row.expiresAt * 1000);
        };
        const acceptParams = async () => {
            await search();
        };
        const search = async () => {
            req.page = paginationConfig.currentPage;
            req.pageSize = paginationConfig.pageSize;
            const res = await rpc.file.searchShares(req);
            // proto 的 expiresAt 是 int64（bigint），展示层按毫秒数处理，此处统一转成 number。
            data.value = res.items.map((item) => ({
                code: item.code,
                path: item.path,
                fileName: item.fileName,
                expiresAt: Number(item.expiresAt),
                permanent: item.permanent,
                hasPassword: item.hasPassword,
                password: item.password,
            }));
            paginationConfig.total = Number(res.total);
            open.value = true;
        };
        const closeShare = async (path: string) => {
            await rpc.file.deleteShare({ path });
            ctx.emit('close', true);
            await search();
        };
        const viewDetail = (row: File.FileShareInfo) => {
            ctx.emit('detail', row.path);
        };
        const buttons = [
            {
                label: i18n.global.t('file.shareDetail'),
                click: (row: File.FileShareInfo) => {
                    viewDetail(row);
                },
            },
            {
                label: i18n.global.t('file.shareClose'),
                permission: true,
                nodeAdmin: true,
                click: (row: File.FileShareInfo) => {
                    closeShare(row.path);
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
                header={$t('file.shareList')}
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
                                    min-width="250"
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
                                                            viewDetail(row);
                                                        }}
                                                        type="primary"
                                                        class={'table-link text-ellipsis'}
                                                    >
                                                        <SvgIcon className="table-icon" iconName="p-file-normal" />
                                                        {row.fileName}
                                                    </span>
                                                </ElTooltip>
                                            </>
                                        ),
                                    }}
                                />
                                <ElTableColumn
                                    label={$t('file.shareExpiresAt')}
                                    min-width="140"
                                    v-slots={{ default: ({ row }) => <>{formatExpire(row)}</> }}
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
