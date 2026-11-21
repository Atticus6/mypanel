import { Suspense, useState } from 'react'

import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'

import { rpc } from '#/lib/rpc'

/**
 * `rpc.<method>.useSuspenseQuery` 示例。
 *
 * Suspense 版查询的 data 不是 undefined，可以直接读字段，
 * 但必须在组件树上层有 <Suspense> 边界（见 HelloPanel）。
 */
function HelloSuspense({ name }: { name: string }) {
  const hello = rpc.hello.useSuspenseQuery({ name })

  return (
    <HStack gap={2} vAlign="center">
      <Text type="body">{hello.data.greeting}</Text>
      <Text type="supporting">{hello.data.serverTime}</Text>
    </HStack>
  )
}

/**
 * `rpc.<method>` 三种用法的对比示例：
 * useQuery（需处理加载/错误态）、useSuspenseQuery（无需判空）、useMutation（变更）。
 *
 * 类型全部从 PanelService 推导，这里没有手写任何请求/响应类型。
 */
export function HelloPanel() {
  const [name, setName] = useState('atticus')

  // 普通查询：data 可能为 undefined，需要自己处理加载与错误态。
  const hello = rpc.hello.useQuery({ name })

  // 变更：mutate 的入参即 HelloRequest。
  const [suffix, setSuffix] = useState('')
  const mutation = rpc.hello.useMutation()

  return (
    <Card>
      <VStack gap={4}>
        <VStack gap={1}>
          <Heading level={2}>rpc.hello</Heading>
          <Text type="supporting">
            同一份类型推导，覆盖 useQuery / useSuspenseQuery / useMutation。
          </Text>
        </VStack>

        <TextInput
          label="name"
          value={name}
          onChange={setName}
          description="修改后会触发 useQuery 重新请求。"
        />

        <VStack gap={2}>
          <Text type="label">useQuery</Text>
          {hello.isPending && <Text type="supporting">Loading…</Text>}
          {hello.isError && (
            <Banner
              status="error"
              title="查询失败"
              description={hello.error.message}
            />
          )}
          {hello.data && (
            <HStack gap={2} vAlign="center">
              <Text type="body">{hello.data.greeting}</Text>
              <Text type="supporting">{hello.data.serverTime}</Text>
            </HStack>
          )}
        </VStack>

        <VStack gap={2}>
          <Text type="label">useSuspenseQuery</Text>
          <Suspense fallback={<Text type="supporting">Suspending…</Text>}>
            <HelloSuspense name={name} />
          </Suspense>
        </VStack>

        <VStack gap={2}>
          <Text type="label">useMutation</Text>
          <HStack gap={2} vAlign="end">
            <TextInput
              label="要发送的名字"
              value={suffix}
              onChange={setSuffix}
              onEnter={() => mutation.mutate({ name: suffix })}
            />
            <Button
              label="Mutate"
              variant="primary"
              isLoading={mutation.isPending}
              onClick={() => mutation.mutate({ name: suffix })}
            />
          </HStack>
          {mutation.isError && (
            <Banner
              status="error"
              title="变更失败"
              description={mutation.error.message}
            />
          )}
          {mutation.data && (
            <HStack gap={2} vAlign="center">
              <Text type="body">mutate → {mutation.data.greeting}</Text>
              <Text type="supporting">{mutation.data.serverTime}</Text>
            </HStack>
          )}
        </VStack>
      </VStack>
    </Card>
  )
}
