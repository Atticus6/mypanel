import { describe, expect, test } from 'bun:test';
import { toFirewallSubsystem } from './subsystem';

describe('toFirewallSubsystem', () => {
    test('规则页的 base 映射到 system', () => {
        expect(toFirewallSubsystem('base')).toBe('system');
    });

    test('其他合法标签原样透传', () => {
        expect(toFirewallSubsystem('forward')).toBe('forward');
        expect(toFirewallSubsystem('docker')).toBe('docker');
    });

    test('空值与未知标签返回空字符串', () => {
        expect(toFirewallSubsystem()).toBe('');
        expect(toFirewallSubsystem('unknown')).toBe('');
    });
});
