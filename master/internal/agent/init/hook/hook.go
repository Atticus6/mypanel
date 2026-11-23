package hook

import (
	"os"
	"os/exec"
	"strings"
	"time"

	"gorm.io/gorm"
	"mypanel/agent/app/dto"
	"mypanel/agent/app/model"
	"mypanel/agent/app/repo"
	"mypanel/agent/app/service"
	"mypanel/agent/constant"
	"mypanel/agent/global"
	"mypanel/agent/utils/alert_push"
	"mypanel/agent/utils/xpack"
)

func Init() {
	initGlobalData()
	handleCronjobStatus()
	handleClamStatus()
	handleRecordStatus()
	handleSnapStatus()
	handleOllamaModelStatus()

	loadLocalDir()

	initDockerConf()
	initAlertTask()
	initMonitorDB()
}

func initGlobalData() {
	settingRepo := repo.NewISettingRepo()
	if _, err := settingRepo.GetValueByKey("SystemStatus"); err != nil {
		_ = settingRepo.Create("SystemStatus", "Free")
	}
	if err := settingRepo.Update("SystemStatus", "Free"); err != nil {
		global.LOG.Fatalf("init service before start failed, err: %v", err)
	}
	node, _ := xpack.MultiNodeProvider.LoadNodeInfo(false)
	if len(node.Version) != 0 {
		_ = settingRepo.Update("SystemVersion", node.Version)
	}
	global.CONF.Base.Version = node.Version
	global.CONF.Base.Edition, _ = settingRepo.GetValueByKey("Edition")
	global.CONF.Base.EncryptKey, _ = settingRepo.GetValueByKey("EncryptKey")
}

func handleSnapStatus() {
	_ = global.DB.Model(&model.Snapshot{}).Where("status = ?", "OnSaveData").
		Updates(map[string]interface{}{"status": constant.StatusSuccess}).Error

	_ = global.DB.Model(&model.Snapshot{}).Where("status = ?", constant.StatusWaiting).
		Updates(map[string]interface{}{
			"status":  constant.StatusFailed,
			"message": constant.InterruptedMsg,
		}).Error

	_ = global.DB.Model(&model.Snapshot{}).Where("recover_status = ?", constant.StatusWaiting).
		Updates(map[string]interface{}{
			"recover_status":  constant.StatusFailed,
			"recover_message": constant.InterruptedMsg,
		}).Error

	_ = global.DB.Model(&model.Snapshot{}).Where("rollback_status = ?", constant.StatusWaiting).
		Updates(map[string]interface{}{
			"rollback_status":  constant.StatusFailed,
			"rollback_message": constant.InterruptedMsg,
		}).Error
}

func handleCronjobStatus() {
	var jobRecords []model.JobRecords
	_ = global.DB.Model(&model.Cronjob{}).Where("is_executing = ?", true).Updates(map[string]interface{}{"is_executing": false}).Error
	_ = global.DB.Where("status = ?", constant.StatusWaiting).Find(&jobRecords).Error
	for _, record := range jobRecords {
		err := global.DB.Model(&model.JobRecords{}).Where("status = ?", constant.StatusWaiting).
			Updates(map[string]interface{}{
				"status":  constant.StatusFailed,
				"message": constant.InterruptedMsg,
			}).Error

		if err != nil {
			global.LOG.Errorf("Failed to update job ID: %v, Error:%v", record.ID, err)
			continue
		}

		var cronjob *model.Cronjob
		_ = global.DB.Where("id = ?", record.CronjobID).First(&cronjob).Error
		handleCronJobAlert(cronjob)
	}
}

func handleClamStatus() {
	_ = global.DB.Model(&model.Clam{}).Where("is_executing = ?", true).Updates(map[string]interface{}{"is_executing": false}).Error
	_ = global.DB.Model(&model.ClamRecord{}).Where("status = ?", constant.StatusWaiting).Updates(map[string]interface{}{
		"status":  constant.StatusFailed,
		"message": constant.InterruptedMsg,
	}).Error
}

func handleRecordStatus() {
	_ = global.DB.Model(&model.BackupRecord{}).Where("status = ?", constant.StatusWaiting).Updates(map[string]interface{}{
		"status":  constant.StatusFailed,
		"message": constant.InterruptedMsg,
	}).Error
}

func handleOllamaModelStatus() {
	_ = global.DB.Model(&model.OllamaModel{}).Where("status = ?", constant.StatusWaiting).Updates(map[string]interface{}{
		"status":  constant.StatusCanceled,
		"message": constant.InterruptedMsg,
	}).Error
}

func handleCronJobAlert(cronjob *model.Cronjob) {
	pushAlert := dto.PushAlert{
		TaskName:  cronjob.Name,
		AlertType: cronjob.Type,
		EntryID:   cronjob.ID,
		Param:     cronjob.Type,
	}
	_ = alert_push.PushAlert(pushAlert)
}

func loadLocalDir() {
	// 共享库里可能存在多条 LOCAL 记录（core 与 agent 各自的历史种子），
	// 选第一个有有效路径的，避免空路径让快照/备份功能失效。
	var accounts []model.BackupAccount
	if err := global.DB.Where("`type` = ?", constant.Local).Find(&accounts).Error; err != nil {
		global.LOG.Errorf("load local backup account info failed, err: %v", err)
		return
	}
	backupPath := ""
	for _, item := range accounts {
		if item.BackupPath != "" {
			backupPath = item.BackupPath
			break
		}
	}
	if backupPath == "" && len(accounts) > 0 {
		backupPath = accounts[0].BackupPath
	}
	global.Dir.LocalBackupDir = backupPath

	if _, err := os.Stat(backupPath); err != nil && os.IsNotExist(err) {
		if err = os.MkdirAll(backupPath, os.ModePerm); err != nil {
			global.LOG.Errorf("mkdir %s failed, err: %v", backupPath, err)
		}
	}
}

func initDockerConf() {
	dockerPath, err := exec.LookPath("docker")
	if err != nil {
		return
	}
	if strings.Contains(dockerPath, "snap") {
		constant.DaemonJsonPath = "/var/snap/docker/current/config/daemon.json"
	}
}

func initAlertTask() {
	service.NewIAlertTaskHelper().ResetTask()
}

func initMonitorDB() {
	_ = global.MonitorDB.AutoMigrate(&model.MonitorBase{}, &model.MonitorNetwork{}, &model.MonitorIO{})
	_ = global.GPUMonitorDB.AutoMigrate(&model.MonitorGPU{})
	_ = global.TaskDB.AutoMigrate(&model.Task{})
	// building indexes on large monitor tables can take seconds, keep it off the startup path;
	// WAL mode leaves readers unblocked and busy_timeout covers the collector's inserts meanwhile
	go ensureMonitorIndexes()
}

func ensureMonitorIndexes() {
	indexes := []struct {
		db   *gorm.DB
		stmt string
	}{
		// created_at alone serves unfiltered range queries and retention cleanup
		{global.MonitorDB, "CREATE INDEX IF NOT EXISTS idx_monitor_bases_created ON monitor_bases(created_at)"},
		{global.MonitorDB, "CREATE INDEX IF NOT EXISTS idx_monitor_ios_created ON monitor_ios(created_at)"},
		{global.MonitorDB, "CREATE INDEX IF NOT EXISTS idx_monitor_networks_created ON monitor_networks(created_at)"},
		{global.GPUMonitorDB, "CREATE INDEX IF NOT EXISTS idx_monitor_gpus_created ON monitor_gpus(created_at)"},
		// (name, created_at) serves per-device range queries and distinct name lookups
		{global.MonitorDB, "CREATE INDEX IF NOT EXISTS idx_monitor_ios_name_created ON monitor_ios(name, created_at)"},
		{global.MonitorDB, "CREATE INDEX IF NOT EXISTS idx_monitor_networks_name_created ON monitor_networks(name, created_at)"},
		{global.GPUMonitorDB, "CREATE INDEX IF NOT EXISTS idx_monitor_gpus_product_created ON monitor_gpus(product_name, created_at)"},
	}
	start := time.Now()
	for _, index := range indexes {
		if err := index.db.Exec(index.stmt).Error; err != nil {
			global.LOG.Warnf("create monitor index failed, stmt: %s, err: %v", index.stmt, err)
		}
	}
	if elapsed := time.Since(start); elapsed > time.Second {
		global.LOG.Infof("monitor indexes ready, took %s", elapsed)
	}
}
