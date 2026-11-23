# 1Panel 全量迁移方案

> 状态：方案草案（只描述设计与实施步骤，不含代码改动）
>
> 迁移基线：1Panel `v2.5.1`，commit `806de6307bd56b11883e04059ad9f1e41ecd06e8`（2026-11-12）
>
> 目标仓库：`mypanel`
>
> 最后更新：2026-11-22

---

## 0. 结论摘要

按已确认的决策执行：

| 决策项 | 结论 |
| --- | --- |
| 前端 | 把 1Panel 的 Vue 3 + Element Plus 前端整体复制进 `web/`，再把 `api/` 数据层改造成 RPC 风格；**AI、VM、网站运行时/模板、Toolbox 不迁移** |
| 数据层 | 使用 **Pinia Colada** 管理查询、变更、缓存与失效，不引入 TanStack Vue Query |
| 后端 | 1Panel 的 `core` 与 `agent` 全部迁入 `master`，合并为**单进程**；剔除上述模块及 xpack/License 相关服务 |
| 通讯 | 删除面向浏览器的 REST JSON API，统一走 **Connect / gRPC**；前端通过同源 `/rpc` 调用 |
| 节奏 | **一次性全量切换**：所有模块完成后再上线，不保留长期双栈 |

核心做法：

1. **前端整体复制，不做页面级重写。** 复制 1Panel 的 Vue 页面、Element Plus 组件、Pinia store、vue-router 路由表，保留 **约 334 个页面**（原始 517 个，剔除 AI 73、VM 23、License 6、网站运行时 42、网站模板 4、Toolbox 35）；只替换 `src/api/`、登录态处理、请求拦截器，以及依赖 `axios` 的通用工具。
2. **RPC 风格由生成的 service descriptor 推导。** 前端 `rpc` 直接基于 `web/src/gen` 的 `*_pb.ts`，不需要为每个接口手写包装，也不生成 RPC hook 中间文件：
   ```ts
   const { data } = rpc.website.search.useQuery({ page: 1, pageSize: 20 })
   const { data } = await rpc.website.search.useSuspenseQuery({ page: 1 })
   const { mutate } = rpc.website.delete.useMutation()
   const website = await rpc.website.get({ id: 1 })
   ```
3. **后端不是“把 gin 路由改成 gRPC 路由”，而是把 gin handler 的业务调用抽到 Connect adapter。** 业务层（`app/service`、`app/repo`、`app/model`）保持原样；新增 `internal/transport` 做 proto ↔ DTO 转换、鉴权、校验、错误映射。
4. **约 654 个接口不能靠手写。** 用 1Panel 现有的 Swagger 注解 + Go AST 生成 proto、转换器和 handler 骨架，再用覆盖率检查强制“每个保留的旧接口都有对应 RPC”。
5. **单进程不等于把所有代码揉成一个包。** `internal/core` 与 `internal/agent` 保持独立目录与独立数据库连接，只是共享一个进程、一个 HTTP server、一套 Connect 服务面；未来要拆回双进程时，边界仍然存在。

最大风险按顺序：

1. **约 654 个接口的一次性切换**：必须用代码生成 + 覆盖率门禁 + 全模块回归，否则必然漏接口。
2. **Vue 与 React 的 RPC 风格差异**：`useSuspenseQuery` 在 Vue 里需要 `await`（Pinia Colada 没有原生 Suspense hook），方案会提供同名封装并明确用法。
3. **流式与文件传输**：浏览器端 Connect 不能可靠承载 PTY 双向流，终端保留 WebSocket；大文件保留专用二进制 HTTP 通道。
4. **单进程影响面**：core 和 agent 的初始化、日志、数据库、定时任务必须按确定顺序启动，任何 panic 都会同时带走控制面与数据面。

---

## 1. 现状盘点

### 1.1 1Panel 基线

| 项目 | 现状 |
| --- | --- |
| 前端 | Vue 3.5 + Element Plus 2.14 + Vite 8 + Pinia 3 + vue-router 5 + vue-i18n |
| 页面 | 517 个 `.vue` 文件；迁移保留约 334 个（剔除 AI 73、VM 23、License 6、网站运行时 42、网站模板 4、Toolbox 35） |
| 前端 API | 58 个文件，`api/modules/*.ts` 约 3965 行；剔除 AI/VM/运行时/模板/Toolbox 后约 3000 行 |
| 后端 | `core`（控制面）+ `agent`（数据面），均为 Gin + GORM + SQLite |
| 进程通讯 | core 通过 `/etc/1panel/agent.sock` 反向代理到 agent |
| 浏览器通讯 | REST JSON（`/api/v2/**`）+ WebSocket + SSE |
| 鉴权 | Session Cookie、CSRF Token、MFA、Passkey、OIDC、SAML、API Key、安全入口 |
| 数据库 | `core.db`、`task.db`、`agent.db`、`alert.db`，SQLite + gormigrate |

路由规模（按 Swagger 注解统计，实际注册数略多；**已剔除 AI、VM、网站运行时/模板、Toolbox**）：

| 范围 | 注解路由 | 实际注册路由（约） |
| --- | ---: | ---: |
| core | 82 | 115 |
| agent | 529 | 539 |
| 合计 | 611 | 约 654 |

被剔除的模块：

| 模块 | 路由数（约） | 页面数 | 处理 |
| --- | ---: | ---: | --- |
| AI | 98 | 73 | 不迁移；删除路由、service、API、页面、菜单 |
| VM | 41 | 23 | 不迁移；删除路由、service、KVM 初始化、VNC、页面、菜单 |
| 网站运行时 | 34 | 42 | 删除 `/runtimes` 与 `/websites/runtimes/*` 入口；网站创建不再支持 runtime 类型 |
| 网站模板 | 11 | 4 | 删除 `/websites/templates` 与模板/输出页面 |
| Toolbox | 39 | 35 | 删除 `/toolbox/*`（设备、清理、Fail2ban、FTP、ClamAV、Supervisor）及页面 |

> 说明：路由数按前缀粗算，部分模块可能还有少量路由挂在其它前缀下；实施时以迁移清单为准，最终覆盖率门禁按“剔除后的清单”比对。

前端模块规模（已剔除上述模块）：

| 模块 | `.vue` 数量 | 后端路由前缀 | 路由数（约） |
| --- | ---: | --- | ---: |
| website | 73 | `/websites` | 97 |
| host | 74 | `/hosts` | 78 |
| database | 46 | `/databases` | 63 |
| container | 45 | `/containers` | 74 |
| setting | 37 | `/settings`、`/core/settings` | 46 |
| app-store | 22 | `/apps` | 31 |
| terminal | 10 | `/hosts/terminal` 等 | 少量 |
| cronjob | 10 | `/cronjobs` | 16 |
| log | 8 | `/logs` | 10 |
| home | 6 | `/dashboard` | 16 |
| login | 2 | `/core/auth` | 25 |
| share | 1 | 公开分享 | 少量 |
| **合计** | **334** | | |

### 1.2 mypanel 现状

| 项目 | 现状 |
| --- | --- |
| 前端 | React 19 + Astryx + TanStack Router + TanStack Query |
| RPC | 已有 Connect-ES 单例、`createRpc` 代理，支持 `useQuery` / `useSuspenseQuery` / `useMutation` / 无限查询 |
| 后端 | `master` 单进程，Gin 挂载 Connect handler，支持 h2c / gRPC / gRPC-Web |
| 前端产物 | `master/internal/webdist/dist` 已出现 1Panel 构建产物，但源码不在仓库内，不能作为可维护来源 |
| 数据层 | 演示用 `PanelService`（Ping / Hello / ListEvents / Watch） |

现有 `rpc-proxy` 的接口形态可以保留，但实现要从 React Query 换成 Pinia Colada。

### 1.3 关键差距

| 差距 | 影响 | 处理方式 |
| --- | --- | --- |
| 1Panel 前端是 Vue，mypanel 是 React | 不能直接复用现有组件与路由 | 用 1Panel 前端整体替换 `web/`，旧 React 应用只保留在 Git 历史/分支 |
| 1Panel 后端是 REST + 反向代理 | 与目标 gRPC 通讯不一致 | 去掉 Gin 业务路由与 core→agent 代理，新增 Connect adapter |
| 1Panel 有约 654 个保留接口 | 手写 proto/适配器不可行 | AST + Swagger 生成 proto 与骨架，人工补业务调用 |
| Vue 没有 React 的 Suspense hook | `rpc.hello.useSuspenseQuery` 不能原样照搬 | 用 Pinia Colada 的 `useQuery` + `refresh` 封装同名异步 composable |
| core/agent 各自初始化 | 单进程内会重复初始化日志、DB、定时任务 | 明确初始化顺序，合并数据库连接与生命周期 |
| 1Panel 代码使用 GPLv3 | 直接影响发布方式 | 迁移前完成 GPLv3 合规确认（与商业 License 无关） |

### 1.4 明确剔除的模块

本期只迁移“主机管理面板”的核心能力，以下模块**不迁移、不保留入口、不保留路由**：

| 模块 | 代码位置 | 处理 |
| --- | --- | --- |
| AI | `agent/app/api/v2/ai*.go`、`agent/app/service/ai*.go`、`agent/app/service/model_chat.go`、`agent/app/api/v2/model_chat.go`、`views/ai/`、`api/modules/ai.ts`、`api/modules/model-chat.ts`、`api/interface/ai.ts` | 整目录删除；移除菜单、路由、模型账号/对话/Benchmark/Ollama 相关入口 |
| VM | `agent/app/api/v2/vm.go`、`agent/app/service/vm*.go`、`agent/init/kvm`、`views/vm/`、`api/modules/vm.ts`、`api/interface/vm.ts`、`@novnc/novnc` | 整目录删除；移除 KVM 初始化、VNC WebSocket、菜单与路由 |
| 网站运行时 | `agent/app/api/v2/runtime.go`、`agent/app/service/runtime*.go`、`agent/app/repo/runtime.go`、`agent/app/dto/**/runtime*.go`、`agent/router/ro_runtime.go`、`views/website/runtime/`、`api/modules/runtime.ts`、`api/interface/runtime.ts` | 删除 `/runtimes`、`/websites/runtimes/*`；网站创建移除 `runtime` 类型与 `RuntimeID` 分支 |
| 网站模板 | `agent/app/api/v2/website_template.go`、`agent/app/service/website_template*.go`、`agent/router/ro_website_template.go`、`views/website/template/` | 删除 `/websites/templates/*` 与模板/输出页面 |
| Toolbox | `agent/router/ro_toolbox.go`、`toolbox` 相关 api/service、`views/toolbox/`、`api/modules/toolbox.ts`、`api/interface/toolbox.ts` | 删除 `/toolbox/*`（设备、清理、Fail2ban、FTP、ClamAV、Supervisor）与页面 |
| xpack / 企业版 | `core/utils/xpack/**`、`agent/utils/xpack/**`、`xpack` / `enterprise` 构建标签分支、`ops_report_xpack.go` | 删除企业分支与 License 校验；保留社区行为，统一为单一版本 |
| License 激活 | `views/setting/license/`、`views/setting/license-required/`、`components/license-import/`、`utils/xpack.ts`、`extensions/xpack.ts`、`/settings/license`、`/enterprise/licenses/*` | 整页删除；移除“导入 License / License 过期 / 绑定 License”入口与接口 |
| 多节点 / 远程 agent | `MultiNodeProvider`、`CurrentNode` 选择、节点注册 | 单进程下只保留本地节点；相关 UI 与接口删除或固定为 `local` |

剔除后的规模：

- 前端页面从 517 降到约 **334**（AI 73 + VM 23 + License 6 + 网站运行时 42 + 网站模板 4 + Toolbox 35）。
- 后端保留接口从约 877 降到约 **654**；AI/VM 之外，网站运行时 34、网站模板 11、Toolbox 39 是主要减少项；xpack/License 在社区版里主要是空实现与前端页面，接口数影响很小。
- `@novnc/novnc`、KVM/Libvirt 相关依赖在确认无其它引用后从 `package.json` / `go.mod` 删除。
- Toolbox 里的 `disk`、`process`、`device` 等底层 service 可能被 host/dashboard 复用，删除前必须做引用审计；只删除 Toolbox 专属入口，避免误删共享能力。

> GPLv3 是 1Panel 代码的开源许可证，和 xpack 商业 License 是两件事。剔除 xpack/License 功能不代表可以不遵守 GPLv3。

---

## 2. 目标架构

### 2.1 总体结构

```text
┌────────────────────────────────────────────────────────────┐
│                       浏览器（同源）                        │
│  Vue 3 + Element Plus + Pinia + Pinia Colada               │
│  src/lib/rpc.ts  ──  Connect-ES client  ──  /rpc           │
└───────────────────────────┬────────────────────────────────┘
                            │ HTTP/1.1 或 h2c
                            │ Connect / gRPC-Web
┌───────────────────────────▼────────────────────────────────┐
│                     master（单进程）                        │
│                                                            │
│  Gin HTTP server                                           │
│   ├── /rpc/*            Connect handlers                   │
│   ├── /ws/terminal      终端 WebSocket（例外）              │
│   ├── /files/upload     大文件上传（例外）                  │
│   ├── /files/download   大文件下载（例外）                  │
│   ├── /assets/*         前端静态资源                        │
│   ├── /api/v2/static/*  1Panel 静态资源（例外）              │
│   ├── /mcp              MCP 协议端点（例外）                │
│   ├── /api/v2/core/auth/oidc/*   OIDC 跳转/回调（例外）      │
│   ├── /api/v2/core/auth/saml2/*  SAML 跳转/回调（例外）      │
│   └── /*                SPA 静态资源与 fallback             │
│                                                            │
│  internal/transport                                        │
│   ├── connect/          proto 服务注册与 adapter           │
│   ├── interceptor/      鉴权、CSRF、i18n、审计、错误映射     │
│   └── policy/           由 proto 注解生成的接口策略          │
│                                                            │
│  internal/core         1Panel core：用户、设置、备份、日志、  │
│                        脚本、MCP、升级、诊断                 │
│  internal/agent        1Panel agent：主机、网站、应用、数据库、│
│                        容器、文件、防火墙、运行时、工具箱     │
│                        （不含 AI / VM / 运行时 / 模板 / Toolbox / xpack / License）│
│                                                            │
│  SQLite：core.db / task.db / agent.db / alert.db            │
└────────────────────────────────────────────────────────────┘
```

### 2.2 请求链路

以“网站列表”为例：

```text
Vue 组件
  rpc.website.search.useQuery({ page: 1 })
    ↓
Pinia Colada
  query: () => websiteClient.search({ page: 1 })
    ↓
Connect-ES（POST /rpc/panel.agent.v1.WebsiteService/Search）
    ↓
Gin → Connect handler
    ↓
internal/transport/agent/website.Search
    ├── proto → dto 转换
    ├── 复用 1Panel validator 校验
    ├── 调用 agent/app/service.WebsiteService.SearchPage(dto)
    └── service 结果 → proto → Connect response
```

### 2.3 通讯协议选择

| 客户端 | 协议 | 说明 |
| --- | --- | --- |
| 浏览器 | Connect over HTTP/1.1 | `createConnectTransport` 默认；同源、无 CORS、可带 Cookie |
| 浏览器（大响应流） | Connect server-stream | 容器日志、任务进度 |
| 原生 gRPC 客户端 | gRPC over h2c / TLS h2 | `grpcurl`、Go client、未来 CLI |
| 旧式 gRPC-Web 客户端 | gRPC-Web | Connect handler 同时支持 |
| 终端 | WebSocket | 浏览器端 Connect 不支持可靠的双向流 |
| 大文件 | 专用二进制 HTTP | 上传、下载、断点续传、Range |

`/rpc` 前缀的挂载方式沿用现有 master 实现：同一个生成的 handler 同时挂根路径（给原生 gRPC）和 `/rpc`（给浏览器），并用通配 `/*filepath` 匹配子路径。

### 2.4 单进程边界

虽然合并为一个进程，但保留以下边界，避免变成不可拆分的大泥球：

| 边界 | 规则 |
| --- | --- |
| 目录 | `internal/core` 与 `internal/agent` 不互相 import |
| 数据库 | core 与 agent 使用各自的 `*gorm.DB`；共享 `agent.db` 时只保留一个连接 |
| 配置 | core/agent 各自读取自己的 `app.yaml` 与 `global.CONF`，由 master 统一注入数据目录 |
| 日志 | 各自保留 logrus 日志文件，同时桥接到 master 的 slog 输出 |
| 生命周期 | master 统一负责初始化顺序、HTTP 启停、优雅退出 |
| 未来拆分 | 只需把 `internal/agent` 移到 `node/`，把直接调用换成 Connect client |

---

## 3. 目录与模块规划

### 3.1 目标目录

```text
mypanel/
├── proto/
│   ├── panel/
│   │   ├── core/v1/          # Auth、Settings、Backup、Log、Script、MCP...
│   │   ├── agent/v1/         # Host、Website、App、Database、Container...
│   │   └── common/v1/        # 分页、错误、方法注解
│   ├── buf.yaml
│   └── buf.gen.yaml
├── master/
│   ├── main.go
│   ├── internal/
│   │   ├── app/              # wire 依赖图
│   │   ├── config/           # 进程级配置
│   │   ├── server/           # HTTP server、Connect 挂载、SPA、WS
│   │   ├── core/             # 1Panel core 复制后代码
│   │   ├── agent/            # 1Panel agent 复制后代码
│   │   ├── transport/        # proto adapter、interceptor、policy
│   │   └── webdist/          # 前端 embed
│   └── go.mod
├── node/                     # 暂留占位；未来拆分 agent 时使用
├── web/                      # 1Panel Vue 前端（替换现有 React）
├── scripts/
│   ├── gen.sh                # buf generate
│   ├── gen-proto-from-gin/   # 旧接口 → proto 生成器
│   ├── gen-adapters/         # proto → Go adapter 骨架生成器
│   ├── check-rpc-coverage/   # 覆盖率门禁
│   └── build.sh
└── docs/
    └── 1panel-migration-plan.md
```

### 3.2 1Panel 代码复制与 import 重写

复制方式：

```text
1Panel/core/**   →  master/internal/core/**
1Panel/agent/**  →  master/internal/agent/**
```

import 路径统一重写：

```text
github.com/1Panel-dev/1Panel/core/...   →  mypanel/master/internal/core/...
github.com/1Panel-dev/1Panel/agent/...  →  mypanel/master/internal/agent/...
```

注意事项：

- 两个目录都存在名为 `global`、`i18n`、`config` 的包，Go 允许同进程存在同名包，但 import 时必须起别名：
  ```go
  coreglobal "mypanel/master/internal/core/global"
  agentglobal "mypanel/master/internal/agent/global"
  ```
- 1Panel 的 `cmd/server/conf`、`cmd/server/web` 等 `go:embed` 目录原样保留，避免丢失默认配置与静态资源。
- 复制后先只做机械重写，不改业务逻辑；所有行为差异都放到后续提交，便于 diff 和上游同步。
- 1Panel 的 `xpack` / `enterprise` 构建标签文件保留社区版实现；不引入闭源模块，缺失的能力用 no-op 接口占位。

### 3.3 go.mod 合并

- Go 版本取 `1.27.4`（当前 master 更高）。
- 依赖版本取 1Panel 与 mypanel 的较高者；冲突时以能同时编译为准。
- 保留 1Panel 的 `replace github.com/go-acme/lego/v5 => github.com/1Panel-dev/lego/v5 v5.3.1`。
- 保留 `godebug multipathtcp=0`。
- 新增：
  - `connectrpc.com/connect`
  - `google.golang.org/protobuf`
  - 现有 wire、viper、slog 依赖
- 移除 REST 文档相关依赖（`swaggo/swag`、`swaggo/files`）前先确认 MCP/Swagger 是否还有引用；没有则删。
- `node/` 继续留在 `go.work`，避免未来拆分时再改工作区。

### 3.4 配置合并

进程级配置仍由 `master/internal/config` 负责：

```yaml
addr: ":8080"
web_dir: ""
debug: false
shutdown_timeout: 5s
data_dir: "./data"
```

1Panel 的 `app.yaml` 继续作为 core/agent 的默认配置，由各自的 `init/viper` 读取。新增规则：

| 配置 | 归属 | 说明 |
| --- | --- | --- |
| 监听地址 | master | `MYPANEL_ADDR` 唯一决定；1Panel 的 `conn.port` 忽略并打印警告 |
| TLS | master | 读取 1Panel 的 `conn.ssl` 与证书路径，由 master 的 `http.Server` 统一启用 |
| 数据目录 | master → core/agent | `MYPANEL_DATA_DIR` 注入 `global.CONF.Base.InstallDir` |
| 安全入口 | 1Panel core | 保留 `conn.entrance` 行为 |
| 语言 | 请求头 | `Accept-Language` 由 Connect 拦截器写入 context |

数据目录建议保持 1Panel 原结构，不做 schema 改造：

```text
data/1panel/
├── conf/
├── db/
│   ├── core.db
│   ├── task.db
│   ├── agent.db
│   └── alert.db
├── log/
├── uploads/
├── apps/
├── websites/
└── ...
```

`core.db`、`task.db`、`alert.db` 由 core 打开；`agent.db` 由 agent 打开。单进程下 core 不再单独打开一份 `agent.db`，而是直接复用 agent 的连接，减少 SQLite 锁竞争。

### 3.5 日志合并

1Panel 代码里大量使用 `global.LOG`（logrus），mypanel 使用 `log/slog`。不建议为了迁移重写所有日志调用。

方案：

- 保留 core/agent 各自的 logrus 文件输出（`core.log`、`agent.log`）。
- 给 logrus 挂一个 Hook，把 `info/warn/error` 转发到 master 的 slog，stdout 只保留一份结构化日志。
- HTTP 访问日志、Connect 调用日志统一由 master 的 slog 中间件输出。
- 操作日志（审计）仍写入 core 数据库，由 Connect 拦截器负责。

---

## 4. 后端迁移设计

### 4.1 初始化顺序

单进程启动顺序必须固定，避免重复初始化和竞态：

```text
master.main
  ├── 解析进程配置（addr、data_dir、debug、shutdown_timeout）
  ├── 初始化 slog
  ├── 初始化 core
  │   ├── core viper（注入 data_dir）
  │   ├── core log
  │   ├── core DB（core.db / task.db / alert.db）
  │   ├── core migration
  │   ├── core i18n / validator / geo
  │   ├── core session
  │   └── core cron / hook
  ├── 初始化 agent
  │   ├── agent viper（同一 data_dir）
  │   ├── agent dir
  │   ├── agent log
  │   ├── agent DB（agent.db）
  │   ├── core.global.AgentDB = agent.global.DB
  │   ├── agent migration
  │   ├── agent cache / app / lang / validator
  │   └── agent cron / hook / firewall
  ├── 初始化 transport（Connect 服务、拦截器、策略）
  ├── 组装 HTTP server（Connect + WS + 文件 + 静态 + SPA）
  └── 等待信号，按相反顺序优雅退出
```

关键约束：

- core 的 `proxy.Init()`、`router.Routers()`、`router.Proxy()` 不再调用。
- agent 的 `server.Start()` 不再调用；只调用它的 `init` 与 `router` 注册之外的部分。
- `agent/init/kvm` 不初始化（VM 已剔除）。
- core/agent 的 cron 都保留：core 负责面板任务，agent 负责主机任务；启动时避免重复注册同名任务。
- 优雅退出时先停 HTTP，再停 cron/hook，最后关 DB，给在途 RPC 与流式响应留时间。

### 4.2 删除 REST 与反向代理

需要删除或停用的部分：

| 组件 | 处理 |
| --- | --- |
| `core/init/router.Routers()` | 不再注册业务 REST 路由 |
| `core/router/*` 业务路由 | 删除；只保留静态、WS、OIDC/SAML 等例外处理器 |
| `core/router/proxy.go` | 删除；不再有 core→agent HTTP 反向代理 |
| `core/init/proxy` | 删除 |
| `middleware.ShouldProxyToAgent` | 删除 |
| `agent/init/router` 业务路由 | 不再注册；只保留 WS、文件传输、MCP 等例外 |
| `swaggo` 注解 | 保留作为迁移输入，迁移完成后可删除 |
| `CurrentNode` 请求头 | 单进程下固定为 `local`；相关代码改为 context 中的节点标识 |
| `X-Panel-User` 转发头 | 改为 Connect 拦截器写入 context，不再跨进程传递 |

验收门禁：构建完成后扫描 Gin 路由表，`/api/` 下不允许出现任何业务 JSON 路由。允许的 HTTP 例外见第 6 节。

### 4.3 Proto 组织

包与命名规则：

```text
panel.core.v1.*     core 控制的领域
panel.agent.v1.*    agent 执行的领域
panel.common.v1.*   公共类型与注解
```

服务按领域拆分，不按 REST 路径机械拆分。示例：

```proto
syntax = "proto3";

package panel.agent.v1;

option go_package = "mypanel/proto/gen/go/panel/agent/v1;agentv1";

import "panel/common/v1/page.proto";

// WebsiteService 对应 1Panel 的网站管理域。
service WebsiteService {
  // 分页查询网站列表，支持按名称模糊搜索。
  rpc Search(SearchWebsitesRequest) returns (SearchWebsitesResponse);

  // 按 ID 查询单个网站详情。
  rpc Get(GetWebsiteRequest) returns (Website);

  // 创建网站。
  rpc Create(CreateWebsiteRequest) returns (Website);

  // 更新网站配置。
  rpc Update(UpdateWebsiteRequest) returns (Website);

  // 批量删除网站。
  rpc Delete(DeleteWebsitesRequest) returns (DeleteWebsitesResponse);
}

// 网站列表查询参数。
message SearchWebsitesRequest {
  // 页码，从 1 开始。
  int32 page = 1;

  // 每页条数，默认 20，最大 100。
  int32 page_size = 2;

  // 网站名称模糊搜索关键字，为空表示不筛选。
  string name = 3;
}

// 网站列表查询结果。
message SearchWebsitesResponse {
  // 当前页的网站列表。
  repeated Website items = 1;

  // 符合条件的网站总数。
  int64 total = 2;
}

// 网站信息。
message Website {
  // 网站 ID，创建后不可变。
  int32 id = 1;

  // 网站名称，展示用，最长 64 个字符。
  string name = 2;

  // 运行状态：running=运行中，stopped=已停止，error=异常。
  string status = 3;

  // 创建时间，RFC3339 格式。
  string created_at = 4;
}
```

服务清单（初稿）：

| 包 | 服务 | 对应 1Panel 域 |
| --- | --- | --- |
| core | `AuthService` | 登录、MFA、Passkey、API Key、当前用户 |
| core | `SettingsService` | 面板设置、SSL、端口、菜单、终端设置 |
| core | `BackupService` | core 备份账号与备份文件 |
| core | `CommandService` | 命令库 |
| core | `GroupService` | core 分组 |
| core | `LogService` | 登录日志、操作日志 |
| core | `ScriptService` | 脚本库 |
| core | `MCPService` | MCP 配置、API、任务 |
| core | `DiagnosticsService` | goroutine、profile、运行时诊断 |
| core | `UpgradeService` | 版本检查、升级说明 |
| agent | `HostService` | 主机、SSH、终端会话 |
| agent | `MonitorService` | 监控、GPU、网络/IO |
| agent | `WebsiteService` | 网站、域名、SSL、DNS、ACME |
| agent | `AppService` | 应用商店、安装、升级、图标 |
| agent | `DatabaseService` | MySQL、PostgreSQL、Redis、MongoDB |
| agent | `ContainerService` | 容器、镜像、网络、Compose、仓库 |
| agent | `FileService` | 文件元数据、搜索、压缩、回收站 |
| agent | `CronjobService` | 计划任务 |
| agent | `FirewallService` | 防火墙 |
| agent | `TaskService` | 任务与进度 |
| agent | `DashboardService` | 首页概览 |
| agent | `BackupService` | agent 备份与恢复 |
| agent | `AlertService` | 告警 |
| agent | `LogService` | agent 日志 |

> AI、VM、网站运行时、网站模板、Toolbox、xpack、License 不生成 proto 服务，也不保留 RPC 方法。

命名冲突处理：

- core 与 agent 都有 `BackupService`、`LogService`、`GroupService`，proto 包不同，生成后的 Go/TS 类型不冲突。
- 前端 `rpc` 对象按包命名空间组织：
  ```ts
  rpc.core.auth.login(...)
  rpc.website.search(...)
  rpc.host.monitor(...)
  ```
  core 统一放在 `rpc.core.*` 下，agent 直接放在 `rpc.*` 下。这样既避免重名，也符合 1Panel 前端 `api/modules` 的分组习惯。

### 4.4 Proto 约定

#### 4.4.1 注释规范（硬性）

**proto 里每个元素都必须有前导注释**，包括：

- 文件 / package 说明（文件头）
- `message`
- `field`（含 `repeated`、`optional`、`map` 的每个字段）
- `enum` 与每个 `enum value`
- `service`
- `rpc` 方法
- `oneof` 与 oneof 内的每个字段

注释要求：

- 用中文，说明**业务含义、单位、取值范围、是否可空**，不要只复述字段名。
- 枚举值必须说明每个取值的含义，不能只写枚举名。
- 金额、大小、时间、计数类字段必须写单位（如 `字节`、`毫秒`、`RFC3339`）。
- 不使用 `TODO`、`待补充`、`字段`、`field` 这类占位注释通过检查。
- 不把密码、密钥、Token 的真实值写进注释。

示例：

```proto
// 网站信息。
message Website {
  // 网站 ID，创建后不可变。
  int32 id = 1;

  // 网站名称，展示用，最长 64 个字符。
  string name = 2;

  // 运行状态：running=运行中，stopped=已停止，error=异常。
  string status = 3;

  // 创建时间，RFC3339 格式，例如 2026-11-22T10:00:00+08:00。
  string created_at = 4;
}

// 网站管理服务。
service WebsiteService {
  // 分页查询网站列表，支持按名称模糊搜索。
  rpc Search(SearchWebsitesRequest) returns (SearchWebsitesResponse);
}
```

CI 门禁：

1. `proto/buf.yaml` 开启注释规则：

   ```yaml
   version: v2
   lint:
     use:
       - STANDARD
       - COMMENT_FIELD
       - COMMENT_MESSAGE
       - COMMENT_ENUM
       - COMMENT_ENUM_VALUE
       - COMMENT_SERVICE
       - COMMENT_RPC
       - COMMENT_ONEOF
   ```

2. `buf lint` 必须通过。
3. 自定义检查 `scripts/check-proto-comments` 额外校验：
   - 注释非空，且不是 `TODO` / `待补充` / 字段名本身；
   - 时间、大小、计数类字段包含单位或格式说明；
   - 枚举每个值都有说明；
   - 生成产物中 `SourceCodeInfo` 的 leading comments 完整。

生成器的注释来源按优先级：

```text
1. Go DTO 字段注释
2. Swagger @Description / @Param 描述
3. 前端 api/interface/*.ts 的 JSDoc
4. proto/comments/<domain>.yaml 人工词典
5. 通用字段名词典（id、name、status、created_at...）
6. 仍缺失 → 生成 // TODO(comment): <字段路径>，并让 CI 失败
```

`proto/comments/` 是人工维护的字段说明词典，用于补足旧代码里没有注释的 DTO。生成器每次运行都会输出缺失注释报告，避免“生成了但没人补”。

#### 4.4.2 方法注解与策略生成

鉴权、CSRF、审计不能在每个 handler 里手写。用 proto 方法注解描述策略：

```proto
syntax = "proto3";

package panel.common.v1;

import "google/protobuf/descriptor.proto";

extend google.protobuf.MethodOptions {
  bool public = 50001;        // 允许未登录访问
  bool csrf_exempt = 50002;   // 跳过 CSRF 校验
  bool no_audit = 50003;      // 不写操作日志
  string audit_action_zh = 50004;
  string audit_action_en = 50005;
}
```

```proto
service AuthService {
  rpc Login(LoginRequest) returns (LoginResponse) {
    option (panel.common.v1.public) = true;
    option (panel.common.v1.csrf_exempt) = true;
    option (panel.common.v1.audit_action_zh) = "登录";
    option (panel.common.v1.audit_action_en) = "Login";
  }
}
```

生成器读取 proto 描述符，输出：

```text
master/internal/transport/policy/policy_gen.go
```

内容是按完整 procedure 名索引的 `map[string]MethodPolicy`。拦截器只查表，不在运行时反射：

```go
type MethodPolicy struct {
    Public       bool
    CSRFExempt   bool
    NoAudit      bool
    AuditActionZH string
    AuditActionEN string
}
```

新增接口时如果忘记标注，默认按“需要登录、需要 CSRF、需要审计”处理，失败关闭（fail closed）。

### 4.5 从旧接口生成 proto 与 adapter

这是整个迁移的核心工具链。

#### 4.5.1 输入

1Panel 现有代码已经具备较好的可解析性：

- 路由注册：`router.POST("/path", api.Handler)`、`apiRouter.GET(...)`
- Swagger 注解：`@Router /path [post]`、`@Param`、`@Success 200 {object} dto.X`
- 请求绑定：`c.ShouldBindJSON(&req)`、`c.ShouldBind(&req)`、`c.PostForm(...)`、`c.Query(...)`
- DTO 结构：`core/app/dto`、`agent/app/dto`，字段有 `json`、`form`、`validate` 标签
- 业务调用：`service.NewIXxxService().Method(...)`

#### 4.5.2 生成流程

```text
旧代码
  │
  ├─ 1. 路由清单：路径 + HTTP 方法 + handler 函数 + Swagger 注解
  │
  ├─ 2. AST 分析：handler 里的绑定类型、服务调用、返回类型
  │
  ├─ 3. DTO → proto 消息（字段、类型、optional、repeated、**中文注释、Protovalidate 规则**）
  │
  ├─ 4. 路由 → RPC 方法（命名规则见下）
  │
  ├─ 5. 生成 proto 文件 + manifest.yaml + 缺失注释报告
  │
  ├─ 6. buf lint（COMMENTS 规则）+ buf generate（Go + TS）
  │
  ├─ 7. 生成 adapter 骨架 + proto ↔ DTO 转换器
  │
  └─ 8. 人工补全无法自动推断的 service 调用与缺失注释
```

命名规则：

| 旧路径 | 新 RPC |
| --- | --- |
| `POST /websites/search` | `WebsiteService.Search` |
| `POST /websites` | `WebsiteService.Create` |
| `POST /websites/update` | `WebsiteService.Update` |
| `POST /websites/del` | `WebsiteService.Delete` |
| `GET /websites/:id` | `WebsiteService.Get` |
| `POST /containers/status` | `ContainerService.Status` |
| `POST /settings/search` | `SettingsService.Search` |
| `GET /core/auth/current` | `core.AuthService.Current` |

规则：

- 第一段路径 → 服务名。
- 剩余路径 → 方法名，`search` → `Search`，`del` → `Delete`，`info` → `Get`。
- 同一路径多个 HTTP 方法时，用 `Get` / `Create` / `Update` / `Delete` 区分。
- 无法命名的路径写入 `manifest.yaml` 的 `manual: true`，由人工确认，不阻塞生成。

#### 4.5.3 Adapter 形态

生成的 Go 代码示例：

```go
// Search 查询网站列表。
func (s *WebsiteServer) Search(
    ctx context.Context,
    req *agentv1.SearchWebsitesRequest,
) (*agentv1.SearchWebsitesResponse, error) {
    // Protovalidate 拦截器已完成格式校验，这里只做 proto → DTO 转换。
    dtoReq := &dto.SearchPage{}
    if err := convert.SearchWebsitesRequestToDTO(req, dtoReq); err != nil {
        return nil, bizerr.InvalidArgument(err)
    }

    res, err := s.website.SearchPage(dtoReq)
    if err != nil {
        return nil, bizerr.FromServiceError(err)
    }
    return convert.SearchWebsitesResponseFromDTO(res), nil
}
```

生成器负责：

- `convert.*` 的字段级赋值。
- 类型不匹配时生成 `// TODO(convert): ...` 并让编译失败，避免静默丢字段。
- DTO 有、proto 没有的字段，在 `manifest.yaml` 中标记 `ignored` 并说明原因（例如仅内部使用、敏感字段）。
- proto 有、DTO 没有的字段，标记 `computed`，由 adapter 手工补。

#### 4.5.4 为什么不用“通用 JSON 透传”

有一种更快但更差的做法：定义一个 `Call(method, json)` RPC，把旧 DTO 直接透传。它能快速跑通，但会：

- 失去 tRPC 式的类型推导；
- 前端无法从 proto 得到类型；
- 无法生成审计/鉴权策略；
- 无法逐步替换成真正的强类型接口。

因此不采用。所有对外 RPC 必须是具体消息类型。

#### 4.5.5 覆盖率门禁

`scripts/check-rpc-coverage` 做三件事：

1. 从旧代码提取路由清单（Swagger + Gin 注册去重）。
2. 从 proto/manifest 提取已实现 RPC 清单。
3. 比对并输出：
   - 已覆盖；
   - 未覆盖；
   - 标记为例外（WS、文件、静态、OIDC/SAML、MCP）；
   - 标记为 `manual` 且未完成。

CI 规则：

- 未覆盖且不是例外 → 失败。
- `manual` 未完成 → 失败。
- 新增 proto 方法没有策略注解 → 失败。
- 扫描到 `/api/` 业务路由 → 失败。

### 4.6 鉴权与拦截器

#### 4.6.1 会话

把现有 Gin `SessionAuth` 改写为 Connect unary interceptor：

```text
读取 Cookie（1Panel session）
  ↓
global.SESSION.Get / RefreshIfNeeded
  ↓
把 SessionUser 写入 context
  ↓
后续 service 从 context 取用户
```

公开方法由 policy 表决定，不按路径字符串硬编码。登录、验证码、MFA 登录、Passkey 登录、OIDC/SAML 回调、登录设置等标记为 `public`。

#### 4.6.2 CSRF

Connect 请求全部是 POST，不能再用 HTTP 方法判断。规则：

- policy 表标记 `csrf_exempt` 的方法跳过。
- 其余方法要求 `X-CSRF-Token` 请求头与 `pcsrftoken` Cookie 匹配。
- 登录成功后由 core 设置新的 CSRF Cookie；前端拦截器在每次变更请求前读取并带上。
- 同源部署，不引入 CORS。
- 对 `Origin` / `Referer` 做一次同源校验，作为第二道防线。

#### 4.6.3 Cookie 与登录响应

Connect unary handler 可以设置响应头。登录成功时：

```go
resp := connect.NewResponse(&authv1.LoginResponse{...})
resp.Header().Set("Set-Cookie", sessionCookie.String())
resp.Header().Add("Set-Cookie", csrfCookie.String())
return resp, nil
```

前端 Connect transport 通过 `fetch` 包装显式带上 `credentials: 'include'`，保证同源 Cookie 自动携带。

#### 4.6.4 API Key

1Panel 现有 API Key 使用 `1Panel-Token` + `1Panel-Timestamp` 请求头。迁移后：

- 保留同样的头，但作为 Connect metadata 传递。
- 拦截器校验签名、时间窗、权限。
- 外部调用方从 REST 改为 Connect/gRPC，这是**破坏性变更**，需要单独通知与文档。

#### 4.6.5 OIDC / SAML

这两类流程依赖浏览器 302 跳转和表单 POST 回调，不能改成普通 RPC。**保留 1Panel 的原始路径**，避免已经配置在 IdP 里的 Redirect URI / ACS URL 失效：

```text
GET  /api/v2/core/auth/oidc/begin
GET  /api/v2/core/auth/oidc/finish
POST /api/v2/core/auth/saml2/begin
POST /api/v2/core/auth/saml2/acs
POST /api/v2/core/auth/saml2/finish
POST /api/v2/core/auth/saml2/logout
```

它们不属于“业务 REST API”，在路由门禁中按协议例外精确放行。回调成功后写 Session Cookie，再 302 回首页。

#### 4.6.6 其他中间件

| 现有中间件 | 迁移方式 |
| --- | --- |
| `OperationLog` | Connect 拦截器 + policy 表 |
| `PasswordExpired` | Connect 拦截器 |
| `DemoHandle` | Connect 拦截器（只读方法放行，写方法拒绝） |
| `GlobalLoading` | 前端 NProgress 已有；如仅用于响应头可删除 |
| `FrontendFallback` | 由 SPA handler 接管 |
| `WebSocketOriginGuard` | 保留为 WS 路由的 HTTP 中间件 |
| `AuditClientIP` | Connect 拦截器 + HTTP 中间件，保留代理头解析 |
| `MCP*` | MCP HTTP 端点保留原有中间件 |

### 4.7 错误、校验与 i18n

#### 4.7.1 错误映射

去掉 `{ code, message, data }` 信封，改用 Connect 错误码 + `google.rpc.ErrorInfo`：

| 1Panel 语义 | Connect Code | ErrorInfo.Reason |
| --- | --- | --- |
| 未登录 / Session 失效 | `Unauthenticated` | `ErrNotLogin` |
| 无权限 | `PermissionDenied` | `ErrPermission` |
| 参数校验失败 | `InvalidArgument` | `ErrInvalidParam` |
| 资源不存在 | `NotFound` | `ErrNotFound` |
| 名称冲突 | `AlreadyExists` | `ErrAlreadyExists` |
| 操作不允许 | `FailedPrecondition` | `ErrNotAllowed` |
| 内部错误 | `Internal` | `ErrInternal` |

参数校验失败的 details 使用 `buf.validate.Violations`，包含：

```text
violations[]:
  fieldPath: "domain"
  ruleId: "string.hostname"
  message: "value is not a valid hostname"
```

前端按 `fieldPath` 定位表单字段，按 `ruleId` 做本地化；`message` 只作为兜底。

`message` 由服务端按 `Accept-Language` 本地化；前端优先显示 `message`，其次按 `reason` 查本地文案。

前端统一处理：

```ts
const err = ConnectError.from(error)
if (err.code === Code.Unauthenticated) {
  router.push('/login')
}
```

#### 4.7.2 参数校验：Protovalidate

参数校验统一使用 **Protovalidate**，proto 是唯一规则来源；不再在 adapter 里手写一套 `if req.X == ""`，也不依赖 1Panel 的 `validate` 标签作为传输层校验。

##### 依赖与配置

Go：

```text
buf.build/go/protovalidate
connectrpc.com/validate v0.9.x   # Connect v1 用 validate.NewInterceptor()
```

前端：

```text
@bufbuild/protovalidate
@connectrpc/validate        # 可选：客户端发送前兜底校验
```

`proto/buf.yaml` 增加依赖：

```yaml
version: v2
modules:
  - path: .
deps:
  - buf.build/bufbuild/protovalidate
lint:
  use:
    - STANDARD
    - COMMENT_FIELD
    - COMMENT_MESSAGE
    - COMMENT_ENUM
    - COMMENT_ENUM_VALUE
    - COMMENT_SERVICE
    - COMMENT_RPC
    - COMMENT_ONEOF
```

`buf.gen.yaml` 如果启用 managed mode，必须排除 protovalidate 模块的 `go_package` 重写；当前项目未启用 managed mode，也要在升级时注意这一点。

##### Proto 规则示例

```proto
import "buf/validate/validate.proto";

// 创建网站请求。
message CreateWebsiteRequest {
  // 网站名称，1-64 个字符。
  string name = 1 [(buf.validate.field).string = {
    min_len: 1
    max_len: 64
  }];

  // 监听端口，1-65535。
  int32 port = 2 [(buf.validate.field).int32 = {
    gte: 1
    lte: 65535
  }];

  // 主域名，必须是合法域名。
  string domain = 3 [(buf.validate.field).string.hostname = true];

  // 网站类型：static=静态，proxy=反向代理，stream=四层代理。
  string type = 4 [(buf.validate.field).string = {
    in: ["static", "proxy", "stream"]
  }];
}
```

跨字段规则用 CEL：

```proto
message UpdateWebsiteRequest {
  option (buf.validate.message).cel = {
    id: "update.requires_id"
    message: "更新网站时必须提供 id"
    expression: "this.id > 0"
  };

  // 网站 ID。
  int32 id = 1;

  // 新名称，为空表示不修改。
  optional string name = 2 [(buf.validate.field).string.max_len = 64];
}
```

规则约定：

- 必填、长度、范围、格式、枚举、重复项数量等**能用标准规则表达的，禁止写 CEL**。
- 跨字段、条件必填、互斥/依赖关系用 CEL，并为每条 CEL 设置稳定的 `id` 和中文 `message`。
- 更新类接口的字段用 `optional` 表达“未提供”，不要用空字符串表示“不修改”。
- 密码、私钥等敏感字段只校验长度/格式，不在错误信息里回显原值。
- 文件上传、WebSocket 握手等非 unary 请求，校验元数据 RPC 或握手参数；二进制内容不走 Protovalidate。

##### 后端拦截器

当前项目使用 Connect-Go v1，用 `validate.NewInterceptor()` 接入 Protovalidate：

```go
import (
    "connectrpc.com/connect"
    "connectrpc.com/validate"
)

validateInterceptor := validate.NewInterceptor()

handlerOpts := []connect.HandlerOption{
    connect.WithInterceptors(
        recoveryInterceptor,
        requestIDInterceptor,
        authInterceptor,
        csrfInterceptor,
        validateInterceptor, // Protovalidate
        auditInterceptor,
    ),
}

websitePath, websiteHandler := websitev1connect.NewWebsiteServiceHandler(websiteServer, handlerOpts...)
```

> 如果后续升级到 Connect-Go v2，改用 `validate.NewServerInterceptor()`；当前不要为了校验单独升级 v2。

顺序要求：

```text
recovery → requestID → auth → CSRF → Protovalidate → audit → handler
```

- 先鉴权再校验，避免未登录请求探测 schema。
- 公开接口（登录、验证码等）跳过 auth，但仍然经过 Protovalidate。
- 默认只校验请求；响应不开启 `WithValidateResponses`，避免列表接口的额外开销。
- 校验失败返回 `InvalidArgument`，details 里带 `buf.validate.Violations`，前端可逐字段展示。
- 业务层继续保留必要的业务校验（例如“名称已存在”“端口被占用”“镜像不存在”），这些不是格式校验，不能塞进 proto。

##### 前端校验

前端用同一个 proto descriptor，不手写规则：

```ts
// web/src/lib/validate.ts
import { create, type MessageInitShape } from '@bufbuild/protobuf'
import { createValidator } from '@bufbuild/protovalidate'
import { CreateWebsiteRequestSchema } from '#/gen/panel/agent/v1/website_pb'

const validator = createValidator()

export function validateCreateWebsite(
  form: MessageInitShape<typeof CreateWebsiteRequestSchema>,
) {
  const message = create(CreateWebsiteRequestSchema, form)
  return validator.validate(CreateWebsiteRequestSchema, message)
}
```

页面里：

```ts
const result = rpc.website.create.validate(form)
if (result.kind !== 'valid') {
  // result.violations: [{ fieldPath, ruleId, message }]
  applyToElementPlusForm(result.violations)
  return
}
await rpc.website.create.mutateAsync(form)
```

`createRpc` 为每个 unary 方法自动生成 `.validate(input)`，内部复用同一个 validator 实例。约定：

- 前端校验只负责交互体验，**后端永远重新校验**，不能信任客户端。
- 表单提交前调用 `.validate()`；字段失焦时可以按单字段路径做局部校验。
- 错误映射：`fieldPath`（如 `domain`、`items[0].name`）→ Element Plus `FormItem` 的 `prop`；`ruleId` → 本地化文案。
- 标准规则的默认英文消息由前端按 `ruleId` 本地化；自定义 CEL 规则的 `message` 直接使用中文。
- 部分更新接口允许字段缺省，前端只校验用户实际填写的字段；不要用创建接口的规则去校验更新请求。

##### 与 1Panel 旧 validator 的关系

1Panel DTO 上的 `validate` 标签保留作为**业务层兜底**，但不再作为 RPC 边界的主校验：

| 旧标签 | Protovalidate 迁移 |
| --- | --- |
| `required` | `(buf.validate.field).required = true` 或 `string.min_len = 1` |
| `min` / `max` / `len` | `string.min_len` / `max_len` / `len` |
| `gte` / `lte` | 数值规则的 `gte` / `lte` |
| `email` | `string.email = true` |
| `url` | `string.uri = true` |
| `ip` | `string.ip = true` |
| `oneof` | `string.in = [...]` |
| `dive` + 元素规则 | `repeated.items...` 或对子消息加规则 |
| `required_without` / 跨字段 | CEL |
| 自定义函数 | 保留在 service 层，或改写成 CEL |

生成器能翻译的标签自动翻译；不能翻译的写入 `manifest.yaml` 的 `validation_manual: true`，由人工补 CEL 或明确保留在 service 层。

##### 测试

- 每个域至少覆盖：合法请求、缺必填、超长、越界、非法枚举、跨字段 CEL 失败。
- 后端测试直接构造 proto 请求，断言 `InvalidArgument` 与 `violations[].fieldPath`。
- 前端测试对同一组 fixture 跑 `validator.validate`，断言与后端一致的 ruleId/路径。
- 覆盖率门禁增加一条：每个 RPC 的请求消息必须至少有一条校验规则，或显式标记 `no_validation` 并说明原因（例如空请求、纯查询）。

#### 4.7.3 i18n

- Connect 拦截器读取 `Accept-Language`，写入 context。
- 保留 1Panel 的 `i18n` 包和翻译文件。
- 新增一个从 context 取语言的 helper，替代 Gin 的 `i18n.UseI18n()`。
- 前端继续使用 `vue-i18n`；错误文案来自服务端 `message`。

### 4.8 流式、文件与静态资源

这些是“去掉 REST”时必须保留的协议例外，不算业务 REST API。

#### 4.8.1 终端：保留 WebSocket

原因：浏览器端 Connect/gRPC-Web 不支持可靠的双向流；PTY 需要低延迟双向字节流。

保留：

```text
/ws/terminal
```

改造点：

- 鉴权从 Gin middleware 改为 WS 握手阶段的 session 校验。
- 保留 `WebSocketOriginGuard`。
- 终端 token/会话创建改为 unary RPC，WS 只负责字节流。
- 前端 `components/terminal/index.vue` 的 WS 逻辑基本不动，只改 token 获取方式。

#### 4.8.2 日志与任务：Connect server-stream

| 场景 | 现状 | 目标 |
| --- | --- | --- |
| 容器日志 | SSE / EventSource | `ContainerService.Logs` server-stream |
| 任务进度 | 轮询 | `TaskService.Watch` server-stream |
| 进程列表推送 | WebSocket | 优先 `ProcessService.Watch` server-stream；如交互复杂再保留 WS |

前端使用 Connect-ES 的异步迭代：

```ts
for await (const line of containerClient.logs(request, { signal })) {
  appendLog(line)
}
```

#### 4.8.3 文件上传/下载：专用二进制 HTTP

大文件不适合塞进 unary proto（内存翻倍、无法断点续传、无法 Range）。保留最小化的二进制通道：

```text
POST /files/upload           # multipart，支持分片
POST /files/chunkupload      # 分片上传
GET  /files/download         # 下载，支持 Range
POST /files/chunkdownload    # 分片下载（如保留）
```

安全设计：

- 前端先调用 RPC 获取一次性票据：
  ```ts
  const { url, token } = await rpc.file.createUploadSession({ dir, filename, size })
  ```
- 上传/下载请求携带票据与 Session Cookie。
- 服务端校验票据、路径、大小、过期时间。
- 其他文件操作（列表、重命名、删除、压缩、解压、搜索、回收站）全部走 `FileService` RPC。

#### 4.8.4 静态资源

保留为普通 HTTP：

```text
/assets/*
/api/v2/static/*      # 1Panel 原路径，保留
/api/v2/images/*      # 1Panel 原路径，保留
/api/v2/apps/icon/*   # 1Panel 原路径，保留
/favicon.ico
```

1Panel 的 `/api/v2/static/*`、`/api/v2/images/*`、`/api/v2/apps/icon/*` 建议**保留原路径**，因为它们可能已经被数据库里的站点配置、主题图片、Markdown 内容或前端拼接逻辑引用；改成无 `/api` 前缀会造成历史数据失效。它们不是业务 JSON API，在门禁中按静态资源白名单放行。

#### 4.8.5 MCP

MCP 是外部协议，客户端要求 HTTP/SSE 或 streamable HTTP，不能改成 gRPC。保留：

```text
/mcp
/mcp/*
```

它不属于管理后台 REST API，列为协议例外。MCP 内部调用业务时直接调用 service，不再经过 REST。

### 4.9 数据库与迁移

- 原样保留 1Panel 的 gormigrate 迁移，不修改已有迁移文件。
- core 与 agent 的迁移在各自初始化阶段执行。
- 单进程下 `agent.db` 只保留一个连接：agent 初始化完成后，赋值给 `core.global.AgentDB`，跳过 core 自己打开 `agent.db`。
- 不新增 schema 变更；迁移只改传输层，保证可以回滚到旧二进制。
- 数据目录迁移：
  - 新部署：`data_dir` 指向新目录，首次启动自动建库。
  - 替换现有 1Panel：`data_dir` 指向现有安装目录，先完整备份 `db/` 与 `conf/`，再用新二进制启动。
- SQLite 建议开启 WAL；1Panel 现有连接配置保持不变，避免行为差异。

### 4.10 单进程下需要改写的 1Panel 逻辑

| 逻辑 | 现状 | 单进程处理 |
| --- | --- | --- |
| core→agent 代理 | Unix socket 反向代理 | 删除；Connect adapter 直接调用 agent service |
| `CurrentNode` | 请求头选择节点 | 固定 `local`，写入 context；不再透传 |
| `X-Panel-User` | 代理层写入 | 拦截器写入 context |
| `LOCAL_REQUEST` | 代理层标记 | 统一按本地请求处理 |
| agent 监听 socket | 独立 HTTP server | 不启动 |
| core 的 `AgentDB` | 打开 `agent.db` | 复用 agent 的 `*gorm.DB` |
| 多节点 | 远程 agent | 本期不支持；见第 9 节待确认项 |

### 4.11 xpack / License 清理

目标：代码里不再出现 xpack / enterprise / License 激活分支，行为固定为社区版。

清理步骤：

1. 删除 `core/utils/xpack/**`、`agent/utils/xpack/**`。
2. 新建一个极小的 `internal/community` 包，承接原 `xpack.AuthProvider`、`xpack.MultiNodeProvider`、`xpack.AlertProvider` 的社区实现（默认放行、本地节点、无企业告警通道），然后机械替换 57 个引用点。
3. 删除所有 `//go:build xpack` / `//go:build enterprise` 文件；只保留社区实现。
4. 删除 `IsMasterProductPro`、`VMCountLimit`、`PANEL_EDITION` 等版本分支。
5. 删除 License 相关页面与接口：
   - 前端：`views/setting/license/`、`views/setting/license-required/`、`components/license-import/`、`utils/xpack.ts`、`extensions/xpack.ts`；
   - 后端：`/settings/license`、`/enterprise/licenses/*` 等路径与常量；
   - 菜单：移除“许可证 / 专业版 / 企业版”入口。
6. `core/init/router/ops_report_xpack.go` 等企业路由文件删除。
7. 清理 `swagger` / 文档中 enterprise、xpack、license 的残留描述。

验收：

- `grep -ri "xpack\|enterprise\|license" master/internal` 只允许命中 GPLv3 许可证文本与第三方依赖，不允许命中业务代码。
- 前端菜单、设置页不再出现 License 入口。
- 不传任何 License 也能正常启动与使用全部保留功能。

### 4.12 AI / VM / 网站运行时 / 网站模板 / Toolbox 清理

| 范围 | 处理 |
| --- | --- |
| 路由 | 删除 `/ai`、`/vms`、`/runtimes`、`/websites/templates`、`/toolbox` 相关 Gin 注册与 Connect 服务 |
| 后端 | 删除上述模块的 api、service、repo、model、task、provider；删除 `agent/init/kvm`；网站 service 删除 `runtime` 类型与 `RuntimeID` 分支 |
| 前端 | 删除 `views/ai/`、`views/vm/`、`views/website/runtime/`、`views/website/template/`、`views/toolbox/`，以及对应 `api/modules`、`api/interface`、菜单与路由 |
| 依赖 | 删除 `@novnc/novnc`；审计并删除仅上述模块使用的 Go 依赖；Toolbox 的 `disk`/`process`/`device` 若被 host/dashboard 复用则保留底层 service |
| 数据库 | 初期保留这些模块的迁移与表，避免破坏已有库；确认无引用后，再单独提交删除迁移与表 |
| 菜单 | 删除 AI、VM、网站运行时、网站模板、Toolbox 一级菜单及二级入口；保留的菜单树通过迁移脚本或前端配置清理 |

> 数据库清理单独做，不和通讯层迁移混在一个提交里；这样切换时如果发现遗漏，可以快速恢复。

---

## 5. 前端迁移设计

### 5.1 整体复制

把 `1Panel/frontend` 复制为 `mypanel/web`，保留：

```text
src/
├── api/            # 删除 modules/interface；仅保留必要的纯 helper（如文件下载）
├── assets/
├── components/
├── composables/
├── config/
├── directives/
├── enums/
├── extensions/
├── global/
├── lang/
├── layout/
├── routers/
├── store/
├── styles/
├── typings/
├── utils/
├── views/
├── App.vue
└── main.ts
```

当前 React 应用处理方式：

- 迁移分支上保留 Git 历史；
- 合并后 `web/` 只保留 Vue 应用；
- 旧 React 代码不放进新目录，避免两套构建配置并存；
- `AGENTS.md` 中关于 React/Astryx 的约定同步改为 Vue/Element Plus/Pinia Colada。

### 5.2 构建与依赖

保留 1Panel 的 Vite 配置，调整：

| 项 | 现状 | 目标 |
| --- | --- | --- |
| 包管理器 | npm | bun（遵循仓库约定） |
| API 地址 | `VITE_API_URL=/api/v2` | 同源 `/rpc` |
| 产物目录 | `dist` | `dist`，由 `scripts/build.sh` 复制到 `master/internal/webdist/dist` |
| 压缩 | `vite-plugin-compression` | 可保留；master 已有 gzip，避免重复 |
| 类型检查 | `vue-tsc` | 保留 |
| 测试 | 暂无 | 新增 `bun:test` 纯逻辑测试 + Playwright E2E |

新增依赖：

```json
{
  "@bufbuild/protobuf": "2.x",
  "@bufbuild/protovalidate": "latest",
  "@connectrpc/connect": "2.x",
  "@connectrpc/connect-web": "2.x",
  "@connectrpc/validate": "latest",
  "@pinia/colada": "1.4.x"
}
```

`@connectrpc/validate` 是可选的客户端兜底；表单校验以 `@bufbuild/protovalidate` 为主，避免每个请求都弹一次通用错误。

Pinia 已存在（3.x），Pinia Colada 1.4 要求 Vue ≥ 3.5.41、Pinia ≥ 2.2.6，当前版本满足。

移除：

- `axios`（改造完成后）
- 与 REST 信封、CSRF 拦截器、`CurrentNode` 头相关的工具代码
- `api/config/service-port.ts` 中不再需要的端口逻辑

### 5.3 RPC 客户端设计

#### 5.3.1 传输层

```ts
// web/src/lib/rpc/transport.ts
import { createConnectTransport } from '@connectrpc/connect-web'

export const transport = createConnectTransport({
  baseUrl: `${window.location.origin}/rpc`,
  // 同源请求默认携带 Cookie；这里显式包一层 fetch，避免未来切换凭据策略时遗漏。
  fetch: (input, init) =>
    fetch(input, { ...init, credentials: 'include' }),
  interceptors: [
    localeInterceptor,   // Accept-Language
    csrfInterceptor,     // X-CSRF-Token
    errorInterceptor,    // 统一转为 ConnectError
  ],
})
```

开发期由 Vite proxy 把 `/rpc` 转到 `http://127.0.0.1:8080`，保持同源。

#### 5.3.2 `rpc` 对象：基于 `web/src/gen` 类型推导，不生成 hook

`rpc` 不是一张手写的方法表，也不是脚本生成的 hook 文件。它直接使用 `protoc-gen-es` 产出的 `web/src/gen/**/*_pb.ts`（项目别名 `#/gen`）里的 service descriptor，由 TypeScript 泛型推导出命名空间、方法名和 hook 类型。

```ts
// web/src/lib/rpc/index.ts
import { AuthService } from '#/gen/panel/core/v1/auth_pb'
import { SettingsService } from '#/gen/panel/core/v1/settings_pb'
import { WebsiteService } from '#/gen/panel/agent/v1/website_pb'
import { HostService } from '#/gen/panel/agent/v1/host_pb'
import { ContainerService } from '#/gen/panel/agent/v1/container_pb'
// ...其余 service descriptor

import { createRpc } from './create-rpc'
import { transport } from './transport'

/**
 * 唯一手工维护的 RPC 注册表。
 *
 * 只登记 service descriptor，不登记 method，也不写 hook。
 * 方法名、入参类型、出参类型、useQuery/useMutation 等全部由 DescService 推导。
 */
const services = {
  core: {
    auth: AuthService,
    settings: SettingsService,
  },
  website: WebsiteService,
  host: HostService,
  container: ContainerService,
  // ...其余 service
} as const satisfies Record<string, DescService | Record<string, DescService>>

export const rpc = createRpc(services, transport)
```

这里刻意**不生成**任何 RPC hook / manifest 中间文件，也不运行脚本扫描 descriptor：

- `web/src/gen` 已经由 `scripts/gen.sh` 生成，是唯一事实来源。
- 新增 proto 方法后，重新 `buf generate` 即可；`createRpc` 的类型会自动出现新方法，不需要改注册表。
- 新增 proto service 时，只需要在 `services` 里加一行 descriptor import；这是 service 发现，不是 hook 硬编码。
- 不在任何地方写 `rpc.website.search = { useQuery, useMutation ... }`。
- 不为某个接口单独写 `useXxxQuery` 包装。

> 范围说明：这里的“不脚本生成”只指**前端 RPC hook / 类型包装**。proto 与后端 adapter 仍然使用生成器，否则 654 个接口无法在合理工期内完成；如果连 proto/adapter 也不允许生成，需要重新评估工期与范围。

命名空间直接由注册表的 key 决定，不再靠脚本推断：

| 注册写法 | 调用形态 |
| --- | --- |
| `core: { auth: AuthService }` | `rpc.core.auth.login` |
| `website: WebsiteService` | `rpc.website.search` |
| `host: HostService` | `rpc.host.monitor` |

方法名由 descriptor 的 `method` key 自动转 lowerCamelCase；如果 proto 新增 `SearchWebsites`，前端自动出现 `rpc.website.searchWebsites`，不需要写任何包装代码。

`createRpc` 的泛型从 `DescService` 推导，和当前 `rpc-proxy.ts` 的思路一致：

```ts
type UnaryMethodKeys<Desc extends DescService> = {
  [K in keyof Desc['method']]: Desc['method'][K]['methodKind'] extends 'unary'
    ? K
    : never
}[keyof Desc['method']]

type Rpc<T> = {
  [K in keyof T]: T[K] extends DescService
    ? { [M in UnaryMethodKeys<T[K]>]: RpcMethod<T[K], M> }
    : Rpc<T[K]>
}
```

每个 unary 方法上提供：

| 入口 | 用途 |
| --- | --- |
| `rpc.website.search(input)` | 直接调用，返回 `Promise<Output>` |
| `rpc.website.search.useQuery(input, opts?)` | Pinia Colada 查询 |
| `rpc.website.search.useSuspenseQuery(input, opts?)` | 异步查询，配合 `<Suspense>` |
| `rpc.website.search.useInfiniteQuery(fn, opts?)` | 无限查询 |
| `rpc.website.search.useMutation(opts?)` | 变更 |
| `rpc.website.search.validate(input)` | 用 Protovalidate 校验入参，返回 violations |
| `rpc.website.search.queryOptions(input, opts?)` | Pinia Colada `defineQueryOptions` |
| `rpc.website.search.key(input)` | 稳定的 query key，供手动失效 |
| `rpc.website.search.refresh(input)` | 主动刷新（需在 setup/事件中使用 cache） |

这些 hook **全部由同一个泛型工厂挂载**，不是为每个方法手写：

```ts
function createRpcMethod<Desc extends DescService, K extends UnaryMethodKeys<Desc>>(
  service: Desc,
  method: K,
  client: Client<Desc>,
) {
  const call = (input, opts?) => client[method](input, opts)
  return Object.assign(call, {
    useQuery: (input, opts?) => useQuery(call.queryOptions(input, opts)),
    useSuspenseQuery: (input, opts?) => useSuspenseQueryImpl(call.queryOptions(input, opts)),
    useInfiniteQuery: (fn, opts?) => useInfiniteQuery(call.infiniteQueryOptions(fn, opts)),
    useMutation: (opts?) => useMutation({ mutation: call, ...opts }),
    validate: (input) => {
      const inputSchema = service.method[method].input
      return validator.validate(inputSchema, create(inputSchema, input))
    },
    queryOptions: (input, opts?) => defineQueryOptions({ key: call.key(input), query: () => call(input), ...opts }),
    key: (input) => toCacheKey([service.typeName, method, normalize(input)]),
    refresh: (input) => useQueryCache().refresh(call.queryOptions(input)),
  })
}
```

实施要求：

- 不在 `web/src` 里手写 `rpc.<service>.<method> = ...`。
- 不为某个接口单独写 `useXxxQuery` 包装；页面直接使用 `rpc.*`。
- 流式方法由 `methodKind` 自动排除，误用 `rpc.x.watch.useQuery` 在编译期报错。
- 不生成 RPC hook / manifest 中间文件，不写扫描 descriptor 的脚本。
- 新增 proto service/method 后，前端无需新增 hook 代码；这是迁移验收的一部分。
- 用一个类型级测试遍历 `typeof services`，断言每个 unary 方法都具备完整 hook 集合，流式方法没有 hook。

示例：

```vue
<script setup lang="ts">
const { data, isLoading } = rpc.website.search.useQuery({
  page: 1,
  pageSize: 20,
})
</script>

<template>
  <div v-if="isLoading">加载中...</div>
  <div v-for="item in data?.items" :key="item.id">{{ item.name }}</div>
</template>
```

变更：

```vue
<script setup lang="ts">
import { useQueryCache } from '@pinia/colada'

const queryCache = useQueryCache()
const { mutateAsync, asyncStatus } = rpc.website.delete.useMutation()

async function remove(id: number) {
  await mutateAsync({ ids: [id] })
  queryCache.invalidateQueries({ key: rpc.website.search.key({ page: 1 }) })
}
</script>
```

#### 5.3.3 `useSuspenseQuery` 在 Vue 中的语义

Pinia Colada **没有** React Query 那种原生 `useSuspenseQuery`。方案提供同名封装，但要求使用 `await`，并配合 Vue 的 `<Suspense>`：

```vue
<!-- 父组件 -->
<Suspense>
  <WebsiteDetail />
  <template #fallback>加载中...</template>
</Suspense>
```

```vue
<!-- WebsiteDetail.vue -->
<script setup lang="ts">
const { data } = await rpc.website.get.useSuspenseQuery({ id: 1 })
</script>

<template>
  <div>{{ data.name }}</div>
</template>
```

实现要点：

```ts
async function useSuspenseQuery(input, opts) {
  const query = useQuery(method.queryOptions(input, opts))
  // 缓存已是 success 时直接返回；否则等待一次真实请求。
  // refresh(true) 会在失败时抛错，正好交给上层 <Suspense> / onErrorCaptured。
  if (query.state.value.status !== 'success') {
    await query.refresh(true)
  }
  return query
}
```

这样：

- 缓存命中时立即返回；
- 缓存未命中时等待请求；
- 请求失败时把错误抛给 `<Suspense>` 上层；
- 类型上可以承诺 `data` 有值。

与 React 写法的差异只有 `await`，调用形态仍然是 `rpc.xxx.useSuspenseQuery(...)`。

#### 5.3.4 Query Key

默认 key：

```ts
[serviceFullName, methodName, normalizedInput]
```

例如：

```ts
['panel.agent.v1.WebsiteService', 'Search', { page: 1, pageSize: 20 }]
```

规则：

- 入参用稳定序列化（Pinia Colada 的 `toCacheKey` 或等价实现），字段顺序固定。
- 无入参方法使用空对象。
- 支持传入 getter 以响应式更新：
  ```ts
  rpc.website.search.useQuery(() => ({ page: page.value }))
  ```
- 允许调用方覆盖 key，用于跨页面共享缓存。
- 变更后按前缀失效：
  ```ts
  queryCache.invalidateQueries({ key: ['panel.agent.v1.WebsiteService'] })
  ```

#### 5.3.5 无限查询

Pinia Colada 的 `useInfiniteQuery` 需要一个返回下一页参数的回调。由于 gRPC 没有统一游标字段，采用与现有 `rpc-proxy` 相同的设计：

```ts
const query = rpc.log.list.useInfiniteQuery(
  (pageParam: string) => ({ pageToken: pageParam, pageSize: 20 }),
  {
    initialPageParam: '',
    getNextPageParam: (last) => last.nextPageToken || undefined,
  },
)
```

#### 5.3.6 表单校验

每个表单提交前先用同一个 proto 规则校验：

```ts
const result = rpc.website.create.validate(form)
if (result.kind !== 'valid') {
  for (const v of result.violations) {
    // fieldPath: "domain" / "items[0].port"
    formRef.value?.setFieldError(v.fieldPath, v.message)
  }
  return
}
await rpc.website.create.mutateAsync(form)
```

实现约定：

- `createRpc` 内部只创建一个 `createValidator()` 实例，按 message type 缓存。
- `.validate()` 返回 `{ kind: 'valid' } | { kind: 'invalid', violations }`，不抛异常，方便表单逐字段展示。
- `.useMutation()` 默认不自动校验，避免批量/局部更新场景被整表规则误伤；需要时传 `{ validate: true }`。
- 服务端仍然使用 `connectrpc.com/validate` 强制校验，前端校验只负责体验。
- Element Plus 的 `el-form-item` 的 `prop` 与 proto `fieldPath` 建立映射；嵌套数组用 `items.0.port` 或 `items[0].port` 统一转换。
- 标准规则文案按 `ruleId` 走 `vue-i18n`；自定义 CEL 规则直接使用 proto 里的中文 `message`。
- 文件上传、终端 WS 等例外通道，在创建票据/握手参数的 RPC 上做同样的 Protovalidate 校验。

### 5.4 从 `api/modules` 迁移到 `rpc`

1Panel 的约 50 个 API 文件按模块改写，不是简单替换 URL，而是去掉“函数 + axios”的中间层：

旧写法：

```ts
export const searchWebsites = (params: Website.Search) => {
  return http.post<ResPage<Website.Website>>('/websites/search', params)
}
```

新写法：

```ts
// 页面直接使用 rpc，不再保留 searchWebsites 包装
const { data } = rpc.website.search.useQuery({ page: 1, pageSize: 20 })
```

类型直接从 `web/src/gen` 推导，不再维护 `api/interface/*.ts`：

```ts
// 页面直接从生成的 pb 文件导入类型
import type { Website } from '#/gen/panel/agent/v1/website_pb'
```

`protoc-gen-es` 已经为每个 message 导出了类型别名（等价于 `MessageShape<typeof WebsiteSchema>`），不需要再写一层手写 interface：

```ts
// 生成的 website_pb.ts 内部大致是：
export type Website = MessageShape<typeof WebsiteSchema>
```

这样：

- 类型只有一个事实来源：`web/src/gen`。
- 字段名、可选性、枚举、64 位整数类型都与 proto 一致。
- 不再维护 `api/interface`；迁移时批量把 import 指向 `#/gen/...`，由 `vue-tsc` 找出遗漏。
- 不为兼容旧类型而手写 `type Foo = { ... }`，否则会再次出现类型漂移。

不建议保留 `api/modules` 的函数包装，否则会出现“RPC 外面再套一层 axios 风格函数”的双层抽象，失去 tRPC 风格的意义。

### 5.5 登录、路由守卫与全局错误

| 现有逻辑 | 迁移方式 |
| --- | --- |
| `api/index.ts` 请求拦截器 | Connect interceptor + Pinia Colada 全局错误处理 |
| `Accept-Language` | interceptor |
| `X-CSRF-Token` | interceptor |
| `CurrentNode` | 删除；单进程固定 local |
| 401 跳登录 | Connect 错误拦截器统一处理 |
| 登录页 | `rpc.core.auth.login.useMutation()` |
| 路由守卫拉当前用户 | `await rpc.core.auth.current()` 或 `queryCache.ensure` |
| 退出登录 | `rpc.core.auth.logout()` + 清空 Pinia Colada 缓存 |
| 密码过期 | `rpc.core.auth.current()` 返回标记，守卫跳转 |
| 安全入口 | 前端读取 cookie/设置，不经过 REST |

登录示例：

```ts
const { mutateAsync } = rpc.core.auth.login.useMutation()
const res = await mutateAsync({ name, password, entranceCode })
```

### 5.6 流式与 WebSocket

| 场景 | 前端改造 |
| --- | --- |
| 终端 | 保留 `new WebSocket`，token 改为 `rpc.host.createTerminalSession()` |
| 容器日志 | `EventSource` → `for await (const line of rpc.container.logs(...))` |
| 任务进度 | 轮询 → `rpc.task.watch.useQuery` 或直接异步迭代 |
| 文件上传 | `http.upload` → 票据 RPC + XHR/fetch 上传 |
| 文件下载 | `http.download` → 票据 RPC + `window.open` / fetch blob |

### 5.7 类型映射规则

旧 Go DTO → proto → TS 的映射必须统一，否则会出现 `bigint`、时间格式、可选字段的连锁问题。

| Go / DTO | proto | TS（protobuf-es） | 说明 |
| --- | --- | --- | --- |
| `string` | `string` | `string` | |
| `int`（ID、页码） | `int32` | `number` | 1Panel 自增 ID 足够 |
| `int64`（大小、计数） | `int64` | `bigint` | 前端显示时转 string；或改用 `string` 字段 |
| `float64` | `double` | `number` | |
| `bool` | `bool` | `boolean` | |
| `*T` | `optional T` | `T \| undefined` | 保留“未设置”语义 |
| `[]T` | `repeated T` | `T[]` | |
| `time.Time` | `string` | `string` | 保持 1Panel 现有日期字符串格式 |
| `map[string]any` | `google.protobuf.Struct` | `JsonObject` | 动态配置 |
| `json.RawMessage` | `string` | `string` | 保持 JSON 原文 |
| `interface{}` | `google.protobuf.Value` | `JsonValue` | 尽量在生成阶段收敛为具体类型 |

特别注意：

- protobuf-es v2 的 64 位整数是 `bigint`，不能直接和 `number` 比较。生成器对 `int64` 默认输出 `string`，只有确知需要数值计算时才用 `bigint`。
- 字段名统一用 proto 的 `snake_case`，生成的 TS 是 `camelCase`，与 1Panel 现有前端命名习惯一致。
- 可选字段必须显式使用 `optional`，否则 proto3 无法区分“空字符串”和“未设置”。

### 5.8 前端验收

- `vue-tsc --noEmit` 无错误。
- `vite build` 成功，产物可被 master embed。
- 334 个页面全部能打开，无 `axios` 残留调用。
- 登录、MFA、Passkey、OIDC/SAML 至少各有一条 E2E。
- 每个模块至少一条“列表 + 详情 + 变更”E2E。
- 终端、文件上传下载、容器日志各有一条手工或自动化用例。
- `rpc` 直接基于 `web/src/gen` descriptor 推导，不存在手写的 `rpc.<service>.<method>` 包装，也不存在 RPC hook 生成脚本。
- 新增 proto 方法后不写前端 hook 代码即可调用；每个 unary 方法在类型层都具备 `useQuery` / `useSuspenseQuery` / `useMutation` / `useInfiniteQuery` / `queryOptions` / `key` / `validate`，流式方法不出现这些 hook。
- 表单校验失败时能按 `fieldPath` 定位到对应 Element Plus 表单项。

---

## 6. 允许保留的 HTTP 端点

“剔除 REST API”指删除面向浏览器的业务 JSON API；以下端点因协议或传输特性保留，并在门禁中列为白名单。

| 路径 | 类型 | 保留原因 |
| --- | --- | --- |
| `/rpc/*` | Connect / gRPC | 新的业务通讯入口 |
| `/healthz` | HTTP | 探针 |
| `/ws/terminal` | WebSocket | PTY 双向流 |
| `/files/upload` | 二进制 HTTP | 大文件、分片、断点续传 |
| `/files/chunkupload` | 二进制 HTTP | 分片上传 |
| `/files/download` | 二进制 HTTP | 大文件、Range |
| `/files/chunkdownload` | 二进制 HTTP | 分片下载 |
| `/assets/*` | 静态 | 前端产物 |
| `/api/v2/static/*` | 静态 | 1Panel 静态 JSON/资源（保留原路径） |
| `/api/v2/images/*` | 静态 | 主题图片（保留原路径） |
| `/apps/icon/*` | 静态 | 应用图标 |
| `/favicon.ico` | 静态 | 图标 |
| `/mcp`、`/mcp/*` | MCP 协议 | 外部 MCP 客户端要求 HTTP/SSE |
| `/api/v2/core/auth/oidc/*` | 浏览器跳转 | OIDC 协议，保留原回调地址 |
| `/api/v2/core/auth/saml2/*` | 浏览器跳转/表单 | SAML 协议，保留原回调地址 |
| `/`、`/*` | SPA fallback | 前端路由 |

除此之外，`/api/v2/**` 不允许存在业务 JSON 路由。白名单按**精确路径或前缀**配置，不能用整个 `/api/v2/core/auth/` 前缀放行。

---

## 7. 一次性全量迁移实施计划

“一次性”指**只做一次生产切换**，不代表施工阶段不分批。建议采用长期分支 + 并行工作流，所有模块完成后统一合并。

### 7.1 工作流

| 工作流 | 内容 | 预估人周 |
| --- | --- | ---: |
| W0 基线冻结 | 冻结 1Panel v2.5.1；打 tag；建立路由/DTO 清单；确认 GPL 合规 | 2 |
| W1 仓库骨架 | 复制 core/agent；import 重写；go.mod 合并；单进程启动骨架；日志/DB/配置合并 | 8 |
| W2 工具链 | 路由解析、DTO→proto 生成、注释/Protovalidate 规则生成、adapter 生成、policy 生成、覆盖率门禁 | 11 |
| W3 core 适配 | Auth、Settings、Backup、Log、Script、MCP、Diagnostics、Upgrade | 8 |
| W4 agent 适配 | Host、Website（不含运行时/模板）、App、Database、Container、File、Cronjob、Firewall、Dashboard、Backup、Alert、Log | 22 |
| W5 前端数据层 | 复制 Vue；Connect transport；Pinia Colada `createRpc`；基于 `web/src/gen` 推导 hook；登录/错误/CSRF；类型迁移 | 10 |
| W6 前端页面改造 | 约 50 个 api 模块替换；334 个页面里直接调用 rpc；流式/文件/WS | 12 |
| W7 流式与认证 | 终端 WS、容器日志、文件票据、OIDC/SAML、API Key | 6 |
| W8 回归与压测 | 全模块 E2E、契约对比、性能、安全、构建 | 12 |
| W9 切换 | 数据备份、发布、冒烟、回滚演练、文档 | 4 |
| 合计 | | **约 95 人周** |

粗算：

- 4 人并行：约 6 个月；
- 6 人并行：约 4 个月；
- 2 人：11 个月以上。

以上不含法律审查、UI 品牌改造、1Panel 上游新功能。

### 7.2 施工顺序

```text
第 1 月
  W0 基线冻结
  W1 仓库骨架（core/agent 能编译、能启动空 HTTP）
  W2 工具链（先跑通 3 个接口的端到端生成）

第 2-3 月
  W2 完成
  W3 core 适配完成
  W4 先做 Host / Website / App / Database 四个高频域
  W5 前端数据层完成，登录页与首页跑通

第 4-5 月
  W4 剩余域（Container / File / App / Database / Cronjob / ...）
  W6 前端按模块替换
  W7 流式与文件完成

第 6 月
  W8 全量回归、契约对比、性能与安全
  W9 切换演练

第 7 月（缓冲）
  修复回归、补文档、正式切换
```

### 7.3 一次性切换的前提门禁

上线前必须全部满足：

1. RPC 覆盖率 100%（白名单除外）。
2. 构建产物中不存在 `/api/` 业务路由。
3. 所有模块至少通过一条 E2E。
4. 登录、MFA、Passkey、OIDC/SAML 全部验证。
5. 终端、文件上传下载、容器日志全部验证。
6. 从真实数据副本启动成功，迁移无报错。
7. 回滚演练成功：旧二进制 + 数据快照能在 10 分钟内恢复。
8. GPLv3 合规文件齐全。

任何一项不满足，不切换。

### 7.4 切换步骤

```text
T-7 天
  ├── 冻结 1Panel 上游
  ├── 备份生产数据目录
  ├── 在预发环境用真实数据副本跑完整回归
  └── 准备回滚包（旧二进制 + 启动脚本）

T-1 天
  ├── 最后一次全量测试
  ├── 确认监控、日志、告警
  └── 通知用户维护窗口

T0
  ├── 停止旧服务
  ├── 备份 db/、conf/、uploads/
  ├── 部署新 master 二进制 + 前端产物
  ├── 启动并检查健康检查
  ├── 冒烟：登录 → 首页 → 网站 → 应用 → 文件 → 终端
  └── 观察错误率、延迟、会话失败率

T+7 天
  └── 保留回滚包；确认稳定后清理
```

回滚条件：

- 登录失败率 > 1%；
- 核心模块 5xx > 0.5%；
- 出现数据写入错误；
- 终端/文件传输不可用。

回滚方式：停新服务，恢复旧二进制与数据快照。因为不新增 schema 变更，回滚不需要反向迁移。

---

## 8. 验收标准

### 8.1 功能

- 登录、退出、修改密码、MFA、Passkey、OIDC、SAML、API Key 全部可用。
- 12 个前端模块（home、host、website、app-store、database、container、cronjob、setting、log、terminal、login、share）全部可打开与操作。
- 终端、容器日志、任务进度可用。
- 文件上传、下载、分片、断点续传、Range 可用。
- 中英文切换、服务端错误本地化可用。
- 安全入口、Demo 模式、密码过期、IP 限制行为与 1Panel 一致。

### 8.2 协议

- 浏览器所有业务调用走 `/rpc`。
- 原生 gRPC 客户端可通过 h2c 调用。
- gRPC reflection 可用。
- 不存在 `/api/v2/**` 业务 JSON 路由。
- 白名单 HTTP 端点有测试覆盖。

### 8.3 质量

- `go vet ./master/...` 通过。
- `go test ./master/...` 通过（含 Protovalidate 拦截器与 adapter 转换测试；依赖 Docker/root 的集成测试用 build tag 隔离）。
- `gofmt -l master` 无输出。
- `bun run type-check` 通过。
- `bun test` 通过（包含 Protovalidate 前后端同 fixture 校验测试）。
- `bun run build` 通过。
- 生成代码可重复生成，`git diff` 为空。

### 8.4 性能

- 常用列表页 P95 延迟不超过 1Panel 基线的 120%。
- 登录后首屏资源加载不超过基线 120%。
- 单进程内存不超过 core + agent 分别运行总和的 120%。
- 文件上传/下载吞吐不低于基线 90%。

### 8.5 安全

- 未登录访问受保护 RPC 返回 `Unauthenticated`。
- 非法参数返回 `InvalidArgument`，details 带 `buf.validate.Violations`。
- CSRF 缺失或错误返回 `PermissionDenied`。
- API Key 签名、时间窗、权限校验有效。
- WebSocket Origin 校验有效。
- 文件票据不能越权访问其他路径。
- 日志不记录密码、私钥、Token。

---

## 9. 风险与应对

| 风险 | 概率 | 影响 | 应对 |
| --- | --- | --- | --- |
| GPLv3 合规 | 高 | 高 | 迁移前法律确认；添加 LICENSE、NOTICE、版权头；分发时提供源码 |
| 654 个接口遗漏 | 高 | 高 | 路由清单 + 覆盖率门禁 + manifest 人工确认 |
| 生成器误判 DTO 字段 | 中 | 中 | 生成 `TODO` 让编译失败；字段级 round-trip 测试 |
| Vue 无原生 Suspense hook | 中 | 中 | 提供同名异步封装；文档明确 `await` |
| Pinia Colada 生态较新 | 中 | 中 | 锁定 1.4.x；核心逻辑不依赖内部 API；保留直接调用 `rpc.x.y()` 作为退路 |
| RPC hook 被手写回潮 | 中 | 中 | 只允许 service descriptor 注册表；禁止手写 `rpc.*` 包装与 hook 生成脚本；类型层测试遍历 `typeof services` |
| Connect 双向流浏览器支持差 | 中 | 中 | 终端保留 WebSocket；日志/任务用 server-stream |
| 单进程 panic 影响面大 | 中 | 高 | recover 中间件；初始化顺序固定；关键 goroutine 隔离 |
| core/agent 重复初始化 | 中 | 中 | 明确顺序；共享 DB 连接；启动自检 |
| 多节点功能丢失 | 中 | 中 | 本期明确只支持本地节点；如需多节点，保留 `internal/agent` 边界，后续拆 node |
| 1Panel 上游漂移 | 中 | 中 | 冻结 v2.5.1；安全补丁 cherry-pick；记录 diff |
| 删除网站运行时影响建站流程 | 高 | 中 | 网站创建只保留 static/proxy/stream；移除 runtime 类型与 RuntimeID；回归建站 E2E |
| 前端构建从 npm 换 bun 出问题 | 低 | 中 | 第 1 月做 spike；必要时保留 npm 构建脚本 |
| 外部 API 客户端断供 | 中 | 中 | 提前通知；提供 Connect/gRPC 迁移文档 |
| 真实数据迁移失败 | 低 | 高 | 预发用真实副本演练；备份；不新增 schema |

---

## 10. 待确认问题

以下问题会影响最终工作量，建议在开工前确认：

1. **GPLv3 是否接受？** 如果 mypanel 需要闭源分发，本方案不可直接复制 1Panel 代码，只能参考协议与交互自行实现。
2. **多节点是否必须？** 合并单进程后，1Panel 的远程 agent/多节点能力默认不保留。如果必须保留，需要把 `internal/agent` 重新拆成 `node/`，并设计 node 注册与鉴权。
3. **MCP 是否保留？** MCP 是外部协议端点，必须保留 HTTP/SSE；如果不需要 MCP，可连同 `MCPService` 一起删除，进一步减少工作量。
4. **网站创建只保留 static/proxy/stream 是否满足需求？** 删除网站运行时后，PHP/Node/Java/Go/Python/.NET 运行环境站点不再支持；需要确认业务上可以接受。
5. **外部 API Key 调用方是否需要兼容层？** 删除 REST 后，现有脚本/第三方集成会失效。是否需要短期保留一个只读兼容网关？
6. **品牌与主题是否替换？** 继续使用 1Panel 的 Element Plus 主题，还是改成 mypanel 的视觉规范？
7. **部署目标是否仅 Linux？** 1Panel 依赖 Docker、systemd、root 权限；CI 和本地开发需要对应的 Linux 环境或 mock。

---

## 附录 A：Proto 文件规划

```text
proto/panel/
├── common/v1/
│   ├── options.proto        # public、csrf_exempt、audit 等注解
│   ├── page.proto           # 分页请求/响应
│   └── error.proto          # ErrorInfo 辅助
├── core/v1/
│   ├── auth.proto
│   ├── user.proto
│   ├── settings.proto
│   ├── backup.proto
│   ├── command.proto
│   ├── group.proto
│   ├── log.proto
│   ├── script.proto
│   ├── mcp.proto
│   ├── diagnostics.proto
│   └── upgrade.proto
└── agent/v1/
    ├── host.proto
    ├── monitor.proto
    ├── website.proto
    ├── website_ssl.proto
    ├── app.proto
    ├── database.proto
    ├── container.proto
    ├── file.proto
    ├── cronjob.proto
    ├── firewall.proto
    ├── task.proto
    ├── dashboard.proto
    ├── backup.proto
    ├── alert.proto
    └── log.proto
```

## 附录 B：前端 rpc 使用速查

```ts
// 查询
const { data, isLoading, error } = rpc.website.search.useQuery({ page: 1 })

// 响应式查询
const page = ref(1)
const query = rpc.website.search.useQuery(() => ({ page: page.value }))

// Suspense（需要在 async setup 中 await）
const { data } = await rpc.website.get.useSuspenseQuery({ id: 1 })

// 变更
const { mutate, mutateAsync, asyncStatus } = rpc.website.delete.useMutation()

// 直接调用
const website = await rpc.website.get({ id: 1 })

// 手动刷新
const cache = useQueryCache()
await cache.invalidateQueries({ key: rpc.website.search.key({ page: 1 }) })

// 无限查询
const list = rpc.log.list.useInfiniteQuery(
  (pageToken: string) => ({ pageToken, pageSize: 20 }),
  {
    initialPageParam: '',
    getNextPageParam: (last) => last.nextPageToken || undefined,
  },
)
```

## 附录 C：后端 adapter 生成产物

```text
master/internal/transport/
├── core/
│   ├── auth_gen.go
│   ├── settings_gen.go
│   └── ...
├── agent/
│   ├── website_gen.go
│   ├── host_gen.go
│   └── ...
├── convert/
│   ├── website_gen.go
│   └── ...
├── policy/
│   └── policy_gen.go
└── register.go
```

`register.go` 只做一件事：把生成的服务实现注册到 Connect handler，并挂到 gin。

## 附录 D：参考命令

```bash
# 生成 proto 与 TS（不含 RPC hook 生成）
./scripts/gen.sh

# proto 注释与 lint
cd proto
buf dep update
buf lint
go run ../scripts/check-proto-comments

# 从旧接口生成 proto/adapter 骨架
go run ./scripts/gen-proto-from-gin \
  -core ../1Panel/core \
  -agent ../1Panel/agent \
  -out ./proto

# 覆盖率检查
go run ./scripts/check-rpc-coverage \
  -baseline ../1Panel \
  -proto ./proto

# 构建
./scripts/build.sh

# 后端检查
go vet ./master/...
go test ./master/...
gofmt -l master

# 前端检查
cd web
bun run type-check
bun test
bun run build
```

---

## 附录 E：迁移检查清单

### 后端

- [ ] core/agent 代码已复制，import 已重写
- [ ] go.mod 合并，`go build ./...` 通过
- [ ] 单进程初始化顺序确定
- [ ] core/agent 数据库连接合并
- [ ] core→agent 反向代理删除
- [ ] 业务 REST 路由删除
- [ ] Connect 服务注册完成
- [ ] 鉴权/CSRF/审计拦截器完成
- [ ] Protovalidate 后端拦截器完成
- [ ] 错误映射与 i18n 完成
- [ ] proto 每个字段/消息/枚举/服务/方法都有注释，`buf lint` 通过
- [ ] 终端 WebSocket 完成
- [ ] 文件上传下载票据完成
- [ ] OIDC/SAML 回调完成
- [ ] MCP 端点保留
- [ ] gRPC reflection 可用
- [ ] 覆盖率 100%
- [ ] 无 `/api/` 业务路由
- [ ] AI/VM/网站运行时/网站模板/Toolbox/xpack/License 已剔除

### 前端

- [ ] 1Panel Vue 前端复制到 `web/`
- [ ] 旧 React 代码移出工作目录
- [ ] Connect transport 完成
- [ ] Pinia Colada 安装并注册
- [ ] `createRpc` 完成，hook 全部从 `web/src/gen` descriptor 推导
- [ ] 不存在手写 `rpc.*` 包装或 RPC hook 生成脚本
- [ ] `useQuery` / `useSuspenseQuery` / `useMutation` / `useInfiniteQuery` / `validate` 完成
- [ ] 登录/路由守卫/401 处理完成
- [ ] CSRF 拦截器完成
- [ ] 约 50 个 api 模块替换完成
- [ ] 类型统一从 `web/src/gen` 导入，`api/interface` 已删除
- [ ] 334 个页面可打开
- [ ] 终端 WS 完成
- [ ] 容器日志流式完成
- [ ] 文件上传下载完成
- [ ] Protovalidate 表单校验接入完成
- [ ] `vue-tsc` / `vite build` 通过
- [ ] E2E 覆盖 12 个模块

### 发布

- [ ] GPLv3 LICENSE / NOTICE 完成
- [ ] 数据备份脚本完成
- [ ] 回滚演练完成
- [ ] 监控与告警完成
- [ ] 用户通知完成

---

## 附录 F：与现有 mypanel 代码的取舍

| 现有代码 | 处理 |
| --- | --- |
| `master/internal/config` | 保留并扩展 `data_dir` |
| `master/internal/app` | 保留 wire 骨架，改为组装 core/agent/transport |
| `master/internal/server` | 保留 h2c、gzip、SPA 逻辑，新增 Connect 服务挂载与 WS/文件路由 |
| `master/internal/panel` | 删除，替换为 1Panel core/agent |
| `master/internal/webdist` | 保留 embed 机制，产物来自新的 Vue 前端 |
| `proto/panel/v1/panel.proto` | 删除或归档，替换为 `panel.core.v1` / `panel.agent.v1` |
| `web/` React 应用 | 迁移分支保留历史，最终由 Vue 应用替换 |
| `node/` | 保留占位，未来拆分 agent 时使用 |
| `AGENTS.md` | 更新前端技术栈与目录说明 |
| `scripts/gen.sh` | 扩展为多 proto 包生成 |
| `scripts/build.sh` | 改为构建 Vue 前端 |

---

## 附录 G：实施进展与偏差（持续更新）

> 更新时间：2026-11-23

### 已落地

| 项 | 状态 |
| --- | --- |
| 1Panel core/agent 复制 | 完成，独立 module `mypanel/core`、`mypanel/agent` |
| 单进程启动骨架 | 完成（core → agent 固定顺序，`data_dir` 注入） |
| Connect/gRPC + 策略注解 + Protovalidate | 完成 |
| 前端 Vue 整体替换 + Pinia Colada `createRpc` | 完成（hook 全部由 `web/src/gen` 推导） |
| 页面迁移 | 登录、终端主机、首页、文件、计划任务、容器、MySQL、PostgreSQL、告警、应用商店、已安装应用、备份账号、SSL、防火墙状态、任务中心 |
| 文件上传/下载 | `/files/upload`、`/files/download` + 一次性票据 |
| 终端 WebSocket | `/ws/terminal`（会话校验 + terminal auth lease） |
| MCP | `/mcp`（POST/GET/DELETE） |
| RPC 门禁 | `scripts/check-rpc-coverage.sh`（策略注解、注册表一致性、HTTP 白名单） |
| 模块删除 | VM 全部后端；Toolbox/AI/runtime/template 的外部 API 与路由 |
| core 系统设置 | `panel.core.v1.SettingService`（26 个方法）：完整/精简设置、终端外观、单项与菜单设置、访问地址、备忘录、下载偏好、端口与绑定地址、HTTPS 证书与重载、升级信息与版本说明、应用商店配置、服务器代理 |
| Website 配置 | 26 个方法：搜索/创建/删除、Nginx 指令级配置、代理缓存、负载均衡读写、真实 IP、默认站点、HTTPS |
| File 能力 | 回收站查询与还原、收藏增删查、文件历史 |
| agent 系统设置 | `panel.agent.v1.AgentSettingService`（12 个方法）：系统设置、数据目录、网站目录、终端/文件 AI 设置、文件历史设置、资源描述、可用性探测 |
| 系统快照 | `panel.agent.v1.SnapshotService`（9 个方法）：数据树、创建、重试、导入、描述、删除、恢复、回滚、分页查询 |
| 主机管理扩展 | `HostService` 增至 17 个方法：主机增删改、连通性测试、组件检查、磁盘分区/挂载/卸载、运行时诊断 |
| 终端会话 | `panel.agent.v1.TerminalService`（3 个方法）：会话列表、单个关闭、全部关闭；数据流仍走 `/ws/terminal` |
| 控制面诊断 | `panel.core.v1.DiagnosticsService`（3 个方法），与 agent 侧共用同一组 proto 消息 |
| 防火墙 | `FirewallService` 扩到 27 个方法：生命周期、转发规则、过滤链、规则增删改排序、设置与白名单、后端切换、IPv6/地址族、Docker 端口防护、规则备份 |
| SSH 管理 | `panel.agent.v1.SSHService`（13 个方法）：SSH 状态/启停/配置、配置文读写、密钥生成修改同步删除、登录日志查询导出清理 |
| 本地终端连接 | `AgentSettingService` 增至 17 个方法：本地连接读取/保存/连通性测试/默认开关 |
| 主机监控 | `panel.agent.v1.MonitorService`（6 个方法）：监控数据查询、采集设置读写、历史清理、磁盘与网卡选项 |
| Website 管理 | `WebsiteService` 增至 47 个方法：详情/列表/选项、启停、基础信息、预检查、分组迁移与批量操作、PHP 版本、跨站访问、CORS、站点目录与权限、自定义伪静态 |
| 证书与 CA | `WebsiteSSLService` 增至 21 个方法：证书查询/创建/修改/签发/DNS 解析/删除/推送，CA 查询/创建/删除/续签，ACME 账号创建/修改/删除 |
| 控制面日志 | `panel.core.v1.LogService`（3 个方法）：登录日志、操作日志、日志清理 |
| 脚本库 | `panel.core.v1.ScriptService`（5 个方法）：查询/创建/修改/删除/同步；脚本执行仍走 WebSocket |
| 快速命令 | `panel.core.v1.CommandService`（8 个方法）：分页/列表/树、增删改、导入导出；CSV 上传保留 HTTP |
| 通用分组 | `panel.core.v1.GroupService`（4 个方法）：按类型列出、增删改，被命令库/计划任务/主机共用 |
| 备份账号 | `panel.core.v1.BackupsService`（5 个方法）：增删改、OAuth 令牌刷新、客户端信息；备份文件操作仍走 agent 的 BackupService |
| API 密钥 | `AuthService` 增 2 个方法：`GenerateAPIKey`、`UpdateAPIConfig`；多密钥管理（`/core/auth/api/keys/*`）依赖 xpack，已剔除 |
| 容器查询 | `ContainerService` 增 6 个方法：容器名列表、按镜像查容器、容器内用户、批量/单项资源占用、实时指标采样；日志实时流（SSE）保留原通道 |
| 容器镜像与 Docker | `ContainerService` 增 11 个方法：Docker 状态/启停、镜像拉取/推送/构建/远程搜索、daemon.json 读写替换、日志与 IPv6 配置 |
| 容器模板与仓库 | `ContainerService` 增 10 个方法：Compose 模板增删改批量导入、镜像仓库增删改与连通性检查 |
| 容器管理 | `ContainerService` 增至 37 个方法：资源限制、容器批量操作/重命名/清理、网络与卷增删查、镜像删除与打标签、Compose 环境/校验/操作/置顶/日志清理 |
| 认证收尾 | `AuthService` 增 7 个方法：Passkey 注册 begin/finish、MFA 生成/绑定/关闭、当前用户修改、过期密码重置；17 条 `/core/auth/*` 路由全部建立映射 |
| 代理与域名 | `WebsiteService` 增至 69 个方法：反向代理新增/文件/删除/状态/缓存清理、访问认证与路径认证、重定向文件、四层代理、关联资源、域名增删改、DNS 账号、数据库绑定、负载均衡文件、日志开关 |
| 多节点接口清理 | 前端 `listNodeOptions`/`listAllSimpleNodes`/`updateNodeFavorite` 已改为本地单节点实现，不再请求 xpack 的 `/core/nodes*` |
| 数据库域剔除 | `/databases/*`（63 条）不再迁移：数据库实例与连接管理交给 DBX 接管，mypanel 只保留网站绑定数据库这一条链路 |

### 当前进度（2026-11-23）

| 指标 | 数值 |
| --- | --- |
| proto RPC 方法数 | 356（含已剔除域遗留的 DatabaseService，待清理） |
| 精确路由覆盖 | 343 / 830（剔除 323，未映射 164） |
| 已迁移页面与对话框 | 约 320 个 |

`web/src/api/modules/setting.ts`、`firewall.ts`、`host.ts` 已整体删除：面板设置、agent 设置与系统快照全部走 RPC。

证书/CA 的文件上传与下载（`/websites/ssl/upload*`、`/websites/ssl/download`、`/websites/ca/upload`、`/websites/ca/download`）
保留 HTTP 二进制通道，已列入剔除前缀；其余证书与 CA 接口全部走 RPC。

容器文件浏览与镜像导入导出、日志下载、daemon.json 文件操作同样是二进制/流式通道，
已随 `containers/files*`、`image/load|save`、`download/log`、`daemonjson/file` 一并列入剔除前缀。

脚本执行（`/core/script/run`）与终端数据流一样属于 WebSocket 通道；命令 CSV 上传
（`/core/commands/upload`）是 multipart 二进制通道，两者都已列入剔除前缀并注明原因。

数据库域（`/databases/*`）已整体列入剔除前缀。数据库实例管理由 DBX 负责，
mypanel 侧只保留「网站绑定数据库」这条链路（`/websites/databases`）。

终端数据流（`/hosts/terminal/local|ssh|container`）与 Toolbox（`/hosts/tool/*`）已显式列入
`manifest.yaml` 的 `excluded_prefixes`，不再算作未映射。`-update-manifest` 现在会保留现有剔除前缀，
避免重新生成 routes 时把人工决策丢掉。

覆盖率工具会把 `:id` 与 `{id}` 视为同一种路径参数（`normalizeRouteKey`），并对未命中任何基线路由的
映射打印警告——此前这种写法差异会让部分映射静默失效，覆盖率被低估。

覆盖率权威命令：`./scripts/check-rpc-coverage.sh`；映射维护在 `master/cmd/rpc-coverage/main.go` 的 `overrides`，
快照 `proto/route-coverage.json` 随映射一起更新。

### 待清理（数据库域）

路由与映射已剔除，但代码仍在，删除时按以下顺序做，避免中途编译不过：

1. 前端：删除 `web/src/views/database/**`，同时移除 `web/src/routers/modules/database.ts` 与侧边栏菜单项；
2. 前端数据层：删除 `web/src/api/modules/database.ts`、`web/src/api/interface/database.ts`，以及 `lib/rpc/index.ts` 里的 `database` 注册；
3. 后端：删除 `proto/panel/agent/v1/database.proto`（连同生成产物）、`master/internal/transport/agent/database.go` 与 `register.go` 中的注册项；
4. 模块内保留 `master/internal/agent/app/api/v2/database*.go` 与 `app/service/database*.go`，直到确认没有其它模块（如应用安装）反向依赖，再单独删除；
5. 跑 `./scripts/gen.sh && ./scripts/check-rpc-coverage.sh`，确认覆盖统计从 343 起不再变化。

### 与原文的偏差

1. **OIDC / SAML 不适用**：当前 1Panel 社区版源码（`v2.5.1`）中没有 `oidc` / `saml2` 的 handler，相关能力位于未开源的 enterprise/xpack 目录。剔除 xpack 后这些端点不存在，白名单中保留路径仅为将来接入 IdP 预留，不能凭空实现。
2. **数据库域剔除**：`/databases/*`（63 条路由）不再迁移。原因是数据库连接与查询能力已由 DBX 提供，重复实现会形成两套连接管理与两套权限模型。当前只做了「路由剔除 + 映射清理」，`panel.agent.v1.DatabaseService` 与其前端页面尚未删除——删除会牵动侧边栏菜单、路由表与 i18n，需要单独一次清理提交（见「待清理」）。
3. **多 API Key 管理不实现**：`/core/auth/api/keys/*`（9 条）依赖 xpack 的 `APIKeyOwnerProvider`；社区版 `authHelper` 未实现该接口，调用会直接返回 `ErrApiConfigStatusInvalid`。只保留 legacy 的生成密钥与配置更新两个接口。
4. **AI service 层未完全删除**：AI 的 API 与路由已删，但 OpenClaw/Ollama 的应用安装与升级钩子仍依赖 `app/service/agents_*.go`、`ai_gateway_*.go` 中的函数。彻底删除需要一并重写应用商店的 AI 应用安装/升级流程，单独提交。
5. **Toolbox 底层能力保留**：`device_clean`、`FTP` 被计划任务与网站模块复用，只删除了 Toolbox 的 API 与路由。
6. **多节点能力不保留**：单进程下固定本地节点，`CurrentNode` 透传已移除。

