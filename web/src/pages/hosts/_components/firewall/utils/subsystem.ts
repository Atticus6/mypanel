export type FirewallSubsystem = '' | 'system' | 'forward' | 'docker';

/**
 * 把页面标签名映射成 BaseInfo 接口接受的子系统名。
 *
 * 规则页的历史标签名是 base，接口侧对应 system；其他标签按原名透传。
 */
export const toFirewallSubsystem = (tab?: string): FirewallSubsystem => {
    const name = tab === 'base' ? 'system' : (tab ?? '');
    return name === 'system' || name === 'forward' || name === 'docker' ? name : '';
};
