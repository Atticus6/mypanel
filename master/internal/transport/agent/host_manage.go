package agent

import (
	"context"
	"encoding/base64"

	"connectrpc.com/connect"

	agentdto "mypanel/agent/app/dto"
	agentreq "mypanel/agent/app/dto/request"
	agentservice "mypanel/agent/app/service"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/conv"
	"mypanel/master/internal/transport/errmap"
)

// Create 创建主机。
func (s *HostServer) Create(
	_ context.Context,
	req *connect.Request[agentv1.CreateHostRequest],
) (*connect.Response[agentv1.Host], error) {
	info, err := s.service.Create(agentdto.HostOperate{
		GroupID:          uint(req.Msg.GetGroupId()),
		Name:             req.Msg.GetName(),
		Addr:             req.Msg.GetAddr(),
		Port:             uint(req.Msg.GetPort()),
		User:             req.Msg.GetUser(),
		AuthMode:         req.Msg.GetAuthMode(),
		Password:         encodeSecret(req.Msg.GetPassword()),
		PrivateKey:       encodeSecret(req.Msg.GetPrivateKey()),
		PassPhrase:       req.Msg.GetPassPhrase(),
		RememberPassword: req.Msg.GetRememberPassword(),
		Description:      req.Msg.GetDescription(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(hostFromDTO(info)), nil
}

// DeleteHosts 批量删除主机。
func (s *HostServer) DeleteHosts(
	_ context.Context,
	req *connect.Request[agentv1.DeleteHostsRequest],
) (*connect.Response[agentv1.DeleteHostsResponse], error) {
	ids := make([]uint, 0, len(req.Msg.GetIds()))
	for _, id := range req.Msg.GetIds() {
		ids = append(ids, uint(id))
	}
	if err := s.service.Delete(ids); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DeleteHostsResponse{}), nil
}

// UpdateHost 修改主机信息。
func (s *HostServer) UpdateHost(
	_ context.Context,
	req *connect.Request[agentv1.UpdateHostRequest],
) (*connect.Response[agentv1.Host], error) {
	// 与旧 handler 一致：只在对应认证方式下加密凭据，并清空另一种方式的字段，
	// 避免切到密码认证后仍残留私钥。
	password := encodeSecret(req.Msg.GetPassword())
	privateKey := encodeSecret(req.Msg.GetPrivateKey())
	passPhrase := req.Msg.GetPassPhrase()
	var err error
	if password != "" && req.Msg.GetAuthMode() == "password" {
		password, err = s.service.EncryptHost(password)
		if err != nil {
			return nil, errmap.FromMsgKey("ErrInvalidParams", err)
		}
		privateKey = ""
		passPhrase = ""
	}
	if privateKey != "" && req.Msg.GetAuthMode() == "key" {
		privateKey, err = s.service.EncryptHost(privateKey)
		if err != nil {
			return nil, errmap.FromMsgKey("ErrInvalidParams", err)
		}
		password = ""
	}

	upMap := map[string]interface{}{
		"name":              req.Msg.GetName(),
		"group_id":          req.Msg.GetGroupId(),
		"addr":              req.Msg.GetAddr(),
		"port":              req.Msg.GetPort(),
		"user":              req.Msg.GetUser(),
		"auth_mode":         req.Msg.GetAuthMode(),
		"remember_password": req.Msg.GetRememberPassword(),
		"description":       req.Msg.GetDescription(),
	}
	if req.Msg.GetAuthMode() == "password" {
		upMap["password"] = password
		upMap["private_key"] = ""
		upMap["pass_phrase"] = ""
	} else {
		upMap["password"] = ""
		upMap["private_key"] = privateKey
		upMap["pass_phrase"] = passPhrase
	}
	info, err := s.service.Update(uint(req.Msg.GetId()), upMap)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(hostFromDTO(info)), nil
}

// UpdateHostGroup 修改主机所属分组。
func (s *HostServer) UpdateHostGroup(
	_ context.Context,
	req *connect.Request[agentv1.UpdateHostGroupRequest],
) (*connect.Response[agentv1.UpdateHostGroupResponse], error) {
	if _, err := s.service.Update(uint(req.Msg.GetId()), map[string]interface{}{
		"group_id": req.Msg.GetGroupId(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateHostGroupResponse{}), nil
}

// TestByInfo 使用请求中的连接信息测试 SSH。
func (s *HostServer) TestByInfo(
	_ context.Context,
	req *connect.Request[agentv1.TestHostInfoRequest],
) (*connect.Response[agentv1.TestHostResponse], error) {
	ok := s.service.TestByInfo(agentdto.HostConnTest{
		Addr:       req.Msg.GetAddr(),
		Port:       uint(req.Msg.GetPort()),
		User:       req.Msg.GetUser(),
		AuthMode:   req.Msg.GetAuthMode(),
		Password:   encodeSecret(req.Msg.GetPassword()),
		PrivateKey: encodeSecret(req.Msg.GetPrivateKey()),
		PassPhrase: req.Msg.GetPassPhrase(),
	})
	return connect.NewResponse(&agentv1.TestHostResponse{Ok: ok}), nil
}

// TestByID 使用已保存凭据测试 SSH。
func (s *HostServer) TestByID(
	_ context.Context,
	req *connect.Request[agentv1.TestHostByIDRequest],
) (*connect.Response[agentv1.TestHostResponse], error) {
	return connect.NewResponse(&agentv1.TestHostResponse{Ok: s.service.TestLocalConn(uint(req.Msg.GetId()))}), nil
}

// CheckComponent 检查本机是否安装了某个命令行组件。
func (s *HostServer) CheckComponent(
	_ context.Context,
	req *connect.Request[agentv1.CheckComponentRequest],
) (*connect.Response[agentv1.ComponentInfo], error) {
	info := agentservice.NewISystemService().IsComponentExist(req.Msg.GetName())
	msg := &agentv1.ComponentInfo{}
	if err := conv.FromDTO(info, msg); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(msg), nil
}

// GetDisks 读取磁盘信息。
func (s *HostServer) GetDisks(
	_ context.Context,
	_ *connect.Request[agentv1.GetDisksRequest],
) (*connect.Response[agentv1.CompleteDiskDetail], error) {
	info, err := agentservice.NewIDiskService().GetCompleteDiskInfo()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	msg := &agentv1.CompleteDiskDetail{}
	if err := conv.FromDTO(info, msg); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(msg), nil
}

// PartitionDisk 分区并挂载磁盘。
func (s *HostServer) PartitionDisk(
	_ context.Context,
	req *connect.Request[agentv1.PartitionDiskRequest],
) (*connect.Response[agentv1.PartitionDiskResponse], error) {
	if _, err := agentservice.NewIDiskService().PartitionDisk(agentreq.DiskPartitionRequest{
		Device:     req.Msg.GetDevice(),
		Filesystem: req.Msg.GetFilesystem(),
		Label:      req.Msg.GetLabel(),
		AutoMount:  req.Msg.GetAutoMount(),
		MountPoint: req.Msg.GetMountPoint(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.PartitionDiskResponse{}), nil
}

// MountDisk 挂载磁盘。
func (s *HostServer) MountDisk(
	_ context.Context,
	req *connect.Request[agentv1.MountDiskRequest],
) (*connect.Response[agentv1.MountDiskResponse], error) {
	if err := agentservice.NewIDiskService().MountDisk(agentreq.DiskMountRequest{
		Device:     req.Msg.GetDevice(),
		MountPoint: req.Msg.GetMountPoint(),
		Filesystem: req.Msg.GetFilesystem(),
		AutoMount:  req.Msg.GetAutoMount(),
		NoFail:     req.Msg.GetNoFail(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.MountDiskResponse{}), nil
}

// UnmountDisk 卸载磁盘。
func (s *HostServer) UnmountDisk(
	_ context.Context,
	req *connect.Request[agentv1.UnmountDiskRequest],
) (*connect.Response[agentv1.UnmountDiskResponse], error) {
	if err := agentservice.NewIDiskService().UnmountDisk(agentreq.DiskUnmountRequest{
		MountPoint: req.Msg.GetMountPoint(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UnmountDiskResponse{}), nil
}

// GetDiagnosticsSummary 读取进程运行时概况。
func (s *HostServer) GetDiagnosticsSummary(
	_ context.Context,
	_ *connect.Request[agentv1.GetDiagnosticsSummaryRequest],
) (*connect.Response[agentv1.DiagnosticsSummary], error) {
	info, err := agentservice.NewIRuntimeDiagnosticsService().Summary()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	msg := &agentv1.DiagnosticsSummary{}
	if err := conv.FromDTO(info, msg); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(msg), nil
}

// GetDiagnosticsGoroutines 读取 goroutine 快照。
func (s *HostServer) GetDiagnosticsGoroutines(
	_ context.Context,
	_ *connect.Request[agentv1.GetDiagnosticsGoroutinesRequest],
) (*connect.Response[agentv1.GoroutineSnapshot], error) {
	info, err := agentservice.NewIRuntimeDiagnosticsService().Goroutines()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	msg := &agentv1.GoroutineSnapshot{}
	if err := conv.FromDTO(info, msg); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(msg), nil
}

// CreateDiagnosticsProfile 采集 pprof 性能剖析。
func (s *HostServer) CreateDiagnosticsProfile(
	_ context.Context,
	req *connect.Request[agentv1.CreateDiagnosticsProfileRequest],
) (*connect.Response[agentv1.DiagnosticsProfile], error) {
	result, err := agentservice.NewIRuntimeDiagnosticsService().CreateProfile(agentdto.RuntimeProfileCreate{
		Type:     req.Msg.GetType(),
		Duration: int(req.Msg.GetDuration()),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DiagnosticsProfile{
		Path: result.Path,
		Name: result.Name,
	}), nil
}

// hostFromDTO 把主机 DTO 转成 proto 消息；凭据字段不返回给前端。
func hostFromDTO(info *agentdto.HostInfo) *agentv1.Host {
	if info == nil {
		return &agentv1.Host{}
	}
	msg := &agentv1.Host{}
	_ = conv.FromDTO(info, msg)
	return msg
}

// encodeSecret 把明文凭据转成 service 层期望的 base64 形态。
//
// 旧的 REST 契约由前端做 base64，RPC 不沿用这种「把编码责任推给浏览器」的做法：
// proto 里传明文，adapter 统一编码后再交给 1Panel 的 EncryptHost / TestByInfo。
func encodeSecret(plain string) string {
	if plain == "" {
		return ""
	}
	return base64.StdEncoding.EncodeToString([]byte(plain))
}
