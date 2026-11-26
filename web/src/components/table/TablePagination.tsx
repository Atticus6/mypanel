import { type PropType } from 'vue';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElPagination } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
    currentPage?: number;
    pageSize?: number;
    pageSizes?: number[];
    total?: number;
}

const emits = {
    'update:pageSize': (...args: unknown[]) => true,
    'update:currentPage': (...args: unknown[]) => true,
    'size-change': (...args: unknown[]) => true,
    'current-change': (...args: unknown[]) => true,
    change: (...args: unknown[]) => true,
};

const options = {
    name: 'FuTablePagination',
    props: {
        currentPage: {
            type: Number,
            default: 1,
        },
        pageSize: {
            type: Number,
            default: 10,
        },
        pageSizes: {
            type: Array as PropType<number[]>,
            default: () => [10, 20, 50, 100],
        },
        total: {
            type: Number,
            default: 0,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const handleSizeChange = (pageSize: number) => {
            ctx.emit('update:pageSize', pageSize);
            ctx.emit('size-change', pageSize);
            ctx.emit('change', { currentPage: __panelSetupProps.currentPage, pageSize });
        };
        const handleCurrentChange = (currentPage: number) => {
            ctx.emit('update:currentPage', currentPage);
            ctx.emit('current-change', currentPage);
            ctx.emit('change', { currentPage, pageSize: __panelSetupProps.pageSize });
        };
        return () => (
            <ElPagination
                {...ctx.attrs}
                current-page={__panelSetupProps.currentPage}
                page-size={__panelSetupProps.pageSize}
                page-sizes={__panelSetupProps.pageSizes}
                total={__panelSetupProps.total}
                onSizeChange={($event?: any) => {
                    (handleSizeChange as any)($event);
                }}
                onCurrentChange={($event?: any) => {
                    (handleCurrentChange as any)($event);
                }}
                class={'fu-table-pagination'}
            />
        );
    },
    options,
);
