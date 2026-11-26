import { describe, expect, test } from 'bun:test';
import { canEditDescription, isDeletableRule } from './rule';

describe('isDeletableRule', () => {
    test('普通规则可删除', () => {
        expect(isDeletableRule({ observed: { protected: false } })).toBe(true);
    });

    test('受保护规则不可删除', () => {
        expect(isDeletableRule({ observed: { protected: true } })).toBe(false);
    });

    test('表格测量行的空 row 与无 observed 的规则都不可删除', () => {
        expect(isDeletableRule(undefined)).toBe(false);
        expect(isDeletableRule(null)).toBe(false);
        expect(isDeletableRule({})).toBe(false);
    });
});

describe('canEditDescription', () => {
    test('有实例信息的普通规则可编辑', () => {
        expect(canEditDescription({ observed: { protected: false, instanceKey: 'k' } })).toBe(true);
    });

    test('受保护规则不可编辑，白名单规则不受保护标记限制', () => {
        expect(canEditDescription({ observed: { protected: true, instanceKey: 'k' } })).toBe(false);
        expect(canEditDescription({ isWhitelist: true, observed: { protected: true, instanceKey: 'k' } })).toBe(true);
    });

    test('表格测量行不可编辑', () => {
        expect(canEditDescription(undefined)).toBe(false);
        expect(canEditDescription({})).toBe(false);
    });
});
