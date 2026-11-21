/**
 * RpcDemo 里与 React 无关的展示逻辑。
 *
 * 抽成纯函数有两个目的：一是组件只负责状态与渲染，二是这些规则能在
 * `bun test` 里直接覆盖，不必搭建 DOM 环境。
 */

/** 事件列表最多保留的条数，超出后丢弃最早的。 */
export const MAX_EVENTS = 20

/** 一条 Watch 事件在界面上展示所需的字段。 */
export type WatchEventLike = {
  seq: bigint
  at: string
  kind: string
}

/**
 * 把新事件插到列表头部并截断到上限。
 *
 * 返回新数组而非原地修改，便于直接喂给 React 的 setState。
 * 最新的排在最前面，用户不用滚动就能看到最新状态。
 */
export function prependEvent<T extends WatchEventLike>(
  events: readonly T[],
  event: T,
  max = MAX_EVENTS,
): T[] {
  if (max <= 0) return []
  return [event, ...events].slice(0, max)
}

/**
 * 把 Ping 响应拼成一行展示文本。
 *
 * 字段可能为空（例如旧版服务端没有 version），空值用 "-" 占位，
 * 避免界面上出现 " ·  · " 这种断裂的分隔符。
 */
export function formatPingResult(res: {
  message: string
  version: string
  serverTime: string
}): string {
  const parts = [res.message, res.version, res.serverTime]
  return parts.map((p) => (p === '' ? '-' : p)).join(' · ')
}

/**
 * 把 Watch 事件拼成一行展示文本。
 *
 * seq 是 int64，在 JS 里是 bigint，必须显式 toString 才能插入字符串。
 */
export function formatEvent(event: WatchEventLike): string {
  return `#${event.seq.toString()} · ${event.kind} · ${event.at}`
}

/**
 * 把事件数量转成界面上的计数文案。
 *
 * 单复数只影响英文单位，这里保留原样以便与既有界面一致。
 */
export function formatEventCount(count: number): string {
  return `${count} event(s)`
}
