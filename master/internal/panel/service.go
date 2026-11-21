// Package panel 实现 panel.v1.PanelService，即 mypanel 控制面的起步服务。
//
// 服务同时通过 Connect、gRPC 与 gRPC-Web 协议对外提供（由 connect-go 的
// 生成代码统一处理），因此这里的实现不需要关心调用方用哪种协议。
package panel

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"connectrpc.com/connect"

	panelv1 "mypanel/proto/gen/go/panel/v1"
)

// DefaultInterval 是 Watch 在调用方传入非正间隔时使用的默认推送周期。
const DefaultInterval = 2 * time.Second

// ListEvents 的分页参数。
const (
	// defaultPageSize 是调用方未指定 page_size 时每页返回的条数。
	defaultPageSize = 10
	// maxPageSize 是单页条数上限，防止一次拉取过多数据。
	maxPageSize = 100
	// totalEvents 是演示数据的总条数。
	totalEvents = 42
)

// Service 实现 panel.v1.PanelService 的业务逻辑。
//
// 零值可用，只是 Version 为空。字段均为可选项，便于在测试中替换。
type Service struct {
	// Version 由 Ping 原样回传，通常填构建版本号。
	Version string
	// Now 可注入，使测试不依赖真实时钟。为 nil 时使用 time.Now。
	Now func() time.Time
}

// Options 是构造 Service 的参数。
type Options struct {
	// Version 由 Ping 原样回传，通常填构建版本号。
	Version string
}

// NewService 构造 Service，供 wire 注入使用。
//
// 保持 Service 的零值可用特性：需要自定义时钟的测试可以直接构造
// &Service{Now: ...}，不必经过这个函数。
func NewService(opts Options) *Service {
	return &Service{Version: opts.Version}
}

// 编译期断言：Service 必须满足生成代码要求的 handler 接口。
// 放在这里可以让接口变动在编译期就暴露，而不是等到注册 handler 时。
var _ interface {
	Ping(context.Context, *connect.Request[panelv1.PingRequest]) (*connect.Response[panelv1.PingResponse], error)
	Hello(context.Context, *connect.Request[panelv1.HelloRequest]) (*connect.Response[panelv1.HelloResponse], error)
	ListEvents(context.Context, *connect.Request[panelv1.ListEventsRequest]) (*connect.Response[panelv1.ListEventsResponse], error)
	Watch(context.Context, *connect.Request[panelv1.WatchRequest], *connect.ServerStream[panelv1.WatchEvent]) error
} = (*Service)(nil)

// Ping 原样回显调用方的 message，并附带服务端当前时间与版本号。
//
// 这是一个纯 unary 调用，用作连通性检查；不会访问任何外部依赖。
func (s *Service) Ping(
	_ context.Context,
	req *connect.Request[panelv1.PingRequest],
) (*connect.Response[panelv1.PingResponse], error) {
	res := connect.NewResponse(&panelv1.PingResponse{
		Message:    req.Msg.GetMessage(),
		ServerTime: s.now().Format(time.RFC3339Nano),
		Version:    s.Version,
	})
	return res, nil
}

// Hello 用调用方提供的名字拼一句问候，并附上服务端时间。
//
// 这是给前端 react-query 封装用的最小示例：无副作用、无外部依赖，
// 名字为空时回退到 "world"，避免返回 "Hello, !" 这种残缺文案。
func (s *Service) Hello(
	_ context.Context,
	req *connect.Request[panelv1.HelloRequest],
) (*connect.Response[panelv1.HelloResponse], error) {
	name := req.Msg.GetName()
	if name == "" {
		name = "world"
	}

	res := connect.NewResponse(&panelv1.HelloResponse{
		Greeting:   fmt.Sprintf("Hello, %s!", name),
		ServerTime: s.now().Format(time.RFC3339Nano),
	})
	return res, nil
}

// ListEvents 返回一页示例事件，用游标分页。
//
// 这是给前端 useInfiniteQuery 用的演示数据：事件内容是确定性生成的，
// 不依赖数据库，便于测试与本地联调。
//
// page_token 为空表示第一页；返回的 next_page_token 为空表示已到末页。
func (s *Service) ListEvents(
	_ context.Context,
	req *connect.Request[panelv1.ListEventsRequest],
) (*connect.Response[panelv1.ListEventsResponse], error) {
	start := parsePageToken(req.Msg.GetPageToken())
	pageSize := int(req.Msg.GetPageSize())
	if pageSize <= 0 {
		pageSize = defaultPageSize
	}
	// 限制单页上限，避免调用方一次拉取过多数据。
	if pageSize > maxPageSize {
		pageSize = maxPageSize
	}

	end := start + pageSize
	if end > totalEvents {
		end = totalEvents
	}

	events := make([]*panelv1.WatchEvent, 0, pageSize)
	for seq := start + 1; seq <= end; seq++ {
		events = append(events, &panelv1.WatchEvent{
			Seq:  int64(seq),
			At:   s.now().Format(time.RFC3339Nano),
			Kind: "page-item",
		})
	}

	var next string
	if end < totalEvents {
		next = strconv.Itoa(end)
	}

	return connect.NewResponse(&panelv1.ListEventsResponse{
		Events:        events,
		NextPageToken: next,
	}), nil
}

// parsePageToken 把游标解析成「已返回的条数」。
//
// 非法游标一律当作首页处理，而不是报错：分页游标对客户端是不透明的，
// 旧客户端拿着过期游标时，退回首页比直接失败体验更好。
func parsePageToken(token string) int {
	if token == "" {
		return 0
	}
	n, err := strconv.Atoi(token)
	if err != nil || n < 0 || n > totalEvents {
		return 0
	}
	return n
}

// Watch 按调用方指定的周期持续推送事件，直到调用方断开连接。
//
// 返回 ctx.Err() 表示是调用方主动取消（正常结束）；返回 stream.Send 的错误
// 表示写流失败（对端已断开或网络异常）。两者都会让循环退出，不会泄漏 ticker。
func (s *Service) Watch(
	ctx context.Context,
	req *connect.Request[panelv1.WatchRequest],
	stream *connect.ServerStream[panelv1.WatchEvent],
) error {
	interval := resolveInterval(req.Msg.GetIntervalSeconds())

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for seq := int64(1); ; seq++ {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			event := &panelv1.WatchEvent{
				Seq:  seq,
				At:   s.now().Format(time.RFC3339Nano),
				Kind: fmt.Sprintf("tick(%s)", interval),
			}
			if err := stream.Send(event); err != nil {
				return err
			}
		}
	}
}

// resolveInterval 把调用方传入的秒数转成推送周期。
//
// 非正值一律回退到 DefaultInterval，避免 time.NewTicker 因非正周期 panic。
// 抽成独立函数是为了能在不建立流式连接的前提下直接测试这段边界逻辑。
func resolveInterval(seconds int32) time.Duration {
	if seconds <= 0 {
		return DefaultInterval
	}
	return time.Duration(seconds) * time.Second
}

// now 返回当前时间，优先使用注入的 Now，便于测试固定时间。
func (s *Service) now() time.Time {
	if s.Now != nil {
		return s.Now()
	}
	return time.Now()
}
