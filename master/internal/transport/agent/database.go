package agent

import (
	"context"

	"connectrpc.com/connect"

	agentdto "mypanel/agent/app/dto"
	agentservice "mypanel/agent/app/service"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/errmap"
)

// DatabaseServer 实现 panel.agent.v1.DatabaseService。
type DatabaseServer struct {
	service    *agentservice.DatabaseService
	mysql      *agentservice.MysqlService
	postgresql *agentservice.PostgresqlService
	mongodb    *agentservice.MongodbService
	redis      *agentservice.RedisService
}

// NewDatabaseServer 构造数据库管理服务。
func NewDatabaseServer() *DatabaseServer {
	return &DatabaseServer{
		service:    &agentservice.DatabaseService{},
		mysql:      &agentservice.MysqlService{},
		postgresql: &agentservice.PostgresqlService{},
		mongodb:    &agentservice.MongodbService{},
		redis:      &agentservice.RedisService{},
	}
}

// List 列出可选的数据库实例。
func (s *DatabaseServer) List(
	_ context.Context,
	req *connect.Request[agentv1.ListDatabasesRequest],
) (*connect.Response[agentv1.ListDatabasesResponse], error) {
	options, err := s.service.List(req.Msg.GetType())
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.DatabaseOption, 0, len(options))
	for _, item := range options {
		items = append(items, &agentv1.DatabaseOption{
			Id:       uint32(item.ID),
			Type:     item.Type,
			From:     item.From,
			Database: item.Database,
			Version:  item.Version,
			Address:  item.Address,
		})
	}
	return connect.NewResponse(&agentv1.ListDatabasesResponse{Items: items}), nil
}

// SearchMySQL 分页查询 MySQL 数据库。
func (s *DatabaseServer) SearchMySQL(
	_ context.Context,
	req *connect.Request[agentv1.SearchMySQLDatabasesRequest],
) (*connect.Response[agentv1.SearchMySQLDatabasesResponse], error) {
	total, list, err := s.mysql.SearchWithPage(agentdto.MysqlDBSearch{
		PageInfo: agentdto.PageInfo{
			Page:     int(req.Msg.GetPage()),
			PageSize: int(req.Msg.GetPageSize()),
		},
		Info:     req.Msg.GetInfo(),
		Database: req.Msg.GetDatabase(),
		OrderBy:  defaultString(req.Msg.GetOrderBy(), "createdAt"),
		Order:    defaultString(req.Msg.GetOrder(), "descending"),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}

	rows, _ := list.([]agentdto.MysqlDBInfo)
	items := make([]*agentv1.MySQLDatabase, 0, len(rows))
	for _, row := range rows {
		items = append(items, &agentv1.MySQLDatabase{
			Id:          uint32(row.ID),
			CreatedAt:   formatTime(row.CreatedAt),
			Name:        row.Name,
			From:        row.From,
			MysqlName:   row.MysqlName,
			Format:      row.Format,
			Collation:   row.Collation,
			IsDelete:    row.IsDelete,
			Description: row.Description,
		})
	}
	return connect.NewResponse(&agentv1.SearchMySQLDatabasesResponse{
		Items: items,
		Total: total,
	}), nil
}

// SearchPostgreSQL 分页查询 PostgreSQL 数据库。
func (s *DatabaseServer) SearchPostgreSQL(
	_ context.Context,
	req *connect.Request[agentv1.SearchPostgreSQLDatabasesRequest],
) (*connect.Response[agentv1.SearchPostgreSQLDatabasesResponse], error) {
	total, list, err := s.postgresql.SearchWithPage(agentdto.PostgresqlDBSearch{
		PageInfo: agentdto.PageInfo{
			Page:     int(req.Msg.GetPage()),
			PageSize: int(req.Msg.GetPageSize()),
		},
		Info:     req.Msg.GetInfo(),
		Database: req.Msg.GetDatabase(),
		OrderBy:  defaultString(req.Msg.GetOrderBy(), "createdAt"),
		Order:    defaultString(req.Msg.GetOrder(), "descending"),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}

	rows, _ := list.([]agentdto.PostgresqlDBInfo)
	items := make([]*agentv1.PostgreSQLDatabase, 0, len(rows))
	for _, row := range rows {
		items = append(items, &agentv1.PostgreSQLDatabase{
			Id:             uint32(row.ID),
			CreatedAt:      formatTime(row.CreatedAt),
			Name:           row.Name,
			From:           row.From,
			PostgresqlName: row.PostgresqlName,
			Format:         row.Format,
			SuperUser:      row.SuperUser,
			IsDelete:       row.IsDelete,
			Description:    row.Description,
		})
	}
	return connect.NewResponse(&agentv1.SearchPostgreSQLDatabasesResponse{
		Items: items,
		Total: total,
	}), nil
}

// ListMySQLUsers 列出 MySQL 实例下的用户。
func (s *DatabaseServer) ListMySQLUsers(
	_ context.Context,
	req *connect.Request[agentv1.ListMySQLUsersRequest],
) (*connect.Response[agentv1.ListMySQLUsersResponse], error) {
	list, err := s.mysql.ListUsers(agentdto.MysqlUserSearch{Database: req.Msg.GetDatabase()})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.MySQLUser, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.MySQLUser{
			Username:    item.Username,
			Host:        item.Host,
			Description: item.Description,
			IsDelete:    item.IsDelete,
		})
	}
	return connect.NewResponse(&agentv1.ListMySQLUsersResponse{Items: items}), nil
}

// CheckRedisCli 检查 Redis CLI 是否可用。
func (s *DatabaseServer) CheckRedisCli(
	_ context.Context,
	_ *connect.Request[agentv1.CheckRedisCliRequest],
) (*connect.Response[agentv1.CheckRedisCliResponse], error) {
	return connect.NewResponse(&agentv1.CheckRedisCliResponse{Available: s.redis.CheckHasCli()}), nil
}

// GetRedisStatus 读取 Redis 运行状态。
func (s *DatabaseServer) GetRedisStatus(
	_ context.Context,
	req *connect.Request[agentv1.RedisInstanceRequest],
) (*connect.Response[agentv1.RedisStatus], error) {
	status, err := s.redis.LoadStatus(agentdto.LoadRedisStatus{
		Type: req.Msg.GetType(),
		Name: req.Msg.GetDatabase(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.RedisStatus{
		Database:                 status.Database,
		TcpPort:                  status.TcpPort,
		UptimeInDays:             status.UptimeInDays,
		ConnectedClients:         status.ConnectedClients,
		UsedMemory:               status.UsedMemory,
		UsedMemoryRss:            status.UsedMemoryRss,
		UsedMemoryPeak:           status.UsedMemoryPeak,
		MemFragmentationRatio:    status.MemFragmentationRatio,
		TotalConnectionsReceived: status.TotalConnectionsReceived,
		TotalCommandsProcessed:   status.TotalCommandsProcessed,
		InstantaneousOpsPerSec:   status.InstantaneousOpsPerSec,
		KeyspaceHits:             status.KeyspaceHits,
		KeyspaceMisses:           status.KeyspaceMisses,
		LatestForkUsec:           status.LatestForkUsec,
	}), nil
}

// GetRedisConf 读取 Redis 配置。
func (s *DatabaseServer) GetRedisConf(
	_ context.Context,
	req *connect.Request[agentv1.RedisInstanceRequest],
) (*connect.Response[agentv1.RedisConf], error) {
	conf, err := s.redis.LoadConf(agentdto.LoadRedisStatus{
		Type: req.Msg.GetType(),
		Name: req.Msg.GetDatabase(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.RedisConf{
		Database:      conf.Database,
		Name:          conf.Name,
		Port:          conf.Port,
		ContainerName: conf.ContainerName,
		Timeout:       conf.Timeout,
		Maxclients:    conf.Maxclients,
		Requirepass:   conf.Requirepass,
		Maxmemory:     conf.Maxmemory,
	}), nil
}

// GetRedisPersistenceConf 读取 Redis 持久化配置。
func (s *DatabaseServer) GetRedisPersistenceConf(
	_ context.Context,
	req *connect.Request[agentv1.RedisInstanceRequest],
) (*connect.Response[agentv1.RedisPersistence], error) {
	conf, err := s.redis.LoadPersistenceConf(agentdto.LoadRedisStatus{
		Type: req.Msg.GetType(),
		Name: req.Msg.GetDatabase(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.RedisPersistence{
		Database:    conf.Database,
		Appendonly:  conf.Appendonly,
		Appendfsync: conf.Appendfsync,
		Save:        conf.Save,
	}), nil
}

// SearchMongoDB 分页查询 MongoDB 数据库。
func (s *DatabaseServer) SearchMongoDB(
	_ context.Context,
	req *connect.Request[agentv1.SearchMongoDBDatabasesRequest],
) (*connect.Response[agentv1.SearchMongoDBDatabasesResponse], error) {
	total, list, err := s.mongodb.SearchWithPage(agentdto.MongodbDBSearch{
		PageInfo: agentdto.PageInfo{
			Page:     int(req.Msg.GetPage()),
			PageSize: int(req.Msg.GetPageSize()),
		},
		Info:     req.Msg.GetInfo(),
		Database: req.Msg.GetDatabase(),
		OrderBy:  defaultString(req.Msg.GetOrderBy(), "createdAt"),
		Order:    defaultString(req.Msg.GetOrder(), "descending"),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	rows, _ := list.([]agentdto.MongodbDBInfo)
	items := make([]*agentv1.MongoDBDatabase, 0, len(rows))
	for _, row := range rows {
		items = append(items, &agentv1.MongoDBDatabase{
			Id:          uint32(row.ID),
			CreatedAt:   formatTime(row.CreatedAt),
			Name:        row.Name,
			From:        row.From,
			MongodbName: row.MongodbName,
			Username:    row.Username,
			IsDelete:    row.IsDelete,
			Description: row.Description,
		})
	}
	return connect.NewResponse(&agentv1.SearchMongoDBDatabasesResponse{Items: items, Total: total}), nil
}

// SearchRemote 分页查询远程数据库连接。
func (s *DatabaseServer) SearchRemote(
	_ context.Context,
	req *connect.Request[agentv1.SearchRemoteDatabasesRequest],
) (*connect.Response[agentv1.SearchRemoteDatabasesResponse], error) {
	total, list, err := s.service.SearchWithPage(agentdto.DatabaseSearch{
		PageInfo: agentdto.PageInfo{
			Page:     int(req.Msg.GetPage()),
			PageSize: int(req.Msg.GetPageSize()),
		},
		Info:    req.Msg.GetInfo(),
		Type:    req.Msg.GetType(),
		OrderBy: defaultString(req.Msg.GetOrderBy(), "createdAt"),
		Order:   defaultString(req.Msg.GetOrder(), "descending"),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}

	rows, _ := list.([]agentdto.DatabaseInfo)
	items := make([]*agentv1.RemoteDatabase, 0, len(rows))
	for _, row := range rows {
		items = append(items, &agentv1.RemoteDatabase{
			Id:          uint32(row.ID),
			CreatedAt:   formatTime(row.CreatedAt),
			Name:        row.Name,
			Type:        row.Type,
			Version:     row.Version,
			Address:     row.Address,
			Port:        uint32(row.Port),
			InitialDb:   row.InitialDB,
			Username:    row.Username,
			From:        row.From,
			Ssl:         row.SSL,
			SkipVerify:  row.SkipVerify,
			Timeout:     uint32(row.Timeout),
			Description: row.Description,
		})
	}
	return connect.NewResponse(&agentv1.SearchRemoteDatabasesResponse{
		Items: items,
		Total: total,
	}), nil
}
