package agent

import (
	"context"
	"encoding/json"
	"time"

	"connectrpc.com/connect"

	agentdto "mypanel/agent/app/dto"
	agentservice "mypanel/agent/app/service"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/errmap"
)

// CronjobServer 实现 panel.agent.v1.CronjobService。
type CronjobServer struct {
	service *agentservice.CronjobService
}

// NewCronjobServer 构造计划任务服务。
func NewCronjobServer() *CronjobServer {
	return &CronjobServer{service: &agentservice.CronjobService{}}
}

// Search 分页查询计划任务。
func (s *CronjobServer) Search(
	_ context.Context,
	req *connect.Request[agentv1.SearchCronjobsRequest],
) (*connect.Response[agentv1.SearchCronjobsResponse], error) {
	groupIDs := make([]uint, 0, len(req.Msg.GetGroupIds()))
	for _, id := range req.Msg.GetGroupIds() {
		groupIDs = append(groupIDs, uint(id))
	}

	total, list, err := s.service.SearchWithPage(agentdto.PageCronjob{
		PageInfo: agentdto.PageInfo{
			Page:     int(req.Msg.GetPage()),
			PageSize: int(req.Msg.GetPageSize()),
		},
		Info:     req.Msg.GetInfo(),
		GroupIDs: groupIDs,
		OrderBy:  defaultString(req.Msg.GetOrderBy(), "createdAt"),
		Order:    defaultString(req.Msg.GetOrder(), "descending"),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}

	items, _ := list.([]agentdto.CronjobInfo)
	result := make([]*agentv1.Cronjob, 0, len(items))
	for _, item := range items {
		result = append(result, fromCronjobInfo(item))
	}
	return connect.NewResponse(&agentv1.SearchCronjobsResponse{
		Items: result,
		Total: total,
	}), nil
}

// SearchRecords 分页查询任务执行记录。
func (s *CronjobServer) SearchRecords(
	_ context.Context,
	req *connect.Request[agentv1.SearchCronjobRecordsRequest],
) (*connect.Response[agentv1.SearchCronjobRecordsResponse], error) {
	search := agentdto.SearchRecord{
		PageInfo: agentdto.PageInfo{
			Page:     int(req.Msg.GetPage()),
			PageSize: int(req.Msg.GetPageSize()),
		},
		CronjobID: int(req.Msg.GetCronjobId()),
		Status:    req.Msg.GetStatus(),
	}
	if value := req.Msg.GetStartTime(); value != "" {
		parsed, err := time.Parse(time.RFC3339, value)
		if err != nil {
			return nil, errmap.FromMsgKey("ErrInvalidParams", err)
		}
		search.StartTime = parsed
	}
	if value := req.Msg.GetEndTime(); value != "" {
		parsed, err := time.Parse(time.RFC3339, value)
		if err != nil {
			return nil, errmap.FromMsgKey("ErrInvalidParams", err)
		}
		search.EndTime = parsed
	}

	// repo.WithByDate 是无条件范围过滤；不传时间时必须补一个宽区间，否则查不到任何记录。
	if search.StartTime.IsZero() {
		search.StartTime = time.Now().AddDate(-10, 0, 0)
	}
	if search.EndTime.IsZero() {
		search.EndTime = time.Now().AddDate(1, 0, 0)
	}

	total, list, err := s.service.SearchRecords(search)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	rows, _ := list.([]agentdto.Record)
	items := make([]*agentv1.CronjobRecord, 0, len(rows))
	for _, row := range rows {
		items = append(items, &agentv1.CronjobRecord{
			Id:         uint32(row.ID),
			CronjobId:  uint32(row.CronjobID),
			TaskId:     row.TaskID,
			StartTime:  row.StartTime,
			Records:    row.Records,
			Status:     row.Status,
			Message:    row.Message,
			TargetPath: row.TargetPath,
			Interval:   int32(row.Interval),
			File:       row.File,
		})
	}
	return connect.NewResponse(&agentv1.SearchCronjobRecordsResponse{Items: items, Total: total}), nil
}

// LoadRecordLog 读取一次执行的日志内容。
func (s *CronjobServer) LoadRecordLog(
	_ context.Context,
	req *connect.Request[agentv1.LoadCronjobRecordLogRequest],
) (*connect.Response[agentv1.CronjobRecordLog], error) {
	content := s.service.LoadRecordLog(agentdto.OperateByID{ID: uint(req.Msg.GetId())})
	return connect.NewResponse(&agentv1.CronjobRecordLog{Content: content}), nil
}

// Get 按 ID 查询计划任务详情。
func (s *CronjobServer) Get(
	_ context.Context,
	req *connect.Request[agentv1.GetCronjobRequest],
) (*connect.Response[agentv1.Cronjob], error) {
	item, err := s.service.LoadInfo(agentdto.OperateByID{ID: uint(req.Msg.GetId())})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrRecordNotFound", err)
	}
	return connect.NewResponse(fromCronjobOperate(item)), nil
}

// fromCronjobInfo 把列表项转换成 proto；Secret/Args 不进入响应。
func fromCronjobInfo(item agentdto.CronjobInfo) *agentv1.Cronjob {
	return &agentv1.Cronjob{
		Id:               uint32(item.ID),
		Name:             item.Name,
		Type:             item.Type,
		GroupId:          uint32(item.GroupID),
		SpecCustom:       item.SpecCustom,
		Spec:             item.Spec,
		Executor:         item.Executor,
		Command:          item.Command,
		ContainerName:    item.ContainerName,
		ScriptMode:       item.ScriptMode,
		Script:           item.Script,
		User:             item.User,
		ScriptId:         uint32(item.ScriptID),
		Website:          item.Website,
		AppId:            item.AppID,
		DbType:           item.DBType,
		DbName:           item.DBName,
		SourceDir:        item.SourceDir,
		RetainCopies:     uint64(item.RetainCopies),
		RetryTimes:       uint32(item.RetryTimes),
		Timeout:          uint32(item.Timeout),
		IgnoreErr:        item.IgnoreErr,
		Status:           item.Status,
		LastRecordStatus: item.LastRecordStatus,
		LastRecordTime:   item.LastRecordTime,
		AlertCount:       uint32(item.AlertCount),
		AlertTriggerMode: item.AlertTriggerMode,
	}
}

// fromCronjobOperate 把详情转换成 proto。
func fromCronjobOperate(item *agentdto.CronjobOperate) *agentv1.Cronjob {
	if item == nil {
		return &agentv1.Cronjob{}
	}
	return &agentv1.Cronjob{
		Id:            uint32(item.ID),
		Name:          item.Name,
		Type:          item.Type,
		GroupId:       uint32(item.GroupID),
		SpecCustom:    item.SpecCustom,
		Spec:          item.Spec,
		Executor:      item.Executor,
		Command:       item.Command,
		ContainerName: item.ContainerName,
		ScriptMode:    item.ScriptMode,
		Script:        item.Script,
		User:          item.User,
		ScriptId:      uint32(item.ScriptID),
		Website:       item.Website,
		AppId:         item.AppID,
		DbType:        item.DBType,
		DbName:        item.DBName,
		SourceDir:     item.SourceDir,
		RetainCopies:  uint64(item.RetainCopies),
		RetryTimes:    uint32(item.RetryTimes),
		Timeout:       uint32(item.Timeout),
		IgnoreErr:     item.IgnoreErr,
		InfoJson:      marshalJSON(item),
	}
}

// CreateCronjob 创建计划任务。
func (s *CronjobServer) CreateCronjob(
	ctx context.Context,
	req *connect.Request[agentv1.CreateCronjobRequest],
) (*connect.Response[agentv1.CreateCronjobResponse], error) {
	var payload agentdto.CronjobOperate
	if err := json.Unmarshal([]byte(req.Msg.GetPayloadJson()), &payload); err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	if err := s.service.Create(payload, alertAuditUser(ctx)); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CreateCronjobResponse{}), nil
}

// UpdateCronjob 更新计划任务。
func (s *CronjobServer) UpdateCronjob(
	ctx context.Context,
	req *connect.Request[agentv1.UpdateCronjobRequest],
) (*connect.Response[agentv1.UpdateCronjobResponse], error) {
	var payload agentdto.CronjobOperate
	if err := json.Unmarshal([]byte(req.Msg.GetPayloadJson()), &payload); err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	payload.ID = uint(req.Msg.GetId())
	if err := s.service.Update(payload.ID, payload, alertAuditUser(ctx)); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateCronjobResponse{}), nil
}

// DeleteCronjobs 批量删除计划任务。
func (s *CronjobServer) DeleteCronjobs(
	_ context.Context,
	req *connect.Request[agentv1.DeleteCronjobsRequest],
) (*connect.Response[agentv1.DeleteCronjobsResponse], error) {
	ids := make([]uint, 0, len(req.Msg.GetIds()))
	for _, id := range req.Msg.GetIds() {
		ids = append(ids, uint(id))
	}
	if err := s.service.Delete(agentdto.CronjobBatchDelete{
		IDs:             ids,
		CleanData:       req.Msg.GetCleanData(),
		CleanRemoteData: req.Msg.GetCleanRemoteData(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DeleteCronjobsResponse{}), nil
}

// UpdateCronjobGroup 修改计划任务分组。
func (s *CronjobServer) UpdateCronjobGroup(
	_ context.Context,
	req *connect.Request[agentv1.UpdateCronjobGroupRequest],
) (*connect.Response[agentv1.UpdateCronjobGroupResponse], error) {
	if err := s.service.UpdateGroup(agentdto.ChangeGroup{
		ID:      uint(req.Msg.GetId()),
		GroupID: uint(req.Msg.GetGroupId()),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateCronjobGroupResponse{}), nil
}

// UpdateCronjobStatus 修改计划任务状态。
func (s *CronjobServer) UpdateCronjobStatus(
	_ context.Context,
	req *connect.Request[agentv1.UpdateCronjobStatusRequest],
) (*connect.Response[agentv1.UpdateCronjobStatusResponse], error) {
	if err := s.service.UpdateStatus(uint(req.Msg.GetId()), req.Msg.GetStatus()); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateCronjobStatusResponse{}), nil
}

// HandleCronjobOnce 手动执行一次计划任务。
func (s *CronjobServer) HandleCronjobOnce(
	_ context.Context,
	req *connect.Request[agentv1.HandleCronjobOnceRequest],
) (*connect.Response[agentv1.HandleCronjobOnceResponse], error) {
	if err := s.service.HandleOnce(uint(req.Msg.GetId())); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.HandleCronjobOnceResponse{}), nil
}

// StopCronjob 停止正在执行的计划任务。
func (s *CronjobServer) StopCronjob(
	_ context.Context,
	req *connect.Request[agentv1.StopCronjobRequest],
) (*connect.Response[agentv1.StopCronjobResponse], error) {
	if err := s.service.HandleStop(uint(req.Msg.GetId())); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.StopCronjobResponse{}), nil
}

// CleanCronjobRecords 清空计划任务执行记录。
func (s *CronjobServer) CleanCronjobRecords(
	_ context.Context,
	req *connect.Request[agentv1.CleanCronjobRecordsRequest],
) (*connect.Response[agentv1.CleanCronjobRecordsResponse], error) {
	if err := s.service.CleanRecord(agentdto.CronjobClean{
		IsDelete:        req.Msg.GetIsDelete(),
		CleanData:       req.Msg.GetCleanData(),
		CronjobID:       uint(req.Msg.GetCronjobId()),
		CleanRemoteData: req.Msg.GetCleanRemoteData(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CleanCronjobRecordsResponse{}), nil
}

// LoadScriptOptions 列出可选脚本。
func (s *CronjobServer) LoadScriptOptions(
	_ context.Context,
	_ *connect.Request[agentv1.LoadScriptOptionsRequest],
) (*connect.Response[agentv1.ScriptOptionsResponse], error) {
	options := s.service.LoadScriptOptions()
	items := make([]*agentv1.ScriptOption, 0, len(options))
	for _, item := range options {
		items = append(items, &agentv1.ScriptOption{Id: uint32(item.ID), Name: item.Name})
	}
	return connect.NewResponse(&agentv1.ScriptOptionsResponse{Items: items}), nil
}

// LoadNextHandle 计算接下来几次执行时间。
func (s *CronjobServer) LoadNextHandle(
	_ context.Context,
	req *connect.Request[agentv1.LoadNextHandleRequest],
) (*connect.Response[agentv1.LoadNextHandleResponse], error) {
	list, err := s.service.LoadNextHandle(req.Msg.GetSpec())
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	if list == nil {
		list = []string{}
	}
	return connect.NewResponse(&agentv1.LoadNextHandleResponse{Items: list}), nil
}

// ImportCronjobs 导入计划任务。
func (s *CronjobServer) ImportCronjobs(
	ctx context.Context,
	req *connect.Request[agentv1.ImportCronjobsRequest],
) (*connect.Response[agentv1.ImportCronjobsResponse], error) {
	var payload struct {
		Cronjobs []agentdto.CronjobTrans `json:"cronjobs"`
	}
	if err := json.Unmarshal([]byte(req.Msg.GetPayloadJson()), &payload); err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	if err := s.service.Import(payload.Cronjobs, alertAuditUser(ctx)); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ImportCronjobsResponse{}), nil
}
