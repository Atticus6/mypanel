import { describe, expect, test } from 'bun:test';
import { isPunycoded } from './misc';

describe('isPunycoded', () => {
    test('识别 punycode 域名', () => {
        expect(isPunycoded('xn--fiqs8s')).toBe(true);
    });

    test('普通域名返回 false', () => {
        expect(isPunycoded('example.com')).toBe(false);
    });

    test('表格测量行的空 row 不会抛错', () => {
        expect(isPunycoded(undefined)).toBe(false);
        expect(isPunycoded('')).toBe(false);
    });
});
