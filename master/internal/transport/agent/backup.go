package agent

import (
	"context"

	"connectrpc.com/connect"

	agentdto "mypanel/agent/app/dto"
	agentservice "mypanel/agent/app/service"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/errmap"
)

// BackupServer 实现 panel.agent.v1.BackupService。
type BackupServer struct {
	service *agentservice.BackupService
}

// NewBackupServer 构造备份账号服务。
func NewBackupServer() *BackupServer {
	return &BackupServer{service: &agentservice.BackupService{}}
}

// Search 分页查询备份账号。
func (s *BackupServer) Search(
	_ context.Context,
	req *connect.Request[agentv1.SearchBackupsRequest],
) (*connect.Response[agentv1.SearchBackupsResponse], error) {
	total, list, err := s.service.SearchWithPage(agentdto.SearchPageWithType{
		PageInfo: agentdto.PageInfo{
			Page:     int(req.Msg.GetPage()),
			PageSize: int(req.Msg.GetPageSize()),
		},
		Info: req.Msg.GetInfo(),
		Type: req.Msg.GetType(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}

	accounts, _ := list.([]agentdto.BackupInfo)
	items := make([]*agentv1.Backup, 0, len(accounts))
	for _, item := range accounts {
		items = append(items, &agentv1.Backup{
			Id:           uint32(item.ID),
			Name:         item.Name,
			Type:         item.Type,
			IsPublic:     item.IsPublic,
			Bucket:       item.Bucket,
			BackupPath:   item.BackupPath,
			Vars:         item.Vars,
			CreatedAt:    formatTime(item.CreatedAt),
			RememberAuth: item.RememberAuth,
		})
	}
	return connect.NewResponse(&agentv1.SearchBackupsResponse{
		Items: items,
		Total: total,
	}), nil
}
