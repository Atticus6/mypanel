package agent

import (
	"context"

	"connectrpc.com/connect"

	agentdto "mypanel/agent/app/dto"
	agentservice "mypanel/agent/app/service"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/errmap"
)

// GroupServer 实现 panel.agent.v1.GroupService。
type GroupServer struct {
	service agentservice.IGroupService
}

// NewGroupServer 构造资源分组服务。
func NewGroupServer() *GroupServer {
	return &GroupServer{service: agentservice.NewIGroupService()}
}

// CreateGroup 创建分组。
func (s *GroupServer) CreateGroup(
	_ context.Context,
	req *connect.Request[agentv1.CreateGroupRequest],
) (*connect.Response[agentv1.CreateGroupResponse], error) {
	if err := s.service.Create(agentdto.GroupCreate{
		ID:   uint(req.Msg.GetId()),
		Name: req.Msg.GetName(),
		Type: req.Msg.GetType(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CreateGroupResponse{}), nil
}

// DeleteGroup 删除分组。
func (s *GroupServer) DeleteGroup(
	_ context.Context,
	req *connect.Request[agentv1.DeleteGroupRequest],
) (*connect.Response[agentv1.DeleteGroupResponse], error) {
	if err := s.service.Delete(uint(req.Msg.GetId())); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DeleteGroupResponse{}), nil
}

// UpdateGroup 更新分组。
func (s *GroupServer) UpdateGroup(
	_ context.Context,
	req *connect.Request[agentv1.UpdateGroupRequest],
) (*connect.Response[agentv1.UpdateGroupResponse], error) {
	if err := s.service.Update(agentdto.GroupUpdate{
		ID:        uint(req.Msg.GetId()),
		Name:      req.Msg.GetName(),
		Type:      req.Msg.GetType(),
		IsDefault: req.Msg.GetIsDefault(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateGroupResponse{}), nil
}

// SearchGroups 按类型查询分组列表。
func (s *GroupServer) SearchGroups(
	_ context.Context,
	req *connect.Request[agentv1.SearchGroupsRequest],
) (*connect.Response[agentv1.SearchGroupsResponse], error) {
	list, err := s.service.List(agentdto.OperateByType{Type: req.Msg.GetType()})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.Group, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.Group{
			Id:        uint32(item.ID),
			Name:      item.Name,
			Type:      item.Type,
			IsDefault: item.IsDefault,
		})
	}
	return connect.NewResponse(&agentv1.SearchGroupsResponse{Items: items}), nil
}
