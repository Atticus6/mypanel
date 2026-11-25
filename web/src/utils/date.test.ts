import { describe, expect, test } from 'bun:test';
import { dateFormatSimple, isNeverExpire } from './date';

describe('isNeverExpire', () => {
    test('Go 零时间视为永不过期', () => {
        expect(isNeverExpire('0001-01-01T00:00:00Z')).toBe(true);
    });

    test('空值与缺失值视为永不过期', () => {
        expect(isNeverExpire('')).toBe(true);
        expect(isNeverExpire(null)).toBe(true);
        expect(isNeverExpire(undefined)).toBe(true);
    });

    test('非法日期视为永不过期', () => {
        expect(isNeverExpire('not-a-date')).toBe(true);
    });

    test('9999 年之后的哨兵时间视为永不过期', () => {
        expect(isNeverExpire('9999-12-31T00:00:00Z')).toBe(true);
    });

    test('正常到期时间不是永不过期', () => {
        expect(isNeverExpire('2026-12-31T00:00:00Z')).toBe(false);
    });
});

describe('dateFormatSimple', () => {
    test('正常时间按年月日格式化', () => {
        expect(dateFormatSimple('2026-11-25T00:00:00Z')).toBe('2026-11-25');
    });

    test('零时间与非法日期返回空串，避免出现 NaN', () => {
        expect(dateFormatSimple('0001-01-01T00:00:00Z')).toBe('');
        expect(dateFormatSimple('')).toBe('');
        expect(dateFormatSimple('bad')).toBe('');
    });
});
