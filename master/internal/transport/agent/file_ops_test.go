package agent

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"connectrpc.com/connect"

	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestCreateCheckAndSaveFile 验证新建、存在性检查、保存与预览走真实文件系统。
func TestCreateCheckAndSaveFile(t *testing.T) {
	setupSingleProcess(t)

	dir := t.TempDir()
	path := filepath.Join(dir, "notes.txt")
	server := NewFileServer()

	if _, err := server.CreateFile(context.Background(), connect.NewRequest(&agentv1.CreateFileRequest{
		Path: path,
	})); err != nil {
		t.Fatalf("CreateFile: %v", err)
	}
	if info, err := os.Stat(path); err != nil || info.IsDir() {
		t.Fatalf("新建文件不存在: err=%v", err)
	}
	// 1Panel 的 CreateFile 只建空文件，内容由 SaveFile 写入。
	if _, err := server.SaveFile(context.Background(), connect.NewRequest(&agentv1.SaveFileRequest{
		Path:    path,
		Content: "hello",
	})); err != nil {
		t.Fatalf("SaveFile: %v", err)
	}
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("读取新建文件失败: %v", err)
	}
	if string(content) != "hello" {
		t.Fatalf("content = %q, 期望 hello", string(content))
	}

	check, err := server.CheckFile(context.Background(), connect.NewRequest(&agentv1.CheckFileRequest{Path: path}))
	if err != nil {
		t.Fatalf("CheckFile: %v", err)
	}
	if !check.Msg.GetExists() {
		t.Fatal("已存在的路径应返回 exists=true")
	}

	// withInit 在路径不存在时应创建目录。
	initDir := filepath.Join(dir, "initdir")
	initCheck, err := server.CheckFile(context.Background(), connect.NewRequest(&agentv1.CheckFileRequest{
		Path:     initDir,
		WithInit: true,
	}))
	if err != nil {
		t.Fatalf("CheckFile with init: %v", err)
	}
	if !initCheck.Msg.GetExists() {
		t.Fatal("withInit 初始化后应返回 exists=true")
	}
	if info, err := os.Stat(initDir); err != nil || !info.IsDir() {
		t.Fatalf("初始化目录失败: err=%v", err)
	}

	if _, err := server.SaveFile(context.Background(), connect.NewRequest(&agentv1.SaveFileRequest{
		Path:    path,
		Content: "updated",
	})); err != nil {
		t.Fatalf("SaveFile: %v", err)
	}
	preview, err := server.PreviewFile(context.Background(), connect.NewRequest(&agentv1.PreviewFileRequest{Path: path}))
	if err != nil {
		t.Fatalf("PreviewFile: %v", err)
	}
	if preview.Msg.GetContent() != "updated" {
		t.Fatalf("content = %q, 期望 updated", preview.Msg.GetContent())
	}
}

// TestBatchCheckAndDeleteFiles 验证批量存在性检查与批量删除。
func TestBatchCheckAndDeleteFiles(t *testing.T) {
	setupSingleProcess(t)

	dir := t.TempDir()
	first := filepath.Join(dir, "a.txt")
	second := filepath.Join(dir, "b.txt")
	for _, path := range []string{first, second} {
		if err := os.WriteFile(path, []byte("x"), 0o644); err != nil {
			t.Fatalf("写入失败: %v", err)
		}
	}

	server := NewFileServer()
	check, err := server.BatchCheckFiles(context.Background(), connect.NewRequest(&agentv1.BatchCheckFilesRequest{
		Paths: []string{first, second, filepath.Join(dir, "missing.txt")},
	}))
	if err != nil {
		t.Fatalf("BatchCheckFiles: %v", err)
	}
	if len(check.Msg.GetItems()) != 2 {
		t.Fatalf("items = %d, 期望 2", len(check.Msg.GetItems()))
	}

	if _, err := server.BatchDeleteFiles(context.Background(), connect.NewRequest(&agentv1.BatchDeleteFilesRequest{
		Paths: []string{first, second},
	})); err != nil {
		t.Fatalf("BatchDeleteFiles: %v", err)
	}
	for _, path := range []string{first, second} {
		if _, err := os.Stat(path); !os.IsNotExist(err) {
			t.Fatalf("%s 删除后仍存在: %v", path, err)
		}
	}
}

// TestMoveSizeAndTree 验证移动、目录大小统计与目录树。
func TestMoveSizeAndTree(t *testing.T) {
	setupSingleProcess(t)

	dir := t.TempDir()
	srcDir := filepath.Join(dir, "src")
	if err := os.Mkdir(srcDir, 0o755); err != nil {
		t.Fatalf("创建源目录失败: %v", err)
	}
	if err := os.WriteFile(filepath.Join(srcDir, "a.txt"), []byte("12345"), 0o644); err != nil {
		t.Fatalf("写入失败: %v", err)
	}
	dstDir := filepath.Join(dir, "dst")
	if err := os.Mkdir(dstDir, 0o755); err != nil {
		t.Fatalf("创建目标目录失败: %v", err)
	}

	server := NewFileServer()
	move, err := server.MoveFiles(context.Background(), connect.NewRequest(&agentv1.MoveFilesRequest{
		Type:     "cut",
		OldPaths: []string{srcDir},
		NewPath:  dstDir,
		TaskId:   "move-1",
	}))
	if err != nil {
		t.Fatalf("MoveFiles: %v", err)
	}
	if move.Msg.GetTaskId() != "move-1" {
		t.Fatalf("task_id = %q, 期望 move-1", move.Msg.GetTaskId())
	}
	moved := filepath.Join(dstDir, "src")
	// 移动是异步任务，轮询等待落盘。
	for i := 0; i < 50; i++ {
		if _, err := os.Stat(filepath.Join(moved, "a.txt")); err == nil {
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	if _, err := os.Stat(filepath.Join(moved, "a.txt")); err != nil {
		t.Fatalf("移动后文件不存在: %v", err)
	}

	size, err := server.GetSize(context.Background(), connect.NewRequest(&agentv1.GetSizeRequest{Path: moved}))
	if err != nil {
		t.Fatalf("GetSize: %v", err)
	}
	// 目录本身也占用空间，不同文件系统结果不同，只要求非零。
	if size.Msg.GetSize() <= 0 {
		t.Fatalf("size = %d, 期望大于 0", size.Msg.GetSize())
	}

	depth, err := server.GetDepthSize(context.Background(), connect.NewRequest(&agentv1.GetDepthSizeRequest{Path: dstDir}))
	if err != nil {
		t.Fatalf("GetDepthSize: %v", err)
	}
	if len(depth.Msg.GetItems()) == 0 {
		t.Fatal("GetDepthSize 应返回至少一个子项")
	}

	tree, err := server.GetFileTree(context.Background(), connect.NewRequest(&agentv1.GetFileTreeRequest{
		Path: dstDir,
		Dir:  true,
	}))
	if err != nil {
		t.Fatalf("GetFileTree: %v", err)
	}
	// GetFileTree 返回以查询目录为根的单节点树，目标目录在 children 里。
	found := false
	var walk func(nodes []*agentv1.FileTreeNode)
	walk = func(nodes []*agentv1.FileTreeNode) {
		for _, node := range nodes {
			if node.GetName() == "src" {
				found = true
			}
			walk(node.GetChildren())
		}
	}
	walk(tree.Msg.GetItems())
	if !found {
		t.Fatalf("目录树未包含 src: %+v", tree.Msg.GetItems())
	}
}

// TestSearchUploadMountsAndUsers 验证上传记录分页、挂载点与用户组查询。
func TestSearchUploadMountsAndUsers(t *testing.T) {
	setupSingleProcess(t)

	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "uploaded.zip"), []byte("zip"), 0o644); err != nil {
		t.Fatalf("写入失败: %v", err)
	}

	server := NewFileServer()
	upload, err := server.SearchUpload(context.Background(), connect.NewRequest(&agentv1.SearchUploadRequest{
		Path:     dir,
		Page:     1,
		PageSize: 10,
	}))
	if err != nil {
		t.Fatalf("SearchUpload: %v", err)
	}
	if upload.Msg.GetTotal() != 1 || len(upload.Msg.GetItems()) != 1 {
		t.Fatalf("total = %d items = %d, 期望 1/1", upload.Msg.GetTotal(), len(upload.Msg.GetItems()))
	}
	if upload.Msg.GetItems()[0].GetName() != "uploaded.zip" {
		t.Fatalf("name = %q, 期望 uploaded.zip", upload.Msg.GetItems()[0].GetName())
	}

	mounts, err := server.ListMounts(context.Background(), connect.NewRequest(&agentv1.ListMountsRequest{}))
	if err != nil {
		t.Fatalf("ListMounts: %v", err)
	}
	// macOS 测试机没有 lsblk，挂载点可能为空，只要求不报错。
	if mounts.Msg.GetItems() == nil {
		t.Fatal("items 为 nil")
	}

	groups, err := server.GetUsersAndGroups(context.Background(), connect.NewRequest(&agentv1.GetUsersAndGroupsRequest{}))
	if err != nil {
		t.Fatalf("GetUsersAndGroups: %v", err)
	}
	// 1Panel 只过滤 root 与 GID>=1000；macOS 上可能没有符合条件的组，只要求可调用。
	_ = groups
}

// TestFileShareLifecycle 验证分享的创建、查询、校验与关闭。
func TestFileShareLifecycle(t *testing.T) {
	setupSingleProcess(t)

	dir := t.TempDir()
	path := filepath.Join(dir, "share.txt")
	if err := os.WriteFile(path, []byte("share"), 0o644); err != nil {
		t.Fatalf("写入失败: %v", err)
	}

	server := NewFileServer()
	created, err := server.CreateShare(context.Background(), connect.NewRequest(&agentv1.CreateShareRequest{
		Path: path,
	}))
	if err != nil {
		t.Fatalf("CreateShare: %v", err)
	}
	code := created.Msg.GetShare().GetCode()
	if code == "" {
		t.Fatal("CreateShare 未返回分享码")
	}
	if !created.Msg.GetShare().GetPermanent() {
		t.Fatal("expireMinutes=0 应为永久分享")
	}

	detail, err := server.GetShare(context.Background(), connect.NewRequest(&agentv1.GetShareRequest{Path: path}))
	if err != nil {
		t.Fatalf("GetShare: %v", err)
	}
	if detail.Msg.GetShare().GetCode() != code {
		t.Fatalf("code = %q, 期望 %q", detail.Msg.GetShare().GetCode(), code)
	}

	if _, err := server.CheckShare(context.Background(), connect.NewRequest(&agentv1.CheckShareRequest{Code: code})); err != nil {
		t.Fatalf("CheckShare: %v", err)
	}

	public, err := server.GetPublicShare(context.Background(), connect.NewRequest(&agentv1.GetPublicShareRequest{Code: code}))
	if err != nil {
		t.Fatalf("GetPublicShare: %v", err)
	}
	if public.Msg.GetFileName() != "share.txt" {
		t.Fatalf("file_name = %q, 期望 share.txt", public.Msg.GetFileName())
	}

	search, err := server.SearchShares(context.Background(), connect.NewRequest(&agentv1.SearchSharesRequest{Page: 1, PageSize: 10}))
	if err != nil {
		t.Fatalf("SearchShares: %v", err)
	}
	if search.Msg.GetTotal() == 0 {
		t.Fatal("SearchShares 应包含刚创建的分享")
	}

	if _, err := server.DeleteShare(context.Background(), connect.NewRequest(&agentv1.DeleteShareRequest{Path: path})); err != nil {
		t.Fatalf("DeleteShare: %v", err)
	}
	afterDelete, err := server.GetShare(context.Background(), connect.NewRequest(&agentv1.GetShareRequest{Path: path}))
	if err != nil {
		t.Fatalf("删除后 GetShare 不应报错: %v", err)
	}
	if afterDelete.Msg.GetShare() != nil {
		t.Fatal("删除后分享详情应为空")
	}
}

// TestRemarksAndRecycleTolerant 验证备注与回收站接口在能力受限时也能安全返回。
func TestRemarksAndRecycleTolerant(t *testing.T) {
	setupSingleProcess(t)

	dir := t.TempDir()
	path := filepath.Join(dir, "remark.txt")
	if err := os.WriteFile(path, []byte("x"), 0o644); err != nil {
		t.Fatalf("写入失败: %v", err)
	}

	server := NewFileServer()
	// 临时目录可能不支持 xattr，写入失败时只要求返回 connect 错误而不是 panic。
	if _, err := server.SetRemark(context.Background(), connect.NewRequest(&agentv1.SetRemarkRequest{
		Path:   path,
		Remark: "备注",
	})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("SetRemark 错误类型 = %T", err)
		}
	}
	remarks, err := server.GetRemarks(context.Background(), connect.NewRequest(&agentv1.GetRemarksRequest{
		Paths: []string{path},
	}))
	if err != nil {
		t.Fatalf("GetRemarks: %v", err)
	}
	if remarks.Msg.GetRemarks() == nil {
		t.Fatal("remarks 为 nil")
	}

	status, err := server.GetRecycleStatus(context.Background(), connect.NewRequest(&agentv1.GetRecycleStatusRequest{}))
	if err != nil {
		t.Fatalf("GetRecycleStatus: %v", err)
	}
	if status.Msg.GetStatus() == "" {
		t.Log("回收站状态为空，可能是首次初始化")
	}
}

// TestStopTasksAndWgetRecords 验证停止任务与下载记录的容错行为。
func TestStopTasksAndWgetRecords(t *testing.T) {
	setupSingleProcess(t)

	server := NewFileServer()
	if _, err := server.StopWget(context.Background(), connect.NewRequest(&agentv1.StopWgetRequest{
		Key: "file-wget-missing",
	})); err != nil {
		t.Fatalf("StopWget 对不存在的任务应返回成功: %v", err)
	}

	keys, err := server.GetWgetProcessKeys(context.Background(), connect.NewRequest(&agentv1.GetWgetProcessKeysRequest{}))
	if err != nil {
		t.Fatalf("GetWgetProcessKeys: %v", err)
	}
	if keys.Msg.GetKeys() == nil {
		t.Fatal("keys 为 nil")
	}

	for name, call := range map[string]func() error{
		"StopCompress": func() error {
			_, err := server.StopCompress(context.Background(), connect.NewRequest(&agentv1.StopCompressRequest{TaskId: "missing"}))
			return err
		},
		"StopDecompress": func() error {
			_, err := server.StopDecompress(context.Background(), connect.NewRequest(&agentv1.StopDecompressRequest{TaskId: "missing"}))
			return err
		},
		"StopMove": func() error {
			_, err := server.StopMove(context.Background(), connect.NewRequest(&agentv1.StopMoveRequest{TaskId: "missing"}))
			return err
		},
	} {
		if err := call(); err != nil {
			if _, ok := err.(*connect.Error); !ok {
				t.Fatalf("%s 错误类型 = %T", name, err)
			}
		}
	}
}
