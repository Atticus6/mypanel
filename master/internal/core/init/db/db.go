package db

import (
	"fmt"

	"mypanel/core/global"
	"mypanel/shareddb"
)

// Init 让 core 的所有连接指向同一个共享 SQLite 连接池。
func Init() {
	handle := shareddb.Handle()
	if handle == nil {
		panic(fmt.Errorf("core 数据库初始化前必须先调用 shareddb.Init"))
	}
	global.DB = handle
	global.TaskDB = handle
	global.AgentDB = handle
	global.AlertDB = handle
}
