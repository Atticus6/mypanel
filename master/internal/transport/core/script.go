package core

import (
	"context"

	"connectrpc.com/connect"

	"mypanel/core/app/dto"
	"mypanel/core/app/service"
	corev1 "mypanel/proto/gen/go/panel/core/v1"

	"mypanel/master/internal/transport/errmap"
)

// ScriptServer 实现 panel.core.v1.ScriptService。
type ScriptServer struct {
	service service.IScriptService
}

// NewScriptServer 构造脚本库服务。
func NewScriptServer() *ScriptServer {
	return &ScriptServer{service: service.NewIScriptService()}
}

// Search 分页查询脚本。
func (s *ScriptServer) Search(
	ctx context.Context,
	req *connect.Request[corev1.SearchScriptsRequest],
) (*connect.Response[corev1.SearchScriptsResponse], error) {
	// 脚本列表需要按请求语言翻译内置脚本名，沿用旧的 gin 上下文。
	total, rows, err := s.service.Search(requireGinContext(ctx), dto.SearchPageWithGroup{
		PageInfo: dto.PageInfo{Page: int(req.Msg.GetPage()), PageSize: int(req.Msg.GetPageSize())},
		GroupID:  uint(req.Msg.GetGroupId()),
		Info:     req.Msg.GetInfo(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*corev1.ScriptEntry, 0)
	if list, ok := rows.([]dto.ScriptInfo); ok {
		for _, item := range list {
			items = append(items, &corev1.ScriptEntry{
				Id:            uint32(item.ID),
				Name:          item.Name,
				IsInteractive: item.IsInteractive,
				Lable:         item.Lable,
				Script:        item.Script,
				GroupList:     toUint32List(item.GroupList),
				GroupBelong:   item.GroupBelong,
				IsSystem:      item.IsSystem,
				Description:   item.Description,
				CreatedAt:     formatTime(item.CreatedAt),
			})
		}
	}
	return connect.NewResponse(&corev1.SearchScriptsResponse{Items: items, Total: total}), nil
}

// Create 创建脚本。
func (s *ScriptServer) Create(
	_ context.Context,
	req *connect.Request[corev1.CreateScriptRequest],
) (*connect.Response[corev1.CreateScriptResponse], error) {
	if err := s.service.Create(dto.ScriptOperate{
		IsInteractive: req.Msg.GetIsInteractive(),
		Name:          req.Msg.GetName(),
		Script:        req.Msg.GetScript(),
		Groups:        req.Msg.GetGroups(),
		Description:   req.Msg.GetDescription(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.CreateScriptResponse{}), nil
}

// Update 修改脚本。
func (s *ScriptServer) Update(
	_ context.Context,
	req *connect.Request[corev1.UpdateScriptRequest],
) (*connect.Response[corev1.UpdateScriptResponse], error) {
	if err := s.service.Update(dto.ScriptOperate{
		ID:            uint(req.Msg.GetId()),
		IsInteractive: req.Msg.GetIsInteractive(),
		Name:          req.Msg.GetName(),
		Script:        req.Msg.GetScript(),
		Groups:        req.Msg.GetGroups(),
		Description:   req.Msg.GetDescription(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.UpdateScriptResponse{}), nil
}

// Delete 批量删除脚本。
func (s *ScriptServer) Delete(
	_ context.Context,
	req *connect.Request[corev1.DeleteScriptsRequest],
) (*connect.Response[corev1.DeleteScriptsResponse], error) {
	ids := make([]uint, 0, len(req.Msg.GetIds()))
	for _, id := range req.Msg.GetIds() {
		ids = append(ids, uint(id))
	}
	if err := s.service.Delete(dto.OperateByIDs{IDs: ids}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.DeleteScriptsResponse{}), nil
}

// Sync 同步脚本到应用商店脚本目录。
func (s *ScriptServer) Sync(
	_ context.Context,
	req *connect.Request[corev1.SyncScriptsRequest],
) (*connect.Response[corev1.SyncScriptsResponse], error) {
	if err := s.service.Sync(dto.OperateByTaskID{TaskID: req.Msg.GetTaskId()}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.SyncScriptsResponse{}), nil
}

// toUint32List 把 uint 列表转成 uint32，供 proto 使用。
func toUint32List(list []uint) []uint32 {
	result := make([]uint32, 0, len(list))
	for _, item := range list {
		result = append(result, uint32(item))
	}
	return result
}
