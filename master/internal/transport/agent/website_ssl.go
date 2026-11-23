package agent

import (
	"context"
	"encoding/json"

	"connectrpc.com/connect"

	agentdto "mypanel/agent/app/dto"
	"mypanel/agent/app/dto/request"
	agentmodel "mypanel/agent/app/model"
	agentservice "mypanel/agent/app/service"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/errmap"
)

// WebsiteSSLServer 实现 panel.agent.v1.WebsiteSSLService。
type WebsiteSSLServer struct {
	service agentservice.WebsiteSSLService
	dns     agentservice.WebsiteDnsAccountService
	acme    agentservice.WebsiteAcmeAccountService
	ca      agentservice.WebsiteCAService
}

// NewWebsiteSSLServer 构造证书管理服务。
func NewWebsiteSSLServer() *WebsiteSSLServer {
	return &WebsiteSSLServer{
		service: agentservice.WebsiteSSLService{},
		dns:     agentservice.WebsiteDnsAccountService{},
		acme:    agentservice.WebsiteAcmeAccountService{},
		ca:      agentservice.WebsiteCAService{},
	}
}

// SearchDNSAccounts 分页查询 DNS 账号。
func (s *WebsiteSSLServer) SearchDNSAccounts(
	_ context.Context,
	req *connect.Request[agentv1.SearchDNSAccountsRequest],
) (*connect.Response[agentv1.SearchDNSAccountsResponse], error) {
	total, list, err := s.dns.Page(agentdto.PageInfo{
		Page:     int(req.Msg.GetPage()),
		PageSize: int(req.Msg.GetPageSize()),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.DNSAccount, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.DNSAccount{
			Id:        uint32(item.ID),
			CreatedAt: formatTime(item.CreatedAt),
			Name:      item.Name,
			Type:      item.Type,
		})
	}
	return connect.NewResponse(&agentv1.SearchDNSAccountsResponse{Items: items, Total: total}), nil
}

// SearchACMEAccounts 分页查询 ACME 账号。
func (s *WebsiteSSLServer) SearchACMEAccounts(
	_ context.Context,
	req *connect.Request[agentv1.SearchACMEAccountsRequest],
) (*connect.Response[agentv1.SearchACMEAccountsResponse], error) {
	total, list, err := s.acme.Page(agentdto.PageInfo{
		Page:     int(req.Msg.GetPage()),
		PageSize: int(req.Msg.GetPageSize()),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.ACMEAccount, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.ACMEAccount{
			Id:        uint32(item.ID),
			CreatedAt: formatTime(item.CreatedAt),
			Email:     item.Email,
			Url:       item.URL,
			Type:      item.Type,
			KeyType:   item.KeyType,
			UseProxy:  item.UseProxy,
			CaDirUrl:  item.CaDirURL,
			UseEab:    item.UseEAB,
		})
	}
	return connect.NewResponse(&agentv1.SearchACMEAccountsResponse{Items: items, Total: total}), nil
}

// Search 分页查询证书。
func (s *WebsiteSSLServer) Search(
	_ context.Context,
	req *connect.Request[agentv1.SearchSSLRequest],
) (*connect.Response[agentv1.SearchSSLResponse], error) {
	total, list, err := s.service.Page(request.WebsiteSSLSearch{
		PageInfo: agentdto.PageInfo{
			Page:     int(req.Msg.GetPage()),
			PageSize: int(req.Msg.GetPageSize()),
		},
		AcmeAccountID: req.Msg.GetAcmeAccountId(),
		Domain:        req.Msg.GetDomain(),
		OrderBy:       defaultString(req.Msg.GetOrderBy(), "created_at"),
		Order:         defaultString(req.Msg.GetOrder(), "descending"),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}

	items := make([]*agentv1.WebsiteSSL, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.WebsiteSSL{
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
		})
	}
	return connect.NewResponse(&agentv1.SearchSSLResponse{
		Items: items,
		Total: total,
	}), nil
}

// ObtainCA 签发自签名证书。
func (s *WebsiteSSLServer) ObtainCA(
	_ context.Context,
	req *connect.Request[agentv1.ObtainCARequest],
) (*connect.Response[agentv1.ObtainCAResponse], error) {
	ssl, err := s.ca.ObtainSSL(request.WebsiteCAObtain{
		ID:          uint(req.Msg.GetId()),
		Domains:     req.Msg.GetDomains(),
		KeyType:     req.Msg.GetKeyType(),
		Time:        int(req.Msg.GetTime()),
		Unit:        req.Msg.GetUnit(),
		PushDir:     req.Msg.GetPushDir(),
		Dir:         req.Msg.GetDir(),
		AutoRenew:   req.Msg.GetAutoRenew(),
		Renew:       req.Msg.GetRenew(),
		SSLID:       uint(req.Msg.GetSslId()),
		Description: req.Msg.GetDescription(),
		ExecShell:   req.Msg.GetExecShell(),
		Shell:       req.Msg.GetShell(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ObtainCAResponse{
		SslId:         uint32(ssl.ID),
		PrimaryDomain: ssl.PrimaryDomain,
	}), nil
}

// ImportCA 导入自签名证书。
func (s *WebsiteSSLServer) ImportCA(
	_ context.Context,
	req *connect.Request[agentv1.ImportCARequest],
) (*connect.Response[agentv1.ImportCAResponse], error) {
	if err := s.ca.Import(request.WebsiteCAImport{
		Name:            req.Msg.GetName(),
		Type:            req.Msg.GetType(),
		Certificate:     req.Msg.GetCertificate(),
		PrivateKey:      req.Msg.GetPrivateKey(),
		CertificatePath: req.Msg.GetCertificatePath(),
		PrivateKeyPath:  req.Msg.GetPrivateKeyPath(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ImportCAResponse{}), nil
}

// ImportSSL 导入主节点证书。
func (s *WebsiteSSLServer) ImportSSL(
	_ context.Context,
	req *connect.Request[agentv1.ImportSSLRequest],
) (*connect.Response[agentv1.ImportSSLResponse], error) {
	var create agentmodel.WebsiteSSL
	if err := json.Unmarshal([]byte(req.Msg.GetPayloadJson()), &create); err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	if err := s.service.ImportMasterSSL(create); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ImportSSLResponse{}), nil
}
