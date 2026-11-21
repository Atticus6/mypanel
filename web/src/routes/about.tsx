import { createFileRoute } from '@tanstack/react-router'
import { Card } from '@astryxdesign/core/Card'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'

export const Route = createFileRoute('/about')({ component: About })

function About() {
  return (
    <VStack gap={5} paddingBlock={5}>
      <VStack gap={1}>
        <Heading level={1}>关于</Heading>
        <Text type="supporting">
          本页定义在 src/routes/about.tsx；TanStack Router 会根据 src/routes
          下的文件自动生成路由树。
        </Text>
      </VStack>

      <Card>
        <VStack gap={3}>
          <Heading level={2}>技术栈</Heading>
          <Text type="body">
            后端 Go + connect-go（一个 handler 同时支持 Connect / gRPC /
            gRPC-Web），前端 React 19 + TanStack Router + TanStack Query，
            界面组件来自 Astryx 设计系统，主题为 Neutral。
          </Text>
        </VStack>
      </Card>
    </VStack>
  )
}
