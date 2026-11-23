package agent

import (
	"context"

	"connectrpc.com/connect"

	agentdto "mypanel/agent/app/dto"
	agentreq "mypanel/agent/app/dto/request"
	agentresp "mypanel/agent/app/dto/response"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/errmap"
)

// List 按账号列出证书。
func (s *WebsiteSSLServer) List(
	_ context.Context,
	req *connect.Request[agentv1.ListSSLRequest],
) (*connect.Response[agentv1.ListSSLResponse], error) {
	list, err := s.service.Search(agentreq.WebsiteSSLListReq{AcmeAccountID: req.Msg.GetAcmeAccountId()})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.WebsiteSSL, 0, len(list))
	for _, item := range list {
		items = append(items, sslFromDTO(item))
	}
	return connect.NewResponse(&agentv1.ListSSLResponse{Items: items}), nil
}

// GetByID 按 ID 读取证书。
func (s *WebsiteSSLServer) GetByID(
	_ context.Context,
	req *connect.Request[agentv1.GetSSLRequest],
) (*connect.Response[agentv1.WebsiteSSL], error) {
	info, err := s.service.GetSSL(uint(req.Msg.GetId()))
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(sslFromDTO(*info)), nil
}

// GetByWebsite 读取网站绑定的证书。
func (s *WebsiteSSLServer) GetByWebsite(
	_ context.Context,
	req *connect.Request[agentv1.GetWebsiteSSLRequest],
) (*connect.Response[agentv1.WebsiteSSL], error) {
	info, err := s.service.GetWebsiteSSL(uint(req.Msg.GetWebsiteId()))
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(sslFromDTO(info)), nil
}

// Create 创建证书记录。
func (s *WebsiteSSLServer) Create(
	_ context.Context,
	req *connect.Request[agentv1.CreateSSLRequest],
) (*connect.Response[agentv1.CreateSSLResponse], error) {
	result, err := s.service.Create(agentreq.WebsiteSSLCreate{
		PrimaryDomain: req.Msg.GetPrimaryDomain(),
		OtherDomains:  req.Msg.GetOtherDomains(),
		Provider:      req.Msg.GetProvider(),
		AcmeAccountID: uint(req.Msg.GetAcmeAccountId()),
		DnsAccountID:  uint(req.Msg.GetDnsAccountId()),
		AutoRenew:     req.Msg.GetAutoRenew(),
		KeyType:       req.Msg.GetKeyType(),
		Apply:         req.Msg.GetApply(),
		PushDir:       req.Msg.GetPushDir(),
		Dir:           req.Msg.GetDir(),
		Description:   req.Msg.GetDescription(),
		DisableCNAME:  req.Msg.GetDisableCname(),
		SkipDNS:       req.Msg.GetSkipDns(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CreateSSLResponse{Id: uint32(result.ID)}), nil
}

// Update 修改证书配置。
func (s *WebsiteSSLServer) Update(
	_ context.Context,
	req *connect.Request[agentv1.UpdateSSLRequest],
) (*connect.Response[agentv1.UpdateSSLResponse], error) {
	if err := s.service.Update(agentreq.WebsiteSSLUpdate{
		ID:            uint(req.Msg.GetId()),
		AutoRenew:     req.Msg.GetAutoRenew(),
		Description:   req.Msg.GetDescription(),
		PrimaryDomain: req.Msg.GetPrimaryDomain(),
		OtherDomains:  req.Msg.GetOtherDomains(),
		Provider:      req.Msg.GetProvider(),
		AcmeAccountID: uint(req.Msg.GetAcmeAccountId()),
		DnsAccountID:  uint(req.Msg.GetDnsAccountId()),
		KeyType:       req.Msg.GetKeyType(),
		Apply:         req.Msg.GetApply(),
		PushDir:       req.Msg.GetPushDir(),
		Dir:           req.Msg.GetDir(),
		DisableCNAME:  req.Msg.GetDisableCname(),
		SkipDNS:       req.Msg.GetSkipDns(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateSSLResponse{}), nil
}

// Apply 签发/续期证书。
func (s *WebsiteSSLServer) Apply(
	_ context.Context,
	req *connect.Request[agentv1.ApplySSLRequest],
) (*connect.Response[agentv1.ApplySSLResponse], error) {
	if err := s.service.ObtainSSL(agentreq.WebsiteSSLApply{
		ID:           uint(req.Msg.GetId()),
		SkipDNSCheck: req.Msg.GetSkipDnsCheck(),
		Nameservers:  req.Msg.GetNameservers(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ApplySSLResponse{}), nil
}

// GetDNSResolve 读取证书需要的 DNS 解析记录。
func (s *WebsiteSSLServer) GetDNSResolve(
	_ context.Context,
	req *connect.Request[agentv1.GetDNSResolveRequest],
) (*connect.Response[agentv1.GetDNSResolveResponse], error) {
	list, err := s.service.GetDNSResolve(agentreq.WebsiteDNSReq{
		AcmeAccountID: uint(req.Msg.GetAcmeAccountId()),
		WebsiteSSLID:  uint(req.Msg.GetWebsiteSslId()),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.DNSResolveRecord, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.DNSResolveRecord{
			Resolve: item.Key,
			Value:   item.Value,
			Domain:  item.Domain,
			Err:     item.Err,
		})
	}
	return connect.NewResponse(&agentv1.GetDNSResolveResponse{Items: items}), nil
}

// Delete 删除证书。
func (s *WebsiteSSLServer) Delete(
	_ context.Context,
	req *connect.Request[agentv1.DeleteSSLRequest],
) (*connect.Response[agentv1.DeleteSSLResponse], error) {
	ids := make([]uint, 0, len(req.Msg.GetIds()))
	for _, id := range req.Msg.GetIds() {
		ids = append(ids, uint(id))
	}
	if err := s.service.Delete(ids); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DeleteSSLResponse{}), nil
}

// Push 推送证书。
func (s *WebsiteSSLServer) Push(
	_ context.Context,
	req *connect.Request[agentv1.PushSSLRequest],
) (*connect.Response[agentv1.PushSSLResponse], error) {
	if err := s.service.PushToNode(agentreq.WebsiteSSLPush{
		ID:       uint(req.Msg.GetId()),
		PushNode: req.Msg.GetPushNode(),
		Nodes:    req.Msg.GetNodes(),
		TaskID:   req.Msg.GetTaskId(),
		Sync:     req.Msg.GetSync(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.PushSSLResponse{}), nil
}

// SearchCA 分页查询 CA。
func (s *WebsiteSSLServer) SearchCA(
	_ context.Context,
	req *connect.Request[agentv1.SearchCARequest],
) (*connect.Response[agentv1.SearchCAResponse], error) {
	total, list, err := s.ca.Page(agentreq.WebsiteCASearch{
		PageInfo: agentdto.PageInfo{Page: int(req.Msg.GetPage()), PageSize: int(req.Msg.GetPageSize())},
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.CADetail, 0, len(list))
	for _, item := range list {
		items = append(items, caFromDTO(item))
	}
	return connect.NewResponse(&agentv1.SearchCAResponse{Items: items, Total: total}), nil
}

// GetCA 按 ID 读取 CA。
func (s *WebsiteSSLServer) GetCA(
	_ context.Context,
	req *connect.Request[agentv1.GetCARequest],
) (*connect.Response[agentv1.CADetail], error) {
	info, err := s.ca.GetCA(uint(req.Msg.GetId()))
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(caFromDTO(*info)), nil
}

// CreateCA 创建自签 CA。
func (s *WebsiteSSLServer) CreateCA(
	_ context.Context,
	req *connect.Request[agentv1.CreateCARequest],
) (*connect.Response[agentv1.CreateCAResponse], error) {
	if _, err := s.ca.Create(agentreq.WebsiteCACreate{
		CommonName:       req.Msg.GetCommonName(),
		Country:          req.Msg.GetCountry(),
		Organization:     req.Msg.GetOrganization(),
		OrganizationUint: req.Msg.GetOrganizationUint(),
		Name:             req.Msg.GetName(),
		KeyType:          req.Msg.GetKeyType(),
		Province:         req.Msg.GetProvince(),
		City:             req.Msg.GetCity(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CreateCAResponse{}), nil
}

// DeleteCA 删除 CA。
func (s *WebsiteSSLServer) DeleteCA(
	_ context.Context,
	req *connect.Request[agentv1.DeleteCARequest],
) (*connect.Response[agentv1.DeleteCAResponse], error) {
	if err := s.ca.Delete(uint(req.Msg.GetId())); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DeleteCAResponse{}), nil
}

// RenewCA 用 CA 续签证书。
func (s *WebsiteSSLServer) RenewCA(
	_ context.Context,
	req *connect.Request[agentv1.RenewCARequest],
) (*connect.Response[agentv1.RenewCAResponse], error) {
	// Renew 复用 ObtainSSL 的续签分支，需要按既有证书信息补全参数。
	// 与旧 handler 一致：续签只传 SSLID，其余参数用默认值（1 年、Renew=true）。
	if _, err := s.ca.ObtainSSL(agentreq.WebsiteCAObtain{
		SSLID: uint(req.Msg.GetSslId()),
		Renew: true,
		Unit:  "year",
		Time:  1,
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.RenewCAResponse{}), nil
}

// CreateACME 创建 ACME 账号。
func (s *WebsiteSSLServer) CreateACME(
	_ context.Context,
	req *connect.Request[agentv1.CreateACMEAccountRequest],
) (*connect.Response[agentv1.CreateACMEAccountResponse], error) {
	if _, err := s.acme.Create(agentreq.WebsiteAcmeAccountCreate{
		Email:      req.Msg.GetEmail(),
		Type:       req.Msg.GetType(),
		KeyType:    req.Msg.GetKeyType(),
		EabKid:     req.Msg.GetEabKid(),
		EabHmacKey: req.Msg.GetEabHmacKey(),
		UseProxy:   req.Msg.GetUseProxy(),
		CaDirURL:   req.Msg.GetCaDirUrl(),
		UseEAB:     req.Msg.GetUseEab(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CreateACMEAccountResponse{}), nil
}

// UpdateACME 修改 ACME 账号。
func (s *WebsiteSSLServer) UpdateACME(
	_ context.Context,
	req *connect.Request[agentv1.UpdateACMEAccountRequest],
) (*connect.Response[agentv1.UpdateACMEAccountResponse], error) {
	if _, err := s.acme.Update(agentreq.WebsiteAcmeAccountUpdate{
		ID:       uint(req.Msg.GetId()),
		UseProxy: req.Msg.GetUseProxy(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateACMEAccountResponse{}), nil
}

// DeleteACME 删除 ACME 账号。
func (s *WebsiteSSLServer) DeleteACME(
	_ context.Context,
	req *connect.Request[agentv1.DeleteACMEAccountRequest],
) (*connect.Response[agentv1.DeleteACMEAccountResponse], error) {
	if err := s.acme.Delete(uint(req.Msg.GetId())); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DeleteACMEAccountResponse{}), nil
}

// sslFromDTO 把证书 DTO 转成 proto 消息。
//
// model.WebsiteSSL 的 json tag 混用大小写（certURL、skipDNS、disableCNAME），
// protojson 无法直接对齐，因此显式赋值。
func sslFromDTO(item agentresp.WebsiteSSLDTO) *agentv1.WebsiteSSL {
	return &agentv1.WebsiteSSL{
		Id:            uint32(item.ID),
		CreatedAt:     formatTime(item.CreatedAt),
		PrimaryDomain: item.PrimaryDomain,
		Domains:       item.Domains,
		Type:          item.Type,
		Provider:      item.Provider,
		Organization:  item.Organization,
		AutoRenew:     item.AutoRenew,
		ExpireDate:    formatTime(item.ExpireDate),
		StartDate:     formatTime(item.StartDate),
		Status:        item.Status,
		Message:       item.Message,
		KeyType:       item.KeyType,
		PushDir:       item.PushDir,
		Dir:           item.Dir,
		Description:   item.Description,
		SkipDns:       item.SkipDNS,
	}
}

// caFromDTO 把 CA DTO 转成 proto 消息。
func caFromDTO(item agentresp.WebsiteCADTO) *agentv1.CADetail {
	return &agentv1.CADetail{
		Id:               uint32(item.ID),
		CreatedAt:        formatTime(item.CreatedAt),
		Name:             item.Name,
		KeyType:          item.KeyType,
		Csr:              item.CSR,
		CommonName:       item.CommonName,
		Country:          item.Country,
		Organization:     item.Organization,
		OrganizationUint: item.OrganizationUint,
		Province:         item.Province,
		City:             item.City,
	}
}
