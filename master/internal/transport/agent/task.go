package agent

import (
	"context"

	"connectrpc.com/connect"

	agentdto "mypanel/agent/app/dto"
	agentservice "mypanel/agent/app/service"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/errmap"
)

// TaskServer 实现 panel.agent.v1.TaskService。
type TaskServer struct {
	service agentservice.ITaskLogService
}

// NewTaskServer 构造任务中心服务。
func NewTaskServer() *TaskServer {
	return &TaskServer{service: agentservice.NewITaskService()}
}

// Search 分页查询任务记录。
func (s *TaskServer) Search(
	_ context.Context,
	req *connect.Request[agentv1.SearchTasksRequest],
) (*connect.Response[agentv1.SearchTasksResponse], error) {
	total, list, err := s.service.Page(agentdto.SearchTaskLogReq{
		PageInfo: agentdto.PageInfo{
			Page:     int(req.Msg.GetPage()),
			PageSize: int(req.Msg.GetPageSize()),
		},
		Status: req.Msg.GetStatus(),
		Type:   req.Msg.GetType(),
		TaskID: req.Msg.GetTaskId(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}

	items := make([]*agentv1.Task, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.Task{
			Id:             item.ID,
			Name:           item.Name,
			Type:           item.Type,
			Operate:        item.Operate,
			LogFile:        item.LogFile,
			Status:         item.Status,
			ErrorMsg:       item.ErrorMsg,
			OperationLogId: uint32(item.OperationLogID),
			ResourceId:     uint32(item.ResourceID),
			CurrentStep:    item.CurrentStep,
			EndAt:          formatTime(item.EndAt),
			CreatedAt:      formatTime(item.CreatedAt),
		})
	}
	return connect.NewResponse(&agentv1.SearchTasksResponse{
		Items: items,
		Total: total,
	}), nil
}

// CountExecuting 统计执行中的任务数量。
func (s *TaskServer) CountExecuting(
	_ context.Context,
	_ *connect.Request[agentv1.CountExecutingTasksRequest],
) (*connect.Response[agentv1.CountExecutingTasksResponse], error) {
	count, err := s.service.CountExecutingTask()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CountExecutingTasksResponse{Count: count}), nil
}
