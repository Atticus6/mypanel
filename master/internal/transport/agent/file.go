package agent

import (
	"context"

	agentdto "mypanel/agent/app/dto"
	"time"

	"connectrpc.com/connect"

	"mypanel/agent/app/dto/request"
	"mypanel/agent/app/dto/response"
	agentservice "mypanel/agent/app/service"
	"mypanel/agent/global"
	"mypanel/agent/utils/files"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/errmap"
)

// FileServer 实现 panel.agent.v1.FileService。
type FileServer struct {
	service *agentservice.FileService
}

// NewFileServer 构造文件管理服务。
func NewFileServer() *FileServer {
	return &FileServer{service: &agentservice.FileService{}}
}

// AddFavorite 添加收藏。
func (s *FileServer) AddFavorite(
	_ context.Context,
	req *connect.Request[agentv1.AddFavoriteRequest],
) (*connect.Response[agentv1.AddFavoriteResponse], error) {
	if _, err := agentservice.NewIFavoriteService().Create(request.FavoriteCreate{Path: req.Msg.GetPath()}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.AddFavoriteResponse{}), nil
}

// DeleteFavorite 删除收藏。
func (s *FileServer) DeleteFavorite(
	_ context.Context,
	req *connect.Request[agentv1.DeleteFavoriteRequest],
) (*connect.Response[agentv1.DeleteFavoriteResponse], error) {
	if err := agentservice.NewIFavoriteService().Delete(uint(req.Msg.GetId())); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DeleteFavoriteResponse{}), nil
}

// SearchHistory 分页查询文件历史版本。
func (s *FileServer) SearchHistory(
	_ context.Context,
	req *connect.Request[agentv1.SearchFileHistoryRequest],
) (*connect.Response[agentv1.SearchFileHistoryResponse], error) {
	total, list, err := agentservice.NewIFileHistoryService().Search(request.FileHistorySearchReq{
		PageInfo: agentdto.PageInfo{
			Page:     int(req.Msg.GetPage()),
			PageSize: int(req.Msg.GetPageSize()),
		},
		Path:      req.Msg.GetPath(),
		Scope:     req.Msg.GetScope(),
		Operation: req.Msg.GetOperation(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.FileHistoryEntry, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.FileHistoryEntry{
			Id:          uint32(item.ID),
			FileId:      item.FileID,
			Path:        item.Path,
			CurrentPath: item.CurrentPath,
			FileName:    item.FileName,
			Extension:   item.Extension,
			Operation:   item.Operation,
			Deleted:     item.Deleted,
			ContentSize: item.ContentSize,
			CreatedAt:   formatTime(item.CreatedAt),
			UpdatedAt:   formatTime(item.UpdatedAt),
		})
	}
	return connect.NewResponse(&agentv1.SearchFileHistoryResponse{Items: items, Total: total}), nil
}

// SearchFavorites 分页查询收藏夹。
func (s *FileServer) SearchFavorites(
	_ context.Context,
	req *connect.Request[agentv1.SearchFavoritesRequest],
) (*connect.Response[agentv1.SearchFavoritesResponse], error) {
	total, list, err := agentservice.NewIFavoriteService().Page(agentdto.PageInfo{
		Page:     int(req.Msg.GetPage()),
		PageSize: int(req.Msg.GetPageSize()),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.FavoriteEntry, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.FavoriteEntry{
			Id:    uint32(item.ID),
			Name:  item.Name,
			Path:  item.Path,
			Type:  item.Type,
			IsDir: item.IsDir,
			IsTxt: item.IsTxt,
		})
	}
	return connect.NewResponse(&agentv1.SearchFavoritesResponse{Items: items, Total: total}), nil
}

// RestoreRecycle 从回收站还原文件。
func (s *FileServer) RestoreRecycle(
	_ context.Context,
	req *connect.Request[agentv1.RestoreRecycleRequest],
) (*connect.Response[agentv1.RestoreRecycleResponse], error) {
	if err := agentservice.NewIRecycleBinService().Reduce(request.RecycleBinReduce{
		From:  req.Msg.GetFrom(),
		RName: req.Msg.GetRName(),
		Name:  req.Msg.GetName(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.RestoreRecycleResponse{}), nil
}

// SearchRecycle 分页查询回收站。
func (s *FileServer) SearchRecycle(
	_ context.Context,
	req *connect.Request[agentv1.SearchRecycleRequest],
) (*connect.Response[agentv1.SearchRecycleResponse], error) {
	total, list, err := agentservice.NewIRecycleBinService().Page(agentdto.PageInfo{
		Page:     int(req.Msg.GetPage()),
		PageSize: int(req.Msg.GetPageSize()),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.RecycleEntry, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.RecycleEntry{
			Name:       item.Name,
			Size:       int64(item.Size),
			Type:       item.Type,
			DeleteTime: formatTime(item.DeleteTime),
			RName:      item.RName,
			SourcePath: item.SourcePath,
			IsDir:      item.IsDir,
			From:       item.From,
		})
	}
	return connect.NewResponse(&agentv1.SearchRecycleResponse{Items: items, Total: total}), nil
}

// ChangeMode 修改文件或目录权限。
func (s *FileServer) ChangeMode(
	_ context.Context,
	req *connect.Request[agentv1.ChangeFileModeRequest],
) (*connect.Response[agentv1.ChangeFileModeResponse], error) {
	if err := s.service.ChangeMode(request.FileCreate{
		Path: req.Msg.GetPath(),
		Mode: req.Msg.GetMode(),
		Sub:  req.Msg.GetSub(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ChangeFileModeResponse{}), nil
}

// Compress 异步压缩文件或目录。
func (s *FileServer) Compress(
	_ context.Context,
	req *connect.Request[agentv1.CompressFilesRequest],
) (*connect.Response[agentv1.CompressFilesResponse], error) {
	if err := s.service.Compress(request.FileCompress{
		Files:   req.Msg.GetFiles(),
		Dst:     req.Msg.GetDst(),
		Type:    req.Msg.GetType(),
		Name:    req.Msg.GetName(),
		Replace: req.Msg.GetReplace(),
		Secret:  req.Msg.GetSecret(),
		TaskID:  req.Msg.GetTaskId(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CompressFilesResponse{TaskId: req.Msg.GetTaskId()}), nil
}

// Delete 删除文件或目录。
func (s *FileServer) Delete(
	_ context.Context,
	req *connect.Request[agentv1.DeleteFilesRequest],
) (*connect.Response[agentv1.DeleteFilesResponse], error) {
	if err := s.service.Delete(request.FileDelete{
		Path:        req.Msg.GetPath(),
		IsDir:       req.Msg.GetIsDir(),
		ForceDelete: req.Msg.GetForceDelete(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DeleteFilesResponse{}), nil
}

// ChangeName 重命名文件或目录。
func (s *FileServer) ChangeName(
	_ context.Context,
	req *connect.Request[agentv1.ChangeFileNameRequest],
) (*connect.Response[agentv1.ChangeFileNameResponse], error) {
	if err := s.service.ChangeName(request.FileRename{
		OldName: req.Msg.GetOldName(),
		NewName: req.Msg.GetNewName(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ChangeFileNameResponse{}), nil
}

// DeCompress 异步解压文件。
func (s *FileServer) DeCompress(
	_ context.Context,
	req *connect.Request[agentv1.DecompressFilesRequest],
) (*connect.Response[agentv1.DecompressFilesResponse], error) {
	if err := s.service.DeCompress(request.FileDeCompress{
		Path:   req.Msg.GetPath(),
		Dst:    req.Msg.GetDst(),
		Type:   req.Msg.GetType(),
		Secret: req.Msg.GetSecret(),
		TaskID: req.Msg.GetTaskId(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DecompressFilesResponse{TaskId: req.Msg.GetTaskId()}), nil
}

// ListFiles 列出目录内容或按关键字搜索。
func (s *FileServer) ListFiles(
	_ context.Context,
	req *connect.Request[agentv1.ListFilesRequest],
) (*connect.Response[agentv1.FileList], error) {
	option := files.FileOption{
		Path:       req.Msg.GetPath(),
		Search:     req.Msg.GetSearch(),
		ContainSub: req.Msg.GetContainSub(),
		// 1Panel 只在 Expand 时才枚举子项；列目录必须打开，否则 items 永远为空。
		Expand:     true,
		Dir:        req.Msg.GetDir(),
		ShowHidden: req.Msg.GetShowHidden(),
		Page:       0,
		PageSize:   0,
		SortBy:     req.Msg.GetSortBy(),
		SortOrder:  req.Msg.GetSortOrder(),
		IsDetail:   req.Msg.GetIsDetail(),
	}
	// 1Panel 的分页是 1 基；Page=0 会退化成「全部返回」，所以有值就原样传入。
	if req.Msg.GetPage() > 0 {
		option.Page = int(req.Msg.GetPage())
	}
	if req.Msg.GetPageSize() > 0 {
		option.PageSize = int(req.Msg.GetPageSize())
	}

	info, err := s.service.GetFileList(request.FileOption{FileOption: option})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}

	items := make([]*agentv1.FileEntry, 0, len(info.Items))
	for _, item := range info.Items {
		items = append(items, fromFileInfo(item))
	}
	return connect.NewResponse(&agentv1.FileList{
		Path:         info.Path,
		Name:         info.Name,
		ItemTotal:    int32(info.ItemTotal),
		Items:        items,
		IsAppendOnly: info.IsAppendOnly,
		IsImmutable:  info.IsImmutable,
	}), nil
}

// GetFile 查询单个文件或目录详情。
func (s *FileServer) GetFile(
	_ context.Context,
	req *connect.Request[agentv1.GetFileRequest],
) (*connect.Response[agentv1.FileEntry], error) {
	// 文件详情走内容接口：GetFileList 会把文件路径改成所在目录，
	// 那样返回的就不是用户点开的那个文件。
	info, err := s.service.GetContent(request.FileContentReq{
		Path:     req.Msg.GetPath(),
		IsDetail: true,
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrRecordNotFound", err)
	}
	if info.Name == "" {
		return nil, errmap.FromMsgKey("ErrRecordNotFound", nil)
	}
	return connect.NewResponse(fromFileInfo(&info.FileInfo)), nil
}

// fromFileInfo 把 1Panel 的文件信息转成 proto。
func fromFileInfo(info *files.FileInfo) *agentv1.FileEntry {
	if info == nil {
		return &agentv1.FileEntry{}
	}
	items := make([]*agentv1.FileEntry, 0, len(info.Items))
	for _, child := range info.Items {
		items = append(items, fromFileInfo(child))
	}
	return &agentv1.FileEntry{
		Path:         info.Path,
		Name:         info.Name,
		User:         info.User,
		Group:        info.Group,
		Uid:          info.Uid,
		Gid:          info.Gid,
		Extension:    info.Extension,
		Content:      info.Content,
		Size:         info.Size,
		IsDir:        info.IsDir,
		IsSymlink:    info.IsSymlink,
		IsHidden:     info.IsHidden,
		LinkPath:     info.LinkPath,
		Type:         info.Type,
		Mode:         info.Mode,
		MimeType:     info.MimeType,
		UpdateTime:   formatFileTime(info.UpdateTime),
		ModTime:      formatFileTime(info.ModTime),
		Items:        items,
		FavoriteId:   uint32(info.FavoriteID),
		ShareCode:    info.ShareCode,
		IsAppendOnly: info.IsAppendOnly,
		IsImmutable:  info.IsImmutable,
	}
}

// formatFileTime 输出 RFC3339；零值保持为空。
func formatFileTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.Format(time.RFC3339)
}

// CreateFile 新建文件、目录或符号链接。
func (s *FileServer) CreateFile(
	_ context.Context,
	req *connect.Request[agentv1.CreateFileRequest],
) (*connect.Response[agentv1.CreateFileResponse], error) {
	if err := s.service.Create(request.FileCreate{
		Path:      req.Msg.GetPath(),
		Content:   req.Msg.GetContent(),
		IsDir:     req.Msg.GetIsDir(),
		Mode:      req.Msg.GetMode(),
		IsLink:    req.Msg.GetIsLink(),
		IsSymlink: req.Msg.GetIsSymlink(),
		LinkPath:  req.Msg.GetLinkPath(),
		Sub:       req.Msg.GetSub(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CreateFileResponse{}), nil
}

// CheckFile 检查路径是否存在，可选择自动初始化目录。
func (s *FileServer) CheckFile(
	_ context.Context,
	req *connect.Request[agentv1.CheckFileRequest],
) (*connect.Response[agentv1.CheckFileResponse], error) {
	fileOp := files.NewFileOp()
	exists := fileOp.Stat(req.Msg.GetPath())
	if !exists && req.Msg.GetWithInit() {
		// 与 1Panel 一致：初始化目录用 0644，失败按「不存在」返回而不是报错。
		if err := fileOp.CreateDir(req.Msg.GetPath(), 0644); err != nil {
			return connect.NewResponse(&agentv1.CheckFileResponse{Exists: false}), nil
		}
		exists = true
	}
	return connect.NewResponse(&agentv1.CheckFileResponse{Exists: exists}), nil
}

// BatchCheckFiles 批量检查路径是否存在。
func (s *FileServer) BatchCheckFiles(
	_ context.Context,
	req *connect.Request[agentv1.BatchCheckFilesRequest],
) (*connect.Response[agentv1.BatchCheckFilesResponse], error) {
	list := s.service.BatchCheckFiles(request.FilePathsCheck{Paths: req.Msg.GetPaths()})
	items := make([]*agentv1.ExistFileInfo, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.ExistFileInfo{
			Name:    item.Name,
			Path:    item.Path,
			Size:    item.Size,
			ModTime: formatFileTime(item.ModTime),
			IsDir:   item.IsDir,
		})
	}
	return connect.NewResponse(&agentv1.BatchCheckFilesResponse{Items: items}), nil
}

// BatchDeleteFiles 批量删除文件或目录。
func (s *FileServer) BatchDeleteFiles(
	_ context.Context,
	req *connect.Request[agentv1.BatchDeleteFilesRequest],
) (*connect.Response[agentv1.BatchDeleteFilesResponse], error) {
	if err := s.service.BatchDelete(request.FileBatchDelete{
		Paths: req.Msg.GetPaths(),
		IsDir: req.Msg.GetIsDir(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.BatchDeleteFilesResponse{}), nil
}

// BatchChangeRole 批量修改权限与所属用户/组。
func (s *FileServer) BatchChangeRole(
	_ context.Context,
	req *connect.Request[agentv1.BatchChangeRoleRequest],
) (*connect.Response[agentv1.BatchChangeRoleResponse], error) {
	if err := s.service.BatchChangeModeAndOwner(request.FileRoleReq{
		Paths: req.Msg.GetPaths(),
		Mode:  req.Msg.GetMode(),
		User:  req.Msg.GetUser(),
		Group: req.Msg.GetGroup(),
		Sub:   req.Msg.GetSub(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.BatchChangeRoleResponse{}), nil
}

// ChangeOwner 修改文件或目录的所有者。
func (s *FileServer) ChangeOwner(
	_ context.Context,
	req *connect.Request[agentv1.ChangeOwnerRequest],
) (*connect.Response[agentv1.ChangeOwnerResponse], error) {
	if err := s.service.ChangeOwner(request.FileRoleUpdate{
		Path:  req.Msg.GetPath(),
		User:  req.Msg.GetUser(),
		Group: req.Msg.GetGroup(),
		Sub:   req.Msg.GetSub(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ChangeOwnerResponse{}), nil
}

// StopCompress 停止压缩任务。
func (s *FileServer) StopCompress(
	_ context.Context,
	req *connect.Request[agentv1.StopCompressRequest],
) (*connect.Response[agentv1.StopCompressResponse], error) {
	if err := s.service.StopCompress(req.Msg.GetTaskId()); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.StopCompressResponse{}), nil
}

// StopDecompress 停止解压任务。
func (s *FileServer) StopDecompress(
	_ context.Context,
	req *connect.Request[agentv1.StopDecompressRequest],
) (*connect.Response[agentv1.StopDecompressResponse], error) {
	if err := s.service.StopDeCompress(req.Msg.GetTaskId()); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.StopDecompressResponse{}), nil
}

// MoveFiles 移动或复制文件与目录。
func (s *FileServer) MoveFiles(
	_ context.Context,
	req *connect.Request[agentv1.MoveFilesRequest],
) (*connect.Response[agentv1.MoveFilesResponse], error) {
	if err := s.service.MvFile(request.FileMove{
		Type:       req.Msg.GetType(),
		OldPaths:   req.Msg.GetOldPaths(),
		NewPath:    req.Msg.GetNewPath(),
		Name:       req.Msg.GetName(),
		Cover:      req.Msg.GetCover(),
		CoverPaths: req.Msg.GetCoverPaths(),
		TaskID:     req.Msg.GetTaskId(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.MoveFilesResponse{TaskId: req.Msg.GetTaskId()}), nil
}

// StopMove 停止移动任务。
func (s *FileServer) StopMove(
	_ context.Context,
	req *connect.Request[agentv1.StopMoveRequest],
) (*connect.Response[agentv1.StopMoveResponse], error) {
	if err := s.service.StopMvFile(req.Msg.GetTaskId()); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.StopMoveResponse{}), nil
}

// GetSize 统计目录占用的总大小。
func (s *FileServer) GetSize(
	_ context.Context,
	req *connect.Request[agentv1.GetSizeRequest],
) (*connect.Response[agentv1.GetSizeResponse], error) {
	res, err := s.service.DirSize(request.DirSizeReq{Path: req.Msg.GetPath()})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.GetSizeResponse{Size: res.Size}), nil
}

// GetDepthSize 按一级子项统计目录占用大小。
func (s *FileServer) GetDepthSize(
	_ context.Context,
	req *connect.Request[agentv1.GetDepthSizeRequest],
) (*connect.Response[agentv1.GetDepthSizeResponse], error) {
	list, err := s.service.DepthDirSize(request.DirSizeReq{Path: req.Msg.GetPath()})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.DepthSize, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.DepthSize{Path: item.Path, Size: item.Size})
	}
	return connect.NewResponse(&agentv1.GetDepthSizeResponse{Items: items}), nil
}

// GetFileTree 获取目录树。
func (s *FileServer) GetFileTree(
	_ context.Context,
	req *connect.Request[agentv1.GetFileTreeRequest],
) (*connect.Response[agentv1.FileTreeResponse], error) {
	// 目录树必须展开子项，否则只有根节点、children 永远为空；
	// 同时分页必须是 1 基，Page/PageSize 为 0 时 listChildren 会切出空数组。
	list, err := s.service.GetFileTree(request.FileOption{FileOption: files.FileOption{
		Path:       req.Msg.GetPath(),
		Search:     req.Msg.GetSearch(),
		ContainSub: req.Msg.GetContainSub(),
		Expand:     true,
		Dir:        req.Msg.GetDir(),
		ShowHidden: req.Msg.GetShowHidden(),
		Page:       1,
		PageSize:   1000,
		SortBy:     req.Msg.GetSortBy(),
		SortOrder:  req.Msg.GetSortOrder(),
	}})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.FileTreeNode, 0, len(list))
	for i := range list {
		items = append(items, fromFileTree(&list[i]))
	}
	return connect.NewResponse(&agentv1.FileTreeResponse{Items: items}), nil
}

// SearchUpload 分页列出目录下已上传的文件。
func (s *FileServer) SearchUpload(
	_ context.Context,
	req *connect.Request[agentv1.SearchUploadRequest],
) (*connect.Response[agentv1.SearchUploadResponse], error) {
	total, data, err := s.service.SearchUploadWithPage(request.SearchUploadWithPage{
		PageInfo: agentdto.PageInfo{Page: int(req.Msg.GetPage()), PageSize: int(req.Msg.GetPageSize())},
		Path:     req.Msg.GetPath(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.UploadEntry, 0)
	if uploads, ok := data.([]response.UploadInfo); ok {
		for _, item := range uploads {
			items = append(items, &agentv1.UploadEntry{
				Name:      item.Name,
				Size:      int64(item.Size),
				CreatedAt: item.CreatedAt,
			})
		}
	}
	return connect.NewResponse(&agentv1.SearchUploadResponse{Items: items, Total: total}), nil
}

// GetUsersAndGroups 列出可选的系统用户与用户组。
func (s *FileServer) GetUsersAndGroups(
	_ context.Context,
	_ *connect.Request[agentv1.GetUsersAndGroupsRequest],
) (*connect.Response[agentv1.GetUsersAndGroupsResponse], error) {
	res, err := s.service.GetUsersAndGroups()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	users := make([]*agentv1.SystemUser, 0, len(res.Users))
	for _, item := range res.Users {
		users = append(users, &agentv1.SystemUser{Username: item.Username, Group: item.Group})
	}
	return connect.NewResponse(&agentv1.GetUsersAndGroupsResponse{
		Users:  users,
		Groups: res.Groups,
	}), nil
}

// GetRemarks 批量读取文件备注。
func (s *FileServer) GetRemarks(
	_ context.Context,
	req *connect.Request[agentv1.GetRemarksRequest],
) (*connect.Response[agentv1.GetRemarksResponse], error) {
	remarks := s.service.BatchGetRemarks(request.FileRemarkBatch{Paths: req.Msg.GetPaths()})
	return connect.NewResponse(&agentv1.GetRemarksResponse{Remarks: remarks}), nil
}

// SetRemark 设置或清除文件备注。
func (s *FileServer) SetRemark(
	_ context.Context,
	req *connect.Request[agentv1.SetRemarkRequest],
) (*connect.Response[agentv1.SetRemarkResponse], error) {
	if err := s.service.SetRemark(request.FileRemarkUpdate{
		Path:   req.Msg.GetPath(),
		Remark: req.Msg.GetRemark(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.SetRemarkResponse{}), nil
}

// PreviewFile 读取文件预览内容。
func (s *FileServer) PreviewFile(
	_ context.Context,
	req *connect.Request[agentv1.PreviewFileRequest],
) (*connect.Response[agentv1.FileEntry], error) {
	info, err := s.service.GetPreviewContent(request.FileContentReq{
		Path:     req.Msg.GetPath(),
		IsDetail: req.Msg.GetIsDetail(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrRecordNotFound", err)
	}
	return connect.NewResponse(fromFileInfo(&info.FileInfo)), nil
}

// SaveFile 保存文件内容。
func (s *FileServer) SaveFile(
	_ context.Context,
	req *connect.Request[agentv1.SaveFileRequest],
) (*connect.Response[agentv1.SaveFileResponse], error) {
	if err := s.service.SaveContent(request.FileEdit{
		Path:    req.Msg.GetPath(),
		Content: req.Msg.GetContent(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.SaveFileResponse{}), nil
}

// ReadFileLines 按行读取日志类文件。
func (s *FileServer) ReadFileLines(
	_ context.Context,
	req *connect.Request[agentv1.ReadFileLinesRequest],
) (*connect.Response[agentv1.ReadFileLinesResponse], error) {
	res, err := s.service.ReadLogByLine(request.FileReadByLineReq{
		Page:     int(req.Msg.GetPage()),
		PageSize: int(req.Msg.GetPageSize()),
		Type:     req.Msg.GetType(),
		ID:       uint(req.Msg.GetId()),
		Name:     req.Msg.GetName(),
		Latest:   req.Msg.GetLatest(),
		TaskReq: request.TaskReq{
			TaskID:      req.Msg.GetTaskId(),
			TaskType:    req.Msg.GetTaskType(),
			TaskOperate: req.Msg.GetTaskOperate(),
			ResourceID:  uint(req.Msg.GetResourceId()),
		},
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ReadFileLinesResponse{
		End:        res.End,
		Path:       res.Path,
		Total:      int32(res.Total),
		TaskStatus: res.TaskStatus,
		Lines:      res.Lines,
		Scope:      res.Scope,
		TotalLines: int32(res.TotalLines),
	}), nil
}

// ListMounts 列出系统挂载点。
func (s *FileServer) ListMounts(
	_ context.Context,
	_ *connect.Request[agentv1.ListMountsRequest],
) (*connect.Response[agentv1.ListMountsResponse], error) {
	disks := s.service.GetHostMount()
	items := make([]*agentv1.MountInfo, 0, len(disks))
	for _, disk := range disks {
		items = append(items, &agentv1.MountInfo{
			Path:              disk.Path,
			Type:              disk.Type,
			Device:            disk.Device,
			Total:             disk.Total,
			Free:              disk.Free,
			Used:              disk.Used,
			UsedPercent:       disk.UsedPercent,
			InodesTotal:       disk.InodesTotal,
			InodesUsed:        disk.InodesUsed,
			InodesFree:        disk.InodesFree,
			InodesUsedPercent: disk.InodesUsedPercent,
		})
	}
	return connect.NewResponse(&agentv1.ListMountsResponse{Items: items}), nil
}

// ClearRecycle 清空回收站。
func (s *FileServer) ClearRecycle(
	_ context.Context,
	_ *connect.Request[agentv1.ClearRecycleRequest],
) (*connect.Response[agentv1.ClearRecycleResponse], error) {
	if err := agentservice.NewIRecycleBinService().Clear(); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ClearRecycleResponse{}), nil
}

// GetRecycleStatus 查询回收站开关状态。
func (s *FileServer) GetRecycleStatus(
	_ context.Context,
	_ *connect.Request[agentv1.GetRecycleStatusRequest],
) (*connect.Response[agentv1.GetRecycleStatusResponse], error) {
	info, err := agentservice.NewISettingService().GetSettingInfo()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.GetRecycleStatusResponse{Status: info.FileRecycleBin}), nil
}

// GetHistoryContent 读取文件历史版本内容。
func (s *FileServer) GetHistoryContent(
	_ context.Context,
	req *connect.Request[agentv1.GetHistoryContentRequest],
) (*connect.Response[agentv1.GetHistoryContentResponse], error) {
	item, err := agentservice.NewIFileHistoryService().GetContent(request.FileHistoryContentReq{
		ID: uint(req.Msg.GetId()),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.GetHistoryContentResponse{
		Id:             uint32(item.ID),
		FileId:         item.FileID,
		Path:           item.Path,
		CurrentPath:    item.CurrentPath,
		PreviousId:     uint32(item.PreviousID),
		SourcePath:     item.SourcePath,
		TargetPath:     item.TargetPath,
		FileName:       item.FileName,
		Extension:      item.Extension,
		FileMode:       item.FileMode,
		Operation:      item.Operation,
		Deleted:        item.Deleted,
		ContentSize:    item.ContentSize,
		ContentSha:     item.ContentSHA,
		Content:        item.Content,
		CurrentContent: item.CurrentContent,
		CreatedAt:      formatFileTime(item.CreatedAt),
		UpdatedAt:      formatFileTime(item.UpdatedAt),
	}), nil
}

// DeleteHistory 删除文件历史版本记录。
func (s *FileServer) DeleteHistory(
	_ context.Context,
	req *connect.Request[agentv1.DeleteHistoryRequest],
) (*connect.Response[agentv1.DeleteHistoryResponse], error) {
	ids := make(request.FileHistoryIDs, 0, len(req.Msg.GetIds()))
	for _, id := range req.Msg.GetIds() {
		ids = append(ids, uint(id))
	}
	if err := agentservice.NewIFileHistoryService().Delete(request.FileHistoryDeleteReq{IDs: ids}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DeleteHistoryResponse{}), nil
}

// RestoreHistory 还原文件历史版本。
func (s *FileServer) RestoreHistory(
	_ context.Context,
	req *connect.Request[agentv1.RestoreHistoryRequest],
) (*connect.Response[agentv1.FileEntry], error) {
	info, err := agentservice.NewIFileHistoryService().Restore(request.FileHistoryRestoreReq{
		ID: uint(req.Msg.GetId()),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(fromFileInfo(&info.FileInfo)), nil
}

// ConvertFiles 触发文件格式转换任务。
func (s *FileServer) ConvertFiles(
	_ context.Context,
	req *connect.Request[agentv1.ConvertFilesRequest],
) (*connect.Response[agentv1.ConvertFilesResponse], error) {
	list := make([]request.FileConvert, 0, len(req.Msg.GetFiles()))
	for _, item := range req.Msg.GetFiles() {
		list = append(list, request.FileConvert{
			Path:         item.GetPath(),
			Type:         item.GetType(),
			InputFile:    item.GetInputFile(),
			Extension:    item.GetExtension(),
			OutputFormat: item.GetOutputFormat(),
			Status:       item.GetStatus(),
		})
	}
	// 转换是异步任务，服务层不返回错误，只能 fire-and-forget。
	s.service.Convert(request.FileConvertRequest{
		Files:        list,
		OutputPath:   req.Msg.GetOutputPath(),
		DeleteSource: req.Msg.GetDeleteSource(),
		TaskID:       req.Msg.GetTaskId(),
	})
	return connect.NewResponse(&agentv1.ConvertFilesResponse{}), nil
}

// SearchConvertLogs 分页查询文件转换日志。
func (s *FileServer) SearchConvertLogs(
	_ context.Context,
	req *connect.Request[agentv1.SearchConvertLogsRequest],
) (*connect.Response[agentv1.SearchConvertLogsResponse], error) {
	total, logs, err := s.service.ConvertLog(agentdto.PageInfo{
		Page:     int(req.Msg.GetPage()),
		PageSize: int(req.Msg.GetPageSize()),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.ConvertLogEntry, 0, len(logs))
	for _, item := range logs {
		items = append(items, &agentv1.ConvertLogEntry{
			Date:    item.Date,
			Type:    item.Type,
			Log:     item.Log,
			Status:  item.Status,
			Message: item.Message,
		})
	}
	return connect.NewResponse(&agentv1.SearchConvertLogsResponse{Items: items, Total: total}), nil
}

// CreateShare 创建文件分享链接。
func (s *FileServer) CreateShare(
	_ context.Context,
	req *connect.Request[agentv1.CreateShareRequest],
) (*connect.Response[agentv1.CreateShareResponse], error) {
	info, err := agentservice.NewIFileShareService().Create(request.FileShareCreate{
		Path:          req.Msg.GetPath(),
		ExpireMinutes: int(req.Msg.GetExpireMinutes()),
		Password:      req.Msg.Password,
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CreateShareResponse{Share: fromShareInfo(info)}), nil
}

// DeleteShare 按路径关闭文件分享。
func (s *FileServer) DeleteShare(
	_ context.Context,
	req *connect.Request[agentv1.DeleteShareRequest],
) (*connect.Response[agentv1.DeleteShareResponse], error) {
	if err := agentservice.NewIFileShareService().DeleteByPath(req.Msg.GetPath()); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DeleteShareResponse{}), nil
}

// GetShare 按路径查询文件分享详情。
func (s *FileServer) GetShare(
	_ context.Context,
	req *connect.Request[agentv1.GetShareRequest],
) (*connect.Response[agentv1.GetShareResponse], error) {
	info, err := agentservice.NewIFileShareService().GetByPath(req.Msg.GetPath())
	if err != nil {
		return nil, errmap.FromMsgKey("ErrRecordNotFound", err)
	}
	// 服务层对「没有分享」返回 (nil, nil)，这里保留空结果而不是报错。
	var share *agentv1.FileShareInfo
	if info != nil {
		share = fromShareInfo(info)
	}
	return connect.NewResponse(&agentv1.GetShareResponse{Share: share}), nil
}

// GetPublicShare 按分享码查询公开分享信息。
func (s *FileServer) GetPublicShare(
	_ context.Context,
	req *connect.Request[agentv1.GetPublicShareRequest],
) (*connect.Response[agentv1.GetPublicShareResponse], error) {
	info, err := agentservice.NewIFileShareService().GetPublicByCode(req.Msg.GetCode())
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	return connect.NewResponse(&agentv1.GetPublicShareResponse{
		FileName:    info.FileName,
		ExpiresAt:   info.ExpiresAt,
		Permanent:   info.Permanent,
		HasPassword: info.HasPassword,
	}), nil
}

// CheckShare 校验分享码与访问密码。
func (s *FileServer) CheckShare(
	_ context.Context,
	req *connect.Request[agentv1.CheckShareRequest],
) (*connect.Response[agentv1.CheckShareResponse], error) {
	if err := agentservice.NewIFileShareService().Check(req.Msg.GetCode(), req.Msg.GetPassword()); err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	return connect.NewResponse(&agentv1.CheckShareResponse{}), nil
}

// SearchShares 分页查询文件分享记录。
func (s *FileServer) SearchShares(
	_ context.Context,
	req *connect.Request[agentv1.SearchSharesRequest],
) (*connect.Response[agentv1.SearchSharesResponse], error) {
	total, list, err := agentservice.NewIFileShareService().Page(agentdto.PageInfo{
		Page:     int(req.Msg.GetPage()),
		PageSize: int(req.Msg.GetPageSize()),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.FileShareInfo, 0, len(list))
	for i := range list {
		items = append(items, fromShareInfo(&list[i]))
	}
	return connect.NewResponse(&agentv1.SearchSharesResponse{Items: items, Total: total}), nil
}

// Wget 创建远程下载任务。
func (s *FileServer) Wget(
	_ context.Context,
	req *connect.Request[agentv1.WgetRequest],
) (*connect.Response[agentv1.WgetResponse], error) {
	key, err := s.service.Wget(request.FileWget{
		Url:               req.Msg.GetUrl(),
		Path:              req.Msg.GetPath(),
		Name:              req.Msg.GetName(),
		IgnoreCertificate: req.Msg.GetIgnoreCertificate(),
		UseProxy:          req.Msg.GetUseProxy(),
		UseServerFilename: req.Msg.GetUseServerFilename(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.WgetResponse{Key: key}), nil
}

// StopWget 停止远程下载任务。
func (s *FileServer) StopWget(
	_ context.Context,
	req *connect.Request[agentv1.StopWgetRequest],
) (*connect.Response[agentv1.StopWgetResponse], error) {
	if err := files.CancelDownload(req.Msg.GetKey()); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.StopWgetResponse{}), nil
}

// GetWgetProcessKeys 列出下载任务的缓存键。
func (s *FileServer) GetWgetProcessKeys(
	_ context.Context,
	_ *connect.Request[agentv1.GetWgetProcessKeysRequest],
) (*connect.Response[agentv1.GetWgetProcessKeysResponse], error) {
	keys := make([]string, 0)
	for _, key := range global.CACHE.PrefixScanKey("file-wget-") {
		if global.CACHE.Get(key) == "" {
			continue
		}
		keys = append(keys, key)
	}
	return connect.NewResponse(&agentv1.GetWgetProcessKeysResponse{Keys: keys}), nil
}

// RemoveWgetRecords 移除已结束的下载记录，不删除文件。
func (s *FileServer) RemoveWgetRecords(
	_ context.Context,
	req *connect.Request[agentv1.RemoveWgetRecordsRequest],
) (*connect.Response[agentv1.RemoveWgetRecordsResponse], error) {
	keys, err := files.RemoveDownloadRecords(req.Msg.GetKeys())
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	return connect.NewResponse(&agentv1.RemoveWgetRecordsResponse{Keys: keys}), nil
}

// fromFileTree 递归转换目录树节点。
func fromFileTree(node *response.FileTree) *agentv1.FileTreeNode {
	if node == nil {
		return &agentv1.FileTreeNode{}
	}
	children := make([]*agentv1.FileTreeNode, 0, len(node.Children))
	for i := range node.Children {
		children = append(children, fromFileTree(&node.Children[i]))
	}
	return &agentv1.FileTreeNode{
		Id:        node.ID,
		Name:      node.Name,
		Path:      node.Path,
		IsDir:     node.IsDir,
		Extension: node.Extension,
		Children:  children,
	}
}

// fromShareInfo 把分享记录转成 proto。
func fromShareInfo(info *response.FileShareInfo) *agentv1.FileShareInfo {
	if info == nil {
		return &agentv1.FileShareInfo{}
	}
	return &agentv1.FileShareInfo{
		Code:        info.Code,
		Path:        info.Path,
		FileName:    info.FileName,
		ExpiresAt:   info.ExpiresAt,
		Permanent:   info.Permanent,
		HasPassword: info.HasPassword,
		Password:    info.Password,
	}
}
