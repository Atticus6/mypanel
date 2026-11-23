// Package shareddb 提供 core 与 agent 共用的单一 SQLite 连接。
//
// 单进程模式下不再为每个模块单独开库：两个 module 通过本包拿到同一个
// *gorm.DB（底层是同一个 *sql.DB 连接池），迁移表按模块区分，业务表共享。
package shareddb

import (
	"fmt"
	"os"
	"path"
	"sync"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var (
	mu     sync.Mutex
	db     *gorm.DB
	dbPath string
)

// DBPath 返回共享库文件路径。
func DBPath(dataDir string) string {
	return path.Join(dataDir, "1panel", "db", "mypanel.db")
}

// Init 打开（或创建）共享数据库；重复调用返回同一个句柄。
func Init(dataDir string) (*gorm.DB, error) {
	mu.Lock()
	defer mu.Unlock()
	fullPath := DBPath(dataDir)
	if db != nil && dbPath == fullPath {
		return db, nil
	}
	if db != nil {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
		db = nil
	}
	dir := path.Dir(fullPath)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, fmt.Errorf("创建共享数据库目录失败: %w", err)
	}
	if err := os.Chmod(dir, 0o700); err != nil {
		return nil, fmt.Errorf("设置共享数据库目录权限失败: %w", err)
	}
	file, err := os.OpenFile(fullPath, os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return nil, fmt.Errorf("创建共享数据库失败: %w", err)
	}
	if err := file.Close(); err != nil {
		return nil, err
	}
	for _, suffix := range []string{"-wal", "-shm", "-journal"} {
		if err := os.Chmod(fullPath+suffix, 0o600); err != nil && !os.IsNotExist(err) {
			return nil, err
		}
	}

	handle, err := gorm.Open(sqlite.Open(fullPath), &gorm.Config{
		DisableForeignKeyConstraintWhenMigrating: true,
		Logger:                                   logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, err
	}
	sqlDB, err := handle.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(4)
	sqlDB.SetMaxIdleConns(1)
	sqlDB.SetConnMaxLifetime(0)
	sqlDB.SetConnMaxIdleTime(0)
	for _, pragma := range []string{
		"PRAGMA journal_mode = WAL;",
		"PRAGMA synchronous = NORMAL;",
		"PRAGMA busy_timeout = 5000;",
		"PRAGMA foreign_keys = OFF;",
	} {
		if err := handle.Exec(pragma).Error; err != nil {
			return nil, fmt.Errorf("设置数据库参数失败: %w", err)
		}
	}
	db = handle
	dbPath = fullPath
	return db, nil
}

// Handle 返回共享连接；必须先调用 Init。
func Handle() *gorm.DB {
	mu.Lock()
	defer mu.Unlock()
	return db
}
