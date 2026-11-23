package agent

import (
	"context"

	agentdto "mypanel/agent/app/dto"
	"time"

	"connectrpc.com/connect"

	"mypanel/agent/app/dto/request"
	agentservice "mypanel/agent/app/service"
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
