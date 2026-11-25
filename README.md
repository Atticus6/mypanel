# mypanel

单进程面板服务，基于 1Panel 的控制面 / 数据面代码改造而来：把原本分离的 `1panel-core`、`1panel-agent`
合并进一个 `master` 进程，同时保留 Connect/gRPC API 与由 Go `embed` 托管的前端页面，做到前后端同源。

前端使用 Vue 3 + Element Plus + Vite；API 用 Protobuf 定义，由 `proto/` 同时生成 Go 与 TypeScript 代码。

## 特性

- **单进程**：core / agent 作为独立 Go module 保留，但共享同一个 SQLite 连接，不互相 import，只通过共享库与进程内协作。
- **同源部署**：`master` 同时提供 REST/Connect RPC 与前端 SPA，无需单独部署前端或配置 CORS。
- **h2c / gRPC**：gin 基于 net/http，因此保留 HTTP/2 明文（h2c）与 gRPC，并支持 Connect 与 gRPC-Web。
- **可配置升级源**：升级包 / 资源 / 应用商店地址默认指向本项目自己的发布地址，可用环境变量覆盖。

## 目录结构

| 目录 | 说明 |
| --- | --- |
| `proto/` | 独立 Go module，存放 `.proto` 与 buf 配置，生成 Go 与 TS 代码 |
| `master/` | 单进程服务端：Connect/gRPC + 托管 web；`internal/core`、`internal/agent` 为 1Panel 控制面/数据面 |
| `node/` | 数据面 agent（占位） |
| `web/` | 前端：Vue 3 + Element Plus + Vite + Pinia Colada |
| `scripts/` | 构建、代码生成、安装、备份/恢复等脚本 |
| `docs/` | 迁移方案与验收文档 |

`go.work` 把 `master`、`master/internal/core`、`master/internal/agent`、`node`、`proto`、`shareddb`
收进同一个 workspace；新增 Go module 必须同步加入。

## 环境要求

- Go（版本以 `master/go.mod` 声明为准）
- [Bun](https://bun.sh/)（前端安装、构建与测试统一用 bun / bunx）
- 代码生成额外需要 `protoc`、`buf`；生成产物已提交，日常构建不需要它们

## 开发

```bash
# 安装前端依赖
cd web && bun install

# 启动前端开发服务器（默认 :4004，/rpc 与 /api/v2 代理到 :8080）
bun --bun run dev

# 另开终端，启动后端（默认 :8080）
./bin/master -addr :8080
```

生产模式下前端由 `master` 用 `go:embed` 托管，不需要单独启动前端。

## 构建

```bash
# 构建前端 → 同步进 embed 目录 → 编译 bin/master
./scripts/build.sh

# 直接运行
./bin/master -addr :8080
```

访问 `http://<主机IP>:8080`。首次启动若未配置密码，会在启动日志里打印一次随机管理员密码。

## 测试

```bash
# Go（仓库根目录执行；workspace 含多个 module）
go test ./master/...

# 前端
cd web && bun run type-check && bun test

# 静态检查
go vet ./master/... && gofmt -l master
cd web && bun run fmt:check
```

提交前请先通读 `AGENTS.md`，其中约定了注释语言、代码生成、路由、配置与测试规范。

## 安装为系统服务

`scripts/install.sh` 会把二进制、配置和 systemd 单元安装到本机（需 root）：

```bash
sudo ./scripts/install.sh \
  --port 8080 \
  --data-dir /opt/mypanel/data \
  --password 'YourStrongPassword'

# 强制先重新构建再安装
sudo ./scripts/install.sh --build

# 卸载（保留配置与数据）
sudo ./scripts/install.sh --uninstall
```

安装后可用 `mypanelctl` 管理服务：

```bash
mypanelctl status            # 运行状态与访问地址
mypanelctl restart           # 重启
mypanelctl logs -f           # 实时日志
mypanelctl version           # 版本
mypanelctl port 9000         # 修改端口（需重启生效）
mypanelctl upgrade-source URL  # 修改升级源
mypanelctl help              # 查看全部命令
```

## 配置

默认配置在 `config.yaml`，个人改动写同目录的 `config.local.yaml`（已 gitignore），不要改入库的默认值。
也可通过 `MYPANEL_` 前缀的环境变量覆盖，例如：

```bash
MYPANEL_ADDR=:9000 MYPANEL_DATA_DIR=/var/lib/mypanel ./bin/master
```

优先级：`命令行参数 > 环境变量 > config.local.yaml > config.yaml > 内置默认值`。

| 配置项 | 环境变量 | 默认值 |
| --- | --- | --- |
| `addr` | `MYPANEL_ADDR` | `:8080` |
| `web_dir` | `MYPANEL_WEB_DIR` | 空（用内置前端） |
| `debug` | `MYPANEL_DEBUG` | `false` |
| `shutdown_timeout` | `MYPANEL_SHUTDOWN_TIMEOUT` | `5s` |
| `data_dir` | `MYPANEL_DATA_DIR` | `./data` |
| `admin_user` | `MYPANEL_ADMIN_USER` | `admin` |
| `admin_password` | `MYPANEL_ADMIN_PASSWORD` | 空（随机生成并打印一次） |
| `upgrade_repo_url` | `MYPANEL_UPGRADE_REPO_URL` | 原版 1Panel 官方地址 |
| `upgrade_resource_url` | `MYPANEL_UPGRADE_RESOURCE_URL` | 原版 1Panel 官方地址 |
| `upgrade_app_url` | `MYPANEL_UPGRADE_APP_URL` | 原版 1Panel 官方地址 |

## 代码生成

`proto/` 是唯一事实来源，**不要手改生成产物**。改完 `.proto` 后执行：

```bash
./scripts/gen.sh        # 生成 Go 与 TS（需要 buf/protoc）
./scripts/gen-wire.sh   # 依赖注入变更时重新生成 wire_gen.go
```

Connect-ES v2 已移除 `protoc-gen-connect-es`，服务描述符由 `protoc-gen-es` 直接生成到 `*_pb.ts`。

## CI / 发布

`.github/workflows/build.yml` 在 push / PR 时构建并打包 `bin/master`、配置、安装脚本与 CLI；推送 `v*`
标签时额外创建 Release 并上传 `mypanel-<版本>-linux-amd64.tar.gz`。版本号取自标签名。

## 许可

GPL-3.0，详见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。
