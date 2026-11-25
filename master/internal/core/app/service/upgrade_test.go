package service

import (
	"strings"
	"testing"
)

func TestParseGitHubRelease(t *testing.T) {
	tests := []struct {
		name        string
		release     githubRelease
		wantVersion string
		wantDate    string
		wantNew     int
		wantOpt     int
		wantFix     int
	}{
		{
			name: "按提交前缀统计三类变更",
			release: githubRelease{
				TagName:     "v0.1.6",
				PublishedAt: "2026-11-25T09:37:52Z",
				Body: strings.Join([]string{
					"## What's Changed",
					"* feat: 修复杂项 + 脚本国际化 by @Atticus6",
					"* fix: 修补死路由 by @Atticus6",
					"* refactor: 前端路由改为文件路由 by @Atticus6",
					"* chore: 构建注入版本号 by @Atticus6",
				}, "\n"),
			},
			wantVersion: "v0.1.6",
			wantDate:    "2026-11-25",
			wantNew:     1,
			wantOpt:     2,
			wantFix:     1,
		},
		{
			name: "中文章节标题按条目计数",
			release: githubRelease{
				TagName:     "v0.1.6",
				PublishedAt: "2026-11-25T09:37:52Z",
				Body: strings.Join([]string{
					"### 新增功能",
					"- feat: 脚本国际化",
					"### 功能优化",
					"- refactor: 应用商店自动同步",
					"- refactor: 侧栏动画",
					"### 问题修复",
					"- fix: 菜单设置过滤",
				}, "\n"),
			},
			wantVersion: "v0.1.6",
			wantDate:    "2026-11-25",
			wantNew:     1,
			wantOpt:     2,
			wantFix:     1,
		},
		{
			name: "短横线列表与非法日期不影响结果",
			release: githubRelease{
				TagName:     "v0.1.0",
				PublishedAt: "not-a-date",
				Body:        "- fix: 首个版本\n- docs: 补充说明",
			},
			wantVersion: "v0.1.0",
			wantDate:    "",
			wantNew:     0,
			wantOpt:     1,
			wantFix:     1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseGitHubRelease(tt.release)
			if got.Version != tt.wantVersion {
				t.Errorf("Version = %q, want %q", got.Version, tt.wantVersion)
			}
			if got.CreatedAt != tt.wantDate {
				t.Errorf("CreatedAt = %q, want %q", got.CreatedAt, tt.wantDate)
			}
			if got.NewCount != tt.wantNew {
				t.Errorf("NewCount = %d, want %d", got.NewCount, tt.wantNew)
			}
			if got.OptimizationCount != tt.wantOpt {
				t.Errorf("OptimizationCount = %d, want %d", got.OptimizationCount, tt.wantOpt)
			}
			if got.FixCount != tt.wantFix {
				t.Errorf("FixCount = %d, want %d", got.FixCount, tt.wantFix)
			}
			if got.Content != strings.TrimSpace(tt.release.Body) {
				t.Errorf("Content = %q, want original release body", got.Content)
			}
		})
	}
}

func TestReleaseNotesAPIPrecedence(t *testing.T) {
	const defaultAPI = "https://api.github.com/repos/Atticus6/mypanel/releases"
	if got := releaseNotesAPI(); got != defaultAPI {
		t.Errorf("default = %q, want %q", got, defaultAPI)
	}

	t.Setenv("MYPANEL_RELEASE_API_URL", "https://example.com/releases/")
	if got := releaseNotesAPI(); got != "https://example.com/releases" {
		t.Errorf("custom = %q, want trailing slash removed", got)
	}
}
