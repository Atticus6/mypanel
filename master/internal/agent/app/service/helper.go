package service

import (
	"context"

	"gorm.io/gorm"
	"mypanel/agent/constant"
	"mypanel/agent/global"
)

func getTxAndContext() (tx *gorm.DB, ctx context.Context) {
	tx = global.DB.Begin()
	ctx = context.WithValue(context.Background(), constant.DB, tx)
	return
}
