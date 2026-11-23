package core

import (
	"context"

	"connectrpc.com/connect"

	"mypanel/core/app/dto"
	"mypanel/core/app/service"
	corev1 "mypanel/proto/gen/go/panel/core/v1"

	"mypanel/master/internal/transport/errmap"
)

// GroupServer 实现 panel.core.v1.GroupService。
type GroupServer struct {
	service service.IGroupService
}

// NewGroupServer 构造分组服务。
func NewGroupServer() *GroupServer {
	return &GroupServer{service: service.NewIGroupService()}
}

// List 按类型列出分组。
func (s *GroupServer) List(
	_ context.Context,
	req *connect.Request[corev1.ListGroupsRequest],
) (*connect.Response[corev1.ListGroupsResponse], error) {
	list, err := s.service.List(dto.OperateByType{Type: req.Msg.GetType()})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*corev1.GroupEntry, 0, len(list))
	for _, item := range list {
		items = append(items, &corev1.GroupEntry{
			Id:        uint32(item.ID),
			Name:      item.Name,
			Type:      item.Type,
			IsDefault: item.IsDefault,
		})
	}
	return connect.NewResponse(&corev1.ListGroupsResponse{Items: items}), nil
}

// Create 创建分组。
func (s *GroupServer) Create(
	_ context.Context,
	req *connect.Request[corev1.CreateGroupRequest],
) (*connect.Response[corev1.CreateGroupResponse], error) {
	if err := s.service.Create(dto.GroupCreate{
		Name: req.Msg.GetName(),
		Type: req.Msg.GetType(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.CreateGroupResponse{}), nil
}

// Update 修改分组。
func (s *GroupServer) Update(
	_ context.Context,
	req *connect.Request[corev1.UpdateGroupRequest],
) (*connect.Response[corev1.UpdateGroupResponse], error) {
	if err := s.service.Update(dto.GroupUpdate{
		ID:        uint(req.Msg.GetId()),
		Name:      req.Msg.GetName(),
		Type:      req.Msg.GetType(),
		IsDefault: req.Msg.GetIsDefault(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.UpdateGroupResponse{}), nil
}

// Delete 删除分组。
func (s *GroupServer) Delete(
	_ context.Context,
	req *connect.Request[corev1.DeleteGroupRequest],
) (*connect.Response[corev1.DeleteGroupResponse], error) {
	if err := s.service.Delete(uint(req.Msg.GetId())); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.DeleteGroupResponse{}), nil
}
