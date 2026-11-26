import { h } from 'vue';
import { panelCacheKey, writePanelCache } from '@/utils/panel-cache';
import { computed, onDeactivated, onMounted, ref, useAttrs } from 'vue';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { flattenVNodes, TABLE_OVERFLOW_TOOLTIP_OPTIONS, type FuTableOperationButton } from '@/components/table/shared';
import { useCardColumns } from './useCardColumns';
import { useContextMenu } from './useContextMenu';
import { useResponsivePagination } from './useResponsivePagination';
import { useTableSelection } from './useTableSelection';
import { useRoute } from 'vue-router';
import { usePaginationCache } from './usePaginationCache';
type DropdownProps = FuTableOperationButton;
type ViewMode = 'table' | 'card';
import './ComplexTable.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { cn } from '@/utils/cn';
import { ElCard } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElEmpty } from 'element-plus';
import { ElPagination } from 'element-plus';
import FuTable from '@/components/table/Table';

interface CodemodProps {
    [key: string]: any;
    header?: string;
    data?: any[];
    loading?: boolean;
    selectionContext?: string | number | unknown[] | Record<string, any> | ((...args: any[]) => any);
    paginationConfig?: Record<string, any>;
    cachePagination?: boolean;
    refreshOnRestore?: boolean;
    cacheId?: string;
    pageSizes?: number[];
    heightDiff?: number;
    height?: number;
    rightButtons?: FuTableOperationButton[];
    viewMode?: ViewMode;
    syncCardContentHeight?: boolean;
}

const emits = {
    search: (...args: unknown[]) => true,
    'update:selects': (...args: unknown[]) => true,
    'update:paginationConfig': (...args: unknown[]) => true,
    'update:viewMode': (...args: unknown[]) => true,
};

type SlotsShape = {
    header: (arg?: unknown) => VNode[];
    toolbar: (arg?: unknown) => VNode[];
    default: (arg?: unknown) => VNode[];
    empty: (arg?: unknown) => VNode[];
    footerLeft: (arg?: unknown) => VNode[];
    paginationLeft: (arg?: unknown) => VNode[];
    pagination: (arg?: unknown) => VNode[];
};

const options = {
    name: 'ComplexTable',
    props: {
        header: { type: String },
        data: { type: Array as PropType<any[]>, default: () => [] },
        loading: { type: Boolean, default: false },
        selectionContext: { type: [String, Number, Array, Object, Function], default: undefined },
        paginationConfig: {
            type: Object,
            required: false,
        },
        cachePagination: { type: Boolean, default: undefined },
        refreshOnRestore: { type: Boolean, default: true },
        cacheId: { type: String },
        pageSizes: {
            type: Array as PropType<number[]>,
            default: () => [5, 10, 20, 50, 100, 200, 500],
        },
        heightDiff: {
            type: Number,
            default: 320,
        },
        height: {
            type: Number,
            default: 0,
        },
        rightButtons: {
            type: Array as PropType<FuTableOperationButton[]>,
        },
        viewMode: {
            type: String as PropType<ViewMode>,
            default: undefined,
        },
        syncCardContentHeight: {
            type: Boolean,
            default: true,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
    __scopeId: 'data-v-323fa9db',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        const slots = useSlots();
        const attrs = useAttrs();
        const { isMobile, openMenuTabs, currentNode } = useGlobalStore();
        usePaginationCache({
            pagePath: useRoute().path,
            pagination: () =>
                __panelSetupProps.paginationConfig as { currentPage: number; pageSize: number; cacheSizeKey?: string },
            enabled: () => __panelSetupProps.cachePagination,
            id: () => __panelSetupProps.cacheId,
            scope: () => __panelSetupProps.cacheScope,
            search: () => ctx.emit('search'),
            pageSizes: () => __panelSetupProps.pageSizes,
            refreshOnRestore: () => __panelSetupProps.refreshOnRestore,
        });
        const tableRef = ref();
        const complexTableRef = ref<HTMLElement>();
        const tableHeight = ref<number | string>('');
        const menuRef = ref<HTMLElement | null>(null);
        const leftSelect = ref(false);
        const cardContentMinHeight = ref(0);
        let cardContentHeightFrame: number | undefined;
        const currentViewMode = ref<ViewMode>(__panelSetupProps.viewMode || 'table');
        watch(
            () => __panelSetupProps.viewMode,
            (mode) => {
                if (mode && mode !== currentViewMode.value) {
                    currentViewMode.value = mode;
                }
            },
        );
        const columnNodes = computed(() => flattenVNodes(slots.default?.() || []));
        const { CardColumnValue, cardColumns, getColumnKey, getColumnLabel } = useCardColumns(
            () => columnNodes.value,
            () => attrs.columns,
        );
        const selectionColumn = computed(() =>
            columnNodes.value.find((column) => (column.props as Record<string, any> | null)?.type === 'selection'),
        );
        const tableData = computed(() => {
            const data = __panelSetupProps.data;
            return Array.isArray(data) ? data : [];
        });
        const cardContentStyle = computed(() => {
            if (!__panelSetupProps.syncCardContentHeight || !cardContentMinHeight.value) {
                return undefined;
            }
            return { minHeight: `${cardContentMinHeight.value}px` };
        });
        const syncCardContentHeight = async () => {
            cardContentMinHeight.value = 0;
            await nextTick();
            if (!__panelSetupProps.syncCardContentHeight || currentViewMode.value !== 'card') {
                return;
            }
            const contentElements =
                complexTableRef.value?.querySelectorAll<HTMLElement>('.complex-table__card-content');
            if (!contentElements?.length) {
                return;
            }
            cardContentMinHeight.value = Math.max(...Array.from(contentElements, (element) => element.offsetHeight));
        };
        const scheduleCardContentHeightSync = () => {
            if (cardContentHeightFrame !== undefined) {
                cancelAnimationFrame(cardContentHeightFrame);
            }
            cardContentHeightFrame = requestAnimationFrame(() => {
                cardContentHeightFrame = undefined;
                void syncCardContentHeight();
            });
        };
        const resolvedTooltipOptions = computed(() => ({
            ...TABLE_OVERFLOW_TOOLTIP_OPTIONS,
            ...((attrs.tooltipOptions ?? attrs['tooltip-options']) as Record<string, unknown> | undefined),
        }));
        const getRowKey = (row: any, index: number) => {
            const rowKey = attrs.rowKey ?? attrs['row-key'];
            if (typeof rowKey === 'function') {
                return rowKey(row) ?? index;
            }
            if (typeof rowKey === 'string') {
                const value = rowKey.split('.').reduce((current, key) => current?.[key], row);
                if (value !== undefined && value !== null) {
                    return value;
                }
            }
            return row?.id ?? row?.name ?? index;
        };
        const {
            contextMenu: rightClick,
            open: openContextMenu,
            close: closeRightClick,
            visibleButtons: visibleRightButtons,
            isDisabled: isRightButtonDisabled,
            click: rightButtonClick,
        } = useContextMenu(() => __panelSetupProps.rightButtons);
        const getTableData = () => __panelSetupProps.data || [];
        const isRowSelectable = (row: any) => {
            const selectable = (selectionColumn.value?.props as Record<string, any> | null)?.selectable;
            return typeof selectable === 'function' ? selectable(row) : true;
        };
        const {
            selectedRows,
            isRowSelected,
            clearSelects,
            toggleSelection,
            selectRow,
            syncTableSelection,
            handleSelect,
            handleSelectionChange: syncSelectionChange,
            handleRowClick,
            handleKeyDown: handleSelectionKeyDown,
            handleKeyUp,
        } = useTableSelection(
            tableRef,
            getTableData,
            (rows) => ctx.emit('update:selects', rows),
            isRowSelectable,
            (row) => {
                const key = attrs.rowKey ?? attrs['row-key'];
                if (typeof key === 'function') return row == null ? undefined : key(row);
                if (typeof key === 'string') return key.split('.').reduce((value, part) => value?.[part], row);
                return row?.id;
            },
        );
        const toggleCardSelection = (row: any, selected: boolean) => {
            selectRow(row, selected);
        };
        const handleRightClick = (row, column, event) => {
            if (!__panelSetupProps.rightButtons?.length) {
                return;
            }
            if (isRowSelectable(row) && !isRowSelected(row)) {
                clearSelects();
                selectRow(row, true);
            }
            openContextMenu(row, event);
        };
        watch(
            () => [__panelSetupProps.data, __panelSetupProps.loading],
            () => {
                const pagination = __panelSetupProps.paginationConfig;
                if (__panelSetupProps.loading || !pagination || !pagination.pageSize) return;
                const lastPage = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
                if (pagination.currentPage > lastPage) {
                    pagination.currentPage = lastPage;
                    ctx.emit('search');
                }
            },
            { flush: 'post' },
        );
        function currentChange() {
            ctx.emit('search');
        }
        function sizeChange() {
            if (__panelSetupProps.cachePagination === false && __panelSetupProps.paginationConfig.cacheSizeKey) {
                writePanelCache(
                    'pagination',
                    panelCacheKey(`size:${__panelSetupProps.paginationConfig.cacheSizeKey}`),
                    __panelSetupProps.paginationConfig.pageSize,
                );
            }
            __panelSetupProps.paginationConfig.currentPage = 1;
            ctx.emit('search');
        }
        function handleSelectionChange(rows: any[]) {
            syncSelectionChange(rows);
        }
        watch(selectedRows, (rows) => {
            leftSelect.value = rows.length > 0;
        });
        watch(
            tableRef,
            async (table) => {
                if (!table || currentViewMode.value !== 'table') {
                    return;
                }
                await nextTick();
                syncTableSelection();
            },
            { flush: 'post' },
        );
        function sort(prop: string, order: string) {
            tableRef.value?.refElTable?.sort(prop, order);
        }
        function clearSort() {
            tableRef.value?.refElTable?.clearSort();
        }
        const { paginationRef, responsivePaginationLayout, responsivePagerCount } = useResponsivePagination(
            () => __panelSetupProps.paginationConfig,
            isMobile,
        );
        const adjustedX = ref(rightClick.value.left);
        const adjustedY = ref(rightClick.value.top);
        watch(
            () => [rightClick.value.left, rightClick.value.top],
            async () => {
                await nextTick();
                if (!menuRef.value) return;

                const menuRect = menuRef.value.getBoundingClientRect();
                const windowWidth = window.innerWidth;
                const windowHeight = window.innerHeight;

                if (rightClick.value.left + menuRect.width > windowWidth) {
                    adjustedX.value = windowWidth - menuRect.width - 4;
                } else {
                    adjustedX.value = rightClick.value.left;
                }

                if (rightClick.value.top + menuRect.height > windowHeight) {
                    adjustedY.value = windowHeight - menuRect.height - 4;
                } else {
                    adjustedY.value = rightClick.value.top;
                }
            },
            { immediate: true },
        );
        function calcHeight() {
            let heightDiff = __panelSetupProps.heightDiff ?? 320;
            let tabHeight = openMenuTabs.value ? 48 : 0;

            if (__panelSetupProps.height) {
                tableHeight.value = __panelSetupProps.height - tabHeight;
            } else {
                tableHeight.value = window.innerHeight - heightDiff - tabHeight;
            }
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            handleSelectionKeyDown(event);
            if (event.key === 'Escape') {
                closeRightClick();
            }
        };
        onMounted(() => {
            if (currentViewMode.value !== __panelSetupProps.viewMode) {
                ctx.emit('update:viewMode', currentViewMode.value);
            }
            scheduleCardContentHeightSync();
            calcHeight();
            window.addEventListener('resize', calcHeight);
            window.addEventListener('resize', scheduleCardContentHeightSync);
            window.addEventListener('keydown', handleKeyDown);
            window.addEventListener('keyup', handleKeyUp);
            watch(
                () => [__panelSetupProps.height, __panelSetupProps.heightDiff],
                () => {
                    calcHeight();
                },
            );
        });
        watch(
            [currentViewMode, tableData, () => __panelSetupProps.syncCardContentHeight],
            scheduleCardContentHeightSync,
            {
                flush: 'post',
            },
        );
        onDeactivated(clearSelects);
        watch(
            [() => __panelSetupProps.paginationConfig?.currentPage, () => __panelSetupProps.paginationConfig?.pageSize],
            clearSelects,
            {
                flush: 'sync',
            },
        );
        watch(
            [
                currentNode,
                () =>
                    JSON.stringify(
                        typeof __panelSetupProps.selectionContext === 'function'
                            ? __panelSetupProps.selectionContext()
                            : __panelSetupProps.selectionContext,
                    ),
            ],
            () => {
                clearSelects();
                if (__panelSetupProps.paginationConfig) {
                    __panelSetupProps.paginationConfig.currentPage = 1;
                }
            },
            { flush: 'sync' },
        );
        onBeforeUnmount(() => {
            window.removeEventListener('resize', calcHeight);
            window.removeEventListener('resize', scheduleCardContentHeightSync);
            if (cardContentHeightFrame !== undefined) {
                cancelAnimationFrame(cardContentHeightFrame);
            }
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        });
        ctx.expose({
            clearSelects,
            sort,
            clearSort,
            closeRightClick,
        });
        return () => (
            <div class={'complex-table'}>
                {unref(slots).header || __panelSetupProps.header ? (
                    <div class={'complex-table__header'}>
                        {ctx.slots['header']?.(undefined) ?? <>{__panelSetupProps.header}</>}
                    </div>
                ) : null}
                {unref(slots).toolbar ? <div>{ctx.slots['toolbar']?.(undefined)}</div> : null}
                <div ref={complexTableRef} class={'complex-table__body'}>
                    {unref(currentViewMode) === 'table' ? (
                        <FuTable
                            {...ctx.attrs}
                            data={__panelSetupProps.data}
                            ref={tableRef}
                            onSelect={($event?: any) => {
                                unref(handleSelect);
                            }}
                            onSelectionChange={($event?: any) => {
                                (handleSelectionChange as any)($event);
                            }}
                            max-height={unref(tableHeight)}
                            onRowContextmenu={($event?: any) => {
                                (handleRightClick as any)($event);
                            }}
                            onRowClick={($event?: any) => {
                                unref(handleRowClick);
                            }}
                            tooltip-options={unref(resolvedTooltipOptions)}
                            v-slots={{ ...(ctx.slots['empty'] ? { empty: () => ctx.slots['empty']?.(undefined) } : {}) }}
                        >
                            {ctx.slots['default']?.(undefined)}
                        </FuTable>
                    ) : null}
                    {unref(currentViewMode) === 'card' ? (
                        <>
                            {unref(tableData).length ? (
                                <div class={'complex-table__card-grid'}>
                                    {(unref(tableData) || []).map((cardRow, cardIndex) => (
                                        <ElCard
                                            onClick={($event?: any) => {
                                                unref(handleRowClick)(cardRow, undefined, $event);
                                            }}
                                            onContextmenu={($event?: any) => {
                                                handleRightClick(cardRow, undefined, $event);
                                            }}
                                            class={'complex-table__card'}
                                            key={getRowKey(cardRow, cardIndex)}
                                        >
                                            {unref(selectionColumn) ||
                                            unref(cardColumns).name.length ||
                                            unref(cardColumns).status.length ? (
                                                <div class={'complex-table__card-header'}>
                                                    {unref(selectionColumn) ? (
                                                        <ElCheckbox
                                                            model-value={unref(isRowSelected)(cardRow)}
                                                            disabled={!isRowSelectable(cardRow)}
                                                            onChange={($event?: any) => {
                                                                toggleCardSelection(cardRow, $event);
                                                            }}
                                                            onClick={($event?: any) => {
                                                                $event.stopPropagation();
                                                            }}
                                                            class={'complex-table__card-selection'}
                                                        />
                                                    ) : null}
                                                    <div class={'complex-table__card-name'}>
                                                        {(unref(cardColumns).name || []).map((nameColumn) => (
                                                            h(CardColumnValue, { column: nameColumn, row: cardRow, index: cardIndex, key: unref(getColumnKey)(nameColumn) })
                                                        ))}
                                                    </div>
                                                    <div class={'complex-table__card-status'}>
                                                        {(unref(cardColumns).status || []).map((statusColumn) => (
                                                            h(CardColumnValue, { column: statusColumn, row: cardRow, index: cardIndex, key: unref(getColumnKey)(statusColumn) })
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : null}
                                            {unref(cardColumns).content.length ? (
                                                <div
                                                    class={'complex-table__card-content'}
                                                    style={unref(cardContentStyle)}
                                                >
                                                    {(unref(cardColumns).content || []).map((contentColumn) => (
                                                        <div
                                                            class={'complex-table__card-item'}
                                                            key={unref(getColumnKey)(contentColumn)}
                                                        >
                                                            <span class={'complex-table__card-label'}>
                                                                {unref(getColumnLabel)(contentColumn)}
                                                            </span>
                                                            <strong class={'complex-table__card-value'}>
                                                                {h(CardColumnValue, { column: contentColumn, row: cardRow, index: cardIndex })}
                                                            </strong>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null}
                                            {unref(cardColumns)['content-full'].length ? (
                                                <div class={'complex-table__card-full-content'}>
                                                    {(unref(cardColumns)['content-full'] || []).map(
                                                        (fullContentColumn) => (
                                                            <div
                                                                class={'complex-table__card-full-content-item'}
                                                                key={unref(getColumnKey)(fullContentColumn)}
                                                            >
                                                                <span class={'complex-table__card-label'}>
                                                                    {unref(getColumnLabel)(fullContentColumn)}
                                                                </span>
                                                                <div class={'complex-table__card-full-content-value'}>
                                                                    {h(CardColumnValue, { column: fullContentColumn, row: cardRow, index: cardIndex })}
                                                                </div>
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            ) : null}
                                            {unref(cardColumns).description.length ? (
                                                <div class={'complex-table__card-description'}>
                                                    {(unref(cardColumns).description || []).map((descriptionColumn) => (
                                                        <div
                                                            class={'complex-table__card-description-item'}
                                                            key={unref(getColumnKey)(descriptionColumn)}
                                                        >
                                                            <span>{unref(getColumnLabel)(descriptionColumn)}</span>
                                                            <strong>
                                                                {h(CardColumnValue, { column: descriptionColumn, row: cardRow, index: cardIndex })}
                                                            </strong>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null}
                                            {unref(cardColumns).button.length ? (
                                                <div class={'complex-table__card-buttons'}>
                                                    {(unref(cardColumns).button || []).map((buttonColumn) => (
                                                        h(CardColumnValue, { column: buttonColumn, row: cardRow, index: cardIndex, key: unref(getColumnKey)(buttonColumn) })
                                                    ))}
                                                </div>
                                            ) : null}
                                        </ElCard>
                                    ))}
                                </div>
                            ) : (
                                (ctx.slots['empty']?.(undefined) ?? (
                                    <>
                                        <ElEmpty />
                                    </>
                                ))
                            )}
                        </>
                    ) : null}
                </div>
                <div class={'table-footer-container'}>
                    {unref(slots).footerLeft ? (
                        <div class={'footer-left'}>{ctx.slots['footerLeft']?.({ selected: unref(leftSelect), toggleSelection })}</div>
                    ) : null}
                    {__panelSetupProps.paginationConfig ? (
                        <div
                            ref={paginationRef}
                            class={cn(
                                'complex-table__pagination flex items-center w-full sm:flex-row flex-col text-xs sm:text-sm',
                                {
                                    '!justify-between': unref(slots).paginationLeft,
                                    '!justify-end': !unref(slots).paginationLeft,
                                },
                            )}
                        >
                            {ctx.slots['paginationLeft']?.(undefined)}
                            {ctx.slots['pagination']?.(undefined) ?? (
                                <>
                                    <ElPagination
                                        current-page={__panelSetupProps.paginationConfig.currentPage}
                                        onUpdate:current-page={($v) => {
                                            __panelSetupProps.paginationConfig.currentPage = $v as any;
                                        }}
                                        page-size={__panelSetupProps.paginationConfig.pageSize}
                                        onUpdate:page-size={($v) => {
                                            __panelSetupProps.paginationConfig.pageSize = $v as any;
                                        }}
                                        total={__panelSetupProps.paginationConfig.total}
                                        page-sizes={__panelSetupProps.pageSizes}
                                        onSizeChange={($event?: any) => {
                                            (sizeChange as any)($event);
                                        }}
                                        onCurrentChange={($event?: any) => {
                                            (currentChange as any)($event);
                                        }}
                                        pager-count={unref(responsivePagerCount)}
                                        size={
                                            unref(isMobile) || __panelSetupProps.paginationConfig.small
                                                ? 'small'
                                                : 'default'
                                        }
                                        layout={unref(responsivePaginationLayout)}
                                    />
                                </>
                            )}
                        </div>
                    ) : null}
                </div>
                {unref(rightClick).visible ? (
                    <ul
                        ref={menuRef}
                        onClick={($event?: any) => {
                            $event.stopPropagation();
                        }}
                        class={'context-menu'}
                        style={{ top: `${adjustedY}px`, left: `${adjustedX}px` }}
                    >
                        {(unref(visibleRightButtons) || []).map((btn, buttonIndex) => (
                            <li
                                onClick={($event?: any) => {
                                    !unref(isRightButtonDisabled)(btn) && unref(rightButtonClick)(btn);
                                }}
                                class={[{ disabled: unref(isRightButtonDisabled)(btn) }, { divided: btn.divided }]}
                                key={buttonIndex}
                            >
                                {btn.label}
                            </li>
                        ))}
                    </ul>
                ) : null}
            </div>
        );
    },
    options,
);
