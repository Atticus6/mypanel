package bootstrap

import (
	"strings"
	"testing"

	agentglobal "mypanel/agent/global"
)

// TestInitAgentCreatesDatabase 验证单进程模式下 agent 能在空目录完成初始化。
//
// 不启动 agent 的 HTTP server，也不依赖 Docker、KVM 或 /usr/local/bin/1pctl：
// 首次启动必须自行建目录、建库、建表。
func TestInitAgentCreatesDatabase(t *testing.T) {
	dir := t.TempDir()

	// 单进程的真实顺序：先 core 后 agent。agent 的部分迁移会读 core 设置。
	if err := InitCore(CoreOptions{
		DataDir:       dir,
		Version:       "v2.5.1-test",
		AdminUser:     "admin",
		AdminPassword: strings.Repeat("x", 12),
		Mode:          "stable",
		Language:      "zh",
	}); err != nil {
		t.Fatalf("InitCore: %v", err)
	}

	err := InitAgent(AgentOptions{
		DataDir:  dir,
		Version:  "v2.5.1-test",
		Mode:     "stable",
		Language: "zh",
	})
	if err != nil {
		t.Fatalf("InitAgent 返回错误: %v", err)
	}

	if agentglobal.DB == nil {
		t.Fatal("agent 数据库未初始化")
	}
	if agentglobal.CACHE == nil {
		t.Fatal("agent 缓存未初始化")
	}
	if agentglobal.CONF.Base.InstallDir != dir {
		t.Fatalf("install dir = %q, 期望 %q", agentglobal.CONF.Base.InstallDir, dir)
	}
	if !agentglobal.IsMaster {
		t.Fatal("单进程模式应固定为主节点")
	}

	var count int64
	if err := agentglobal.DB.Table("websites").Count(&count).Error; err != nil {
		t.Fatalf("查询 websites 表失败: %v", err)
	}
}
