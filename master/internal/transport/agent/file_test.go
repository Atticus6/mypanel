package agent

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"connectrpc.com/connect"

	"mypanel/agent/app/model"
	agentglobal "mypanel/agent/global"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestListFilesAndGetFile 验证文件浏览走真实文件系统：
// 在临时目录写入文件与子目录后，ListFiles 能列出全部条目，GetFile 能读到内容。
func TestListFilesAndGetFile(t *testing.T) {
	setupSingleProcess(t)

	dir := t.TempDir()
	filePath := filepath.Join(dir, "hello.txt")
	if err := os.WriteFile(filePath, []byte("hello"), 0o644); err != nil {
		t.Fatalf("写入测试文件失败: %v", err)
	}
	if err := os.Mkdir(filepath.Join(dir, "sub"), 0o755); err != nil {
		t.Fatalf("创建子目录失败: %v", err)
	}

	server := NewFileServer()

	list, err := server.ListFiles(context.Background(), connect.NewRequest(&agentv1.ListFilesRequest{
		Path:       dir,
		Page:       1,
		PageSize:   100,
		ShowHidden: true,
	}))
	if err != nil {
		t.Fatalf("ListFiles 返回错误: %v", err)
	}
	if list.Msg.GetItemTotal() < 2 {
		t.Fatalf("item_total = %d, 期望至少 2", list.Msg.GetItemTotal())
	}

	var foundFile, foundDir bool
	for _, item := range list.Msg.GetItems() {
		switch item.GetName() {
		case "hello.txt":
			foundFile = true
			if item.GetSize() != 5 || item.GetIsDir() {
				t.Fatalf("hello.txt = size %d isDir %v, 期望 5/false", item.GetSize(), item.GetIsDir())
			}
		case "sub":
			foundDir = true
			if !item.GetIsDir() {
				t.Fatal("sub 应为目录")
			}
		}
	}
	if !foundFile || !foundDir {
		t.Fatalf("未找到预期条目: file=%v dir=%v items=%d", foundFile, foundDir, len(list.Msg.GetItems()))
	}

	detail, err := server.GetFile(context.Background(), connect.NewRequest(&agentv1.GetFileRequest{Path: filePath}))
	if err != nil {
		t.Fatalf("GetFile 返回错误: %v", err)
	}
	if detail.Msg.GetName() != "hello.txt" {
		t.Fatalf("name = %q, 期望 hello.txt", detail.Msg.GetName())
	}
	if detail.Msg.GetSize() != 5 {
		t.Fatalf("size = %d, 期望 5", detail.Msg.GetSize())
	}
}

// TestGetFileNotFound 验证不存在的路径返回 NotFound。
func TestGetFileNotFound(t *testing.T) {
	setupSingleProcess(t)

	server := NewFileServer()
	_, err := server.GetFile(context.Background(), connect.NewRequest(&agentv1.GetFileRequest{
		Path: filepath.Join(t.TempDir(), "missing.txt"),
	}))
	if err == nil {
		t.Fatal("不存在的文件应返回错误")
	}
	connectErr, ok := err.(*connect.Error)
	if !ok {
		t.Fatalf("错误类型 = %T", err)
	}
	if connectErr.Code() != connect.CodeNotFound {
		t.Fatalf("code = %v, 期望 not_found", connectErr.Code())
	}
}

// TestChangeFileMode 验证权限修改真实生效。
func TestChangeFileMode(t *testing.T) {
	setupSingleProcess(t)

	path := filepath.Join(t.TempDir(), "mode.txt")
	if err := os.WriteFile(path, []byte("x"), 0o644); err != nil {
		t.Fatalf("写入文件失败: %v", err)
	}

	server := NewFileServer()
	if _, err := server.ChangeMode(context.Background(), connect.NewRequest(&agentv1.ChangeFileModeRequest{
		Path: path,
		Mode: 0o600,
	})); err != nil {
		t.Fatalf("ChangeMode 返回错误: %v", err)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat: %v", err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("mode = %o, 期望 600", info.Mode().Perm())
	}
}

// TestCompressFiles 验证压缩任务能产出压缩包。
func TestCompressFiles(t *testing.T) {
	setupSingleProcess(t)

	dir := t.TempDir()
	src := filepath.Join(dir, "data")
	if err := os.Mkdir(src, 0o755); err != nil {
		t.Fatalf("创建目录失败: %v", err)
	}
	if err := os.WriteFile(filepath.Join(src, "a.txt"), []byte("hello"), 0o644); err != nil {
		t.Fatalf("写入文件失败: %v", err)
	}
	dst := filepath.Join(dir, "out")
	if err := os.Mkdir(dst, 0o755); err != nil {
		t.Fatalf("创建目标目录失败: %v", err)
	}

	server := NewFileServer()
	if _, err := server.Compress(context.Background(), connect.NewRequest(&agentv1.CompressFilesRequest{
		Files:  []string{src},
		Dst:    dst,
		Type:   "tar.gz",
		Name:   "data.tar.gz",
		TaskId: "task-compress-test",
	})); err != nil {
		t.Fatalf("Compress 返回错误: %v", err)
	}

	target := filepath.Join(dst, "data.tar.gz")
	for i := 0; i < 30; i++ {
		if info, err := os.Stat(target); err == nil && info.Size() > 0 {
			return
		}
		time.Sleep(100 * time.Millisecond)
	}
	t.Fatalf("压缩包未生成: %s", target)
}

// TestDeleteAndRenameFile 验证删除与重命名真实生效。
func TestDeleteAndRenameFile(t *testing.T) {
	setupSingleProcess(t)

	dir := t.TempDir()
	path := filepath.Join(dir, "a.txt")
	if err := os.WriteFile(path, []byte("x"), 0o644); err != nil {
		t.Fatalf("写入失败: %v", err)
	}

	server := NewFileServer()
	renamed := filepath.Join(dir, "b.txt")
	if _, err := server.ChangeName(context.Background(), connect.NewRequest(&agentv1.ChangeFileNameRequest{
		OldName: path,
		NewName: renamed,
	})); err != nil {
		t.Fatalf("ChangeName: %v", err)
	}
	if _, err := os.Stat(renamed); err != nil {
		t.Fatalf("重命名后文件不存在: %v", err)
	}
	if _, err := server.Delete(context.Background(), connect.NewRequest(&agentv1.DeleteFilesRequest{
		Path:        renamed,
		ForceDelete: true,
	})); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := os.Stat(renamed); !os.IsNotExist(err) {
		t.Fatalf("删除后文件仍存在: %v", err)
	}
}

// TestDecompressFiles 验证压缩包能解压出新文件。
func TestDecompressFiles(t *testing.T) {
	setupSingleProcess(t)

	dir := t.TempDir()
	src := filepath.Join(dir, "src")
	if err := os.Mkdir(src, 0o755); err != nil {
		t.Fatalf("创建目录失败: %v", err)
	}
	if err := os.WriteFile(filepath.Join(src, "a.txt"), []byte("hello"), 0o644); err != nil {
		t.Fatalf("写入失败: %v", err)
	}
	outDir := filepath.Join(dir, "out")
	out2 := filepath.Join(dir, "out2")
	_ = os.Mkdir(outDir, 0o755)
	_ = os.Mkdir(out2, 0o755)

	server := NewFileServer()
	if _, err := server.Compress(context.Background(), connect.NewRequest(&agentv1.CompressFilesRequest{
		Files: []string{src}, Dst: outDir, Type: "tar.gz", Name: "src.tar.gz", TaskId: "c1",
	})); err != nil {
		t.Fatalf("Compress: %v", err)
	}
	archive := filepath.Join(outDir, "src.tar.gz")
	for i := 0; i < 30; i++ {
		if info, err := os.Stat(archive); err == nil && info.Size() > 0 {
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	if _, err := os.Stat(archive); err != nil {
		t.Fatalf("压缩包不存在: %v", err)
	}

	if _, err := server.DeCompress(context.Background(), connect.NewRequest(&agentv1.DecompressFilesRequest{
		Path: archive, Dst: out2, Type: "tar.gz", TaskId: "d1",
	})); err != nil {
		t.Fatalf("DeCompress: %v", err)
	}
	for i := 0; i < 40; i++ {
		if _, err := os.Stat(filepath.Join(out2, "src", "a.txt")); err == nil {
			return
		}
		time.Sleep(100 * time.Millisecond)
	}
	t.Fatalf("解压后文件未出现: %s", filepath.Join(out2, "src", "a.txt"))
}

// TestSearchRecycle 验证回收站查询不报错。
func TestSearchRecycle(t *testing.T) {
	setupSingleProcess(t)

	server := NewFileServer()
	resp, err := server.SearchRecycle(context.Background(), connect.NewRequest(&agentv1.SearchRecycleRequest{Page: 1, PageSize: 10}))
	if err != nil {
		t.Fatalf("SearchRecycle: %v", err)
	}
	if resp.Msg.GetItems() == nil {
		t.Fatal("items 为 nil")
	}
}

// TestSearchFavorites 验证收藏夹查询走真实数据库。
func TestSearchFavorites(t *testing.T) {
	setupSingleProcess(t)

	// 同一测试进程内 DB 可能被多次初始化，用唯一路径避免命中 path 唯一索引。
	name := "notes-" + t.Name() + ".txt"
	path := "/tmp/" + name
	if err := agentglobal.DB.Create(&model.Favorite{Name: name, Path: path, Type: "txt", IsTxt: true}).Error; err != nil {
		t.Fatalf("插入收藏失败: %v", err)
	}
	server := NewFileServer()
	resp, err := server.SearchFavorites(context.Background(), connect.NewRequest(&agentv1.SearchFavoritesRequest{Page: 1, PageSize: 10}))
	if err != nil {
		t.Fatalf("SearchFavorites: %v", err)
	}
	found := false
	for _, item := range resp.Msg.GetItems() {
		if item.GetName() == name {
			found = true
		}
	}
	if !found {
		t.Fatalf("items = %+v, 期望包含 %s", resp.Msg.GetItems(), name)
	}
}

// TestRestoreRecycleTolerant 验证回收站还原安全失败。
func TestRestoreRecycleTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewFileServer()
	_, err := server.RestoreRecycle(context.Background(), connect.NewRequest(&agentv1.RestoreRecycleRequest{
		From: "trash", RName: "missing", Name: "missing",
	}))
	if err == nil {
		return
	}
	if _, ok := err.(*connect.Error); !ok {
		t.Fatalf("错误类型 = %T", err)
	}
}

// TestFavoritesAndHistoryTolerant 验证收藏写操作与历史查询。
func TestFavoritesAndHistoryTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewFileServer()
	if _, err := server.AddFavorite(context.Background(), connect.NewRequest(&agentv1.AddFavoriteRequest{Path: "/tmp/not-exist"})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("add favorite: %T", err)
		}
	}
	if _, err := server.SearchHistory(context.Background(), connect.NewRequest(&agentv1.SearchFileHistoryRequest{
		Page: 1, PageSize: 10, Scope: "all",
	})); err != nil {
		t.Fatalf("SearchHistory: %v", err)
	}
}
