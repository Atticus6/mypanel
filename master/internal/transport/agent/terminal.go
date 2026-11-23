package agent

import (
	"context"
	"strconv"
	"strings"
	"time"

	"connectrpc.com/connect"

	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/agent/utils/terminal"

	"mypanel/master/internal/transport/errmap"
)

// TerminalServer 实现 panel.agent.v1.TerminalService。
type TerminalServer struct{}

// NewTerminalServer 构造终端会话服务。
func NewTerminalServer() *TerminalServer {
	return &TerminalServer{}
}

// ListSessions 列出当前用户与登录会话下的终端会话。
func (s *TerminalServer) ListSessions(
	_ context.Context,
	req *connect.Request[agentv1.ListTerminalSessionsRequest],
) (*connect.Response[agentv1.ListTerminalSessionsResponse], error) {
	identity, err := terminalIdentity(req.Header())
	if err != nil {
		return nil, err
	}
	list := terminal.List(identity)
	items := make([]*agentv1.TerminalSession, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.TerminalSession{
			Id:         item.ID,
			Kind:       item.Kind,
			Title:      item.Title,
			Persistent: item.Persistent,
			HostId:     uint32(item.HostID),
			Attached:   item.Attached,
			CreatedAt:  item.CreatedAt.Format(time.RFC3339),
			DetachedAt: formatOptionalTime(item.DetachedAt),
		})
	}
	return connect.NewResponse(&agentv1.ListTerminalSessionsResponse{Items: items}), nil
}

// CloseSession 关闭指定终端会话。
func (s *TerminalServer) CloseSession(
	_ context.Context,
	req *connect.Request[agentv1.CloseTerminalSessionRequest],
) (*connect.Response[agentv1.CloseTerminalSessionResponse], error) {
	identity, err := terminalIdentity(req.Header())
	if err != nil {
		return nil, err
	}
	if err := terminal.CloseSession(req.Msg.GetId(), identity); err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	return connect.NewResponse(&agentv1.CloseTerminalSessionResponse{}), nil
}

// CloseAllSessions 关闭当前登录会话下的全部终端会话。
func (s *TerminalServer) CloseAllSessions(
	_ context.Context,
	req *connect.Request[agentv1.CloseAllTerminalSessionsRequest],
) (*connect.Response[agentv1.CloseAllTerminalSessionsResponse], error) {
	identity, err := terminalIdentity(req.Header())
	if err != nil {
		return nil, err
	}
	terminal.Revoke("auth_session", identity.UserID, identity.AuthSessionID)
	return connect.NewResponse(&agentv1.CloseAllTerminalSessionsResponse{}), nil
}

// terminalIdentity 从请求头还原终端身份。
//
// 终端身份与 WebSocket 共用同一组请求头；AuthLeaseUntil 由服务端校验上限，
// 防止客户端把租约无限延长。
func terminalIdentity(header interface{ Get(string) string }) (terminal.Identity, error) {
	identity := terminal.Identity{
		UserID:        strings.TrimSpace(header.Get(terminal.HeaderUserID)),
		AuthSessionID: strings.TrimSpace(header.Get(terminal.HeaderAuthSessionID)),
	}
	if value := header.Get(terminal.HeaderAuthLeaseUntil); value != "" {
		millis, err := strconv.ParseInt(value, 10, 64)
		if err != nil || millis <= 0 {
			return terminal.Identity{}, errmap.FromMsgKey("ErrInvalidParams", err)
		}
		identity.AuthLeaseUntil = time.UnixMilli(millis)
		if maximum := time.Now().Add(90 * time.Second); identity.AuthLeaseUntil.After(maximum) {
			identity.AuthLeaseUntil = maximum
		}
	}
	if !identity.Valid() {
		return terminal.Identity{}, errmap.FromMsgKey("ErrInvalidParams", nil)
	}
	return identity, nil
}
