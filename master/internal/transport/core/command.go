package core

import (
	"context"

	"connectrpc.com/connect"

	"mypanel/core/app/dto"
	"mypanel/core/app/service"
	corev1 "mypanel/proto/gen/go/panel/core/v1"

	"mypanel/master/internal/transport/errmap"
)

// CommandServer 实现 panel.core.v1.CommandService。
type CommandServer struct {
	service service.ICommandService
}

// NewCommandServer 构造快速命令服务。
func NewCommandServer() *CommandServer {
	return &CommandServer{service: service.NewICommandService()}
}

// Search 分页查询命令。
func (s *CommandServer) Search(
	_ context.Context,
	req *connect.Request[corev1.SearchCommandsRequest],
) (*connect.Response[corev1.SearchCommandsResponse], error) {
	total, rows, err := s.service.SearchWithPage(dto.SearchCommandWithPage{
		PageInfo: dto.PageInfo{Page: int(req.Msg.GetPage()), PageSize: int(req.Msg.GetPageSize())},
		OrderBy:  req.Msg.GetOrderBy(),
		Order:    req.Msg.GetOrder(),
		GroupID:  uint(req.Msg.GetGroupId()),
		Type:     req.Msg.GetType(),
		Info:     req.Msg.GetInfo(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*corev1.CommandEntry, 0)
	if list, ok := rows.([]dto.CommandInfo); ok {
		for _, item := range list {
			items = append(items, commandEntryFromDTO(item))
		}
	}
	return connect.NewResponse(&corev1.SearchCommandsResponse{Items: items, Total: total}), nil
}

// List 按类型列出命令。
func (s *CommandServer) List(
	_ context.Context,
	req *connect.Request[corev1.ListCommandsRequest],
) (*connect.Response[corev1.ListCommandsResponse], error) {
	list, err := s.service.List(dto.OperateByType{Type: req.Msg.GetType()})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*corev1.CommandEntry, 0, len(list))
	for _, item := range list {
		items = append(items, commandEntryFromDTO(item))
	}
	return connect.NewResponse(&corev1.ListCommandsResponse{Items: items}), nil
}

// Tree 返回命令分组树。
func (s *CommandServer) Tree(
	_ context.Context,
	req *connect.Request[corev1.CommandTreeRequest],
) (*connect.Response[corev1.CommandTreeResponse], error) {
	list, err := s.service.SearchForTree(dto.OperateByType{Type: req.Msg.GetType()})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.CommandTreeResponse{Items: commandTreeFromDTO(list)}), nil
}

// Create 创建命令。
func (s *CommandServer) Create(
	_ context.Context,
	req *connect.Request[corev1.CreateCommandRequest],
) (*connect.Response[corev1.CreateCommandResponse], error) {
	if err := s.service.Create(commandOperateFromProto(req.Msg)); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.CreateCommandResponse{}), nil
}

// Update 修改命令。
func (s *CommandServer) Update(
	_ context.Context,
	req *connect.Request[corev1.UpdateCommandRequest],
) (*connect.Response[corev1.UpdateCommandResponse], error) {
	if err := s.service.Update(dto.CommandOperate{
		ID:          uint(req.Msg.GetId()),
		Type:        req.Msg.GetType(),
		GroupID:     uint(req.Msg.GetGroupId()),
		GroupBelong: req.Msg.GetGroupBelong(),
		Name:        req.Msg.GetName(),
		Command:     req.Msg.GetCommand(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.UpdateCommandResponse{}), nil
}

// Delete 批量删除命令。
func (s *CommandServer) Delete(
	_ context.Context,
	req *connect.Request[corev1.DeleteCommandsRequest],
) (*connect.Response[corev1.DeleteCommandsResponse], error) {
	ids := make([]uint, 0, len(req.Msg.GetIds()))
	for _, id := range req.Msg.GetIds() {
		ids = append(ids, uint(id))
	}
	if err := s.service.Delete(ids); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.DeleteCommandsResponse{}), nil
}

// Import 批量导入命令。
func (s *CommandServer) Import(
	_ context.Context,
	req *connect.Request[corev1.ImportCommandsRequest],
) (*connect.Response[corev1.ImportCommandsResponse], error) {
	// 与旧 handler 一致：未填分组时落到默认命令分组，单条失败不中断整批。
	for _, item := range req.Msg.GetItems() {
		operate := commandOperateFromProto(item)
		operate.ID = 0
		_ = s.service.Create(operate)
	}
	return connect.NewResponse(&corev1.ImportCommandsResponse{}), nil
}

// Export 导出命令到 CSV。
func (s *CommandServer) Export(
	_ context.Context,
	_ *connect.Request[corev1.ExportCommandsRequest],
) (*connect.Response[corev1.ExportCommandsResponse], error) {
	path, err := s.service.Export()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.ExportCommandsResponse{Path: path}), nil
}

// commandEntryFromDTO 转换一条命令。
func commandEntryFromDTO(item dto.CommandInfo) *corev1.CommandEntry {
	return &corev1.CommandEntry{
		Id:          uint32(item.ID),
		GroupId:     uint32(item.GroupID),
		Name:        item.Name,
		Type:        item.Type,
		Command:     item.Command,
		GroupBelong: item.GroupBelong,
	}
}

// commandOperateFromProto 把创建参数转成 DTO。
func commandOperateFromProto(msg *corev1.CreateCommandRequest) dto.CommandOperate {
	return dto.CommandOperate{
		Type:        msg.GetType(),
		GroupID:     uint(msg.GetGroupId()),
		GroupBelong: msg.GetGroupBelong(),
		Name:        msg.GetName(),
		Command:     msg.GetCommand(),
	}
}

// commandTreeFromDTO 递归转换命令树。
func commandTreeFromDTO(list []dto.CommandTree) []*corev1.CommandTreeNode {
	result := make([]*corev1.CommandTreeNode, 0, len(list))
	for _, item := range list {
		result = append(result, &corev1.CommandTreeNode{
			Label:    item.Label,
			Value:    item.Value,
			Children: commandTreeFromDTO(item.Children),
		})
	}
	return result
}
