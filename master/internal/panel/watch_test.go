package panel_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"connectrpc.com/connect"

	"mypanel/master/internal/panel"
	panelv1 "mypanel/proto/gen/go/panel/v1"
	"mypanel/proto/gen/go/panel/v1/panelv1connect"
)

// newTestClient 起一个只挂 PanelService 的测试服务端，返回连到它的 client。
//
// connect.ServerStream 没有导出构造器，所以 Watch 只能通过真实连接来测。
// httptest 用本机回环，不占固定端口，也不依赖外部网络。
func newTestClient(t *testing.T, svc *panel.Service) panelv1connect.PanelServiceClient {
	t.Helper()

	mux := http.NewServeMux()
	path, handler := panelv1connect.NewPanelServiceHandler(svc)
	mux.Handle(path, handler)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	return panelv1connect.NewPanelServiceClient(srv.Client(), srv.URL)
}

func TestWatchStreamsIncreasingSeq(t *testing.T) {
	client := newTestClient(t, &panel.Service{Version: "test"})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	stream, err := client.Watch(ctx, connect.NewRequest(&panelv1.WatchRequest{
		IntervalSeconds: 1,
	}))
	if err != nil {
		t.Fatalf("Watch() error = %v, want nil", err)
	}
	defer stream.Close()

	// 只等前两个事件，避免测试被固定时长拖慢。
	var got []*panelv1.WatchEvent
	for len(got) < 2 {
		if !stream.Receive() {
			t.Fatalf("stream ended early: %v", stream.Err())
		}
		got = append(got, stream.Msg())
	}

	if got[0].GetSeq() != 1 || got[1].GetSeq() != 2 {
		t.Fatalf("seq = %d,%d, want 1,2", got[0].GetSeq(), got[1].GetSeq())
	}
	if got[0].GetKind() == "" {
		t.Error("Kind is empty, want tick description")
	}
	if _, err := time.Parse(time.RFC3339Nano, got[0].GetAt()); err != nil {
		t.Errorf("At = %q is not RFC3339Nano: %v", got[0].GetAt(), err)
	}
}

func TestWatchStopsWhenCallerCancels(t *testing.T) {
	client := newTestClient(t, &panel.Service{})

	ctx, cancel := context.WithCancel(context.Background())
	stream, err := client.Watch(ctx, connect.NewRequest(&panelv1.WatchRequest{
		IntervalSeconds: 1,
	}))
	if err != nil {
		t.Fatalf("Watch() error = %v, want nil", err)
	}
	defer stream.Close()

	if !stream.Receive() {
		t.Fatalf("first event missing: %v", stream.Err())
	}

	// 取消后流应结束，而不是无限推送。
	cancel()

	done := make(chan error, 1)
	go func() {
		for stream.Receive() {
		}
		done <- stream.Err()
	}()

	select {
	case err := <-done:
		if err == nil {
			t.Fatal("stream ended without error, want cancellation error")
		}
		var connectErr *connect.Error
		if !errors.As(err, &connectErr) || connectErr.Code() != connect.CodeCanceled {
			t.Fatalf("err = %v, want connect CodeCanceled", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("stream did not stop after cancel")
	}
}

func TestPingOverConnect(t *testing.T) {
	client := newTestClient(t, &panel.Service{Version: "e2e"})

	res, err := client.Ping(context.Background(), connect.NewRequest(&panelv1.PingRequest{
		Message: "round-trip",
	}))
	if err != nil {
		t.Fatalf("Ping() error = %v, want nil", err)
	}
	if got := res.Msg.GetMessage(); got != "round-trip" {
		t.Errorf("Message = %q, want %q", got, "round-trip")
	}
	if got := res.Msg.GetVersion(); got != "e2e" {
		t.Errorf("Version = %q, want %q", got, "e2e")
	}
}
