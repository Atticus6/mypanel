package agent

import (
	"context"
	"testing"
	"time"

	"connectrpc.com/connect"

	agentmodel "mypanel/agent/app/model"
	agentglobal "mypanel/agent/global"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestMonitorSearchMapsSeries 验证监控查询按 param 填充对应序列。
func TestMonitorSearchMapsSeries(t *testing.T) {
	setupSingleProcess(t)

	now := time.Now()
	// 监控数据落在独立的 MonitorDB 里，不是业务库。
	if err := agentglobal.MonitorDB.Create(&agentmodel.MonitorBase{
		Cpu: 12.5, Memory: 33.5, LoadUsage: 1.5, CpuLoad1: 0.1, CpuLoad5: 0.2, CpuLoad15: 0.3,
	}).Error; err != nil {
		t.Fatalf("插入监控数据失败: %v", err)
	}

	server := NewMonitorServer()
	resp, err := server.Search(context.Background(), connect.NewRequest(&agentv1.SearchMonitorRequest{
		Param:     "all",
		StartTime: now.Add(-time.Hour).Format(time.RFC3339),
		EndTime:   now.Add(time.Hour).Format(time.RFC3339),
	}))
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	var base *agentv1.MonitorSeries
	for _, item := range resp.Msg.GetItems() {
		if item.GetParam() == "base" {
			base = item
		}
	}
	if base == nil {
		t.Fatalf("缺少 base 序列: %+v", resp.Msg.GetItems())
	}
	if len(base.GetBase()) != 1 || base.GetBase()[0].GetCpu() != 12.5 {
		t.Fatalf("base 序列不正确: %+v", base.GetBase())
	}
}

// TestMonitorSearchRejectsBadTime 验证非法时间被拒绝。
func TestMonitorSearchRejectsBadTime(t *testing.T) {
	setupSingleProcess(t)

	server := NewMonitorServer()
	_, err := server.Search(context.Background(), connect.NewRequest(&agentv1.SearchMonitorRequest{
		Param: "all", StartTime: "bad", EndTime: "bad",
	}))
	if err == nil {
		t.Fatal("非法时间应被拒绝")
	}
	if _, ok := err.(*connect.Error); !ok {
		t.Fatalf("错误类型 = %T", err)
	}
}

// TestMonitorSettingRoundTrip 验证监控设置读写。
func TestMonitorSettingRoundTrip(t *testing.T) {
	setupSingleProcess(t)

	server := NewMonitorServer()
	if _, err := server.UpdateSetting(context.Background(), connect.NewRequest(&agentv1.UpdateMonitorSettingRequest{
		Key: "MonitorInterval", Value: "120",
	})); err != nil {
		t.Fatalf("UpdateSetting: %v", err)
	}
	resp, err := server.GetSetting(context.Background(), connect.NewRequest(&agentv1.GetMonitorSettingRequest{}))
	if err != nil {
		t.Fatalf("GetSetting: %v", err)
	}
	if resp.Msg.GetMonitorInterval() != "120" {
		t.Fatalf("monitor_interval = %q, 期望 120", resp.Msg.GetMonitorInterval())
	}
}

// TestMonitorOptions 验证磁盘与网卡列表可读。
func TestMonitorOptions(t *testing.T) {
	setupSingleProcess(t)

	server := NewMonitorServer()
	io, err := server.ListIOOptions(context.Background(), connect.NewRequest(&agentv1.ListMonitorIOOptionsRequest{}))
	if err != nil {
		t.Fatalf("ListIOOptions: %v", err)
	}
	if len(io.Msg.GetItems()) == 0 {
		t.Fatal("磁盘列表为空")
	}
	net, err := server.ListNetworkOptions(context.Background(), connect.NewRequest(&agentv1.ListMonitorNetworkOptionsRequest{}))
	if err != nil {
		t.Fatalf("ListNetworkOptions: %v", err)
	}
	if len(net.Msg.GetItems()) == 0 {
		t.Fatal("网卡列表为空")
	}
}
