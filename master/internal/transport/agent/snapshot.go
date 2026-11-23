// Package agent 实现 panel.agent.v1 的 Connect 服务。
package agent

import (
	"context"

	"connectrpc.com/connect"

	"mypanel/agent/app/dto"
	"mypanel/agent/app/service"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/conv"
	"mypanel/master/internal/transport/errmap"
)

// SnapshotServer 实现 panel.agent.v1.SnapshotService。
type SnapshotServer struct {
	service service.ISnapshotService
}

// NewSnapshotServer 构造系统快照服务。
func NewSnapshotServer() *SnapshotServer {
	return &SnapshotServer{service: service.NewISnapshotService()}
}

// LoadData 读取可备份的数据树。
func (s *SnapshotServer) LoadData(
	_ context.Context,
	_ *connect.Request[agentv1.LoadSnapshotDataRequest],
) (*connect.Response[agentv1.SnapshotData], error) {
	data, err := s.service.LoadSnapshotData()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	msg := &agentv1.SnapshotData{}
	if err := conv.FromDTO(data, msg); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(msg), nil
}

// Create 创建系统快照。
func (s *SnapshotServer) Create(
	_ context.Context,
	req *connect.Request[agentv1.CreateSnapshotRequest],
) (*connect.Response[agentv1.CreateSnapshotResponse], error) {
	// 旧 handler 传入 parentTask=nil、jobID=0、retry=3，这里保持一致。
	if err := s.service.SnapshotCreate(nil, snapshotCreateFromProto(req.Msg), 0, 3); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CreateSnapshotResponse{}), nil
}

// Recreate 重试创建快照。
func (s *SnapshotServer) Recreate(
	_ context.Context,
	req *connect.Request[agentv1.RecreateSnapshotRequest],
) (*connect.Response[agentv1.RecreateSnapshotResponse], error) {
	if err := s.service.SnapshotReCreate(uint(req.Msg.GetId())); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.RecreateSnapshotResponse{}), nil
}

// Import 从备份账号导入快照。
func (s *SnapshotServer) Import(
	_ context.Context,
	req *connect.Request[agentv1.ImportSnapshotRequest],
) (*connect.Response[agentv1.ImportSnapshotResponse], error) {
	if err := s.service.SnapshotImport(dto.SnapshotImport{
		BackupAccountID: uint(req.Msg.GetBackupAccountId()),
		Names:           req.Msg.GetNames(),
		Description:     req.Msg.GetDescription(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ImportSnapshotResponse{}), nil
}

// UpdateDescription 修改快照描述。
func (s *SnapshotServer) UpdateDescription(
	_ context.Context,
	req *connect.Request[agentv1.UpdateSnapshotDescriptionRequest],
) (*connect.Response[agentv1.UpdateSnapshotDescriptionResponse], error) {
	if err := s.service.UpdateDescription(dto.UpdateDescription{
		ID:          uint(req.Msg.GetId()),
		Description: req.Msg.GetDescription(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateSnapshotDescriptionResponse{}), nil
}

// Delete 批量删除快照。
func (s *SnapshotServer) Delete(
	_ context.Context,
	req *connect.Request[agentv1.DeleteSnapshotsRequest],
) (*connect.Response[agentv1.DeleteSnapshotsResponse], error) {
	ids := make([]uint, 0, len(req.Msg.GetIds()))
	for _, id := range req.Msg.GetIds() {
		ids = append(ids, uint(id))
	}
	if err := s.service.Delete(dto.SnapshotBatchDelete{
		DeleteWithFile: req.Msg.GetDeleteWithFile(),
		Ids:            ids,
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DeleteSnapshotsResponse{}), nil
}

// Recover 从快照恢复。
func (s *SnapshotServer) Recover(
	_ context.Context,
	req *connect.Request[agentv1.RecoverSnapshotRequest],
) (*connect.Response[agentv1.RecoverSnapshotResponse], error) {
	if err := s.service.SnapshotRecover(dto.SnapshotRecover{
		ID:         uint(req.Msg.GetId()),
		ReDownload: req.Msg.GetReDownload(),
		TaskID:     req.Msg.GetTaskId(),
		Secret:     req.Msg.GetSecret(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.RecoverSnapshotResponse{}), nil
}

// Rollback 从快照回滚。
func (s *SnapshotServer) Rollback(
	_ context.Context,
	req *connect.Request[agentv1.RollbackSnapshotRequest],
) (*connect.Response[agentv1.RollbackSnapshotResponse], error) {
	if err := s.service.SnapshotRollback(dto.SnapshotRecover{
		ID:         uint(req.Msg.GetId()),
		IsNew:      req.Msg.GetIsNew(),
		ReDownload: req.Msg.GetReDownload(),
		TaskID:     req.Msg.GetTaskId(),
		Secret:     req.Msg.GetSecret(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.RollbackSnapshotResponse{}), nil
}

// Search 分页查询快照。
func (s *SnapshotServer) Search(
	_ context.Context,
	req *connect.Request[agentv1.SearchSnapshotsRequest],
) (*connect.Response[agentv1.SearchSnapshotsResponse], error) {
	total, rows, err := s.service.SearchWithPage(dto.PageSnapshot{
		PageInfo: dto.PageInfo{Page: int(req.Msg.GetPage()), PageSize: int(req.Msg.GetPageSize())},
		Info:     req.Msg.GetInfo(),
		OrderBy:  req.Msg.GetOrderBy(),
		Order:    req.Msg.GetOrder(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	// service 为了兼容旧前端返回 interface{}，这里做一次类型断言。
	items := make([]*agentv1.SnapshotInfo, 0)
	switch list := rows.(type) {
	case []dto.SnapshotInfo:
		for _, item := range list {
			msg := &agentv1.SnapshotInfo{}
			if err := conv.FromDTO(item, msg); err != nil {
				return nil, errmap.FromMsgKey("ErrInternalServer", err)
			}
			items = append(items, msg)
		}
	case nil:
	default:
		return nil, errmap.FromMsgKey("ErrInternalServer", nil)
	}
	return connect.NewResponse(&agentv1.SearchSnapshotsResponse{Items: items, Total: total}), nil
}

// snapshotCreateFromProto 把 proto 请求转成 service 的 DTO。
func snapshotCreateFromProto(msg *agentv1.CreateSnapshotRequest) dto.SnapshotCreate {
	return dto.SnapshotCreate{
		TaskID:            msg.GetTaskId(),
		SourceAccountIDs:  msg.GetSourceAccountIds(),
		DownloadAccountID: uint(msg.GetDownloadAccountId()),
		Description:       msg.GetDescription(),
		AppData:           dataTreesFromProto(msg.GetAppData()),
		BackupData:        dataTreesFromProto(msg.GetBackupData()),
		PanelData:         dataTreesFromProto(msg.GetPanelData()),
		WithDockerConf:    msg.GetWithDockerConf(),
		WithMonitorData:   msg.GetWithMonitorData(),
		WithLoginLog:      msg.GetWithLoginLog(),
		WithOperationLog:  msg.GetWithOperationLog(),
		WithSystemLog:     msg.GetWithSystemLog(),
		WithTaskLog:       msg.GetWithTaskLog(),
		IgnoreFiles:       msg.GetIgnoreFiles(),
	}
}

// dataTreesFromProto 递归转换数据树。
func dataTreesFromProto(list []*agentv1.DataTree) []dto.DataTree {
	if list == nil {
		return nil
	}
	result := make([]dto.DataTree, 0, len(list))
	for _, item := range list {
		result = append(result, dto.DataTree{
			ID:             item.GetId(),
			Label:          item.GetLabel(),
			Key:            item.GetKey(),
			Name:           item.GetName(),
			IsLocal:        item.GetIsLocal(),
			Size:           item.GetSize(),
			IsCheck:        item.GetIsCheck(),
			IsDisable:      item.GetIsDisable(),
			Path:           item.GetPath(),
			RelationItemID: item.GetRelationItemId(),
			Children:       dataTreesFromProto(item.GetChildren()),
		})
	}
	return result
}
