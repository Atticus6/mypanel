package panel

import (
	"context"
	"strconv"
	"testing"
	"time"

	"connectrpc.com/connect"

	panelv1 "mypanel/proto/gen/go/panel/v1"
)

func TestResolveInterval(t *testing.T) {
	tests := []struct {
		name    string
		seconds int32
		want    time.Duration
	}{
		{name: "正数按秒转换", seconds: 3, want: 3 * time.Second},
		{name: "1 秒", seconds: 1, want: time.Second},
		{name: "零回退到默认值", seconds: 0, want: DefaultInterval},
		{name: "负数回退到默认值", seconds: -5, want: DefaultInterval},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := resolveInterval(tt.seconds); got != tt.want {
				t.Fatalf("resolveInterval(%d) = %v, want %v", tt.seconds, got, tt.want)
			}
		})
	}
}

func TestResolveIntervalNeverReturnsNonPositive(t *testing.T) {
	// time.NewTicker 对非正周期会 panic，这里守住这条底线。
	for _, seconds := range []int32{-100, -1, 0} {
		if got := resolveInterval(seconds); got <= 0 {
			t.Fatalf("resolveInterval(%d) = %v, must be positive", seconds, got)
		}
	}
}

func TestPingEchoesMessageAndReportsVersion(t *testing.T) {
	fixed := time.Date(2026, 11, 21, 15, 30, 0, 0, time.UTC)
	svc := &Service{
		Version: "v1.2.3",
		Now:     func() time.Time { return fixed },
	}

	res, err := svc.Ping(context.Background(), connect.NewRequest(&panelv1.PingRequest{
		Message: "hello",
	}))
	if err != nil {
		t.Fatalf("Ping() error = %v, want nil", err)
	}

	if got := res.Msg.GetMessage(); got != "hello" {
		t.Errorf("Message = %q, want %q", got, "hello")
	}
	if got := res.Msg.GetVersion(); got != "v1.2.3" {
		t.Errorf("Version = %q, want %q", got, "v1.2.3")
	}
	if got, want := res.Msg.GetServerTime(), fixed.Format(time.RFC3339Nano); got != want {
		t.Errorf("ServerTime = %q, want %q", got, want)
	}
}

func TestPingWithEmptyMessage(t *testing.T) {
	// 空消息不应报错，原样回显空串即可。
	svc := &Service{}

	res, err := svc.Ping(context.Background(), connect.NewRequest(&panelv1.PingRequest{}))
	if err != nil {
		t.Fatalf("Ping() error = %v, want nil", err)
	}
	if got := res.Msg.GetMessage(); got != "" {
		t.Errorf("Message = %q, want empty", got)
	}
}

func TestHelloGreetsName(t *testing.T) {
	fixed := time.Date(2026, 11, 21, 16, 0, 0, 0, time.UTC)
	svc := &Service{Now: func() time.Time { return fixed }}

	res, err := svc.Hello(context.Background(), connect.NewRequest(&panelv1.HelloRequest{
		Name: "atticus",
	}))
	if err != nil {
		t.Fatalf("Hello() error = %v, want nil", err)
	}

	if got, want := res.Msg.GetGreeting(), "Hello, atticus!"; got != want {
		t.Errorf("Greeting = %q, want %q", got, want)
	}
	if got, want := res.Msg.GetServerTime(), fixed.Format(time.RFC3339Nano); got != want {
		t.Errorf("ServerTime = %q, want %q", got, want)
	}
}

func TestHelloFallsBackToWorld(t *testing.T) {
	// 空名字应回退到 "world"，而不是产生 "Hello, !" 这种残缺文案。
	svc := &Service{}

	res, err := svc.Hello(context.Background(), connect.NewRequest(&panelv1.HelloRequest{}))
	if err != nil {
		t.Fatalf("Hello() error = %v, want nil", err)
	}
	if got, want := res.Msg.GetGreeting(), "Hello, world!"; got != want {
		t.Errorf("Greeting = %q, want %q", got, want)
	}
}

func TestNowFallsBackToWallClock(t *testing.T) {
	svc := &Service{}
	before := time.Now()
	got := svc.now()
	after := time.Now()

	if got.Before(before) || got.After(after) {
		t.Fatalf("now() = %v, want between %v and %v", got, before, after)
	}
}

func TestListEventsFirstPage(t *testing.T) {
	svc := &Service{Now: func() time.Time { return time.Unix(0, 0).UTC() }}

	res, err := svc.ListEvents(context.Background(), connect.NewRequest(&panelv1.ListEventsRequest{
		PageSize: 5,
	}))
	if err != nil {
		t.Fatalf("ListEvents() error = %v, want nil", err)
	}

	if got := len(res.Msg.GetEvents()); got != 5 {
		t.Fatalf("len(Events) = %d, want 5", got)
	}
	// 首页从 seq=1 开始。
	if got := res.Msg.GetEvents()[0].GetSeq(); got != 1 {
		t.Errorf("first seq = %d, want 1", got)
	}
	if got := res.Msg.GetNextPageToken(); got != "5" {
		t.Errorf("NextPageToken = %q, want %q", got, "5")
	}
}

func TestListEventsUsesDefaultPageSize(t *testing.T) {
	svc := &Service{}

	res, err := svc.ListEvents(context.Background(), connect.NewRequest(&panelv1.ListEventsRequest{}))
	if err != nil {
		t.Fatalf("ListEvents() error = %v, want nil", err)
	}
	if got := len(res.Msg.GetEvents()); got != defaultPageSize {
		t.Fatalf("len(Events) = %d, want %d", got, defaultPageSize)
	}
}

func TestListEventsLastPageHasNoToken(t *testing.T) {
	svc := &Service{}

	// 直接跳到最后一页：totalEvents - 5。
	res, err := svc.ListEvents(context.Background(), connect.NewRequest(&panelv1.ListEventsRequest{
		PageToken: strconv.Itoa(totalEvents - 5),
		PageSize:  5,
	}))
	if err != nil {
		t.Fatalf("ListEvents() error = %v, want nil", err)
	}
	if got := len(res.Msg.GetEvents()); got != 5 {
		t.Fatalf("len(Events) = %d, want 5", got)
	}
	if got := res.Msg.GetNextPageToken(); got != "" {
		t.Errorf("NextPageToken = %q, want empty on last page", got)
	}
}

func TestListEventsClampsPageSize(t *testing.T) {
	svc := &Service{}

	res, err := svc.ListEvents(context.Background(), connect.NewRequest(&panelv1.ListEventsRequest{
		PageSize: 10000,
	}))
	if err != nil {
		t.Fatalf("ListEvents() error = %v, want nil", err)
	}
	// 请求量超过 maxPageSize 时按上限返回，且不超过总数。
	want := min(maxPageSize, totalEvents)
	if got := len(res.Msg.GetEvents()); got != want {
		t.Fatalf("len(Events) = %d, want %d", got, want)
	}
}

func TestParsePageTokenFallsBackToFirstPage(t *testing.T) {
	tests := []struct {
		name  string
		token string
		want  int
	}{
		{name: "空串是首页", token: "", want: 0},
		{name: "合法游标", token: "10", want: 10},
		{name: "非数字回退首页", token: "abc", want: 0},
		{name: "负数回退首页", token: "-3", want: 0},
		{name: "超出总数回退首页", token: "9999", want: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := parsePageToken(tt.token); got != tt.want {
				t.Fatalf("parsePageToken(%q) = %d, want %d", tt.token, got, tt.want)
			}
		})
	}
}
