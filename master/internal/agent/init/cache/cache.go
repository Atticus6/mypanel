package cache

import (
	"mypanel/agent/global"
	cachedb "mypanel/agent/init/cache/db"
)

func Init() {
	global.CACHE = cachedb.NewCacheDB()
}
