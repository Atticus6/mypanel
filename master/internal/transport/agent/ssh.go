package agent

import (
	"context"
	"net/http"
	"time"

	"connectrpc.com/connect"
	"github.com/gin-gonic/gin"

	agentdto "mypanel/agent/app/dto"
	agentservice "mypanel/agent/app/service"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/bridge"
	"mypanel/master/internal/transport/conv"
	"mypanel/master/internal/transport/errmap"
)

// SSHServer 实现 panel.agent.v1.SSHService。
type SSHServer struct {
	service *agentservice.SSHService
}

// NewSSHServer 构造 SSH 管理服务。
func NewSSHServer() *SSHServer {
	return &SSHServer{service: &agentservice.SSHService{}}
}

// GetInfo 读取 SSH 服务状态。
func (s *SSHServer) GetInfo(
	_ context.Context,
	_ *connect.Request[agentv1.GetSSHInfoRequest],
) (*connect.Response[agentv1.SSHInfo], error) {
	info, err := s.service.GetSSHInfo()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	msg := &agentv1.SSHInfo{}
	if err := conv.FromDTO(info, msg); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(msg), nil
}

// Operate 启停或重载 SSH 服务。
func (s *SSHServer) Operate(
	_ context.Context,
	req *connect.Request[agentv1.OperateSSHRequest],
) (*connect.Response[agentv1.OperateSSHResponse], error) {
	if err := s.service.OperateSSH(req.Msg.GetOperation()); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.OperateSSHResponse{}), nil
}

// Update 修改单个 SSH 配置项。
func (s *SSHServer) Update(
	_ context.Context,
	req *connect.Request[agentv1.UpdateSSHRequest],
) (*connect.Response[agentv1.UpdateSSHResponse], error) {
	if err := s.service.Update(agentdto.SSHUpdate{
		Key:      req.Msg.GetKey(),
		NewValue: req.Msg.GetNewValue(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateSSHResponse{}), nil
}

// LoadFile 读取 sshd 配置文件。
func (s *SSHServer) LoadFile(
	_ context.Context,
	req *connect.Request[agentv1.LoadSSHFileRequest],
) (*connect.Response[agentv1.SSHFileContent], error) {
	content, err := s.service.LoadSSHFile(req.Msg.GetName())
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.SSHFileContent{Content: content}), nil
}

// UpdateFile 按文件方式修改 SSH 配置。
func (s *SSHServer) UpdateFile(
	_ context.Context,
	req *connect.Request[agentv1.UpdateSSHFileRequest],
) (*connect.Response[agentv1.UpdateSSHFileResponse], error) {
	if err := s.service.UpdateByFile(agentdto.SSHConfUpdate{
		Key:   req.Msg.GetKey(),
		Path:  req.Msg.GetPath(),
		Value: req.Msg.GetValue(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateSSHFileResponse{}), nil
}

// CreateCert 生成主机密钥对。
func (s *SSHServer) CreateCert(
	_ context.Context,
	req *connect.Request[agentv1.CreateSSHCertRequest],
) (*connect.Response[agentv1.CreateSSHCertResponse], error) {
	if err := s.service.CreateRootCert(agentdto.RootCertOperate{
		Name:           req.Msg.GetName(),
		EncryptionMode: req.Msg.GetEncryptionMode(),
		PassPhrase:     encodeSecret(req.Msg.GetPassPhrase()),
		Description:    req.Msg.GetDescription(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CreateSSHCertResponse{}), nil
}

// UpdateCert 修改已有主机密钥。
func (s *SSHServer) UpdateCert(
	_ context.Context,
	req *connect.Request[agentv1.UpdateSSHCertRequest],
) (*connect.Response[agentv1.UpdateSSHCertResponse], error) {
	if err := s.service.EditRootCert(agentdto.RootCertOperate{
		ID:             uint(req.Msg.GetId()),
		Name:           req.Msg.GetName(),
		EncryptionMode: req.Msg.GetEncryptionMode(),
		PassPhrase:     encodeSecret(req.Msg.GetPassPhrase()),
		Description:    req.Msg.GetDescription(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateSSHCertResponse{}), nil
}

// SyncCerts 同步密钥到 authorized_keys。
func (s *SSHServer) SyncCerts(
	_ context.Context,
	_ *connect.Request[agentv1.SyncSSHCertsRequest],
) (*connect.Response[agentv1.SyncSSHCertsResponse], error) {
	if err := s.service.SyncRootCert(); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.SyncSSHCertsResponse{}), nil
}

// SearchCerts 分页查询主机密钥。
func (s *SSHServer) SearchCerts(
	_ context.Context,
	req *connect.Request[agentv1.SearchSSHCertsRequest],
) (*connect.Response[agentv1.SearchSSHCertsResponse], error) {
	total, rows, err := s.service.SearchRootCerts(agentdto.SearchWithPage{
		PageInfo: agentdto.PageInfo{Page: int(req.Msg.GetPage()), PageSize: int(req.Msg.GetPageSize())},
		Info:     req.Msg.GetInfo(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	// service 为了兼容旧前端返回 interface{}，这里做一次类型断言。
	list, ok := rows.([]agentdto.RootCert)
	if !ok && rows != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", nil)
	}
	items := make([]*agentv1.SSHCert, 0, len(list))
	for _, item := range list {
		msg := &agentv1.SSHCert{}
		if err := conv.FromDTO(item, msg); err != nil {
			return nil, errmap.FromMsgKey("ErrInternalServer", err)
		}
		items = append(items, msg)
	}
	return connect.NewResponse(&agentv1.SearchSSHCertsResponse{Items: items, Total: total}), nil
}

// DeleteCerts 删除主机密钥。
func (s *SSHServer) DeleteCerts(
	_ context.Context,
	req *connect.Request[agentv1.DeleteSSHCertsRequest],
) (*connect.Response[agentv1.DeleteSSHCertsResponse], error) {
	ids := make([]uint, 0, len(req.Msg.GetIds()))
	for _, id := range req.Msg.GetIds() {
		ids = append(ids, uint(id))
	}
	if err := s.service.DeleteRootCerts(agentdto.ForceDelete{
		IDs:         ids,
		ForceDelete: req.Msg.GetForceDelete(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DeleteSSHCertsResponse{}), nil
}

// SearchLogs 分页查询 SSH 登录日志。
func (s *SSHServer) SearchLogs(
	ctx context.Context,
	req *connect.Request[agentv1.SearchSSHLogsRequest],
) (*connect.Response[agentv1.SearchSSHLogsResponse], error) {
	search, err := sshLogSearch(req.Msg.GetInfo(), req.Msg.GetStatus(), req.Msg.GetStartTime(), req.Msg.GetEndTime())
	if err != nil {
		return nil, err
	}
	// 日志解析需要读取审计文件与地区库，旧实现依赖 gin.Context 做取消与超时。
	total, list, err := s.service.LoadLog(requireGinContext(ctx), search)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.SSHLog, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.SSHLog{
			Date:     item.Date.Format(time.RFC3339),
			DateStr:  item.DateStr,
			Area:     item.Area,
			User:     item.User,
			AuthMode: item.AuthMode,
			Address:  item.Address,
			Port:     item.Port,
			Status:   item.Status,
			Message:  item.Message,
		})
	}
	return connect.NewResponse(&agentv1.SearchSSHLogsResponse{Items: items, Total: total}), nil
}

// ExportLogs 导出 SSH 登录日志。
func (s *SSHServer) ExportLogs(
	ctx context.Context,
	req *connect.Request[agentv1.ExportSSHLogsRequest],
) (*connect.Response[agentv1.ExportSSHLogsResponse], error) {
	search, err := sshLogSearch(req.Msg.GetInfo(), req.Msg.GetStatus(), req.Msg.GetStartTime(), req.Msg.GetEndTime())
	if err != nil {
		return nil, err
	}
	path, err := s.service.ExportLog(requireGinContext(ctx), search)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ExportSSHLogsResponse{Path: path}), nil
}

// CleanLogs 清空 SSH 登录日志。
func (s *SSHServer) CleanLogs(
	_ context.Context,
	_ *connect.Request[agentv1.CleanSSHLogsRequest],
) (*connect.Response[agentv1.CleanSSHLogsResponse], error) {
	if err := s.service.CleanLog(); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CleanSSHLogsResponse{}), nil
}

// sshLogSearch 组装日志查询参数，时间接受 RFC3339 与空值。
func sshLogSearch(info, status, startTime, endTime string) (agentdto.SearchSSHLog, error) {
	search := agentdto.SearchSSHLog{Info: info, Status: status}
	if startTime != "" {
		value, err := time.Parse(time.RFC3339, startTime)
		if err != nil {
			return search, errmap.FromMsgKey("ErrInvalidParams", err)
		}
		search.StartTime = value
	}
	if endTime != "" {
		value, err := time.Parse(time.RFC3339, endTime)
		if err != nil {
			return search, errmap.FromMsgKey("ErrInvalidParams", err)
		}
		search.EndTime = value
	}
	return search, nil
}

// requireGinContext 取出拦截器构造的 gin 上下文，缺失时构造一个最小上下文。
//
// SSH 日志解析沿用了旧 handler 里的 gin.Context（用于超时与取消），
// 这里保证 RPC 路径下也能拿到等价上下文。
func requireGinContext(ctx context.Context) *gin.Context {
	c := bridge.GinContext(ctx)
	if c == nil {
		c, _ = bridge.New(ctx, http.Header{}, "", http.MethodPost, "/rpc")
	}
	return c
}
