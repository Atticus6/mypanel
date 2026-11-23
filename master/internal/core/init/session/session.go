package session

import (
	"mypanel/core/global"
	"mypanel/core/init/session/psession"
)

func Init() {
	global.SESSION = psession.NewPSession("")
	global.LOG.Info("init in-memory session successfully")
}
