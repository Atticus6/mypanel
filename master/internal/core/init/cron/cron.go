package cron

import (
	"time"

	"github.com/robfig/cron/v3"
	"mypanel/core/app/service"
	"mypanel/core/global"
	"mypanel/core/init/cron/job"
	"mypanel/core/utils/common"
)

func Init() {
	nyc, _ := time.LoadLocation(common.LoadTimeZoneByCmd())
	global.Cron = cron.New(cron.WithLocation(nyc), cron.WithChain(cron.Recover(cron.DefaultLogger)), cron.WithChain(cron.DelayIfStillRunning(cron.DefaultLogger)))

	if _, err := global.Cron.AddJob("0 3 */31 * *", job.NewBackupJob()); err != nil {
		global.LOG.Errorf("[core] can not add backup token refresh corn job: %s", err.Error())
	}

	service.StartSync()
	global.Cron.Start()
}
