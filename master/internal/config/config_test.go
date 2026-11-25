package config

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

// writeYAML 在临时目录写入配置文件并返回路径。
func writeYAML(t *testing.T, content string) string {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "config.yaml")
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}
	return path
}

func TestLoadUsesDefaults(t *testing.T) {
	cfg, err := Load(nil, Options{SkipFile: true})
	if err != nil {
		t.Fatalf("Load() error = %v, want nil", err)
	}

	if cfg.Addr != ":8080" {
		t.Errorf("Addr = %q, want :8080", cfg.Addr)
	}
	if cfg.WebDir != "" {
		t.Errorf("WebDir = %q, want empty", cfg.WebDir)
	}
	if cfg.Debug {
		t.Error("Debug = true, want false")
	}
	if cfg.ShutdownTimeout != 5*time.Second {
		t.Errorf("ShutdownTimeout = %v, want 5s", cfg.ShutdownTimeout)
	}
	if cfg.ConfigFile != "" {
		t.Errorf("ConfigFile = %q, want empty when skipped", cfg.ConfigFile)
	}
	if cfg.UpgradeRepoURL == "" {
		t.Error("UpgradeRepoURL = empty, want original 1Panel official URL")
	}
	if cfg.UpgradeResourceURL == "" {
		t.Error("UpgradeResourceURL = empty, want original 1Panel official URL")
	}
	if cfg.UpgradeAppURL == "" {
		t.Error("UpgradeAppURL = empty, want original 1Panel official URL")
	}
}

// TestLoadUpgradeURLEnvOverride 验证升级源可以完全由环境变量替换为用户自己的发布地址。
func TestLoadUpgradeURLEnvOverride(t *testing.T) {
	const custom = "https://example.com/my-release"
	t.Setenv("MYPANEL_UPGRADE_REPO_URL", custom)
	t.Setenv("MYPANEL_UPGRADE_RESOURCE_URL", custom)
	t.Setenv("MYPANEL_UPGRADE_APP_URL", custom)

	cfg, err := Load(nil, Options{SkipFile: true})
	if err != nil {
		t.Fatalf("Load() error = %v, want nil", err)
	}
	if cfg.UpgradeRepoURL != custom {
		t.Errorf("UpgradeRepoURL = %q, want %q", cfg.UpgradeRepoURL, custom)
	}
	if cfg.UpgradeResourceURL != custom {
		t.Errorf("UpgradeResourceURL = %q, want %q", cfg.UpgradeResourceURL, custom)
	}
	if cfg.UpgradeAppURL != custom {
		t.Errorf("UpgradeAppURL = %q, want %q", cfg.UpgradeAppURL, custom)
	}
}

func TestLoadFromYAML(t *testing.T) {
	path := writeYAML(t, `
addr: ":9000"
web_dir: ""
debug: true
shutdown_timeout: "30s"
`)

	cfg, err := Load(nil, Options{Path: path})
	if err != nil {
		t.Fatalf("Load() error = %v, want nil", err)
	}

	if cfg.Addr != ":9000" {
		t.Errorf("Addr = %q, want :9000", cfg.Addr)
	}
	if !cfg.Debug {
		t.Error("Debug = false, want true")
	}
	if cfg.ShutdownTimeout != 30*time.Second {
		t.Errorf("ShutdownTimeout = %v, want 30s", cfg.ShutdownTimeout)
	}
	if cfg.ConfigFile == "" {
		t.Error("ConfigFile = empty, want the loaded path")
	}
}

func TestYAMLPartiallyOverridesDefaults(t *testing.T) {
	// 只写一个字段，其余应保持默认值。
	path := writeYAML(t, `addr: ":7777"`)

	cfg, err := Load(nil, Options{Path: path})
	if err != nil {
		t.Fatalf("Load() error = %v, want nil", err)
	}

	if cfg.Addr != ":7777" {
		t.Errorf("Addr = %q, want :7777", cfg.Addr)
	}
	if cfg.ShutdownTimeout != 5*time.Second {
		t.Errorf("ShutdownTimeout = %v, want default 5s", cfg.ShutdownTimeout)
	}
}

func TestEnvOverridesYAML(t *testing.T) {
	// 这是最关键的一条：容器里用环境变量临时改配置，
	// 不该被镜像内的 YAML 压掉。
	path := writeYAML(t, `addr: ":9000"`)
	t.Setenv("MYPANEL_ADDR", ":7000")

	cfg, err := Load(nil, Options{Path: path})
	if err != nil {
		t.Fatalf("Load() error = %v, want nil", err)
	}

	if cfg.Addr != ":7000" {
		t.Fatalf("Addr = %q, want env value :7000", cfg.Addr)
	}
}

func TestEnvOverridesDefaults(t *testing.T) {
	t.Setenv("MYPANEL_ADDR", ":6000")
	t.Setenv("MYPANEL_DEBUG", "true")
	t.Setenv("MYPANEL_SHUTDOWN_TIMEOUT", "45s")

	cfg, err := Load(nil, Options{SkipFile: true})
	if err != nil {
		t.Fatalf("Load() error = %v, want nil", err)
	}

	if cfg.Addr != ":6000" {
		t.Errorf("Addr = %q, want :6000", cfg.Addr)
	}
	if !cfg.Debug {
		t.Error("Debug = false, want true from env")
	}
	if cfg.ShutdownTimeout != 45*time.Second {
		t.Errorf("ShutdownTimeout = %v, want 45s", cfg.ShutdownTimeout)
	}
}

func TestEnvWebDir(t *testing.T) {
	// 下划线键名映射必须生效，否则 MYPANEL_WEB_DIR 永远读不到。
	dir := t.TempDir()
	t.Setenv("MYPANEL_WEB_DIR", dir)

	cfg, err := Load(nil, Options{SkipFile: true})
	if err != nil {
		t.Fatalf("Load() error = %v, want nil", err)
	}
	if cfg.WebDir != dir {
		t.Fatalf("WebDir = %q, want %q", cfg.WebDir, dir)
	}
}

func TestExplicitPathMustExist(t *testing.T) {
	// 用户明确指定了文件却不存在，必须报错而不是静默回退默认值。
	_, err := Load(nil, Options{Path: filepath.Join(t.TempDir(), "nope.yaml")})
	if err == nil {
		t.Fatal("Load() error = nil, want error for missing explicit path")
	}
}

func TestMissingDefaultFileIsOK(t *testing.T) {
	// 未指定路径且默认位置都没有配置文件时，应正常返回默认值。
	cfg, err := Load(nil, Options{})
	if err != nil {
		t.Fatalf("Load() error = %v, want nil when no config file exists", err)
	}
	if cfg.ConfigFile != "" {
		t.Errorf("ConfigFile = %q, want empty", cfg.ConfigFile)
	}
}

func TestMalformedYAMLReportsError(t *testing.T) {
	// 文件存在但解析失败属于真错误，不能被当成「没配置」。
	path := writeYAML(t, "addr: [unclosed\n  bad: : :\n")

	if _, err := Load(nil, Options{Path: path}); err == nil {
		t.Fatal("Load() error = nil, want parse error")
	}
}

func TestInvalidShutdownTimeout(t *testing.T) {
	tests := []struct {
		name  string
		value string
	}{
		{name: "非时长格式", value: "abc"},
		{name: "缺少单位", value: "5"},
		{name: "零值", value: "0s"},
		{name: "负数", value: "-1s"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			path := writeYAML(t, "shutdown_timeout: \""+tt.value+"\"")

			if _, err := Load(nil, Options{Path: path}); err == nil {
				t.Fatalf("Load(shutdown_timeout=%q) error = nil, want error", tt.value)
			}
		})
	}
}

func TestEmptyAddrRejected(t *testing.T) {
	path := writeYAML(t, `addr: "  "`)

	if _, err := Load(nil, Options{Path: path}); err == nil {
		t.Fatal("Load() error = nil, want error for blank addr")
	}
}

func TestNonexistentWebDirRejected(t *testing.T) {
	// web_dir 指向不存在的目录说明部署有问题，应尽早失败，
	// 而不是启动后每个页面请求都 404。
	path := writeYAML(t, "web_dir: \"/nonexistent/path/xyz\"")

	if _, err := Load(nil, Options{Path: path}); err == nil {
		t.Fatal("Load() error = nil, want error for missing web_dir")
	}
}

func TestFlagValueBeatsEnv(t *testing.T) {
	// 模拟 main 里的做法：flag 通过 v.Set 写入，优先级最高。
	t.Setenv("MYPANEL_ADDR", ":6000")

	v := NewViper()
	v.Set("addr", ":5000")

	cfg, err := Load(v, Options{SkipFile: true})
	if err != nil {
		t.Fatalf("Load() error = %v, want nil", err)
	}
	if cfg.Addr != ":5000" {
		t.Fatalf("Addr = %q, want flag value :5000", cfg.Addr)
	}
}

func TestLocalOverrideMerges(t *testing.T) {
	// config.local.yaml 只覆盖它提到的键，其余保持主配置的值。
	dir := t.TempDir()
	mainPath := filepath.Join(dir, "config.yaml")
	if err := os.WriteFile(mainPath, []byte("addr: \":9000\"\ndebug: false\n"), 0o600); err != nil {
		t.Fatalf("write main: %v", err)
	}
	localPath := filepath.Join(dir, "config.local.yaml")
	if err := os.WriteFile(localPath, []byte("addr: \":9100\"\n"), 0o600); err != nil {
		t.Fatalf("write local: %v", err)
	}

	cfg, err := Load(nil, Options{Path: mainPath})
	if err != nil {
		t.Fatalf("Load() error = %v, want nil", err)
	}

	if cfg.Addr != ":9100" {
		t.Errorf("Addr = %q, want local override :9100", cfg.Addr)
	}
	// 本地文件没提 debug，应保留主配置的值。
	if cfg.Debug {
		t.Error("Debug = true, want false from main config")
	}
	if cfg.ShutdownTimeout != 5*time.Second {
		t.Errorf("ShutdownTimeout = %v, want default 5s", cfg.ShutdownTimeout)
	}
}

func TestEnvBeatsLocalOverride(t *testing.T) {
	// 完整优先级：env > config.local.yaml > config.yaml > default。
	dir := t.TempDir()
	mainPath := filepath.Join(dir, "config.yaml")
	if err := os.WriteFile(mainPath, []byte("addr: \":9000\"\n"), 0o600); err != nil {
		t.Fatalf("write main: %v", err)
	}
	localPath := filepath.Join(dir, "config.local.yaml")
	if err := os.WriteFile(localPath, []byte("addr: \":9100\"\n"), 0o600); err != nil {
		t.Fatalf("write local: %v", err)
	}
	t.Setenv("MYPANEL_ADDR", ":9200")

	cfg, err := Load(nil, Options{Path: mainPath})
	if err != nil {
		t.Fatalf("Load() error = %v, want nil", err)
	}
	if cfg.Addr != ":9200" {
		t.Fatalf("Addr = %q, want env value :9200", cfg.Addr)
	}
}

func TestMissingLocalOverrideIsOK(t *testing.T) {
	dir := t.TempDir()
	mainPath := filepath.Join(dir, "config.yaml")
	if err := os.WriteFile(mainPath, []byte("addr: \":9000\"\n"), 0o600); err != nil {
		t.Fatalf("write main: %v", err)
	}

	cfg, err := Load(nil, Options{Path: mainPath})
	if err != nil {
		t.Fatalf("Load() error = %v, want nil without local file", err)
	}
	if cfg.Addr != ":9000" {
		t.Errorf("Addr = %q, want :9000", cfg.Addr)
	}
}

func TestMalformedLocalOverrideReportsError(t *testing.T) {
	// 本地覆盖存在但写错，必须报错——静默忽略会让人以为覆盖生效了。
	dir := t.TempDir()
	mainPath := filepath.Join(dir, "config.yaml")
	if err := os.WriteFile(mainPath, []byte("addr: \":9000\"\n"), 0o600); err != nil {
		t.Fatalf("write main: %v", err)
	}
	localPath := filepath.Join(dir, "config.local.yaml")
	if err := os.WriteFile(localPath, []byte("addr: [broken\n"), 0o600); err != nil {
		t.Fatalf("write local: %v", err)
	}

	if _, err := Load(nil, Options{Path: mainPath}); err == nil {
		t.Fatal("Load() error = nil, want error for malformed local override")
	}
}
