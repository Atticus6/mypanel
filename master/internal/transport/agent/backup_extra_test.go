package agent

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestBackupQueries 验证备份账号与记录的查询接口可调用。
func TestBackupQueries(t *testing.T) {
	setupSingleProcess(t)

	server := NewBackupServer()
	options, err := server.LoadBackupOptions(context.Background(), connect.NewRequest(&agentv1.LoadBackupOptionsRequest{}))
	if err != nil {
		t.Fatalf("LoadBackupOptions: %v", err)
	}
	if options.Msg.GetItems() == nil {
		t.Fatal("items 为 nil")
	}

	dir, err := server.GetLocalBackupDir(context.Background(), connect.NewRequest(&agentv1.GetLocalBackupDirRequest{}))
	if err != nil {
		t.Fatalf("GetLocalBackupDir: %v", err)
	}
	if dir.Msg.GetDir() == "" {
		t.Fatal("本地备份目录为空")
	}

	records, err := server.SearchBackupRecords(context.Background(), connect.NewRequest(&agentv1.SearchBackupRecordsRequest{
		Page: 1, PageSize: 10, Type: "app",
	}))
	if err != nil {
		t.Fatalf("SearchBackupRecords: %v", err)
	}
	if records.Msg.GetItems() == nil {
		t.Fatal("items 为 nil")
	}

	sizes, err := server.LoadRecordSize(context.Background(), connect.NewRequest(&agentv1.LoadRecordSizeRequest{
		Page: 1, PageSize: 10, Type: "app",
	}))
	if err != nil {
		t.Fatalf("LoadRecordSize: %v", err)
	}
	if sizes.Msg.GetItems() == nil {
		t.Fatal("items 为 nil")
	}

	files, err := server.ListBackupFiles(context.Background(), connect.NewRequest(&agentv1.ListBackupFilesRequest{Id: 1}))
	if err != nil {
		t.Fatalf("ListBackupFiles: %v", err)
	}
	if files.Msg.GetFiles() == nil {
		t.Fatal("files 为 nil")
	}
}

// TestBackupTolerantOperations 验证异常输入只返回 Connect 错误而不 panic。
func TestBackupTolerantOperations(t *testing.T) {
	setupSingleProcess(t)

	server := NewBackupServer()
	calls := map[string]func() error{
		"CheckBackupUsed": func() error {
			_, err := server.CheckBackupUsed(context.Background(), connect.NewRequest(&agentv1.CheckBackupUsedRequest{Name: "missing"}))
			return err
		},
		"DownloadBackupRecord": func() error {
			_, err := server.DownloadBackupRecord(context.Background(), connect.NewRequest(&agentv1.DownloadBackupRecordRequest{
				DownloadAccountId: 1, FileDir: "/tmp", FileName: "missing.gz",
			}))
			return err
		},
		"DeleteBackupRecords": func() error {
			_, err := server.DeleteBackupRecords(context.Background(), connect.NewRequest(&agentv1.DeleteBackupRecordsRequest{Ids: []uint32{999999}}))
			return err
		},
		"SearchBackupRecordsByCronjob": func() error {
			_, err := server.SearchBackupRecordsByCronjob(context.Background(), connect.NewRequest(&agentv1.SearchBackupRecordsByCronjobRequest{
				Page: 1, PageSize: 10, CronjobId: 999999,
			}))
			return err
		},
		"RecoverData": func() error {
			_, err := server.RecoverData(context.Background(), connect.NewRequest(&agentv1.RecoverDataRequest{
				DownloadAccountId: 999999, Type: "app", File: "/tmp/missing.gz",
			}))
			return err
		},
	}
	for name, call := range calls {
		if err := call(); err != nil {
			if _, ok := err.(*connect.Error); !ok {
				t.Fatalf("%s 错误类型 = %T", name, err)
			}
		}
	}
}
