package agent

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	"mypanel/agent/app/model"
	agentglobal "mypanel/agent/global"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestBackupSearch 验证备份账号查询走真实数据库，且响应不带凭据字段。
func TestBackupSearch(t *testing.T) {
	setupSingleProcess(t)

	account := model.BackupAccount{
		Name:       "oss-test",
		Type:       "S3",
		IsPublic:   false,
		Bucket:     "my-bucket",
		AccessKey:  "should-not-leak",
		Credential: "should-not-leak",
		BackupPath: "backup",
	}
	if err := agentglobal.DB.Create(&account).Error; err != nil {
		t.Fatalf("插入备份账号失败: %v", err)
	}

	server := NewBackupServer()
	resp, err := server.Search(context.Background(), connect.NewRequest(&agentv1.SearchBackupsRequest{
		Page:     1,
		PageSize: 10,
		Info:     "oss",
	}))
	if err != nil {
		t.Fatalf("Search 返回错误: %v", err)
	}
	if resp.Msg.GetTotal() != 1 {
		t.Fatalf("total = %d, 期望 1", resp.Msg.GetTotal())
	}
	item := resp.Msg.GetItems()[0]
	if item.GetName() != "oss-test" || item.GetBucket() != "my-bucket" {
		t.Fatalf("backup = %+v, 期望 oss-test/my-bucket", item)
	}
	if item.GetBackupPath() != "/backup" {
		t.Fatalf("backup_path = %q, 期望 /backup", item.GetBackupPath())
	}
	// proto 里没有 access_key/credential 字段，凭据不可能通过该接口泄漏。
}
