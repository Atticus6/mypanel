import { createClient, type Client } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'

import { PanelService } from '#/gen/panel/v1/panel_pb'
import { createRpc, type Rpc } from '#/lib/rpc-proxy'

/**
 * Connect 客户端单例。
 *
 * baseUrl 固定为同源的 /rpc：
 *   - 生产环境由 master 同时托管 SPA 与 API，天然同源；
 *   - 开发环境由 vite proxy 把 /rpc 转发到 master（见 vite.config.ts）。
 *
 * 两种情况都不产生跨域请求，所以后端不需要任何 CORS 配置。
 * 也正因为依赖 window.location，这个模块只能在前端运行。
 */
const transport = createConnectTransport({
  baseUrl: `${window.location.origin}/rpc`,
})

/** 全应用共用的 PanelService 客户端（Connect 原始形态）。 */
export const panelClient: Client<typeof PanelService> = createClient(
  PanelService,
  transport,
)

/**
 * 类似 tRPC 的调用入口。
 *
 * 类型全部从 PanelService 描述符推导，新增 proto 方法后这里无需改动：
 *
 * ```ts
 * const { data } = rpc.hello.useQuery({ name: 'atticus' })  // data 推导为 HelloResponse
 * const res = await rpc.hello({ name: 'atticus' })          // res 推导为 HelloResponse
 * ```
 */
export const rpc: Rpc<typeof PanelService> = createRpc(PanelService, panelClient)
