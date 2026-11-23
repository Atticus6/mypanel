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

// Operate 启停防火墙或切换禁 ping 策略。
func (s *FirewallServer) Operate(
	_ context.Context,
	req *connect.Request[agentv1.FirewallLifecycleRequest],
) (*connect.Response[agentv1.FirewallTaskResponse], error) {
	result, err := s.service.QueueFirewallOperation(agentdto.FirewallLifecycleOperation{
		BackupFile:        req.Msg.GetBackupFile(),
		Operation:         req.Msg.GetOperation(),
		WithDockerRestart: req.Msg.GetWithDockerRestart(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.FirewallTaskResponse{TaskId: result.TaskID, Queued: result.Queued}), nil
}

// GetForwardBase 读取端口转发子系统状态。
func (s *FirewallServer) GetForwardBase(
	ctx context.Context,
	_ *connect.Request[agentv1.GetForwardBaseRequest],
) (*connect.Response[agentv1.FirewallSubsystem], error) {
	info, err := agentservice.NewIForwardingService().LoadBaseInfo(ctx)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.FirewallSubsystem{
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

// SearchForwardRules 分页查询端口转发规则。
func (s *FirewallServer) SearchForwardRules(
	ctx context.Context,
	req *connect.Request[agentv1.SearchForwardRulesRequest],
) (*connect.Response[agentv1.SearchForwardRulesResponse], error) {
	total, list, err := agentservice.NewIForwardingService().SearchRules(ctx, agentdto.ForwardRuleSearch{
		PageInfo: agentdto.PageInfo{Page: int(req.Msg.GetPage()), PageSize: int(req.Msg.GetPageSize())},
		All:      req.Msg.GetAll(),
		Info:     req.Msg.GetInfo(),
		Status:   req.Msg.GetStatus(),
		Strategy: req.Msg.GetStrategy(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.ForwardRule, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.ForwardRule{
			Id:          uint32(item.ID),
			Chain:       item.Chain,
			Family:      item.Family,
			Address:     item.Address,
			Port:        item.Port,
			Protocol:    item.Protocol,
			Strategy:    item.Strategy,
			Num:         item.Num,
			TargetIp:    item.TargetIP,
			TargetPort:  item.TargetPort,
			Interface:   item.Interface,
			UsedStatus:  item.UsedStatus,
			Description: item.Description,
		})
	}
	return connect.NewResponse(&agentv1.SearchForwardRulesResponse{Items: items, Total: total}), nil
}

// OperateForwardRules 新增或删除端口转发规则。
func (s *FirewallServer) OperateForwardRules(
	_ context.Context,
	req *connect.Request[agentv1.OperateForwardRulesRequest],
) (*connect.Response[agentv1.FirewallTaskResponse], error) {
	request := agentdto.ForwardRuleOperate{Import: req.Msg.GetImport()}
	for _, item := range req.Msg.GetRules() {
		request.Rules = append(request.Rules, agentdto.ForwardRuleOperation{
			Operation:  item.GetOperation(),
			Num:        item.GetNum(),
			Family:     item.GetFamily(),
			Protocol:   item.GetProtocol(),
			Interface:  item.GetInterface(),
			Port:       item.GetPort(),
			TargetIP:   item.GetTargetIp(),
			TargetPort: item.GetTargetPort(),
		})
	}
	result, err := agentservice.NewIForwardingService().OperateRules(request)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.FirewallTaskResponse{TaskId: result.TaskID, Queued: result.Queued}), nil
}

// EnableForwarding 初始化并启用端口转发。
func (s *FirewallServer) EnableForwarding(
	_ context.Context,
	req *connect.Request[agentv1.EnableForwardingRequest],
) (*connect.Response[agentv1.FirewallTaskResponse], error) {
	result, err := agentservice.NewIForwardingService().QueueInitialization(agentdto.FirewallInitializationTask{
		BackupFile: req.Msg.GetBackupFile(),
		TaskID:     req.Msg.GetTaskId(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.FirewallTaskResponse{TaskId: result.TaskID, Queued: result.Queued}), nil
}

// OperateFilterChain 初始化、绑定或解绑过滤链。
func (s *FirewallServer) OperateFilterChain(
	_ context.Context,
	req *connect.Request[agentv1.OperateFilterChainRequest],
) (*connect.Response[agentv1.FirewallTaskResponse], error) {
	operation := agentdto.FilterChainOperation{
		Name:    req.Msg.GetName(),
		Operate: req.Msg.GetOperate(),
		TaskID:  req.Msg.GetTaskId(),
	}
	if operation.Operate == "init-base" {
		result, err := s.service.QueueFilterChainInitialization(operation)
		if err != nil {
			return nil, errmap.FromMsgKey("ErrInternalServer", err)
		}
		return connect.NewResponse(&agentv1.FirewallTaskResponse{TaskId: result.TaskID, Queued: result.Queued}), nil
	}
	if err := s.service.OperateFilterChain(operation); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.FirewallTaskResponse{}), nil
}

// ResetRules 重置子系统规则。
func (s *FirewallServer) ResetRules(
	ctx context.Context,
	req *connect.Request[agentv1.ResetFirewallRulesRequest],
) (*connect.Response[agentv1.ResetFirewallRulesResponse], error) {
	// DTO 用 *bool 表达「未传时默认备份」，proto3 无法区分 false 与未设置，
	// 这里显式接受 false：调用方要备份必须传 true。
	backup := req.Msg.GetBackup()
	result, err := s.service.Reset(ctx, agentdto.FirewallRuleReset{
		Subsystem:         req.Msg.GetSubsystem(),
		Backup:            &backup,
		Provider:          filter.Provider(req.Msg.GetProvider()),
		WithDockerRestart: req.Msg.GetWithDockerRestart(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ResetFirewallRulesResponse{
		BackupPath: result.BackupPath,
		Removed:    int32(result.Removed),
		Disabled:   result.Disabled,
	}), nil
}

// GetNativeDetail 读取原生规则详情。
func (s *FirewallServer) GetNativeDetail(
	ctx context.Context,
	req *connect.Request[agentv1.GetFirewallNativeDetailRequest],
) (*connect.Response[agentv1.FirewallNativeDetailResponse], error) {
	content, err := s.service.LoadFirewallNativeDetail(ctx, agentdto.FirewallNativeDetail{
		Provider:   filter.Provider(req.Msg.GetProvider()),
		NativeKind: filter.NativeKind(req.Msg.GetNativeKind()),
		Name:       req.Msg.GetName(),
		Permanent:  req.Msg.GetPermanent(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.FirewallNativeDetailResponse{Content: content}), nil
}

// CreateRules 批量创建规则。
func (s *FirewallServer) CreateRules(
	ctx context.Context,
	req *connect.Request[agentv1.CreateFirewallRulesRequest],
) (*connect.Response[agentv1.CreateFirewallRulesResponse], error) {
	request := agentdto.FirewallRuleCreate{
		BackupFile: req.Msg.GetBackupFile(),
		Initialize: req.Msg.GetInitialize(),
	}
	for _, item := range req.Msg.GetItems() {
		request.Items = append(request.Items, agentdto.FirewallRuleCreateItem{
			Raw:         item.GetRaw(),
			ParseStatus: filter.ParseStatus(item.GetParseStatus()),
			Rule:        toFirewallRule(item.GetRule()),
			SourceKind:  item.GetSourceKind(),
		})
	}
	result, err := s.service.Create(ctx, request)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CreateFirewallRulesResponse{
		TaskId:    result.TaskID,
		Queued:    result.Queued,
		Succeeded: int32(result.Succeeded),
		Failed:    int32(result.Failed),
		Skipped:   int32(result.Skipped),
		Errors:    fromCreateFailures(result.Errors),
	}), nil
}

// DeleteRules 批量删除规则。
func (s *FirewallServer) DeleteRules(
	ctx context.Context,
	req *connect.Request[agentv1.DeleteFirewallRulesRequest],
) (*connect.Response[agentv1.DeleteFirewallRulesResponse], error) {
	request := agentdto.FirewallRuleDelete{}
	for _, target := range req.Msg.GetTargets() {
		request.Targets = append(request.Targets, agentdto.FirewallRuleDeleteItem{
			FirewallRuleDeleteTarget: agentdto.FirewallRuleDeleteTarget{
				Scope:       fromProtoScope(target.GetScope()),
				InstanceKey: target.GetInstanceKey(),
			},
			Observed: toObservedRule(target.GetObserved()),
		})
	}
	result, err := s.service.Delete(ctx, request)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	failures := make([]*agentv1.FirewallRuleDeleteFailure, 0, len(result.Errors))
	for _, item := range result.Errors {
		failures = append(failures, &agentv1.FirewallRuleDeleteFailure{
			Index:       int32(item.Index),
			InstanceKey: item.InstanceKey,
			Error:       item.Error,
		})
	}
	return connect.NewResponse(&agentv1.DeleteFirewallRulesResponse{
		TaskId:    result.TaskID,
		Queued:    result.Queued,
		Succeeded: int32(result.Succeeded),
		Failed:    int32(result.Failed),
		Errors:    failures,
	}), nil
}

// UpdateRule 修改单条规则。
func (s *FirewallServer) UpdateRule(
	ctx context.Context,
	req *connect.Request[agentv1.UpdateFirewallRuleRequest],
) (*connect.Response[agentv1.UpdateFirewallRuleResponse], error) {
	request := agentdto.FirewallRuleUpdate{
		FirewallRuleDeleteTarget: agentdto.FirewallRuleDeleteTarget{
			Scope:       fromProtoScope(req.Msg.GetScope()),
			InstanceKey: req.Msg.GetInstanceKey(),
		},
	}
	if req.Msg.GetRule() != nil {
		rule := toFirewallRule(req.Msg.GetRule())
		request.Rule = &rule
	}
	if req.Msg.Description != nil {
		request.Description = req.Msg.Description
	}
	if req.Msg.OrderIndex != nil {
		request.OrderIndex = req.Msg.OrderIndex
	}
	if req.Msg.Priority != nil {
		priority := int(req.Msg.GetPriority())
		request.Priority = &priority
	}
	if err := s.service.Update(ctx, request); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateFirewallRuleResponse{}), nil
}

// ReorderRule 调整规则位置。
func (s *FirewallServer) ReorderRule(
	ctx context.Context,
	req *connect.Request[agentv1.ReorderFirewallRuleRequest],
) (*connect.Response[agentv1.ReorderFirewallRuleResponse], error) {
	request := agentdto.FirewallRuleReorder{
		FirewallRuleDeleteTarget: agentdto.FirewallRuleDeleteTarget{
			Scope:       fromProtoScope(req.Msg.GetScope()),
			InstanceKey: req.Msg.GetInstanceKey(),
		},
	}
	if req.Msg.TargetPosition != nil {
		request.TargetPosition = req.Msg.TargetPosition
	}
	if req.Msg.Priority != nil {
		priority := int(req.Msg.GetPriority())
		request.Priority = &priority
	}
	if err := s.service.Reorder(ctx, request); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ReorderFirewallRuleResponse{}), nil
}

// GetSettings 读取防火墙设置。
func (s *FirewallServer) GetSettings(
	ctx context.Context,
	_ *connect.Request[agentv1.GetFirewallSettingsRequest],
) (*connect.Response[agentv1.FirewallSettings], error) {
	info, err := agentservice.NewIFirewallSettingService().Load(ctx)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	msg := &agentv1.FirewallSettings{
		Ipv6Enabled: info.IPv6Enabled,
		System:      fromBackendGroup(info.System),
		Forwarding:  fromBackendGroup(info.Forwarding),
		Docker:      fromBackendGroup(info.Docker),
		PingStatus:  info.PingStatus,
		PanelPort:   info.PanelPort,
		SshPort:     info.SSHPort,
	}
	for _, item := range info.PortWhitelist {
		msg.PortWhiteList = append(msg.PortWhiteList, &agentv1.PortWhitelistRule{
			Port:     item.Port,
			Protocol: item.Protocol,
			Type:     item.Type,
			Sources:  item.Sources,
		})
	}
	return connect.NewResponse(msg), nil
}

// CreateWhitelist 新增端口白名单。
func (s *FirewallServer) CreateWhitelist(
	ctx context.Context,
	req *connect.Request[agentv1.CreateFirewallWhitelistRequest],
) (*connect.Response[agentv1.CreateFirewallWhitelistResponse], error) {
	if err := agentservice.NewIFirewallSettingService().CreatePortWhitelist(ctx, agentdto.FirewallPortWhitelistCreate{
		Rule: toPortWhitelist(req.Msg.GetRule()),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CreateFirewallWhitelistResponse{}), nil
}

// UpdateWhitelist 修改端口白名单。
func (s *FirewallServer) UpdateWhitelist(
	ctx context.Context,
	req *connect.Request[agentv1.UpdateFirewallWhitelistRequest],
) (*connect.Response[agentv1.UpdateFirewallWhitelistResponse], error) {
	if err := agentservice.NewIFirewallSettingService().UpdatePortWhitelist(ctx, agentdto.FirewallPortWhitelistUpdate{
		OldRule: toPortWhitelist(req.Msg.GetOldRule()),
		Rule:    toPortWhitelist(req.Msg.GetRule()),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateFirewallWhitelistResponse{}), nil
}

// DeleteWhitelist 删除端口白名单。
func (s *FirewallServer) DeleteWhitelist(
	ctx context.Context,
	req *connect.Request[agentv1.DeleteFirewallWhitelistRequest],
) (*connect.Response[agentv1.DeleteFirewallWhitelistResponse], error) {
	rule := toPortWhitelist(req.Msg.GetRule())
	if err := agentservice.NewIFirewallSettingService().DeletePortWhitelist(ctx, agentdto.FirewallPortWhitelistDelete{
		Rule: &rule,
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DeleteFirewallWhitelistResponse{}), nil
}

// OperateBackend 切换子系统后端。
func (s *FirewallServer) OperateBackend(
	ctx context.Context,
	req *connect.Request[agentv1.OperateFirewallBackendRequest],
) (*connect.Response[agentv1.OperateFirewallBackendResponse], error) {
	if err := agentservice.NewIFirewallSettingService().Operate(ctx, agentdto.FirewallBackendOperation{
		Subsystem: req.Msg.GetSubsystem(),
		Backend:   req.Msg.GetBackend(),
		Operation: req.Msg.GetOperation(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.OperateFirewallBackendResponse{}), nil
}

// OperateIPv6 开关 IPv6 支持。
func (s *FirewallServer) OperateIPv6(
	_ context.Context,
	req *connect.Request[agentv1.OperateFirewallIPv6Request],
) (*connect.Response[agentv1.FirewallTaskResponse], error) {
	result, err := agentservice.NewIFirewallSettingService().OperateIPv6(agentdto.FirewallIPv6Operation{
		Status: req.Msg.GetStatus(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.FirewallTaskResponse{TaskId: result.TaskID, Queued: result.Queued}), nil
}

// OperateFamily 初始化、修复或绑定地址族。
func (s *FirewallServer) OperateFamily(
	_ context.Context,
	req *connect.Request[agentv1.OperateFirewallFamilyRequest],
) (*connect.Response[agentv1.FirewallTaskResponse], error) {
	result, err := agentservice.NewIFirewallSettingService().OperateFamily(agentdto.FirewallFamilyOperation{
		Subsystem: req.Msg.GetSubsystem(),
		Backend:   req.Msg.GetBackend(),
		Family:    req.Msg.GetFamily(),
		Operation: req.Msg.GetOperation(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.FirewallTaskResponse{TaskId: result.TaskID, Queued: result.Queued}), nil
}

// ListDockerPorts 读取 Docker 端口防护总览。
func (s *FirewallServer) ListDockerPorts(
	ctx context.Context,
	_ *connect.Request[agentv1.GetDockerPortsRequest],
) (*connect.Response[agentv1.DockerGuardOverview], error) {
	info, err := agentservice.NewIDockerPortGuardService().LoadOverview(ctx)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	msg := &agentv1.DockerGuardOverview{Base: fromDockerGuardBase(info.Base)}
	for _, item := range info.Containers {
		msg.Containers = append(msg.Containers, fromDockerGuardContainer(item))
	}
	for _, item := range info.OrphanPolicies {
		msg.OrphanPolicies = append(msg.OrphanPolicies, fromDockerGuardEndpoint(item))
	}
	return connect.NewResponse(msg), nil
}

// ListDockerEndpoints 列出 Docker 已发布端口。
func (s *FirewallServer) ListDockerEndpoints(
	ctx context.Context,
	_ *connect.Request[agentv1.GetDockerEndpointsRequest],
) (*connect.Response[agentv1.DockerEndpointsResponse], error) {
	list, err := agentservice.NewIDockerPortGuardService().LoadPublishedPorts(ctx)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.DockerGuardContainer, 0, len(list))
	for _, item := range list {
		items = append(items, fromDockerGuardContainer(item))
	}
	return connect.NewResponse(&agentv1.DockerEndpointsResponse{Items: items}), nil
}

// OperateDocker 初始化或绑定 Docker 端口防护。
func (s *FirewallServer) OperateDocker(
	ctx context.Context,
	req *connect.Request[agentv1.OperateDockerGuardRequest],
) (*connect.Response[agentv1.FirewallTaskResponse], error) {
	service := agentservice.NewIDockerPortGuardService()
	request := agentdto.DockerPortGuardOperation{
		BackupFile: req.Msg.GetBackupFile(),
		Operation:  req.Msg.GetOperation(),
		TaskID:     req.Msg.GetTaskId(),
	}
	if request.Operation == "initialize" {
		result, err := service.QueueInitialization(request)
		if err != nil {
			return nil, errmap.FromMsgKey("ErrInternalServer", err)
		}
		return connect.NewResponse(&agentv1.FirewallTaskResponse{TaskId: result.TaskID, Queued: result.Queued}), nil
	}
	if err := service.Operate(ctx, request); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.FirewallTaskResponse{}), nil
}

// UpsertDockerPolicies 批量新增或更新策略。
func (s *FirewallServer) UpsertDockerPolicies(
	_ context.Context,
	req *connect.Request[agentv1.UpsertDockerPoliciesRequest],
) (*connect.Response[agentv1.FirewallTaskResponse], error) {
	request := agentdto.DockerPortGuardPolicyBatch{Import: req.Msg.GetImport()}
	for _, item := range req.Msg.GetPolicies() {
		request.Policies = append(request.Policies, agentdto.DockerPortGuardPolicy{
			DockerPortGuardEndpointIdentity: agentdto.DockerPortGuardEndpointIdentity{
				Family:   item.GetFamily(),
				HostIP:   item.GetHostIp(),
				HostPort: uint16(item.GetHostPort()),
				Protocol: item.GetProtocol(),
			},
			Mode:    item.GetMode(),
			Sources: item.GetSources(),
		})
	}
	result, err := agentservice.NewIDockerPortGuardService().UpsertPolicies(request)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.FirewallTaskResponse{TaskId: result.TaskID, Queued: result.Queued}), nil
}

// DeleteDockerPolicies 批量删除策略。
func (s *FirewallServer) DeleteDockerPolicies(
	_ context.Context,
	req *connect.Request[agentv1.DeleteDockerPoliciesRequest],
) (*connect.Response[agentv1.FirewallTaskResponse], error) {
	result, err := agentservice.NewIDockerPortGuardService().DeletePolicies(agentdto.DockerPortGuardPolicyBatchDelete{
		UUIDs: req.Msg.GetUuids(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.FirewallTaskResponse{TaskId: result.TaskID, Queued: result.Queued}), nil
}

// ListRuleBackups 列出规则备份文件。
func (s *FirewallServer) ListRuleBackups(
	ctx context.Context,
	req *connect.Request[agentv1.ListFirewallBackupsRequest],
) (*connect.Response[agentv1.FirewallRuleBackups], error) {
	subsystem := req.Msg.GetSubsystem()
	if subsystem == "" {
		// 旧接口默认查 system 子系统。
		subsystem = "system"
	}
	result, err := s.service.ListRuleBackups(ctx, subsystem)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	msg := &agentv1.FirewallRuleBackups{Directory: result.Directory}
	for _, item := range result.Files {
		msg.Files = append(msg.Files, &agentv1.FirewallRuleBackup{
			Name:       item.Name,
			Provider:   string(item.Provider),
			RuleCount:  int32(item.RuleCount),
			ModifiedAt: item.ModifiedAt,
		})
	}
	return connect.NewResponse(msg), nil
}

// toFirewallRule 把 proto 规则转成 filter.FirewallRule。
func toFirewallRule(rule *agentv1.FirewallRule) filter.FirewallRule {
	if rule == nil {
		return filter.FirewallRule{}
	}
	result := filter.FirewallRule{
		UUID:               rule.GetUuid(),
		Scope:              fromProtoScope(rule.GetScope()),
		NativeKind:         filter.NativeKind(rule.GetNativeKind()),
		Protocol:           rule.GetProtocol(),
		SourceAddress:      rule.GetSourceAddress(),
		SourcePort:         rule.GetSourcePort(),
		DestinationAddress: rule.GetDestinationAddress(),
		DestinationPort:    rule.GetDestinationPort(),
		Interface:          rule.GetInterface(),
		ConnectionStates:   rule.GetConnectionStates(),
		Action:             filter.Action(rule.GetAction()),
		OrderBucket:        rule.GetOrderBucket(),
		Description:        rule.GetDescription(),
	}
	if rule.GetHasPriority() {
		priority := int(rule.GetPriority())
		result.Priority = &priority
	}
	if rule.GetHasOrderIndex() {
		orderIndex := rule.GetOrderIndex()
		result.OrderIndex = &orderIndex
	}
	return result
}

// toObservedRule 把 proto 观测状态转成 filter.ObservedRule。
func toObservedRule(observed *agentv1.FirewallObservedRule) filter.ObservedRule {
	if observed == nil {
		return filter.ObservedRule{}
	}
	result := filter.ObservedRule{
		Rule:            toFirewallRule(observed.GetRule()),
		InstanceKey:     observed.GetInstanceKey(),
		Marker:          observed.GetMarker(),
		ParseStatus:     filter.ParseStatus(observed.GetParseStatus()),
		UncertainFields: observed.GetUncertainFields(),
		Raw:             observed.GetRaw(),
		Protected:       observed.GetProtected(),
		Persistence:     filter.PersistenceStatus(observed.GetPersistence()),
	}
	if locator := observed.GetLocator(); locator != nil {
		result.Locator.Provider = filter.Provider(locator.GetProvider())
		result.Locator.ScopeKey = locator.GetScopeKey()
		result.Locator.NativeID = locator.GetNativeId()
		result.Locator.Canonical = locator.GetCanonical()
		if locator.GetHasPosition() {
			position := int(locator.GetPosition())
			result.Locator.Position = &position
		}
	}
	return result
}

// fromCreateFailures 转换创建失败明细。
func fromCreateFailures(list []agentdto.FirewallRuleCreateFailure) []*agentv1.FirewallRuleCreateFailure {
	result := make([]*agentv1.FirewallRuleCreateFailure, 0, len(list))
	for _, item := range list {
		result = append(result, &agentv1.FirewallRuleCreateFailure{
			Index:  int32(item.Index),
			Status: item.Status,
			Rule:   fromFirewallRule(item.Rule),
			Error:  item.Error,
		})
	}
	return result
}

// toPortWhitelist 转换端口白名单。
func toPortWhitelist(rule *agentv1.PortWhitelistRule) filter.PortWhitelist {
	if rule == nil {
		return filter.PortWhitelist{}
	}
	return filter.PortWhitelist{
		Port:     rule.GetPort(),
		Protocol: rule.GetProtocol(),
		Type:     rule.GetType(),
		Sources:  rule.GetSources(),
	}
}

// fromBackendGroup 转换后端分组。
func fromBackendGroup(group agentdto.FirewallBackendGroup) *agentv1.FirewallBackendGroup {
	result := &agentv1.FirewallBackendGroup{Selected: group.Selected, Current: group.Current}
	for _, option := range group.Options {
		result.Options = append(result.Options, &agentv1.FirewallBackendOption{
			Name:           option.Name,
			Installed:      option.Installed,
			Active:         option.Active,
			Initialized:    option.Initialized,
			Bound:          option.Bound,
			Supported:      option.Supported,
			SupportReason:  option.SupportReason,
			Implementation: option.Implementation,
			Message:        option.Message,
			Ipv4:           fromFirewallFamily(option.IPv4),
			Ipv6:           fromFirewallFamily(option.IPv6),
		})
	}
	return result
}

// fromDockerGuardBase 转换 Docker 防护基础状态。
func fromDockerGuardBase(base agentdto.DockerPortGuardBase) *agentv1.DockerGuardBase {
	return &agentv1.DockerGuardBase{
		Ipv6Enabled: base.IPv6Enabled,
		Name:        base.Name,
		Version:     base.Version,
		IsExist:     base.IsExist,
		Initialized: base.Initialized,
		Bound:       base.Bound,
		Ipv4:        fromDockerGuardFamily(base.IPv4),
		Ipv6:        fromDockerGuardFamily(base.IPv6),
		Backend:     base.Backend,
		Message:     base.Message,
	}
}

// fromDockerGuardFamily 转换 Docker 防护地址族状态。
func fromDockerGuardFamily(item agentdto.DockerPortGuardFamilyStatus) *agentv1.DockerGuardFamilyStatus {
	return &agentv1.DockerGuardFamilyStatus{
		Partial:     item.Partial,
		State:       item.State,
		Reason:      item.Reason,
		Initialized: item.Initialized,
		Bound:       item.Bound,
		Effective:   item.Effective,
	}
}

// fromDockerGuardContainer 转换 Docker 容器信息。
func fromDockerGuardContainer(item agentdto.DockerPortGuardContainer) *agentv1.DockerGuardContainer {
	result := &agentv1.DockerGuardContainer{
		Key:         item.Key,
		Name:        item.Name,
		Compose:     item.Compose,
		Application: item.Application,
	}
	for _, endpoint := range item.Endpoints {
		result.Endpoints = append(result.Endpoints, fromDockerGuardEndpoint(endpoint))
	}
	for _, group := range item.PortGroups {
		groupMsg := &agentv1.DockerGuardPortGroup{
			Key:      group.Key,
			Label:    group.Label,
			Endpoint: fromDockerGuardEndpoint(group.Endpoint),
		}
		for _, endpoint := range group.Endpoints {
			groupMsg.Endpoints = append(groupMsg.Endpoints, fromDockerGuardEndpoint(endpoint))
		}
		result.PortGroups = append(result.PortGroups, groupMsg)
	}
	return result
}

// fromDockerGuardEndpoint 转换 Docker 端口端点。
func fromDockerGuardEndpoint(item agentdto.DockerPortGuardEndpoint) *agentv1.DockerGuardEndpoint {
	return &agentv1.DockerGuardEndpoint{
		Family:           item.Family,
		HostIp:           item.HostIP,
		HostPort:         uint32(item.HostPort),
		Protocol:         item.Protocol,
		ContainerId:      item.ContainerID,
		ContainerName:    item.ContainerName,
		ContainerState:   item.ContainerState,
		ContainerPort:    uint32(item.ContainerPort),
		Compose:          item.Compose,
		Application:      item.Application,
		PolicyUuid:       item.PolicyUUID,
		Mode:             item.Mode,
		Sources:          item.Sources,
		Effective:        item.Effective,
		TrafficPath:      item.TrafficPath,
		ManagementTarget: item.ManagementTarget,
		ManagementReason: item.ManagementReason,
	}
}
