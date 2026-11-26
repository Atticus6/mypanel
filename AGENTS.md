# AGENTS.md

本文件是本仓库的协作约定，对人和其他协作方（含 AI 助手）同样适用。
提交代码前请先通读一遍。

npm相关的命令都使用bun 包括bunx

## 外观与主题

前端沿用 1Panel 的 **Vue 3 + Element Plus** 外观，主题变量与样式入口在 `web/src/styles/`。
换主题色、Logo、favicon 通过面板设置页完成，不要另起一套设计系统。
页面结构以现有 1Panel 组件为准，新增 UI 优先复用 `web/src/components/` 里的组件。

## 仓库结构

| 目录 | 作用 |
| --- | --- |
| `proto/` | 独立 Go module `mypanel/proto`，存放 `.proto` 与 buf 配置，**同时**产出 Go 与 TS 代码 |
| `master/` | 单进程服务端：Connect/gRPC + 托管 web；`internal/core`、`internal/agent` 为 1Panel 控制面/数据面代码 |
| `node/` | 数据面 agent（目前为占位） |
| `web/` | 前端，Vue 3 + Element Plus + Vite + Pinia Colada |
| `scripts/` | `gen.sh`（代码生成）、`build.sh`（构建） |

`go.work` 同时包含 `master`、`master/internal/core`、`master/internal/agent`、`node`、`proto` 五个 module。**新增 Go module 必须同步加进 `go.work`**，否则 `go build ./...` 找不到它。

`master/internal/core`（`mypanel/core`）与 `master/internal/agent`（`mypanel/agent`）保持独立 module，
但共享同一个 SQLite 连接（`mypanel/shareddb`）；迁移表按模块命名，业务表共用。
它们之间**不允许互相 import**，只通过 `shareddb` 与进程内 HTTP server 协作。

## 注释规范

**代码注释一律用中文**，标识符、日志字段名、错误字符串保持英文。

- 导出符号（包、类型、函数、常量）必须有注释，说明**用途与约束**，而不是复述函数名。
  不要写 `// Ping 执行 Ping`，要写清楚它做什么、有什么副作用或前置条件。
- 导出的包必须写包注释，一句话说清这个包负责什么。
- 注释解释「为什么」，不复述「是什么」。能自解释的代码不加注释。
- 关键决策要留下原因。例如「为什么挂载两次」「为什么必须暴露 Flush」这类反直觉处，
  必须写清来龙去脉，否则后人会当成冗余代码删掉。
- 中英文之间留空格，标点用中文标点。
- 注释随代码一起改。过期的注释比没有注释更糟。

## 代码生成

`proto/` 是唯一的事实来源，**不要手改生成产物**：

- `proto/gen/go/**` — Go 消息类型与 Connect handler
- `web/src/gen/**` — TS 消息类型与服务描述符

生成产物**提交入库**，这样 clone 后无需装 protoc 插件即可编译。
改完 `.proto` 后执行：

```bash
./scripts/gen.sh
```

该脚本把 `protoc-gen-go`、`protoc-gen-connect-go` 装进 `.bin/`（已 gitignore）并固定版本，
避免受全局 GOBIN 里旧版插件影响；`protoc-gen-es` 来自 `web/node_modules`。

注意：Connect-ES **v2 已移除 `protoc-gen-connect-es`**，服务描述符由 `protoc-gen-es` 直接生成到 `*_pb.ts`。
不要再往 `buf.gen.yaml` 里加那个插件。

## 后端结构（master）

```
master/
  main.go                  只做：解析参数 → 调 InitApp → 等信号
  internal/app/            wire 依赖图（app.go）+ 注入点（wire.go）
    wire_gen.go            wire 生成，勿手改
  internal/server/         gin 路由 + SPA/gzip
  internal/bootstrap/      单进程初始化 core/agent
  internal/transport/      Connect adapter、拦截器、策略
  internal/core/           1Panel 控制面（独立 module mypanel/core）
  internal/agent/          1Panel 数据面（独立 module mypanel/agent）
  internal/webdist/        前端 embed
```

### 路由层用 gin

**gin 基于 net/http，因此可以保留 h2c 与 gRPC。**
不要换成 Fiber 等基于 fasthttp 的框架——它们不支持 HTTP/2，gRPC 会直接失效。

RPC 处理器作为普通 `http.Handler` 挂进 gin：

```go
authPath, authHandler := corev1connect.NewAuthServiceHandler(authServer, handlerOpts...)
// 必须用通配：生成的是「服务前缀」，内部再按完整 procedure 分发
r.Any(authPath+"*filepath", gin.WrapH(authHandler))
```

**踩过的坑**：`r.Any(panelPath, ...)` 是精确匹配，而 `panelPath` 形如
`/panel.core.v1.AuthService/`，导致所有 RPC 落到 NoRoute。必须加 `*filepath`。
reflection 的路径同理。

日志用自定义 slog 中间件，不用 `gin.Logger()`（它输出带 ANSI 的文本，
与结构化日志不一致）。

### wire 依赖注入

改依赖关系时只动 `internal/app/app.go` 的 `ProviderSet`，
然后重新生成：

```bash
./scripts/gen-wire.sh
```

- `wire.go` 带 `//go:build wireinject` 标签，只在运行 wire 时编译。
- `wire_gen.go` **提交入库**，保证 clone 后无需装 wire 即可编译。
- 需要把 `Config` 的字段喂给构造函数时，写一个 `provideXxx(cfg Config)` 适配函数，
  不要让下层包反向依赖 `Config`。
- 测试里可以直接调 `InitApp` 验证依赖图（见 `internal/app/app_test.go`），
  比逐个构造函数断言更能发现「装配错了」。

### 配置（viper）

配置包在 `master/internal/config`，用 viper 读环境变量与 YAML。

**优先级（高到低）：**

```
命令行参数 > 环境变量 > config.local.yaml > config.yaml > 内置默认值
```

**环境变量**统一带 `MYPANEL_` 前缀，键名用下划线：

| 配置项 | 环境变量 | 默认值 |
| --- | --- | --- |
| `addr` | `MYPANEL_ADDR` | `:8080` |
| `web_dir` | `MYPANEL_WEB_DIR` | 空（用内置前端） |
| `debug` | `MYPANEL_DEBUG` | `false` |
| `shutdown_timeout` | `MYPANEL_SHUTDOWN_TIMEOUT` | `5s` |
| `data_dir` | `MYPANEL_DATA_DIR` | `./data` |
| `admin_user` | `MYPANEL_ADMIN_USER` | `admin` |
| `admin_password` | `MYPANEL_ADMIN_PASSWORD` | 空（随机生成并打印一次） |
| `release_api_url` | `MYPANEL_RELEASE_API_URL` | 本项目 GitHub Release 列表接口 |

**YAML 文件**：`config.yaml` 入库作为默认值；个人改动写 `config.local.yaml`
（已 gitignore，只在同目录存在时自动叠一层）。查找顺序是
`.` → `./config` → `/etc/mypanel`，也可以用 `-config <path>` 显式指定。

注意事项：

- **新增配置项要改三处**：`config.go` 的 `defaults` map、`Config` 结构体、
  以及上面这张表。
- `AutomaticEnv` 必须配 `SetEnvKeyReplacer`，否则 `MYPANEL_WEB_DIR`
  这类下划线变量永远读不到。
- 时长用 `GetString` + `time.ParseDuration` 解析，不要用 `GetDuration`——
  后者对非法值静默返回 0，会导致「配错了却按 0 超时运行」。
- 显式指定的 `-config` 路径不存在时**必须报错**，不能静默回退默认值，
  否则部署错误会被掩盖。
- 配置文件存在但解析失败也要报错，理由同上。

## 构建与运行

```bash
./scripts/build.sh                 # 构建前端 → 同步进 embed 目录 → 编译 bin/master
./bin/master -addr :8080           # 生产模式：SPA 与 /rpc 同源
cd web && bun --bun run dev        # 开发模式：:4004，/rpc、/api/v2 代理到 :8080
```

前端产物会被复制到 `master/internal/webdist/dist/` 供 `//go:embed` 使用。
该目录下只有 `.gitkeep` 入库，构建产物被 gitignore —— **不要提交 dist 内容**。
干净 checkout 下 `dist/` 只有占位文件，此时页面会提示 `run ./scripts/build.sh`，API 仍可用。

### 静态资源压缩

master 对文本类静态资源（`.js` / `.css` / `.html` / `.json` / `.svg` / `.map` 等）
按 `Accept-Encoding` 做 gzip，实现在 `spaHandler` / `shouldGzip`。

- 前端产物里 CSS 有数百 KB（Element Plus 全量样式 + 业务样式），
  gzip 后能压到几十 KB，不压缩等于每次冷启动多传几百 KB。
- 图片、字体、视频不压缩——它们本身已是压缩格式。
- Range 请求不压缩（与整体压缩语义冲突）。

改动这段代码时注意：压缩路径**绕过了 `http.FileServer`**，所以必须自己设置
`Content-Type`。浏览器对 ES module 强制要求 JS MIME 类型，缺失会导致脚本被拒绝
执行、页面白屏且无明确报错。`TestGzipSetsCorrectContentType` 守着这条。

## 测试规范

**改代码就要带测试。** 新增或修改逻辑时，同步补上覆盖该逻辑的测试。

### Go（`master/`、`proto/`）

```bash
go test ./master/...      # 在仓库根目录执行
go vet ./master/...
gofmt -l master           # 必须无输出
```

- 测试与源码同包（`package server`），文件名 `*_test.go`。
- 表驱动优先；用例名用中文描述场景。
- **不要在测试里依赖真实时钟或网络**。时间相关逻辑用可注入的时钟或固定时间戳。
- 需要 HTTP 层时用 `net/http/httptest` + `fstest.MapFS`，不要起真实端口。
- 流式 RPC（`Watch`）的 `connect.ServerStream` 没有导出构造器，
  只能通过 `httptest.NewServer` + 生成的 client 做端到端测试，或把纯逻辑抽成函数单独测。
  优先选择后者。

### web（`web/`）

使用 **`bun:test`**，只写测试函数，不引入额外测试框架。

```bash
cd web && bun test        # 或 bun run test
```

- 文件名 `*.test.ts`，放在被测文件同目录。
- 只测**纯函数与纯逻辑**。不测 Vue 组件的渲染细节，不搭 DOM 环境。
  需要测的行为先从组件里抽成纯函数（参考 `src/lib/rpc/create-rpc.ts`）。
- `@/*` 路径别名在 `bun test` 下可用（见 `tsconfig.json`）。
- `bun test` 不经过 Vite 的自动导入，被测源码里用到的 Vue / Element Plus API 要保留显式 `import`。
- 断言用 `expect`，避免 `toBeTruthy()` 这类模糊断言，写清期望的具体值。
- 不写「跑通就算过」的空测试，也不为了覆盖率造无意义用例。

## UI 组件与主题

界面统一用 **Element Plus**（`element-plus`），图标用 `@element-plus/icons-vue`，
页面语言用 `vue-i18n`（`web/src/lang/`）。

约定：

- 组件按需自动导入：`unplugin-vue-components` + `unplugin-auto-import` 已在 `vite.config.ts` 配好，
  `ref` / `reactive` / `onMounted` 等无需手写 import；类型由 `web/src/types/auto-imports.d.ts` 提供。
- 布局用 Element Plus 的栅格与 `LayoutContent` 等既有容器，不要手写一套新的布局体系。
- 颜色、间距优先用 `web/src/styles/` 里的变量与工具类；不要把颜色写死在新页面里。
- 提示与错误用 `MsgSuccess` / `MsgError`（`@/utils/message`），不要自己拼弹窗。
- 空状态、加载态复用 1Panel 现有组件（`components/` 下），保持交互一致。

## 前端 RPC 调用

数据层统一走 `@/lib/rpc` 暴露的 `rpc` 对象，风格类似 tRPC：

```ts
import { rpc } from '@/lib/rpc'

const { data, isLoading } = rpc.website.search.useQuery({ page: 1, pageSize: 20 })
const detail = await rpc.website.get.useSuspenseQuery({ id: 1 })   // 需要 await
const { mutateAsync } = rpc.website.delete.useMutation()
const website = await rpc.website.get({ id: 1 })                   // 直接调用
```

要点：

- **`rpc` 由生成的 service descriptor 推导，禁止手写包装。**
  `web/src/lib/rpc/index.ts` 只登记 descriptor；方法名、入参/出参类型、
  `useQuery` / `useMutation` / `useInfiniteQuery` / `validate` 全部由 `createRpc` 泛型生成。
  新增 proto 方法后重新 `./scripts/gen.sh` 即可使用，不要新增 `useXxxQuery` 文件。
- 查询用 Pinia Colada：`useQuery` / `useSuspenseQuery` / `useMutation` / `useInfiniteQuery`。
  不要引入 TanStack Query，也不要在页面里直接写 `fetch('/rpc/...')`。
- `useSuspenseQuery` 在 Vue 里是异步 composable，**必须 `await`**，
  并配合外层 `<Suspense>` 或 `onErrorCaptured` 处理失败。
- 变更后按 key 失效缓存：
  ```ts
  const cache = useQueryCache()
  await cache.invalidateQueries({ key: rpc.website.search.key({ page: 1 }) })
  ```
- 表单提交前可以先用同一套 proto 规则校验：
  ```ts
  const result = rpc.website.create.validate(form)
  if (result.kind !== 'invalid') { /* 通过 */ }
  ```
  失败时按 `result.violations[].fieldPath` 调用 `formRef.setFieldError`。
- 类型直接从 `@/gen/...` 导入，不再维护 `api/interface`；迁移期间旧类型可以暂时保留，
  但新代码不要新增手写 DTO。
- 流式与文件传输是例外：容器日志用 server-stream 异步迭代，终端用 WebSocket，
  大文件走 `/files/*` 二进制通道。

## 其它约定

- 提交前跑一遍：`go vet ./master/... && go test ./master/... && gofmt -l master && cd web && bun run type-check && bun run fmt:check && bun test && bun run build`。
- 不要提交 `.bin/`、`bin/`、`node_modules/`、`.DS_Store`。
- 日志用 `log/slog` 结构化输出，字段名英文小写。
- 前端与后端同源，**不要引入 CORS 配置**；开发期靠 vite proxy 解决。
