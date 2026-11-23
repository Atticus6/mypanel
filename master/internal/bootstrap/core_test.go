package bootstrap

import (
	"strings"
	"testing"

	"mypanel/core/global"
)

// TestInitCoreCreatesDatabase 验证单进程模式下 core 能在给定目录完成初始化。
//
// 这里不依赖真实安装目录，也不读取 /usr/local/bin/1pctl：
// 首次启动必须在空目录下自行建库、建表、写入默认设置。
func TestInitCoreCreatesDatabase(t *testing.T) {
	dir := t.TempDir()

	err := InitCore(CoreOptions{
		DataDir:       dir,
		Version:       "v2.5.1-test",
		AdminUser:     "admin",
		AdminPassword: strings.Repeat("x", 12),
		Mode:          "stable",
		Language:      "zh",
	})
	if err != nil {
		t.Fatalf("InitCore 返回错误: %v", err)
	}

	if global.DB == nil {
		t.Fatal("core 数据库未初始化")
	}
	if global.SESSION == nil {
		t.Fatal("session 未初始化")
	}
	if global.CONF.Base.InstallDir != dir {
		t.Fatalf("install dir = %q, 期望 %q", global.CONF.Base.InstallDir, dir)
	}

	var count int64
	if err := global.DB.Table("settings").Count(&count).Error; err != nil {
		t.Fatalf("查询 settings 表失败: %v", err)
	}
	if count == 0 {
		t.Fatal("初始化后 settings 表为空，迁移没有写入默认设置")
	}
}
