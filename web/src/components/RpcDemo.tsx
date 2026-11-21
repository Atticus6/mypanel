import { useState } from 'react'

import { ConnectError } from '@connectrpc/connect'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'

import {
  formatEvent,
  formatEventCount,
  formatPingResult,
  prependEvent,
  type WatchEventLike,
} from '#/lib/format'
import { panelClient } from '#/lib/rpc'

/** Watch 的推送周期（秒）。目前写死为 1 秒。 */
const WATCH_INTERVAL_SECONDS = 1

/**
 * 流式 RPC 演示：一个 unary 调用（Ping）加一个服务端流（Watch）。
 *
 * 组件只负责状态与渲染，字符串拼接、列表截断等规则都放在 #/lib/format，
 * 这样那些规则能被单元测试直接覆盖。
 *
 * 注意这里用的是 panelClient 而不是 rpc：流式方法不出现在 rpc 上，
 * 因为 useQuery 一类的 hook 无法表达「持续推送」。
 */
export function RpcDemo() {
  // —— Ping 相关状态 ——
  const [message, setMessage] = useState('hello')
  const [pingResult, setPingResult] = useState<string | null>(null)
  const [pingError, setPingError] = useState<string | null>(null)
  const [pinging, setPinging] = useState(false)

  // —— Watch 相关状态 ——
  const [watching, setWatching] = useState(false)
  const [events, setEvents] = useState<WatchEventLike[]>([])
  const [watchError, setWatchError] = useState<string | null>(null)
  const [controller, setController] = useState<AbortController | null>(null)

  async function onPing() {
    setPinging(true)
    setPingError(null)
    try {
      const res = await panelClient.ping({ message })
      setPingResult(formatPingResult(res))
    } catch (err) {
      setPingResult(null)
      setPingError(ConnectError.from(err).rawMessage)
    } finally {
      setPinging(false)
    }
  }

  async function onWatch() {
    // AbortController 既用于停止按钮，也用于组件卸载时终止流。
    const ac = new AbortController()
    setController(ac)
    setWatching(true)
    setWatchError(null)
    setEvents([])
    try {
      const stream = panelClient.watch(
        { intervalSeconds: WATCH_INTERVAL_SECONDS },
        { signal: ac.signal },
      )
      for await (const event of stream) {
        setEvents((prev) => prependEvent(prev, event))
      }
    } catch (err) {
      // 主动 abort 会抛异常，这是预期行为，不该显示成错误。
      if (!ac.signal.aborted) {
        setWatchError(ConnectError.from(err).rawMessage)
      }
    } finally {
      setWatching(false)
      setController(null)
    }
  }

  function onStop() {
    controller?.abort()
  }

  return (
    <Card>
      <VStack gap={4}>
        <VStack gap={1}>
          <Heading level={2}>流式 RPC</Heading>
          <Text type="supporting">
            同一个 handler 同时提供 Connect、gRPC 与 gRPC-Web；流式方法直接用
            panelClient 调用，不走 react-query。
          </Text>
        </VStack>

        <VStack gap={2}>
          <Text type="label">Ping（unary）</Text>
          <HStack gap={2} vAlign="end">
            <TextInput
              label="message"
              value={message}
              onChange={setMessage}
              onEnter={onPing}
            />
            <Button
              label="Ping"
              variant="primary"
              isLoading={pinging}
              onClick={onPing}
            />
          </HStack>
          {pingResult && <Text type="body">Ping: {pingResult}</Text>}
          {pingError && (
            <Banner status="error" title="Ping 失败" description={pingError} />
          )}
        </VStack>

        <VStack gap={2}>
          <Text type="label">Watch（server streaming）</Text>
          <HStack gap={3} vAlign="center">
            <Button
              label={watching ? 'Stop watch' : 'Start watch'}
              variant={watching ? 'destructive' : 'secondary'}
              onClick={watching ? onStop : onWatch}
            />
            <Text type="supporting">{formatEventCount(events.length)}</Text>
          </HStack>
          {watchError && (
            <Banner status="error" title="Watch 失败" description={watchError} />
          )}
          {events.length > 0 && (
            <ol className="event-list">
              {events.map((e) => (
                <li key={e.seq.toString()}>{formatEvent(e)}</li>
              ))}
            </ol>
          )}
        </VStack>
      </VStack>
    </Card>
  )
}
