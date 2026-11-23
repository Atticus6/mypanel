package migrations

import (
	"github.com/go-gormigrate/gormigrate/v2"
	"gorm.io/gorm"
	"mypanel/core/app/model"
)

var AddPanelMCP = &gormigrate.Migration{
	ID: "20261009-panel-mcp",
	Migrate: func(tx *gorm.DB) error {
		if err := tx.Migrator().DropTable(&model.MCPSetting{}); err != nil {
			return err
		}
		return tx.AutoMigrate(&model.MCPCredential{}, &model.MCPGrant{}, &model.MCPInvocation{}, &model.MCPSetting{})
	},
}
