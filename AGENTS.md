# AGENTS.md

本文件是本仓库的协作约定，对人和其他协作方（含 AI 助手）同样适用。
提交代码前请先通读一遍。

npm相关的命令都使用bun 包括bunx

## 外观与主题

Ask me what look and feel this app should have. Run `bunx @astryxdesign/cli theme list`, install the closest theme package, and run `theme add <slug>`; use `--package` when owners share a slug. Import `themes` and `defaultThemeSlug` from the generated module once and pass `themes[defaultThemeSlug]` to `<Theme>`. Customize with `defineTheme({extends: importedTheme, ...})`. Use `theme eject` only when I ask for an independent source fork. Default to neutral if I have no preference, and show me the result before moving on.

## 仓库结构

| 目录 | 作用 |
| --- | --- |
| `proto/` | 独立 Go module `mypanel/proto`，存放 `.proto` 与 buf 配置，**同时**产出 Go 与 TS 代码 |
| `master/` | 控制面：Connect/gRPC 服务端 + 托管 web 前端 |
| `node/` | 数据面 agent（目前为占位） |
| `web/` | 前端，TanStack Router + Vite + React |
| `scripts/` | `gen.sh`（代码生成）、`build.sh`（构建） |

`go.work` 同时包含 `master`、`node`、`proto` 三个 module。**新增 Go module 必须同步加进 `go.work`**，否则 `go build ./...` 找不到它。

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
  internal/panel/          业务实现
  internal/webdist/        前端 embed
```

### 路由层用 gin

**gin 基于 net/http，因此可以保留 h2c 与 gRPC。**
不要换成 Fiber 等基于 fasthttp 的框架——它们不支持 HTTP/2，gRPC 会直接失效。

RPC 处理器作为普通 `http.Handler` 挂进 gin：

```go
panelPath, panelHandler := panelv1connect.NewPanelServiceHandler(svc)
// 必须用通配：生成的是「服务前缀」，内部再按完整 procedure 分发
r.Any(panelPath+"*filepath", gin.WrapH(panelHandler))
```

**踩过的坑**：`r.Any(panelPath, ...)` 是精确匹配，而 `panelPath` 形如
`/panel.v1.PanelService/`，导致所有 RPC 落到 NoRoute。必须加 `*filepath`。
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

## 构建与运行

```bash
./scripts/build.sh                 # 构建前端 → 同步进 embed 目录 → 编译 bin/master
./bin/master -addr :8080           # 生产模式：SPA 与 /rpc 同源
cd web && bun --bun run dev        # 开发模式：:3000，/rpc 代理到 :8080
```

前端产物会被复制到 `master/internal/webdist/dist/` 供 `//go:embed` 使用。
该目录下只有 `.gitkeep` 入库，构建产物被 gitignore —— **不要提交 dist 内容**。
干净 checkout 下 `dist/` 只有占位文件，此时页面会提示 `run ./scripts/build.sh`，API 仍可用。

### 静态资源压缩

master 对文本类静态资源（`.js` / `.css` / `.html` / `.json` / `.svg` / `.map` 等）
按 `Accept-Encoding` 做 gzip，实现在 `spaHandler` / `shouldGzip`。

- 前端产物里 CSS 有 300KB+（Astryx 是全量样式，**没有分组件 CSS，无法按需引入**），
  gzip 后约 50KB，不压缩等于每次冷启动多传 260KB。
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
- **不要在测试里依赖真实时钟或网络**。`panel.Service` 的 `Now` 字段就是为了注入时间。
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
- 只测**纯函数与纯逻辑**。不测 React 组件的渲染细节，不搭 DOM 环境。
  需要测的行为先从组件里抽成纯函数（参考 `src/lib/format.ts`）。
- `#/*` 路径别名在 `bun test` 下可用，直接 import。
- 断言用 `expect`，避免 `toBeTruthy()` 这类模糊断言，写清期望的具体值。
- 不写「跑通就算过」的空测试，也不为了覆盖率造无意义用例。

## UI 组件与主题

界面统一用 **Astryx**（`@astryxdesign/core`，Meta 开源的 React 19 设计系统），
当前主题是 **Neutral**。

### 基本用法

组件按需从各自入口导入，不要从根入口批量导入：

```tsx
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Heading } from '@astryxdesign/core/Heading'
import { VStack } from '@astryxdesign/core/VStack'
import { Text } from '@astryxdesign/core/Text'

<VStack gap={4}>
  <Heading level={2}>标题</Heading>
  <Text type="supporting">说明文字</Text>
  <Button label="保存" variant="primary" />
</VStack>
```

查组件文档用 CLI，不要靠猜 props：

```bash
bunx @astryxdesign/cli component <Name>    # 加 --dense 精简输出
bunx @astryxdesign/cli component           # 列出全部 174 个组件
bunx @astryxdesign/cli docs <topic>        # tokens / color / styling 等
bunx @astryxdesign/cli search <关键词>
```

### 布局

用 `VStack` / `HStack`，不要手写 flex：

- `gap` / `padding` 传**数字字面量**：`gap={4}`，不要 `gap="4"`。
- 交叉轴对齐是 **`vAlign`**（不是 `alignItems`）；主轴是 `hAlign` 或 `justify`。
- 需要拉伸的项用 `StackItem size="fill"`，不要加 margin。

### 排版

- 正文用 `Text`，标题用 `Heading level={1..6}`。**不要用原生 `<p>` / `<h1>`**，
  否则拿不到主题的排版 token。
- `Text` 的样式属性叫 **`type`**（`body` / `label` / `supporting` / `code` …），
  不是 `variant`。
- 提示文字用 `type="supporting"`（自动用次要色）。

### 颜色与间距

一律用 CSS 变量，**不要写死 hex 或 px**：

| 用途 | token |
| --- | --- |
| 页面底色 | `--color-background-body` |
| 卡片底色 | `--color-background-card` |
| 主文字 | `--color-text-primary` |
| 次要文字 | `--color-text-secondary` |
| 边框 | `--color-border` |
| 间距 | `--spacing-1` … `--spacing-12`（`--spacing-4` = 1rem） |

**不要给 CSS 变量加回退值**（如 `var(--color-text-primary, #000)`）。
token 名写错时会静默用错颜色，不如直接不生效来得容易发现。

### 状态提示

- 错误/警告用 `Banner`（`status="error"` + `title` + `description`），不要自己拼红色文字。
- 短标签用 `Badge`，不要用带背景色的 `Text`。

### 主题与全局样式

- 主题由 `src/astryx-themes.ts`（CLI 生成，**不要手改**）提供，
  在 `src/main.tsx` 用 `<Theme theme={themes[defaultThemeSlug]} mode="system">` 包裹。
- `mode="system"` 跟随系统深浅色，Astryx 会把 `data-theme` 同步到 `<html>`。
- 换主题：`bunx @astryxdesign/cli theme add <slug>` 然后改 `defaultThemeSlug`。
- `src/styles.css` 用 `@layer reset, astryx-base, app` 声明层序，
  自己的样式放 `@layer app`，避免覆盖组件样式。

### 关于 StyleX

Astryx 与 StyleX 深度集成，但 **本项目没有启用 StyleX 编译器**，
所以不要用 `xstyle` prop（需要额外构建配置）。布局用 `VStack`/`HStack`，
自定义样式写进 `src/styles.css` 的 `@layer app`。

## 前端 RPC 调用

用 `#/lib/rpc` 导出的 `rpc` 对象，写法类似 tRPC：

```ts
import { rpc } from '#/lib/rpc'

const { data } = rpc.hello.useQuery({ name: 'atticus' })      // data: HelloResponse | undefined
const hello = rpc.hello.useSuspenseQuery({ name: 'atticus' }) // hello.data: HelloResponse
await rpc.hello({ name: 'atticus' })                          // 直接调用
rpc.hello.useMutation().mutate({ name: 'x' })                 // 变更，入参即请求体
```

**不要手写请求/响应类型，也不要为新方法加包装。** 类型由
`createRpc`（`src/lib/rpc-proxy.ts`）从生成的 service 描述符推导，
proto 加方法后 `rpc` 上自动出现，一行模板代码都不用写。

每个 unary 方法上都挂齐了这些入口：

| 入口 | 用途 |
| --- | --- |
| `rpc.<M>(input)` | 直接调用，返回 Promise |
| `rpc.<M>.useQuery(input, opts?)` | 普通查询，`data` 可能为 undefined |
| `rpc.<M>.useSuspenseQuery(input, opts?)` | Suspense 查询，`data` 必定有值 |
| `rpc.<M>.useInfiniteQuery(fn, opts)` | 无限查询 |
| `rpc.<M>.useSuspenseInfiniteQuery(fn, opts)` | Suspense 无限查询 |
| `rpc.<M>.useMutation(opts?)` | 变更，`mutate(input)` 的入参即请求体 |
| `rpc.<M>.queryOptions(input, opts?)` | 供 `useQueries` / `prefetchQuery` 使用 |
| `rpc.<M>.infiniteQueryOptions(fn, opts)` | 无限查询版的 options |

约定：

- 只有 unary 方法出现在 `rpc` 上；流式方法（如 `watch`）不能套 `useQuery`，
  类型层已排除，误用会在编译期报错。流式调用直接用 `panelClient`。
- 默认 `queryKey` 为 `[服务全限定名, 方法名, 入参]`，入参变化会自动重新请求。
  需要自定义时传 `queryKey` 覆盖。
- **无限查询的入参是「pageParam → 请求体」的函数**，不是请求体本身。
  gRPC 没有统一的游标字段名，所以由调用方决定游标放哪个字段：

  ```ts
  rpc.listEvents.useInfiniteQuery((pageToken: string) => ({ pageToken, pageSize: 5 }), {
    initialPageParam: '',
    getNextPageParam: (last) => last.nextPageToken || undefined, // 空值 = 没有下一页
  })
  ```

  由于函数无法参与 key 序列化，无限查询的默认 key 只含服务名与方法名。
  查询依赖外部条件时**必须自行传 `queryKey`**，否则条件变化不会触发重新请求。
- `useQuery` 等 hook 依赖 `QueryClientProvider`，已在 `src/main.tsx` 挂好。
- 用 `useSuspenseQuery` 时记得在组件树上层放 `<Suspense>` 边界
  （参考 `src/components/HelloPanel.tsx`）。

## 其它约定

- 提交前跑一遍：`go vet ./master/... && go test ./master/... && cd web && bunx tsc --noEmit && bun test`。
- 不要提交 `.bin/`、`bin/`、`node_modules/`、`.DS_Store`。
- 日志用 `log/slog` 结构化输出，字段名英文小写。
- 前端与后端同源，**不要引入 CORS 配置**；开发期靠 vite proxy 解决。
