package service

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path"
	"strconv"
	"strings"
	"syscall"
	"time"

	"mypanel/core/app/dto"
	"mypanel/core/app/model"
	"mypanel/core/app/repo"
	"mypanel/core/buserr"
	"mypanel/core/constant"
	"mypanel/core/global"
	"mypanel/core/utils/cmd"
	"mypanel/core/utils/common"
	"mypanel/core/utils/controller"
	"mypanel/core/utils/ctl_conf"
	"mypanel/core/utils/files"
	"mypanel/core/utils/req_helper"
	upgradeUtil "mypanel/core/utils/upgrade"
	"mypanel/core/utils/xpack"
)

type serviceInfo struct {
	basePath     string
	coreName     string
	agentName    string
	selCoreName  string
	selAgentName string
}

const minUpgradeFreeSpace = 500 << 20 // 500MB

func loadServiceInfo() (serviceInfo, error) {
	basePath, err := controller.GetServicePath("")
	if err != nil {
		global.LOG.Errorf("get service path failed: %v", err)
		return serviceInfo{}, err
	}
	coreName, err := controller.LoadServiceName("1panel-core")
	if err != nil {
		global.LOG.Errorf("load core service name failed: %v", err)
		return serviceInfo{}, err
	}
	agentName, err := controller.LoadServiceName("1panel-agent")
	if err != nil {
		global.LOG.Errorf("load agent service name failed: %v", err)
		return serviceInfo{}, err
	}
	selCoreName, err := controller.SelectInitScript("1panel-core")
	if err != nil {
		global.LOG.Errorf("select core init script failed: %v", err)
		return serviceInfo{}, err
	}
	selAgentName, err := controller.SelectInitScript("1panel-agent")
	if err != nil {
		global.LOG.Errorf("select agent init script failed: %v", err)
		return serviceInfo{}, err
	}
	return serviceInfo{
		basePath:     basePath,
		coreName:     coreName,
		agentName:    agentName,
		selCoreName:  selCoreName,
		selAgentName: selAgentName,
	}, nil
}

type UpgradeService struct{}

type IUpgradeService interface {
	Upgrade(req dto.Upgrade) error
	Rollback(req dto.OperateByID) error
	LoadNotes(req dto.Upgrade) (string, error)
	SearchUpgrade() (*dto.UpgradeInfo, error)
	LoadRelease() ([]dto.ReleasesNotes, error)
}

func NewIUpgradeService() IUpgradeService {
	return &UpgradeService{}
}

func (u *UpgradeService) SearchUpgrade() (*dto.UpgradeInfo, error) {
	if global.CONF.Base.IsOffline {
		return &dto.UpgradeInfo{}, nil
	}
	var upgrade dto.UpgradeInfo
	currentVersion, err := settingRepo.Get(repo.WithByKey("SystemVersion"))
	if err != nil {
		return nil, err
	}
	DeveloperMode, err := settingRepo.Get(repo.WithByKey("DeveloperMode"))
	if err != nil {
		return nil, err
	}

	upgrade.TestVersion, upgrade.NewVersion, upgrade.LatestVersion = u.loadVersionByMode(DeveloperMode.Value, currentVersion.Value)
	var itemVersion string
	if len(upgrade.NewVersion) != 0 {
		itemVersion = upgrade.NewVersion
	}
	if (global.CONF.Base.Mode == "dev" || DeveloperMode.Value == constant.StatusEnable) && len(upgrade.TestVersion) != 0 {
		itemVersion = upgrade.TestVersion
	}
	if len(upgrade.LatestVersion) != 0 {
		itemVersion = upgrade.LatestVersion
	}
	if len(itemVersion) == 0 {
		return &upgrade, nil
	}
	mode := global.CONF.Base.Mode
	if strings.Contains(itemVersion, "beta") {
		mode = "beta"
	}
	if strings.HasPrefix(upgrade.TestVersion, upgrade.LatestVersion+"-beta") {
		upgrade.TestVersion = ""
	}
	notes, err := u.loadReleaseNotes(fmt.Sprintf("%s/%s/%s/release/1panel-%s-release-notes", global.RepoURL(), mode, itemVersion, itemVersion))
	if err != nil {
		return nil, fmt.Errorf("load releases-notes of version %s failed, err: %v", itemVersion, err)
	}
	upgrade.ReleaseNote = notes
	return &upgrade, nil
}

func (u *UpgradeService) LoadNotes(req dto.Upgrade) (string, error) {
	mode := global.CONF.Base.Mode
	if strings.Contains(req.Version, "beta") {
		mode = "beta"
	}
	notes, err := u.loadReleaseNotes(fmt.Sprintf("%s/%s/%s/release/1panel-%s-release-notes", global.RepoURL(), mode, req.Version, req.Version))
	if err != nil {
		return "", fmt.Errorf("load releases-notes of version %s failed, err: %v", req.Version, err)
	}
	return notes, nil
}

func (u *UpgradeService) Upgrade(req dto.Upgrade) error {
	global.LOG.Info("start to upgrade now...")
	itemArch, err := loadArch()
	if err != nil {
		return err
	}
	svcInfo, err := loadServiceInfo()
	if err != nil {
		return err
	}
	if err := checkUpgradeSpace(); err != nil {
		return err
	}

	baseDir := path.Join(global.CONF.Base.InstallDir, fmt.Sprintf("1panel/tmp/upgrade/%s", req.Version))
	downloadDir := path.Join(baseDir, "downloads")
	_ = os.RemoveAll(baseDir)
	originalDir := path.Join(baseDir, "original")
	if err := os.MkdirAll(downloadDir, os.ModePerm); err != nil {
		return err
	}
	if err := os.MkdirAll(originalDir, os.ModePerm); err != nil {
		return err
	}

	mode := global.CONF.Base.Mode
	if strings.Contains(req.Version, "beta") {
		mode = "beta"
	}
	downloadPath := fmt.Sprintf("%s/%s/%s/release", global.RepoURL(), mode, req.Version)
	fileName := fmt.Sprintf("1panel-%s-%s-%s.tar.gz", req.Version, "linux", itemArch)
	_ = settingRepo.Update("SystemStatus", "Upgrading")
	go func() {
		oldLang := ctl_conf.Load("LANGUAGE")
		if err := files.DownloadFileWithProxyStream(downloadPath+"/"+fileName, downloadDir+"/"+fileName); err != nil {
			global.LOG.Errorf("download service file failed, err: %v", err)
			_ = settingRepo.Update("SystemStatus", "Free")
			return
		}
		global.LOG.Info("download all file successful!")
		defer func() {
			_ = os.Remove(downloadDir)
		}()
		if err := files.HandleUnTar(downloadDir+"/"+fileName, downloadDir, ""); err != nil {
			global.LOG.Errorf("decompress file failed, err: %v", err)
			_ = settingRepo.Update("SystemStatus", "Free")
			return
		}
		tmpDir := downloadDir + "/" + strings.ReplaceAll(fileName, ".tar.gz", "")

		if err := u.handleBackup(originalDir, svcInfo); err != nil {
			global.LOG.Errorf("handle backup original file failed, err: %v", err)
			_ = settingRepo.Update("SystemStatus", "Free")
			return
		}
		itemLog := model.UpgradeLog{NodeID: 0, OldVersion: global.CONF.Base.Version, NewVersion: req.Version, BackupFile: baseDir}
		_ = upgradeLogRepo.Create(&itemLog)

		global.LOG.Info("backup original data successful, now start to upgrade!")

		if err := files.CopyFileWithRename(path.Join(tmpDir, "1panel-core"), "/usr/local/bin/1panel-core"); err != nil {
			global.LOG.Errorf("upgrade 1panel-core failed, err: %v", err)
			_ = settingRepo.Update("SystemStatus", "Free")
			u.handleRollback(originalDir, 1, svcInfo)
			return
		}
		if err := files.CopyFileWithRename(path.Join(tmpDir, "1panel-agent"), "/usr/local/bin/1panel-agent"); err != nil {
			global.LOG.Errorf("upgrade 1panel-agent failed, err: %v", err)
			_ = settingRepo.Update("SystemStatus", "Free")
			u.handleRollback(originalDir, 1, svcInfo)
			return
		}

		if err := files.CopyFileWithRename(path.Join(tmpDir, "1pctl"), "/usr/local/bin/1pctl"); err != nil {
			global.LOG.Errorf("upgrade 1pctl failed, err: %v", err)
			_ = settingRepo.Update("SystemStatus", "Free")
			u.handleRollback(originalDir, 2, svcInfo)
			return
		}
		if err := ctl_conf.UpdateInFile("/usr/local/bin/1pctl", "BASE_DIR", global.CONF.Base.InstallDir); err != nil {
			global.LOG.Errorf("upgrade basedir in 1pctl failed, err: %v", err)
			u.handleRollback(originalDir, 2, svcInfo)
			return
		}
		if err := ctl_conf.UpdateInFile("/usr/local/bin/1pctl", "LANGUAGE", oldLang); err != nil {
			global.LOG.Errorf("upgrade basedir in 1pctl failed, err: %v", err)
			u.handleRollback(originalDir, 2, svcInfo)
			return
		}
		initScriptPath := path.Join(tmpDir, "initscript")

		if err := files.CopyItem(false, true, path.Join(initScriptPath, svcInfo.selCoreName), svcInfo.basePath); err != nil {
			global.LOG.Errorf("upgrade %s failed, err: %v", svcInfo.coreName, err)
			_ = settingRepo.Update("SystemStatus", "Free")
			u.handleRollback(originalDir, 3, svcInfo)
			return
		}
		if err := files.CopyItem(false, true, path.Join(initScriptPath, svcInfo.selAgentName), svcInfo.basePath); err != nil {
			global.LOG.Errorf("upgrade %s failed, err: %v", svcInfo.agentName, err)
			_ = settingRepo.Update("SystemStatus", "Free")
			u.handleRollback(originalDir, 3, svcInfo)
			return
		}

		if err := files.CopyItem(true, true, path.Join(tmpDir, "lang"), "/usr/local/bin"); err != nil {
			global.LOG.Errorf("Update language files failed: %v", err)
			_ = settingRepo.Update("SystemStatus", "Free")
			u.handleRollback(originalDir, 4, svcInfo)
			return
		}
		if err := files.CopyFileWithRename(path.Join(tmpDir, "GeoIP.mmdb"), path.Join(global.CONF.Base.InstallDir, "1panel/geo/GeoIP.mmdb")); err != nil {
			global.LOG.Warnf("Update GeoIP database failed: %v", err)
			_ = settingRepo.Update("SystemStatus", "Free")
			u.handleRollback(originalDir, 4, svcInfo)
			return
		}

		global.LOG.Info("upgrade successful!")
		dropBackupCopies()
		xpack.MultiNodeProvider.AutoUpgradeWithMaster()
		go writeLogs(req.Version)
		_ = settingRepo.Update("SystemVersion", req.Version)
		_ = global.AgentDB.Model(&model.Setting{}).Where("key = ?", "SystemVersion").Updates(map[string]interface{}{"value": req.Version}).Error
		global.CONF.Base.Version = req.Version
		_ = os.RemoveAll(downloadDir)
		_ = settingRepo.Update("SystemStatus", "Free")

		controller.RestartPanel(true, true, true)
	}()
	return nil
}

func (u *UpgradeService) Rollback(req dto.OperateByID) error {
	log, _ := upgradeLogRepo.Get(repo.WithByID(req.ID))
	if log.ID == 0 {
		return buserr.New("ErrRecordNotFound")
	}
	svcInfo, err := loadServiceInfo()
	if err != nil {
		return err
	}
	u.handleRollback(log.BackupFile, 3, svcInfo)
	return nil
}

// githubRelease 是本仓库 GitHub Release 的最小结构，只取版本说明需要的字段。
type githubRelease struct {
	TagName     string `json:"tag_name"`
	Body        string `json:"body"`
	PublishedAt string `json:"published_at"`
	Draft       bool   `json:"draft"`
}

// releaseNotesAPI 返回版本说明接口地址；MYPANEL_RELEASE_API_URL 可指向任意兼容 GitHub
// Release 列表的接口，未配置时读取本项目自己的 Release。
func releaseNotesAPI() string {
	if value := strings.TrimSpace(os.Getenv("MYPANEL_RELEASE_API_URL")); value != "" {
		return strings.TrimRight(value, "/")
	}
	return "https://api.github.com/repos/Atticus6/mypanel/releases"
}

// LoadRelease 读取本项目的版本说明，按发布时间倒序返回。
//
// 数据来自 GitHub Release 列表，而不是原版 1Panel 的文档站；草稿版本不展示。
func (u *UpgradeService) LoadRelease() ([]dto.ReleasesNotes, error) {
	resp, err := req_helper.HandleGet(releaseNotesAPI())
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("load release notes failed: HTTP %d", resp.StatusCode)
	}

	var releases []githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil {
		return nil, err
	}
	notes := make([]dto.ReleasesNotes, 0, len(releases))
	for _, release := range releases {
		if release.Draft || release.TagName == "" {
			continue
		}
		notes = append(notes, parseGitHubRelease(release))
	}
	return notes, nil
}

// parseGitHubRelease 把 Release 正文转成面板展示用的说明与三类变更计数。
// 优先按「新增功能/功能优化/问题修复」小节的条目计数，兼容自动生成日志的
// feat/fix/refactor 等提交前缀；识别不出时仍展示正文。
func parseGitHubRelease(release githubRelease) dto.ReleasesNotes {
	item := dto.ReleasesNotes{
		Version: release.TagName,
		Content: strings.TrimSpace(release.Body),
	}
	if published, err := time.Parse(time.RFC3339, release.PublishedAt); err == nil {
		item.CreatedAt = published.Format("2006-01-02")
	}

	section := ""
	for _, line := range strings.Split(release.Body, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "#") {
			heading := strings.ToLower(strings.TrimSpace(strings.TrimLeft(trimmed, "#")))
			switch {
			case strings.Contains(heading, "新增"), strings.Contains(heading, "feature"):
				section = "new"
			case strings.Contains(heading, "修复"), strings.Contains(heading, "fix"):
				section = "fix"
			case strings.Contains(heading, "优化"), strings.Contains(heading, "improvement"),
				strings.Contains(heading, "refactor"):
				section = "opt"
			default:
				section = ""
			}
			continue
		}
		bullet := strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(trimmed, "-"), "*"))
		if bullet == trimmed {
			continue
		}
		if section != "" {
			switch section {
			case "new":
				item.NewCount++
			case "fix":
				item.FixCount++
			case "opt":
				item.OptimizationCount++
			}
			continue
		}
		// 没有小节标题时按提交前缀兜底（GitHub 自动生成的 Release 常见格式）。
		switch lower := strings.ToLower(bullet); {
		case strings.HasPrefix(lower, "feat"), strings.HasPrefix(lower, "feature"):
			item.NewCount++
		case strings.HasPrefix(lower, "fix"), strings.HasPrefix(lower, "bug"):
			item.FixCount++
		case strings.HasPrefix(lower, "refactor"), strings.HasPrefix(lower, "perf"),
			strings.HasPrefix(lower, "build"), strings.HasPrefix(lower, "chore"),
			strings.HasPrefix(lower, "docs"), strings.HasPrefix(lower, "test"):
			item.OptimizationCount++
		}
	}
	return item
}

func checkUpgradeSpace() error {
	dir := global.CONF.Base.InstallDir
	var stat syscall.Statfs_t
	if err := syscall.Statfs(dir, &stat); err != nil {
		return err
	}
	avail := stat.Bavail * uint64(stat.Bsize)
	if avail < minUpgradeFreeSpace {
		return fmt.Errorf("available space of %s is %d MB, less than required 500MB", dir, avail>>20)
	}
	return nil
}

func (u *UpgradeService) handleBackup(originalDir string, svcInfo serviceInfo) error {
	if err := files.CopyItem(false, true, "/usr/local/bin/1panel-core", originalDir); err != nil {
		return err
	}
	if err := files.CopyItem(false, true, "/usr/local/bin/1panel-agent", originalDir); err != nil {
		return err
	}
	if err := files.CopyItem(false, true, "/usr/local/bin/1pctl", originalDir); err != nil {
		return err
	}
	if err := files.CopyItem(true, true, "/usr/local/bin/lang", originalDir); err != nil {
		return err
	}
	if err := files.CopyItem(false, true, path.Join(svcInfo.basePath, svcInfo.coreName), originalDir); err != nil {
		return err
	}
	if err := files.CopyItem(false, true, path.Join(svcInfo.basePath, svcInfo.agentName), originalDir); err != nil {
		return err
	}
	if err := files.CopyItem(true, true, path.Join(global.CONF.Base.InstallDir, "1panel/db"), originalDir); err != nil {
		return err
	}
	if err := files.CopyItem(false, true, path.Join(global.CONF.Base.InstallDir, "1panel/geo/GeoIP.mmdb"), originalDir); err != nil {
		return err
	}
	return nil
}

func (u *UpgradeService) handleRollback(originalDir string, errStep int, svcInfo serviceInfo) {
	_ = settingRepo.Update("SystemStatus", "Free")
	dbPath := path.Join(global.CONF.Base.InstallDir, "1panel")
	if _, err := os.Stat(path.Join(originalDir, "db")); err == nil {
		if err := os.Chmod(path.Join(originalDir, "db"), 0700); err != nil {
			global.LOG.Errorf("set rollback db dir permissions failed, err: %v", err)
		} else if err := files.CopyItem(true, true, path.Join(originalDir, "db"), dbPath); err != nil {
			global.LOG.Errorf("rollback 1panel db failed, err: %v", err)
		}
	}
	if err := files.CopyFileWithRename(path.Join(originalDir, "1panel-core"), "/usr/local/bin/1panel-core"); err != nil {
		global.LOG.Errorf("rollback 1panel-core failed, err: %v", err)
	}
	if err := files.CopyFileWithRename(path.Join(originalDir, "1panel-agent"), "/usr/local/bin/1panel-agent"); err != nil {
		global.LOG.Errorf("rollback 1panel-agent failed, err: %v", err)
	}
	if errStep == 1 {
		return
	}
	if err := files.CopyFileWithRename(path.Join(originalDir, "1pctl"), "/usr/local/bin/1pctl"); err != nil {
		global.LOG.Errorf("rollback 1pctl failed, err: %v", err)
	}
	if errStep == 2 {
		return
	}
	if err := files.CopyFileWithRename(path.Join(originalDir, svcInfo.coreName), path.Join(svcInfo.basePath, svcInfo.coreName)); err != nil {
		global.LOG.Errorf("rollback %s failed, err: %v", svcInfo.coreName, err)
	}
	if err := files.CopyFileWithRename(path.Join(originalDir, svcInfo.agentName), path.Join(svcInfo.basePath, svcInfo.agentName)); err != nil {
		global.LOG.Errorf("rollback %s failed, err: %v", svcInfo.agentName, err)
	}
	if errStep == 3 {
		return
	}
	if err := files.CopyItem(true, true, path.Join(originalDir, "lang"), "/usr/local/bin"); err != nil {
		global.LOG.Errorf("rollback language files failed, err: %v", err)
	}
	if err := files.CopyFileWithRename(path.Join(originalDir, "GeoIP.mmdb"), path.Join(global.CONF.Base.InstallDir, "1panel/geo/GeoIP.mmdb")); err != nil {
		global.LOG.Errorf("rollback GeoIP database failed, err: %v", err)
	}
}

func (u *UpgradeService) loadVersionByMode(developer, currentVersion string) (string, string, string) {
	var current, latest string
	if global.CONF.Base.Mode == "dev" {
		devVersionLatest := u.loadVersion(true, currentVersion, "dev")
		return devVersionLatest, "", ""
	}

	betaVersionLatest := ""
	latest = u.loadVersion(true, currentVersion, "stable")
	current = u.loadVersion(false, currentVersion, "stable")
	if developer == constant.StatusEnable {
		betaVersionLatest = u.loadVersion(true, currentVersion, "beta")
	}
	if current != latest {
		return betaVersionLatest, current, latest
	}

	versionPart := strings.Split(current, ".")
	if len(versionPart) < 3 {
		return betaVersionLatest, "", latest
	}
	num, _ := strconv.Atoi(versionPart[1])
	if num == 0 {
		return betaVersionLatest, "", latest
	}
	if num >= 10 {
		if current[:6] == currentVersion[:6] {
			return betaVersionLatest, current, ""
		}
		return betaVersionLatest, "", latest
	}
	if current[:5] == currentVersion[:5] {
		return betaVersionLatest, "", ""
	}
	return betaVersionLatest, "", latest
}

func (u *UpgradeService) loadVersion(isLatest bool, currentVersion, mode string) string {
	path := fmt.Sprintf("%s/%s/latest", global.RepoURL(), mode)
	if !isLatest {
		path = fmt.Sprintf("%s/%s/latest.current", global.RepoURL(), mode)
	}
	_, latestVersionRes, err := req_helper.HandleRequestWithProxy(path, http.MethodGet, constant.TimeOut20s)
	if err != nil {
		global.LOG.Errorf("load latest version from oss failed, err: %v", err)
		return ""
	}
	version := string(latestVersionRes)
	if strings.Contains(version, "<") {
		global.LOG.Errorf("load latest version from oss failed, err: %v", version)
		return ""
	}
	if isLatest {
		return u.checkVersion(version, currentVersion)
	}

	versionMap := make(map[string]string)
	if err := json.Unmarshal(latestVersionRes, &versionMap); err != nil {
		global.LOG.Errorf("load latest version from oss failed (error unmarshal), err: %v", err)
		return ""
	}

	versionPart := strings.Split(currentVersion, ".")
	if len(versionPart) < 3 {
		global.LOG.Errorf("current version is error format: %s", currentVersion)
		return ""
	}
	num, _ := strconv.Atoi(versionPart[1])
	if num >= 10 {
		if version, ok := versionMap[currentVersion[0:5]]; ok {
			return u.checkVersion(version, currentVersion)
		}
		return ""
	}
	if version, ok := versionMap[currentVersion[0:4]]; ok {
		return u.checkVersion(version, currentVersion)
	}
	return ""
}

func (u *UpgradeService) checkVersion(v2, v1 string) string {
	addSuffix := false
	if !strings.Contains(v1, "-") {
		v1 = v1 + "-lts"
	}
	if !strings.Contains(v2, "-") {
		addSuffix = true
		v2 = v2 + "-lts"
	}
	if common.ComparePanelVersion(v2, v1) {
		if addSuffix {
			return strings.TrimSuffix(v2, "-lts")
		}
		return v2
	}
	return ""
}

func (u *UpgradeService) loadReleaseNotes(path string) (string, error) {
	_, releaseNotes, err := req_helper.HandleRequestWithProxy(path, http.MethodGet, constant.TimeOut20s)
	if err != nil {
		return "", err
	}
	return string(releaseNotes), nil
}

func loadArch() (string, error) {
	std, err := cmd.NewCommandMgr().RunWithStdout("uname", "-a")
	if err != nil {
		return "", fmt.Errorf("std: %s, err: %s", std, err.Error())
	}
	if strings.Contains(std, "x86_64") {
		return "amd64", nil
	}
	if strings.Contains(std, "arm64") || strings.Contains(std, "aarch64") {
		return "arm64", nil
	}
	if strings.Contains(std, "armv7l") {
		return "armv7", nil
	}
	if strings.Contains(std, "ppc64le") {
		return "ppc64le", nil
	}
	if strings.Contains(std, "s390x") {
		return "s390x", nil
	}
	if strings.Contains(std, "riscv64") {
		return "riscv64", nil
	}
	return "", fmt.Errorf("unsupported such arch: %s", std)
}

func dropBackupCopies() {
	backupCopies, _ := settingRepo.GetValueByKey("UpgradeBackupCopies")
	if err := upgradeUtil.DropBackupCopies(global.CONF.Base.InstallDir, backupCopies); err != nil {
		global.LOG.Errorf("read upgrade dir failed, err: %v", err)
	}
}
