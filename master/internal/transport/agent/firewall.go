package agent

import (
	"context"

	"connectrpc.com/connect"

	agentdto "mypanel/agent/app/dto"
	agentservice "mypanel/agent/app/service"
	filter "mypanel/agent/utils/firewall/filter"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/errmap"
)

// FirewallServer 实现 panel.agent.v1.FirewallService。
type FirewallServer struct {
	service *agentservice.FirewallService
}

// NewFirewallServer 构造防火墙服务。
func NewFirewallServer() *FirewallServer {
	return &FirewallServer{service: &agentservice.FirewallService{}}
}

// BaseInfo 读取防火墙子系统状态。
func (s *FirewallServer) BaseInfo(
	_ context.Context,
	req *connect.Request[agentv1.FirewallBaseInfoRequest],
) (*connect.Response[agentv1.FirewallBaseInfo], error) {
	info, err := s.service.LoadBaseInfo(req.Msg.GetName())
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.FirewallBaseInfo{
		Ipv6Enabled:     info.IPv6Enabled,
		Name:            info.Name,
		Backend:         info.Backend,
		ConflictBackend: info.ConflictBackend,
		IsExist:         info.IsExist,
		IsActive:        info.IsActive,
		IsInit:          info.IsInit,
		IsBind:          info.IsBind,
		Version:         info.Version,
		PingStatus:      info.PingStatus,
		Message:         info.Message,
		Reason:          info.Reason,
		LifecycleTaskId: info.LifecycleTaskID,
		Ipv4:            fromFirewallFamily(info.IPv4),
		Ipv6:            fromFirewallFamily(info.IPv6),
	}), nil
}

// Inventory 分页查询防火墙规则清单。
func (s *FirewallServer) Inventory(
	ctx context.Context,
	req *connect.Request[agentv1.FirewallInventoryRequest],
) (*connect.Response[agentv1.FirewallInventory], error) {
	request := agentdto.FirewallRuleInventory{
		PageInfo: agentdto.PageInfo{
			Page:     int(req.Msg.GetPage()),
			PageSize: int(req.Msg.GetPageSize()),
		},
		All:   req.Msg.GetAll(),
		Info:  req.Msg.GetInfo(),
		Scope: fromProtoScope(req.Msg.GetScope()),
	}
	for _, scope := range req.Msg.GetScopes() {
		request.Scopes = append(request.Scopes, fromProtoScope(scope))
	}
	for _, family := range req.Msg.GetFamilies() {
		request.Families = append(request.Families, filter.Family(family))
	}
	request.Actions = req.Msg.GetActions()
	request.ExcludeChains = req.Msg.GetExcludeChains()

	result, err := s.service.Inventory(ctx, request)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}

	items := make([]*agentv1.FirewallInventoryItem, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, &agentv1.FirewallInventoryItem{
			Rule:          fromFirewallRule(item.Rule),
			Observed:      fromObservedRule(item.Observed),
			IsWhitelist:   item.IsWhitelist,
			DescriptionId: item.DescriptionID,
		})
	}
	notices := make([]*agentv1.FirewallScopeNotice, 0, len(result.Notices))
	for _, notice := range result.Notices {
		notices = append(notices, &agentv1.FirewallScopeNotice{
			Code:   string(notice.Code),
			Values: notice.Values,
		})
	}
	return connect.NewResponse(&agentv1.FirewallInventory{
		Ipv4Range: &agentv1.FirewallPositionRange{Min: int32(result.IPv4Range.Min), Max: int32(result.IPv4Range.Max)},
		Ipv6Range: &agentv1.FirewallPositionRange{Min: int32(result.IPv6Range.Min), Max: int32(result.IPv6Range.Max)},
		Total:     result.Total,
		AllTotal:  result.AllTotal,
		Items:     items,
		Notices:   notices,
	}), nil
}

// fromProtoScope 把 proto 的范围转成 filter.Scope。
func fromProtoScope(scope *agentv1.FirewallScope) filter.Scope {
	if scope == nil {
		return filter.Scope{}
	}
	return filter.Scope{
		Provider:  filter.Provider(scope.GetProvider()),
		Family:    filter.Family(scope.GetFamily()),
		Table:     scope.GetTable(),
		Zone:      scope.GetZone(),
		Chain:     scope.GetChain(),
		Direction: filter.Direction(scope.GetDirection()),
	}
}

// fromFirewallFamily 转换地址族状态。
func fromFirewallFamily(item agentdto.FirewallBackendFamilyStatus) *agentv1.FirewallFamilyStatus {
	return &agentv1.FirewallFamilyStatus{
		Partial:      item.Partial,
		Available:    item.Available,
		Initialized:  item.Initialized,
		Bound:        item.Bound,
		Reason:       item.Reason,
		RaInterfaces: item.RAInterfaces,
	}
}

// fromFirewallRule 转换规则。
func fromFirewallRule(rule filter.FirewallRule) *agentv1.FirewallRule {
	result := &agentv1.FirewallRule{
		Uuid: rule.UUID,
		Scope: &agentv1.FirewallScope{
			Provider:  string(rule.Scope.Provider),
			Family:    string(rule.Scope.Family),
			Table:     rule.Scope.Table,
			Zone:      rule.Scope.Zone,
			Chain:     rule.Scope.Chain,
			Direction: string(rule.Scope.Direction),
		},
		NativeKind:         string(rule.NativeKind),
		Protocol:           rule.Protocol,
		SourceAddress:      rule.SourceAddress,
		SourcePort:         rule.SourcePort,
		DestinationAddress: rule.DestinationAddress,
		DestinationPort:    rule.DestinationPort,
		Interface:          rule.Interface,
		ConnectionStates:   rule.ConnectionStates,
		Action:             string(rule.Action),
		OrderBucket:        rule.OrderBucket,
		Description:        rule.Description,
	}
	if rule.Priority != nil {
		result.Priority = int32(*rule.Priority)
		result.HasPriority = true
	}
	if rule.OrderIndex != nil {
		result.OrderIndex = *rule.OrderIndex
		result.HasOrderIndex = true
	}
	return result
}

// fromObservedRule 转换观测状态。
func fromObservedRule(observed *filter.ObservedRule) *agentv1.FirewallObservedRule {
	if observed == nil {
		return nil
	}
	result := &agentv1.FirewallObservedRule{
		Rule: fromFirewallRule(observed.Rule),
		Locator: &agentv1.FirewallLocator{
			Provider:  string(observed.Locator.Provider),
			ScopeKey:  observed.Locator.ScopeKey,
			NativeId:  observed.Locator.NativeID,
			Canonical: observed.Locator.Canonical,
		},
		InstanceKey:     observed.InstanceKey,
		Marker:          observed.Marker,
		ParseStatus:     string(observed.ParseStatus),
		UncertainFields: observed.UncertainFields,
		Raw:             observed.Raw,
		Protected:       observed.Protected,
		Persistence:     string(observed.Persistence),
	}
	if observed.Locator.Position != nil {
		result.Locator.Position = int32(*observed.Locator.Position)
		result.Locator.HasPosition = true
	}
	return result
}
