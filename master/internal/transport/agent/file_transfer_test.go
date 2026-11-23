package agent

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestCreateUploadTicketRejectsTraversal 验证文件名不能带路径分隔符。
func TestCreateUploadTicketRejectsTraversal(t *testing.T) {
	setupSingleProcess(t)

	server := NewFileTransferServer()
	_, err := server.CreateUploadTicket(context.Background(), connect.NewRequest(&agentv1.CreateUploadTicketRequest{
		Dir:      t.TempDir(),
		Filename: "../escape.txt",
	}))
	if err == nil {
		t.Fatal("带路径的文件名应被拒绝")
	}
	connectErr, ok := err.(*connect.Error)
	if !ok || connectErr.Code() != connect.CodeInvalidArgument {
		t.Fatalf("错误 = %v, 期望 invalid_argument", err)
	}
}

// TestCreateDownloadTicketNotFound 验证不存在的文件返回 NotFound。
func TestCreateDownloadTicketNotFound(t *testing.T) {
	setupSingleProcess(t)

	server := NewFileTransferServer()
	_, err := server.CreateDownloadTicket(context.Background(), connect.NewRequest(&agentv1.CreateDownloadTicketRequest{
		Path: t.TempDir() + "/missing.txt",
	}))
	if err == nil {
		t.Fatal("不存在的文件应返回错误")
	}
	connectErr, ok := err.(*connect.Error)
	if !ok || connectErr.Code() != connect.CodeNotFound {
		t.Fatalf("错误 = %v, 期望 not_found", err)
	}
}
