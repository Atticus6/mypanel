import { createFileRoute } from '@tanstack/react-router'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'

import { EventsInfinite } from '#/components/EventsInfinite'
import { HelloPanel } from '#/components/HelloPanel'
import { RpcDemo } from '#/components/RpcDemo'

/** 首页路由。文件路径即路由路径，TanStack Router 会自动生成路由树。 */
export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <VStack gap={5} paddingBlock={5}>
      <VStack gap={1}>
        <Heading level={1}>控制面板</Heading>
        <Text type="supporting">
          前端通过 Connect 协议与 master 通信；同一个 handler 同时提供 gRPC、
          gRPC-Web 与 Connect。
        </Text>
      </VStack>

      <HelloPanel />
      <EventsInfinite />
      <RpcDemo />
    </VStack>
  )
}
