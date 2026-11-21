import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'

import { rpc } from '#/lib/rpc'

/** 每页拉取的条数。 */
const PAGE_SIZE = 5

/**
 * `rpc.<method>.useInfiniteQuery` 示例。
 *
 * 关键点：gRPC 没有统一的游标字段名，所以入参不是「请求体」而是一个
 * 「pageParam -> 请求体」的映射函数，由调用方决定游标放在哪个字段。
 *
 * 默认 queryKey 只含服务名与方法名（函数无法参与序列化），因此当查询
 * 依赖外部条件时，务必自行传 queryKey。
 */
export function EventsInfinite() {
  const query = rpc.listEvents.useInfiniteQuery(
    // 把 pageParam 映射成请求体：游标放在 pageToken 字段。
    (pageToken: string) => ({ pageToken, pageSize: PAGE_SIZE }),
    {
      initialPageParam: '',
      // 返回 undefined 表示没有下一页，useInfiniteQuery 会据此停止。
      getNextPageParam: (last) => last.nextPageToken || undefined,
    },
  )

  // data.pages 是各页结果的数组，每页类型都是 ListEventsResponse。
  const events = query.data?.pages.flatMap((page) => page.events) ?? []

  return (
    <Card>
      <VStack gap={4}>
        <VStack gap={1}>
          <Heading level={2}>rpc.listEvents.useInfiniteQuery</Heading>
          <Text type="supporting">
            游标分页；getNextPageParam 返回空值即表示已到末页。
          </Text>
        </VStack>

        {query.isPending && <Text type="supporting">Loading…</Text>}
        {query.isError && (
          <Banner
            status="error"
            title="加载失败"
            description={query.error.message}
          />
        )}

        {events.length > 0 && (
          <ol className="event-list">
            {events.map((e) => (
              <li key={e.seq.toString()}>
                #{e.seq.toString()} · {e.kind}
              </li>
            ))}
          </ol>
        )}

        <HStack gap={3} vAlign="center">
          <Button
            label={
              query.isFetchingNextPage
                ? 'Loading more…'
                : query.hasNextPage
                  ? 'Load more'
                  : 'No more pages'
            }
            variant="secondary"
            isLoading={query.isFetchingNextPage}
            isDisabled={!query.hasNextPage}
            onClick={() => query.fetchNextPage()}
          />
          <Text type="supporting">{events.length} 条</Text>
        </HStack>
      </VStack>
    </Card>
  )
}
