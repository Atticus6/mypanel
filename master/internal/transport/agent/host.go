package agent

import (
	"context"
	"time"

	"connectrpc.com/connect"

	agentdto "mypanel/agent/app/dto"
	agentservice "mypanel/agent/app/service"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/errmap"
)

// HostServer 实现 panel.agent.v1.HostService。
type HostServer struct {
	service *agentservice.HostService
}

// NewHostServer 构造主机管理服务。
func NewHostServer() *HostServer {
	return &HostServer{service: &agentservice.HostService{}}
}

// Search 分页查询主机。
func (s *HostServer) Search(
	_ context.Context,
	req *connect.Request[agentv1.SearchHostsRequest],
) (*connect.Response[agentv1.SearchHostsResponse], error) {
	total, list, err := s.service.SearchWithPage(agentdto.SearchPageWithGroup{
		PageInfo: agentdto.PageInfo{
			Page:     int(req.Msg.GetPage()),
			PageSize: int(req.Msg.GetPageSize()),
		},
		GroupID: uint(req.Msg.GetGroupId()),
		Info:    req.Msg.GetInfo(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}

	hosts, _ := list.([]agentdto.HostInfo)
	items := make([]*agentv1.Host, 0, len(hosts))
	for _, host := range hosts {
		items = append(items, fromHostInfo(host))
	}
	return connect.NewResponse(&agentv1.SearchHostsResponse{
		Items: items,
		Total: total,
	}), nil
}

// Get 按 ID 查询主机。
func (s *HostServer) Get(
	_ context.Context,
	req *connect.Request[agentv1.GetHostRequest],
) (*connect.Response[agentv1.Host], error) {
	host, err := s.service.GetHostByID(uint(req.Msg.GetId()))
	if err != nil {
		return nil, errmap.FromMsgKey("ErrRecordNotFound", err)
	}
	return connect.NewResponse(fromHostInfo(*host)), nil
}

// Tree 查询主机分组树。
func (s *HostServer) Tree(
	_ context.Context,
	req *connect.Request[agentv1.HostTreeRequest],
) (*connect.Response[agentv1.HostTreeResponse], error) {
	tree, err := s.service.SearchForTree(agentdto.SearchForTree{Info: req.Msg.GetInfo()})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	groups := make([]*agentv1.HostGroup, 0, len(tree))
	for _, group := range tree {
		children := make([]*agentv1.HostTreeChild, 0, len(group.Children))
		for _, child := range group.Children {
			children = append(children, &agentv1.HostTreeChild{
				Id:    uint32(child.ID),
				Label: child.Label,
			})
		}
		groups = append(groups, &agentv1.HostGroup{
			Id:       uint32(group.ID),
			Label:    group.Label,
			Children: children,
		})
	}
	return connect.NewResponse(&agentv1.HostTreeResponse{Groups: groups}), nil
}

// fromHostInfo 只映射展示字段，密码/私钥/口令不进入 RPC 响应。
func fromHostInfo(item agentdto.HostInfo) *agentv1.Host {
	return &agentv1.Host{
		Id:          uint32(item.ID),
		CreatedAt:   formatOptionalTime(item.CreatedAt),
		GroupId:     uint32(item.GroupID),
		GroupBelong: item.GroupBelong,
		Name:        item.Name,
		Addr:        item.Addr,
		Port:        uint32(item.Port),
		User:        item.User,
		AuthMode:    item.AuthMode,
		Description: item.Description,
	}
}

// formatOptionalTime 与 WebsiteService 保持同样的时间格式。
func formatOptionalTime(value time.Time) string {
	return formatTime(value)
}
