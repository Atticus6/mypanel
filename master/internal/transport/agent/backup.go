package agent

import (
	"context"
	"path"

	"connectrpc.com/connect"

	agentdto "mypanel/agent/app/dto"
	agentservice "mypanel/agent/app/service"
	"mypanel/agent/constant"
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

// CheckBackupUsed 检查备份账号是否已被任务引用。
func (s *BackupServer) CheckBackupUsed(
	_ context.Context,
	req *connect.Request[agentv1.CheckBackupUsedRequest],
) (*connect.Response[agentv1.CheckBackupUsedResponse], error) {
	if err := s.service.CheckUsed(req.Msg.GetName(), true); err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	return connect.NewResponse(&agentv1.CheckBackupUsedResponse{}), nil
}

// CheckBackupConn 测试备份账号连通性。
func (s *BackupServer) CheckBackupConn(
	_ context.Context,
	req *connect.Request[agentv1.BackupOperate],
) (*connect.Response[agentv1.BackupCheckResult], error) {
	res := s.service.CheckConn(fromBackupOperate(req.Msg))
	return connect.NewResponse(&agentv1.BackupCheckResult{
		IsOk:  res.IsOk,
		Msg:   res.Msg,
		Token: res.Token,
	}), nil
}

// CreateBackupAccount 新建备份账号。
func (s *BackupServer) CreateBackupAccount(
	_ context.Context,
	req *connect.Request[agentv1.BackupOperate],
) (*connect.Response[agentv1.CreateBackupAccountResponse], error) {
	if err := s.service.Create(fromBackupOperate(req.Msg)); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CreateBackupAccountResponse{}), nil
}

// UpdateBackupAccount 更新备份账号。
func (s *BackupServer) UpdateBackupAccount(
	_ context.Context,
	req *connect.Request[agentv1.BackupOperate],
) (*connect.Response[agentv1.UpdateBackupAccountResponse], error) {
	if err := s.service.Update(fromBackupOperate(req.Msg)); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateBackupAccountResponse{}), nil
}

// DeleteBackupAccount 删除备份账号。
func (s *BackupServer) DeleteBackupAccount(
	_ context.Context,
	req *connect.Request[agentv1.DeleteBackupAccountRequest],
) (*connect.Response[agentv1.DeleteBackupAccountResponse], error) {
	if err := s.service.Delete(uint(req.Msg.GetId())); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DeleteBackupAccountResponse{}), nil
}

// RefreshBackupToken 刷新备份账号令牌。
func (s *BackupServer) RefreshBackupToken(
	_ context.Context,
	req *connect.Request[agentv1.RefreshBackupTokenRequest],
) (*connect.Response[agentv1.RefreshBackupTokenResponse], error) {
	if err := s.service.RefreshToken(agentdto.OperateByID{ID: uint(req.Msg.GetId())}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.RefreshBackupTokenResponse{}), nil
}

// ListBuckets 列出对象存储账号里的存储桶。
func (s *BackupServer) ListBuckets(
	_ context.Context,
	req *connect.Request[agentv1.ListBucketsRequest],
) (*connect.Response[agentv1.ListBucketsResponse], error) {
	list, err := s.service.GetBuckets(agentdto.ForBuckets{
		Type:       req.Msg.GetType(),
		AccessKey:  req.Msg.GetAccessKey(),
		Credential: req.Msg.GetCredential(),
		Vars:       req.Msg.GetVars(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]string, 0, len(list))
	for _, bucket := range list {
		if value, ok := bucket.(string); ok {
			items = append(items, value)
		}
	}
	return connect.NewResponse(&agentv1.ListBucketsResponse{Items: items}), nil
}

// LoadBackupOptions 列出可选备份账号。
func (s *BackupServer) LoadBackupOptions(
	_ context.Context,
	_ *connect.Request[agentv1.LoadBackupOptionsRequest],
) (*connect.Response[agentv1.LoadBackupOptionsResponse], error) {
	list, err := s.service.LoadBackupOptions()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.BackupOption, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.BackupOption{
			Id:       uint32(item.ID),
			Name:     item.Name,
			Type:     item.Type,
			IsPublic: item.IsPublic,
		})
	}
	return connect.NewResponse(&agentv1.LoadBackupOptionsResponse{Items: items}), nil
}

// GetLocalBackupDir 获取本机备份目录。
func (s *BackupServer) GetLocalBackupDir(
	_ context.Context,
	_ *connect.Request[agentv1.GetLocalBackupDirRequest],
) (*connect.Response[agentv1.GetLocalBackupDirResponse], error) {
	dir, err := s.service.GetLocalDir()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.GetLocalBackupDirResponse{Dir: dir}), nil
}

// UploadForRecover 登记已上传的备份文件。
func (s *BackupServer) UploadForRecover(
	_ context.Context,
	req *connect.Request[agentv1.UploadForRecoverRequest],
) (*connect.Response[agentv1.UploadForRecoverResponse], error) {
	if err := s.service.UploadForRecover(agentdto.UploadForRecover{
		FilePath:  req.Msg.GetFilePath(),
		TargetDir: req.Msg.GetTargetDir(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UploadForRecoverResponse{}), nil
}

// SearchBackupRecords 分页查询备份记录。
func (s *BackupServer) SearchBackupRecords(
	_ context.Context,
	req *connect.Request[agentv1.SearchBackupRecordsRequest],
) (*connect.Response[agentv1.BackupRecordsResponse], error) {
	total, list, err := recordService().SearchRecordsWithPage(agentdto.RecordSearch{
		PageInfo:   pageInfo(req.Msg.GetPage(), req.Msg.GetPageSize()),
		Type:       req.Msg.GetType(),
		Name:       req.Msg.GetName(),
		DetailName: req.Msg.GetDetailName(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.BackupRecordsResponse{
		Items: fromBackupRecords(list),
		Total: total,
	}), nil
}

// SearchBackupRecordsByCronjob 按计划任务分页查询备份记录。
func (s *BackupServer) SearchBackupRecordsByCronjob(
	_ context.Context,
	req *connect.Request[agentv1.SearchBackupRecordsByCronjobRequest],
) (*connect.Response[agentv1.BackupRecordsResponse], error) {
	total, list, err := recordService().SearchRecordsByCronjobWithPage(agentdto.RecordSearchByCronjob{
		PageInfo:  pageInfo(req.Msg.GetPage(), req.Msg.GetPageSize()),
		CronjobID: uint(req.Msg.GetCronjobId()),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.BackupRecordsResponse{
		Items: fromBackupRecords(list),
		Total: total,
	}), nil
}

// LoadRecordSize 统计备份记录大小。
func (s *BackupServer) LoadRecordSize(
	_ context.Context,
	req *connect.Request[agentv1.LoadRecordSizeRequest],
) (*connect.Response[agentv1.LoadRecordSizeResponse], error) {
	list, err := recordService().LoadRecordSize(agentdto.SearchForSize{
		PageInfo:   pageInfo(req.Msg.GetPage(), req.Msg.GetPageSize()),
		Type:       req.Msg.GetType(),
		Name:       req.Msg.GetName(),
		DetailName: req.Msg.GetDetailName(),
		Info:       req.Msg.GetInfo(),
		CronjobID:  uint(req.Msg.GetCronjobId()),
		OrderBy:    req.Msg.GetOrderBy(),
		Order:      req.Msg.GetOrder(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.RecordFileSize, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.RecordFileSize{
			Id:   uint32(item.ID),
			Name: item.Name,
			Size: item.Size,
		})
	}
	return connect.NewResponse(&agentv1.LoadRecordSizeResponse{Items: items}), nil
}

// DownloadBackupRecord 获取备份记录的本地下载路径。
func (s *BackupServer) DownloadBackupRecord(
	_ context.Context,
	req *connect.Request[agentv1.DownloadBackupRecordRequest],
) (*connect.Response[agentv1.DownloadBackupRecordResponse], error) {
	filePath, err := recordService().DownloadRecord(agentdto.DownloadRecord{
		DownloadAccountID: uint(req.Msg.GetDownloadAccountId()),
		FileDir:           req.Msg.GetFileDir(),
		FileName:          req.Msg.GetFileName(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DownloadBackupRecordResponse{Path: filePath}), nil
}

// UpdateRecordDescription 更新备份记录描述。
func (s *BackupServer) UpdateRecordDescription(
	_ context.Context,
	req *connect.Request[agentv1.UpdateRecordDescriptionRequest],
) (*connect.Response[agentv1.UpdateRecordDescriptionResponse], error) {
	if err := recordService().UpdateDescription(agentdto.UpdateDescription{
		ID:          uint(req.Msg.GetId()),
		Description: req.Msg.GetDescription(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateRecordDescriptionResponse{}), nil
}

// DeleteBackupRecords 批量删除备份记录。
func (s *BackupServer) DeleteBackupRecords(
	_ context.Context,
	req *connect.Request[agentv1.DeleteBackupRecordsRequest],
) (*connect.Response[agentv1.DeleteBackupRecordsResponse], error) {
	ids := make([]uint, 0, len(req.Msg.GetIds()))
	for _, id := range req.Msg.GetIds() {
		ids = append(ids, uint(id))
	}
	if err := recordService().BatchDeleteRecord(ids); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DeleteBackupRecordsResponse{}), nil
}

// ListBackupFiles 列出备份账号里的文件。
func (s *BackupServer) ListBackupFiles(
	_ context.Context,
	req *connect.Request[agentv1.ListBackupFilesRequest],
) (*connect.Response[agentv1.ListBackupFilesResponse], error) {
	files := recordService().ListFiles(agentdto.OperateByID{ID: uint(req.Msg.GetId())})
	if files == nil {
		files = []string{}
	}
	return connect.NewResponse(&agentv1.ListBackupFilesResponse{Files: files}), nil
}

// BackupData 执行数据备份。
func (s *BackupServer) BackupData(
	_ context.Context,
	req *connect.Request[agentv1.BackupDataRequest],
) (*connect.Response[agentv1.BackupDataResponse], error) {
	data := fromCommonBackup(req.Msg)
	var record any
	var err error
	switch data.Type {
	case "app":
		record, err = s.service.AppBackup(data)
	case "mysql", "mariadb", constant.AppMysqlCluster:
		err = s.service.MysqlBackup(data)
	case "mongodb":
		err = s.service.MongodbBackup(data)
	case constant.AppPostgresql, constant.AppPostgresqlCluster:
		err = s.service.PostgresqlBackup(data)
	case "website":
		err = s.service.WebsiteBackup(data)
	case "redis", constant.AppRedisCluster:
		err = s.service.RedisBackup(data)
	case "container":
		err = s.service.ContainerBackup(data)
	case "compose":
		err = s.service.ComposeBackup(data)
	}
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.BackupDataResponse{RecordJson: marshalJSON(record)}), nil
}

// RecoverData 从备份账号恢复数据。
func (s *BackupServer) RecoverData(
	_ context.Context,
	req *connect.Request[agentv1.RecoverDataRequest],
) (*connect.Response[agentv1.RecoverDataResponse], error) {
	data := fromCommonRecover(req.Msg)
	downloadPath, err := recordService().DownloadRecord(agentdto.DownloadRecord{
		DownloadAccountID: data.DownloadAccountID,
		FileDir:           path.Dir(data.File),
		FileName:          path.Base(data.File),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	data.File = downloadPath
	if err := s.recover(data); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.RecoverDataResponse{}), nil
}

// RecoverByUpload 从本机上传的备份文件恢复数据。
func (s *BackupServer) RecoverByUpload(
	_ context.Context,
	req *connect.Request[agentv1.RecoverDataRequest],
) (*connect.Response[agentv1.RecoverDataResponse], error) {
	data := fromCommonRecover(req.Msg)
	var err error
	switch data.Type {
	case "mysql", "mariadb", constant.AppMysqlCluster:
		err = s.service.MysqlRecoverByUpload(data)
	case "mongodb":
		err = s.service.MongodbRecoverByUpload(data)
	case constant.AppPostgresql, constant.AppPostgresqlCluster:
		err = s.service.PostgresqlRecoverByUpload(data)
	default:
		err = s.recover(data)
	}
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.RecoverDataResponse{}), nil
}

// recover 按备份类型分发恢复逻辑。
func (s *BackupServer) recover(data agentdto.CommonRecover) error {
	switch data.Type {
	case "mysql", "mariadb", constant.AppMysqlCluster:
		return s.service.MysqlRecover(data)
	case "mongodb":
		return s.service.MongodbRecover(data)
	case constant.AppPostgresql, constant.AppPostgresqlCluster:
		return s.service.PostgresqlRecover(data)
	case "website":
		return s.service.WebsiteRecover(data)
	case "redis", constant.AppRedisCluster:
		return s.service.RedisRecover(data)
	case "app":
		return s.service.AppRecover(data)
	case "container":
		return s.service.ContainerRecover(data)
	case "compose":
		return s.service.ComposeRecover(data)
	}
	return nil
}

// recordService 返回备份记录服务。
func recordService() agentservice.IBackupRecordService {
	return agentservice.NewIBackupRecordService()
}

// pageInfo 构造分页参数。
func pageInfo(page, pageSize int32) agentdto.PageInfo {
	return agentdto.PageInfo{Page: int(page), PageSize: int(pageSize)}
}

// fromBackupOperate 把 proto 账号参数转成 DTO。
func fromBackupOperate(msg *agentv1.BackupOperate) agentdto.BackupOperate {
	return agentdto.BackupOperate{
		ID:           uint(msg.GetId()),
		Name:         msg.GetName(),
		Type:         msg.GetType(),
		IsPublic:     msg.GetIsPublic(),
		Bucket:       msg.GetBucket(),
		AccessKey:    msg.GetAccessKey(),
		Credential:   msg.GetCredential(),
		BackupPath:   msg.GetBackupPath(),
		Vars:         msg.GetVars(),
		RememberAuth: msg.GetRememberAuth(),
	}
}

// fromCommonBackup 把 proto 备份参数转成 DTO。
func fromCommonBackup(msg *agentv1.BackupDataRequest) agentdto.CommonBackup {
	return agentdto.CommonBackup{
		Type:        msg.GetType(),
		Name:        msg.GetName(),
		DetailName:  msg.GetDetailName(),
		Secret:      msg.GetSecret(),
		IsImmediate: msg.GetIsImmediate(),
		StopBefore:  msg.GetStopBefore(),
		TaskID:      msg.GetTaskId(),
		FileName:    msg.GetFileName(),
		Args:        msg.GetArgs(),
		Description: msg.GetDescription(),
	}
}

// fromCommonRecover 把 proto 恢复参数转成 DTO。
func fromCommonRecover(msg *agentv1.RecoverDataRequest) agentdto.CommonRecover {
	return agentdto.CommonRecover{
		DownloadAccountID:  uint(msg.GetDownloadAccountId()),
		Type:               msg.GetType(),
		Name:               msg.GetName(),
		DetailName:         msg.GetDetailName(),
		File:               msg.GetFile(),
		Secret:             msg.GetSecret(),
		DropAllCollections: msg.GetDropAllCollections(),
		TaskID:             msg.GetTaskId(),
		BackupRecordID:     uint(msg.GetBackupRecordId()),
		Timeout:            int(msg.GetTimeout()),
	}
}

// fromBackupRecords 把备份记录转成 proto。
func fromBackupRecords(list []agentdto.BackupRecords) []*agentv1.BackupRecordEntry {
	items := make([]*agentv1.BackupRecordEntry, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.BackupRecordEntry{
			Id:                uint32(item.ID),
			CreatedAt:         formatTime(item.CreatedAt),
			AccountType:       item.AccountType,
			AccountName:       item.AccountName,
			DownloadAccountId: uint32(item.DownloadAccountID),
			FileDir:           item.FileDir,
			FileName:          item.FileName,
			TaskId:            item.TaskID,
			Status:            item.Status,
			Message:           item.Message,
			Description:       item.Description,
		})
	}
	return items
}
