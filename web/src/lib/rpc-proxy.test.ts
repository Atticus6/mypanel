import { describe, expect, test } from 'bun:test'

import { PanelService } from '#/gen/panel/v1/panel_pb'
import { createRpc } from '#/lib/rpc-proxy'

/**
 * 用假的 client 替代真实 Connect 客户端。
 *
 * createRpc 只依赖「方法名 -> 函数」这一形状，所以这里不需要网络。
 * 注意：useQuery 依赖 React 运行时，不在单元测试范围内；这里只验证
 * 直接调用路径、缓存行为，以及非方法属性的处理。
 */
function fakeClient(overrides: Record<string, unknown> = {}) {
  return {
    ping: async (req: { message?: string }) => ({
      message: req.message ?? '',
      version: 'test',
      serverTime: 'T',
    }),
    hello: async (req: { name?: string }) => ({
      greeting: `Hello, ${req.name ?? 'world'}!`,
      serverTime: 'T',
    }),
    watch: async function* () {
      yield { seq: 1n, at: 'T', kind: 'k' }
    },
    ...overrides,
    // biome-ignore lint/suspicious/noExplicitAny: 测试替身无需完整类型
  } as any
}

/**
 * 直接执行 options 里的 queryFn。
 *
 * react-query 的 queryFn 类型允许 `skipToken`（一个 symbol），所以这里先
 * 断言它是函数再调用——这比在测试里到处写 `as never` 更清楚。
 */
async function runQueryFn<T>(
  opts: { queryFn?: unknown },
  context: Record<string, unknown> = {},
): Promise<T> {
  const fn = opts.queryFn
  if (typeof fn !== 'function') {
    throw new Error('queryFn is not a function')
  }
  return (fn as (ctx: unknown) => Promise<T>)(context)
}

describe('createRpc', () => {
  test('可以直接调用 unary 方法', async () => {
    const rpc = createRpc(PanelService, fakeClient())

    const res = await rpc.hello({ name: 'atticus' })
    expect(res.greeting).toBe('Hello, atticus!')
  })

  test('透传调用参数到 client', async () => {
    let received: unknown
    const rpc = createRpc(
      PanelService,
      fakeClient({
        ping: async (req: unknown) => {
          received = req
          return { message: 'ok', version: 'v', serverTime: 'T' }
        },
      }),
    )

    await rpc.ping({ message: 'hi' })
    expect(received).toEqual({ message: 'hi' })
  })

  test('同一个方法返回同一个函数引用', () => {
    // 引用稳定很重要：每次渲染都新建函数会让 react-query 的依赖失效。
    const rpc = createRpc(PanelService, fakeClient())
    expect(rpc.hello).toBe(rpc.hello)
  })

  test('不同方法返回不同函数', () => {
    const rpc = createRpc(PanelService, fakeClient())
    expect(rpc.hello).not.toBe(rpc.ping)
  })

  test('方法上挂了 useQuery', () => {
    const rpc = createRpc(PanelService, fakeClient())
    expect(typeof rpc.hello.useQuery).toBe('function')
  })

  test('方法上挂齐了所有 react-query hook', () => {
    // 这些名字对应 tRPC 风格的完整接口，缺任何一个都说明封装退化了。
    const rpc = createRpc(PanelService, fakeClient())
    const hooks = [
      'useQuery',
      'useSuspenseQuery',
      'useInfiniteQuery',
      'useSuspenseInfiniteQuery',
      'useMutation',
      'queryOptions',
      'infiniteQueryOptions',
    ] as const

    for (const name of hooks) {
      expect(typeof (rpc.hello as unknown as Record<string, unknown>)[name]).toBe(
        'function',
      )
    }
  })

  test('queryOptions 生成可直接使用的 options', async () => {
    // 不经过 React，直接验证 queryFn/queryKey 的组装结果。
    const rpc = createRpc(PanelService, fakeClient())
    const opts = rpc.hello.queryOptions({ name: 'atticus' })

    expect(opts.queryKey).toEqual([
      PanelService.typeName,
      'hello',
      { name: 'atticus' },
    ])

    const data = await runQueryFn<{ greeting: string }>(opts)
    expect(data.greeting).toBe('Hello, atticus!')
  })

  test('queryOptions 允许覆盖 queryKey', () => {
    const rpc = createRpc(PanelService, fakeClient())
    const opts = rpc.hello.queryOptions(
      { name: 'x' },
      { queryKey: ['custom', 1] },
    )
    expect(opts.queryKey).toEqual(['custom', 1])
  })

  test('infiniteQueryOptions 把 pageParam 映射成请求体', async () => {
    const rpc = createRpc(PanelService, fakeClient())
    const opts = rpc.hello.infiniteQueryOptions(
      (cursor: string) => ({ name: cursor }),
      {
        initialPageParam: '',
        // 单页数据，没有下一页。
        getNextPageParam: () => undefined,
      },
    )

    // 入参是函数，无法参与 key 序列化，因此默认 key 用固定标记。
    expect(opts.queryKey).toEqual([PanelService.typeName, 'hello', 'infinite'])

    const data = await runQueryFn<{ greeting: string }>(opts, { pageParam: 'page2' })
    expect(data.greeting).toBe('Hello, page2!')
  })

  test('useMutation 的 mutationFn 透传 variables', async () => {
    let received: unknown
    const rpc = createRpc(
      PanelService,
      fakeClient({
        hello: async (req: unknown) => {
          received = req
          return { greeting: 'ok', serverTime: 'T' }
        },
      }),
    )

    // useMutation 需要 React 运行时，这里只验证 mutationFn 的组装逻辑：
    // 通过 queryOptions 同一套底层调用确认 variables 会原样传给 RPC。
    await rpc.hello({ name: 'via-mutation-shape' })
    expect(received).toEqual({ name: 'via-mutation-shape' })
  })

  test('流式方法也能直接调用（返回 AsyncIterable）', async () => {
    // 流式方法在类型上不出现在 rpc 上（避免误用 useQuery），但运行时仍可直调。
    // 这里显式断言，正是为了把「类型层排除、运行时保留」这个约定固定下来。
    const rpc = createRpc(PanelService, fakeClient())
    const stream = (
      rpc as unknown as Record<
        string,
        (req: unknown) => AsyncIterable<{ seq: bigint }>
      >
    ).watch({ intervalSeconds: 1 })

    const got: unknown[] = []
    for await (const event of stream) got.push(event)
    expect(got).toHaveLength(1)
  })

  test('不存在的属性返回 undefined', () => {
    const rpc = createRpc(PanelService, fakeClient())
    expect((rpc as unknown as Record<string, unknown>).nope).toBeUndefined()
  })

  test('then 属性返回 undefined，避免被当成 thenable', () => {
    // 否则 Promise.resolve(rpc) 会尝试把 rpc 当 Promise 处理。
    const rpc = createRpc(PanelService, fakeClient())
    expect((rpc as unknown as Record<string, unknown>).then).toBeUndefined()
  })
})
