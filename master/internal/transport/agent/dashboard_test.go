package agent

import (
	"context"
	"runtime"
	"testing"

	"connectrpc.com/connect"

	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestDashboardOsInfo 验证系统信息来自真实的 gopsutil 采集，而不是空壳响应。
func TestDashboardOsInfo(t *testing.T) {
	setupSingleProcess(t)

	server := NewDashboardServer()
	resp, err := server.GetOsInfo(context.Background(), connect.NewRequest(&agentv1.OsInfoRequest{}))
	if err != nil {
		t.Fatalf("GetOsInfo 返回错误: %v", err)
	}
	if resp.Msg.GetOs() == "" {
		t.Fatal("os 为空，系统信息未采集")
	}
	if resp.Msg.GetKernelArch() == "" {
		t.Fatal("kernel_arch 为空")
	}
}

// TestDashboardCurrentInfo 验证当前负载包含 CPU 与内存数据。
func TestDashboardCurrentInfo(t *testing.T) {
	setupSingleProcess(t)

	server := NewDashboardServer()
	resp, err := server.CurrentInfo(context.Background(), connect.NewRequest(&agentv1.CurrentInfoRequest{}))
	if err != nil {
		t.Fatalf("CurrentInfo 返回错误: %v", err)
	}
	if resp.Msg.GetUptime() == 0 {
		t.Fatal("uptime = 0，运行时长未采集")
	}
	// 1Panel 的 psutil 封装按 Linux 采集 CPU/内存；在 macOS 开发机上跳过硬件断言，
	// 生产目标（Linux）上仍然强校验，避免把平台差异当成实现缺陷。
	if runtime.GOOS != "linux" {
		t.Logf("非 Linux 环境，跳过 CPU/内存断言（cpu_total=%d）", resp.Msg.GetCpuTotal())
		return
	}
	if resp.Msg.GetCpuTotal() <= 0 {
		t.Fatalf("cpu_total = %d, 期望大于 0", resp.Msg.GetCpuTotal())
	}
	if resp.Msg.GetMemoryTotal() == 0 {
		t.Fatal("memory_total = 0，内存信息未采集")
	}
}

// TestDashboardQuickJumps 验证快捷入口接口返回可序列化的列表。
func TestDashboardQuickJumps(t *testing.T) {
	setupSingleProcess(t)

	server := NewDashboardServer()
	resp, err := server.QuickJumps(context.Background(), connect.NewRequest(&agentv1.QuickJumpsRequest{}))
	if err != nil {
		t.Fatalf("QuickJumps 返回错误: %v", err)
	}
	if resp.Msg.GetItems() == nil {
		t.Fatal("items 为 nil，应为空切片")
	}
}
