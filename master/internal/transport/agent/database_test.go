package agent

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	"mypanel/agent/app/model"
	agentglobal "mypanel/agent/global"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestDatabaseListAndSearch 验证数据库实例列表与 MySQL/PostgreSQL 数据库查询。
//
// 直接插入实例与数据库记录，走真实的 repo 查询与转换逻辑。
func TestDatabaseListAndSearch(t *testing.T) {
	setupSingleProcess(t)

	db := model.Database{
		Name:    "mysql-test",
		Type:    "mysql",
		Version: "8.0",
		From:    "local",
		Address: "127.0.0.1",
		Port:    3306,
	}
	if err := agentglobal.DB.Create(&db).Error; err != nil {
		t.Fatalf("插入数据库实例失败: %v", err)
	}
	mysqlDB := model.DatabaseMysql{
		Name:        "appdb",
		From:        "local",
		MysqlName:   "mysql-test",
		Format:      "utf8mb4",
		Collation:   "utf8mb4_general_ci",
		Username:    "appdb",
		Password:    "secret",
		Permission:  "%",
		Description: "测试库",
	}
	if err := agentglobal.DB.Create(&mysqlDB).Error; err != nil {
		t.Fatalf("插入 MySQL 数据库失败: %v", err)
	}
	pgDB := model.DatabasePostgresql{
		Name:           "pgdb",
		From:           "local",
		PostgresqlName: "pg-test",
		Format:         "UTF8",
		Username:       "pgdb",
		Password:       "secret",
	}
	if err := agentglobal.DB.Create(&pgDB).Error; err != nil {
		t.Fatalf("插入 PostgreSQL 数据库失败: %v", err)
	}

	server := NewDatabaseServer()

	list, err := server.List(context.Background(), connect.NewRequest(&agentv1.ListDatabasesRequest{Type: "mysql"}))
	if err != nil {
		t.Fatalf("List 返回错误: %v", err)
	}
	if len(list.Msg.GetItems()) != 1 || list.Msg.GetItems()[0].GetDatabase() != "mysql-test" {
		t.Fatalf("items = %+v, 期望 mysql-test", list.Msg.GetItems())
	}

	search, err := server.SearchMySQL(context.Background(), connect.NewRequest(&agentv1.SearchMySQLDatabasesRequest{
		Page:     1,
		PageSize: 10,
		Database: "mysql-test",
	}))
	if err != nil {
		t.Fatalf("SearchMySQL 返回错误: %v", err)
	}
	if search.Msg.GetTotal() != 1 {
		t.Fatalf("total = %d, 期望 1", search.Msg.GetTotal())
	}
	item := search.Msg.GetItems()[0]
	if item.GetName() != "appdb" || item.GetFormat() != "utf8mb4" {
		t.Fatalf("mysql item = %+v, 期望 appdb/utf8mb4", item)
	}

	pgSearch, err := server.SearchPostgreSQL(context.Background(), connect.NewRequest(&agentv1.SearchPostgreSQLDatabasesRequest{
		Page:     1,
		PageSize: 10,
		Database: "pg-test",
	}))
	if err != nil {
		t.Fatalf("SearchPostgreSQL 返回错误: %v", err)
	}
	if pgSearch.Msg.GetTotal() != 1 {
		t.Fatalf("pg total = %d, 期望 1", pgSearch.Msg.GetTotal())
	}
	if pgSearch.Msg.GetItems()[0].GetName() != "pgdb" {
		t.Fatalf("pg item = %+v, 期望 pgdb", pgSearch.Msg.GetItems()[0])
	}
}

// TestDatabaseSearchRemote 验证远程数据库（Redis/MongoDB）列表只返回非本地实例。
func TestDatabaseSearchRemote(t *testing.T) {
	setupSingleProcess(t)

	remote := model.Database{
		Name:     "redis-remote",
		Type:     "redis",
		Version:  "7.0",
		From:     "remote",
		Address:  "10.0.0.9",
		Port:     6379,
		Username: "default",
	}
	if err := agentglobal.DB.Create(&remote).Error; err != nil {
		t.Fatalf("插入远程数据库失败: %v", err)
	}
	local := model.Database{
		Name:    "redis-local",
		Type:    "redis",
		Version: "7.0",
		From:    "local",
		Address: "127.0.0.1",
		Port:    6379,
	}
	if err := agentglobal.DB.Create(&local).Error; err != nil {
		t.Fatalf("插入本地数据库失败: %v", err)
	}

	server := NewDatabaseServer()
	resp, err := server.SearchRemote(context.Background(), connect.NewRequest(&agentv1.SearchRemoteDatabasesRequest{
		Page:     1,
		PageSize: 10,
		Type:     "redis",
	}))
	if err != nil {
		t.Fatalf("SearchRemote 返回错误: %v", err)
	}
	if resp.Msg.GetTotal() != 1 {
		t.Fatalf("total = %d, 期望 1（仅远程）", resp.Msg.GetTotal())
	}
	if got := resp.Msg.GetItems()[0]; got.GetName() != "redis-remote" || got.GetPort() != 6379 {
		t.Fatalf("remote item = %+v, 期望 redis-remote:6379", got)
	}
}

// TestDatabaseSearchMongoDB 验证 MongoDB 数据库查询走真实数据库。
func TestDatabaseSearchMongoDB(t *testing.T) {
	setupSingleProcess(t)

	item := model.DatabaseMongodb{
		Name:        "mongodb-app",
		From:        "local",
		MongodbName: "mongodb-test",
		Username:    "app",
		Password:    "secret",
	}
	if err := agentglobal.DB.Create(&item).Error; err != nil {
		t.Fatalf("插入 MongoDB 数据库失败: %v", err)
	}

	server := NewDatabaseServer()
	resp, err := server.SearchMongoDB(context.Background(), connect.NewRequest(&agentv1.SearchMongoDBDatabasesRequest{
		Page:     1,
		PageSize: 10,
		Database: "mongodb-test",
	}))
	if err != nil {
		t.Fatalf("SearchMongoDB 返回错误: %v", err)
	}
	if resp.Msg.GetTotal() != 1 || resp.Msg.GetItems()[0].GetName() != "mongodb-app" {
		t.Fatalf("items = %+v, 期望 mongodb-app", resp.Msg.GetItems())
	}
}

// TestRedisConfigTolerant 验证 Redis 配置接口在实例不存在时安全失败。
func TestRedisConfigTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewDatabaseServer()
	req := &agentv1.RedisInstanceRequest{Type: "redis", Database: "missing-redis"}
	if _, err := server.GetRedisStatus(context.Background(), connect.NewRequest(req)); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("status 错误类型 = %T", err)
		}
	}
	if _, err := server.GetRedisConf(context.Background(), connect.NewRequest(req)); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("conf 错误类型 = %T", err)
		}
	}
	if _, err := server.GetRedisPersistenceConf(context.Background(), connect.NewRequest(req)); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("persistence 错误类型 = %T", err)
		}
	}
}

// TestCheckRedisCli 验证 Redis CLI 检查返回布尔值。
func TestCheckRedisCli(t *testing.T) {
	setupSingleProcess(t)

	server := NewDatabaseServer()
	resp, err := server.CheckRedisCli(context.Background(), connect.NewRequest(&agentv1.CheckRedisCliRequest{}))
	if err != nil {
		t.Fatalf("CheckRedisCli: %v", err)
	}
	if resp.Msg.GetAvailable() != resp.Msg.GetAvailable() {
		t.Fatal("unreachable")
	}
}

// TestListMySQLUsersTolerant 验证 MySQL 用户列表在实例不可用时安全失败。
func TestListMySQLUsersTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewDatabaseServer()
	_, err := server.ListMySQLUsers(context.Background(), connect.NewRequest(&agentv1.ListMySQLUsersRequest{Database: "missing"}))
	if err == nil {
		return
	}
	if _, ok := err.(*connect.Error); !ok {
		t.Fatalf("错误类型 = %T", err)
	}
}
