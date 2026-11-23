package bootstrap

import (
	"strings"
	"testing"

	agentglobal "mypanel/agent/global"
	coreglobal "mypanel/core/global"
)

// TestCoreAndAgentShareDatabase 验证单进程下两个 module 拿到的是同一个连接。
func TestCoreAndAgentShareDatabase(t *testing.T) {
	dir := t.TempDir()
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
	if err := InitAgent(AgentOptions{
		DataDir:  dir,
		Version:  "v2.5.1-test",
		Mode:     "stable",
		Language: "zh",
	}); err != nil {
		t.Fatalf("InitAgent: %v", err)
	}

	if coreglobal.DB == nil || agentglobal.DB == nil {
		t.Fatal("core/agent 数据库未初始化")
	}
	if coreglobal.DB != agentglobal.DB {
		t.Fatal("core.DB 与 agent.DB 不是同一个 *gorm.DB")
	}
	if coreglobal.TaskDB != agentglobal.TaskDB {
		t.Fatal("TaskDB 未共享")
	}
	if coreglobal.AlertDB != agentglobal.AlertDB {
		t.Fatal("AlertDB 未共享")
	}

	// 业务表应当落在同一个物理库里。
	var count int64
	if err := agentglobal.DB.Raw("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('settings','apps','core_migrations','agent_migrations')").Scan(&count).Error; err != nil {
		t.Fatalf("检查共享库表失败: %v", err)
	}
	if count < 2 {
		t.Fatalf("共享库里业务表数量 = %d, 期望至少 2", count)
	}
}
