import type { Firewall } from '@/types/firewall';

/**
 * 判断规则是否允许删除。
 *
 * Element Plus 表格在测量列宽时会用空对象调用操作列的 show，
 * 此时没有 observed；缺少 observed 的规则也无法拿到删除所需的实例信息。
 */
export const isDeletableRule = (row?: Partial<Firewall.InventoryItem> | null): boolean =>
    Boolean(row?.observed) && !row.observed?.protected;

/** 白名单规则没有 observed 时同样不能编辑，避免表格测量行触发空值访问。 */
export const canEditDescription = (row?: Partial<Firewall.InventoryItem> | null): boolean =>
    Boolean(row?.observed) &&
    (Boolean(row.isWhitelist) || !row.observed?.protected) &&
    Boolean(row.observed?.instanceKey);
