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

// TestCronjobSearchAndGet 验证计划任务查询走真实数据库。
func TestCronjobSearchAndGet(t *testing.T) {
	setupSingleProcess(t)

	job := model.Cronjob{
		Name:       "daily-backup",
		Type:       "shell",
		Spec:       "0 0 * * *",
		SpecCustom: true,
		Status:     "Enable",
		Script:     "echo backup",
	}
	if err := agentglobal.DB.Create(&job).Error; err != nil {
		t.Fatalf("插入计划任务失败: %v", err)
	}

	server := NewCronjobServer()

	list, err := server.Search(context.Background(), connect.NewRequest(&agentv1.SearchCronjobsRequest{
		Page:     1,
		PageSize: 10,
		Info:     "daily",
	}))
	if err != nil {
		t.Fatalf("Search 返回错误: %v", err)
	}
	if list.Msg.GetTotal() != 1 {
		t.Fatalf("total = %d, 期望 1", list.Msg.GetTotal())
	}
	item := list.Msg.GetItems()[0]
	if item.GetName() != "daily-backup" || item.GetSpec() != "0 0 * * *" {
		t.Fatalf("cronjob = %+v, 期望 daily-backup/0 0 * * *", item)
	}
	if item.GetStatus() != "Enable" {
		t.Fatalf("status = %q, 期望 Enable", item.GetStatus())
	}

	detail, err := server.Get(context.Background(), connect.NewRequest(&agentv1.GetCronjobRequest{Id: uint32(job.ID)}))
	if err != nil {
		t.Fatalf("Get 返回错误: %v", err)
	}
	if detail.Msg.GetScript() != "echo backup" {
		t.Fatalf("script = %q, 期望 echo backup", detail.Msg.GetScript())
	}
}

// TestCronjobGetNotFound 验证不存在的任务返回 NotFound。
func TestCronjobGetNotFound(t *testing.T) {
	setupSingleProcess(t)

	server := NewCronjobServer()
	_, err := server.Get(context.Background(), connect.NewRequest(&agentv1.GetCronjobRequest{Id: 777}))
	if err == nil {
		t.Fatal("不存在的任务应返回错误")
	}
	connectErr, ok := err.(*connect.Error)
	if !ok {
		t.Fatalf("错误类型 = %T", err)
	}
	if connectErr.Code() != connect.CodeNotFound {
		t.Fatalf("code = %v, 期望 not_found", connectErr.Code())
	}
}

// TestCronjobRecords 验证执行记录查询与日志读取。
func TestCronjobRecords(t *testing.T) {
	setupSingleProcess(t)

	job := model.Cronjob{Name: "records-job", Type: "shell", Spec: "0 * * * *", Status: "Enable"}
	if err := agentglobal.DB.Create(&job).Error; err != nil {
		t.Fatalf("插入任务失败: %v", err)
	}
	logPath := filepath.Join(t.TempDir(), "record.log")
	if err := os.WriteFile(logPath, []byte("record-content"), 0o644); err != nil {
		t.Fatalf("写入记录日志失败: %v", err)
	}
	record := model.JobRecords{
		CronjobID: job.ID,
		TaskID:    "task-1",
		Status:    "Success",
		Records:   logPath,
		StartTime: time.Now(),
	}
	if err := agentglobal.DB.Create(&record).Error; err != nil {
		t.Fatalf("插入执行记录失败: %v", err)
	}

	server := NewCronjobServer()
	list, err := server.SearchRecords(context.Background(), connect.NewRequest(&agentv1.SearchCronjobRecordsRequest{
		Page:      1,
		PageSize:  10,
		CronjobId: uint32(job.ID),
	}))
	if err != nil {
		t.Fatalf("SearchRecords: %v", err)
	}
	if list.Msg.GetTotal() != 1 || list.Msg.GetItems()[0].GetTaskId() != "task-1" {
		t.Fatalf("records = %+v", list.Msg.GetItems())
	}

	log, err := server.LoadRecordLog(context.Background(), connect.NewRequest(&agentv1.LoadCronjobRecordLogRequest{Id: uint32(record.ID)}))
	if err != nil {
		t.Fatalf("LoadRecordLog: %v", err)
	}
	if log.Msg.GetContent() != "record-content" {
		t.Fatalf("content = %q", log.Msg.GetContent())
	}
}
