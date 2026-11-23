package agent

import (
	"context"

	"mypanel/agent/app/model"
	agentglobal "mypanel/agent/global"
	"testing"

	"connectrpc.com/connect"

	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestContainerSearchDoesNotPanic 验证容器查询在 Docker 不可用时返回可识别的错误。
//
// 开发机与 CI 往往没有 Docker daemon；这里断言「要么正常返回列表，要么
// 返回 Internal 并且不 panic」，既覆盖适配器转换，也不把环境差异当成缺陷。
func TestContainerSearchDoesNotPanic(t *testing.T) {
	setupSingleProcess(t)

	server := NewContainerServer()
	resp, err := server.Search(context.Background(), connect.NewRequest(&agentv1.SearchContainersRequest{
		Page:     1,
		PageSize: 10,
		State:    "all",
	}))
	if err != nil {
		connectErr, ok := err.(*connect.Error)
		if !ok {
			t.Fatalf("错误类型 = %T, 期望 *connect.Error", err)
		}
		if connectErr.Code() != connect.CodeInternal {
			t.Fatalf("code = %v, 期望 internal（Docker 不可用）", connectErr.Code())
		}
		t.Logf("Docker 不可用，按预期返回 Internal: %v", connectErr.Message())
		return
	}
	if resp.Msg.GetTotal() < 0 {
		t.Fatalf("total = %d，不应为负数", resp.Msg.GetTotal())
	}
}

// TestContainerStatusDoesNotPanic 验证状态统计接口在 Docker 不可用时的错误处理。
func TestContainerStatusDoesNotPanic(t *testing.T) {
	setupSingleProcess(t)

	server := NewContainerServer()
	_, err := server.Status(context.Background(), connect.NewRequest(&agentv1.ContainerStatusRequest{
		ContainersOnly: true,
	}))
	if err == nil {
		return
	}
	connectErr, ok := err.(*connect.Error)
	if !ok {
		t.Fatalf("错误类型 = %T", err)
	}
	if connectErr.Code() != connect.CodeInternal {
		t.Fatalf("code = %v, 期望 internal（Docker 不可用）", connectErr.Code())
	}
}

// TestContainerImagesNetworkVolumeTolerant 验证三个列表接口在 Docker 不可用时安全失败。
func TestContainerImagesNetworkVolumeTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewContainerServer()
	if _, err := server.SearchImages(context.Background(), connect.NewRequest(&agentv1.SearchImagesRequest{Page: 1, PageSize: 10})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("images 错误类型 = %T", err)
		}
	}
	if _, err := server.SearchNetworks(context.Background(), connect.NewRequest(&agentv1.SearchNetworksRequest{Page: 1, PageSize: 10})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("networks 错误类型 = %T", err)
		}
	}
	if _, err := server.SearchVolumes(context.Background(), connect.NewRequest(&agentv1.SearchVolumesRequest{Page: 1, PageSize: 10})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("volumes 错误类型 = %T", err)
		}
	}
}

// TestContainerComposeTolerant 验证 Compose 列表在 Docker 不可用时安全失败。
func TestContainerComposeTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewContainerServer()
	_, err := server.SearchCompose(context.Background(), connect.NewRequest(&agentv1.SearchComposeRequest{
		Page:     1,
		PageSize: 10,
	}))
	if err == nil {
		return
	}
	if _, ok := err.(*connect.Error); !ok {
		t.Fatalf("错误类型 = %T", err)
	}
}

// TestContainerReposAndTemplates 验证镜像仓库与 Compose 模板列表走真实数据库。
func TestContainerReposAndTemplates(t *testing.T) {
	setupSingleProcess(t)

	repo := model.ImageRepo{Name: "dockerhub", DownloadUrl: "docker.io", Protocol: "https", Status: "Success"}
	if err := agentglobal.DB.Create(&repo).Error; err != nil {
		t.Fatalf("插入镜像仓库失败: %v", err)
	}
	template := model.ComposeTemplate{Name: "redis-template", Description: "redis", Content: "services: {}"}
	if err := agentglobal.DB.Create(&template).Error; err != nil {
		t.Fatalf("插入 Compose 模板失败: %v", err)
	}

	server := NewContainerServer()
	repos, err := server.SearchImageRepos(context.Background(), connect.NewRequest(&agentv1.SearchImageReposRequest{Page: 1, PageSize: 10}))
	if err != nil {
		t.Fatalf("SearchImageRepos: %v", err)
	}
	foundRepo := false
	for _, item := range repos.Msg.GetItems() {
		if item.GetName() == "dockerhub" {
			foundRepo = true
		}
	}
	if !foundRepo {
		t.Fatalf("repos = %+v, 期望包含 dockerhub", repos.Msg.GetItems())
	}

	templates, err := server.SearchComposeTemplates(context.Background(), connect.NewRequest(&agentv1.SearchComposeTemplatesRequest{Page: 1, PageSize: 10}))
	if err != nil {
		t.Fatalf("SearchComposeTemplates: %v", err)
	}
	foundTemplate := false
	for _, item := range templates.Msg.GetItems() {
		if item.GetName() == "redis-template" {
			foundTemplate = true
		}
	}
	if !foundTemplate {
		t.Fatalf("templates = %+v, 期望包含 redis-template", templates.Msg.GetItems())
	}
}

// TestContainerInspectTolerant 验证 inspect 在 Docker 不可用时安全失败。
func TestContainerInspectTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewContainerServer()
	_, err := server.Inspect(context.Background(), connect.NewRequest(&agentv1.ContainerInspectRequest{
		Id: "abc", Type: "container",
	}))
	if err == nil {
		return
	}
	if _, ok := err.(*connect.Error); !ok {
		t.Fatalf("错误类型 = %T", err)
	}
}

// TestContainerManageTolerant 验证容器管理类接口在无 Docker 环境时安全失败。
func TestContainerManageTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewContainerServer()
	ctx := context.Background()
	if _, err := server.GetLimit(ctx, connect.NewRequest(&agentv1.GetContainerLimitRequest{})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("limit: %T", err)
		}
	}
	if _, err := server.Prune(ctx, connect.NewRequest(&agentv1.PruneContainersRequest{PruneType: "container"})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("prune: %T", err)
		}
	}
	if _, err := server.ListNetworks(ctx, connect.NewRequest(&agentv1.ListNetworksRequest{})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("network: %T", err)
		}
	}
	if _, err := server.OperateCompose(ctx, connect.NewRequest(&agentv1.OperateComposeRequest{
		Name: "demo", Operation: "down",
	})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("compose: %T", err)
		}
	}
}

// TestContainerTemplateAndRepoTolerant 验证模板与仓库接口的安全失败行为。
func TestContainerTemplateAndRepoTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewContainerServer()
	ctx := context.Background()
	list, err := server.ListTemplates(ctx, connect.NewRequest(&agentv1.ListComposeTemplatesRequest{}))
	if err != nil {
		t.Fatalf("ListTemplates: %v", err)
	}
	if list.Msg.GetItems() == nil {
		t.Fatal("模板列表为 nil")
	}
	if _, err := server.DeleteRepo(ctx, connect.NewRequest(&agentv1.DeleteImageRepoRequest{Id: 9999})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("repo delete: %T", err)
		}
	}
	if _, err := server.UpdateTemplate(ctx, connect.NewRequest(&agentv1.UpdateComposeTemplateRequest{Id: 9999})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("template update: %T", err)
		}
	}
}

// TestContainerDockerTolerant 验证 Docker 守护进程与镜像接口在无 Docker 时安全失败。
func TestContainerDockerTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewContainerServer()
	ctx := context.Background()
	status, err := server.GetDockerStatus(ctx, connect.NewRequest(&agentv1.GetDockerStatusRequest{}))
	if err != nil {
		t.Fatalf("GetDockerStatus: %v", err)
	}
	if status.Msg.GetIsExist() {
		t.Log("当前环境存在 Docker，跳过失败断言")
	}
	if _, err := server.PullImages(ctx, connect.NewRequest(&agentv1.PullImagesRequest{
		ImageName: []string{"nginx:latest"},
	})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("pull: %T", err)
		}
	}
	if _, err := server.GetDaemonJson(ctx, connect.NewRequest(&agentv1.GetDaemonJsonRequest{})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("daemon json: %T", err)
		}
	}
	if _, err := server.SearchRemoteImages(ctx, connect.NewRequest(&agentv1.SearchRemoteImagesRequest{
		Query: "nginx", Page: 1, PageSize: 10,
	})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("remote search: %T", err)
		}
	}
}

// TestContainerQueryTolerant 验证容器查询类接口在无 Docker 环境时安全失败。
func TestContainerQueryTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewContainerServer()
	ctx := context.Background()
	if _, err := server.ListContainers(ctx, connect.NewRequest(&agentv1.ListContainersRequest{})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("list: %T", err)
		}
	}
	if _, err := server.GetContainerUsers(ctx, connect.NewRequest(&agentv1.GetContainerUsersRequest{Name: "demo"})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("users: %T", err)
		}
	}
	if _, err := server.GetContainerStats(ctx, connect.NewRequest(&agentv1.GetContainerStatsRequest{})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("stats: %T", err)
		}
	}
	if _, err := server.SampleContainerStats(ctx, connect.NewRequest(&agentv1.SampleContainerStatsRequest{Id: "abc"})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("sample: %T", err)
		}
	}
}
