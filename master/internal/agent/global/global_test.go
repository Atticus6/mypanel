package global

import (
	"strings"
	"testing"
)

// TestRepoURLEnvOverride 验证自定义发布源优先于原版官方地址，并去掉末尾斜杠。
func TestRepoURLEnvOverride(t *testing.T) {
	const custom = "https://example.com/my-release/"
	t.Setenv("MYPANEL_UPGRADE_REPO_URL", custom)
	t.Setenv("MYPANEL_UPGRADE_RESOURCE_URL", custom)
	t.Setenv("MYPANEL_UPGRADE_APP_URL", custom)

	for name, got := range map[string]string{
		"repo":     RepoURL(),
		"resource": ResourceURL(),
		"app":      AppRepoURL(),
	} {
		if got != strings.TrimRight(custom, "/") {
			t.Errorf("%s URL = %q, want %q", name, got, strings.TrimRight(custom, "/"))
		}
	}
}

// TestRepoURLFallback 验证未配置环境变量时回落到原版官方地址。
func TestRepoURLFallback(t *testing.T) {
	t.Setenv("MYPANEL_UPGRADE_REPO_URL", "")
	t.Setenv("MYPANEL_UPGRADE_RESOURCE_URL", "")
	t.Setenv("MYPANEL_UPGRADE_APP_URL", "")

	CONF.Base.Edition = "cn"
	if !strings.HasPrefix(RepoURL(), "https://resource.fit2cloud.com/1panel/package/") {
		t.Errorf("RepoURL() = %q, want original official prefix", RepoURL())
	}
	if !strings.HasPrefix(ResourceURL(), "https://resource.fit2cloud.com/1panel/resource/") {
		t.Errorf("ResourceURL() = %q, want original official prefix", ResourceURL())
	}
	if !strings.HasPrefix(AppRepoURL(), "https://apps-assets.fit2cloud.com") {
		t.Errorf("AppRepoURL() = %q, want original official prefix", AppRepoURL())
	}
}
