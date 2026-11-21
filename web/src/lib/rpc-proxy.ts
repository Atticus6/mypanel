/**
 * 把 Connect 客户端包装成类似 tRPC 的调用形式。
 *
 * 每个 unary 方法上都挂一组 react-query hook，类型全部从生成的 service
 * 描述符推导，**不写任何模板代码**：proto 新增方法后这里一行都不用改。
 *
 * 提供的入口（`<M>` 代表任意 unary 方法）：
 *
 * ```ts
 * await rpc.<M>(input)                     // 直接调用
 * rpc.<M>.useQuery(input, options?)        // 普通查询
 * rpc.<M>.useSuspenseQuery(input, options?)// Suspense 查询
 * rpc.<M>.useInfiniteQuery(fn, options)    // 无限查询
 * rpc.<M>.useSuspenseInfiniteQuery(fn, o)  // Suspense 无限查询
 * rpc.<M>.useMutation(options?)            // 变更
 * rpc.<M>.queryOptions(input, options?)    // 供 useQueries / prefetchQuery 使用
 * rpc.<M>.infiniteQueryOptions(fn, options)// 同上，无限查询版
 * ```
 */

import type {
  DescService,
  MessageInitShape,
  MessageShape,
} from '@bufbuild/protobuf'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
  type InfiniteData,
  type QueryKey,
  type UseInfiniteQueryOptions,
  type UseInfiniteQueryResult,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
  type UseSuspenseInfiniteQueryOptions,
  type UseSuspenseInfiniteQueryResult,
  type UseSuspenseQueryOptions,
  type UseSuspenseQueryResult,
} from '@tanstack/react-query'
import type { CallOptions, Client } from '@connectrpc/connect'

/**
 * 只保留 unary 方法名。
 *
 * 流式方法（server_streaming 等）无法套用查询 hook，因此从 `rpc` 上排除；
 * 访问 `rpc.watch.useQuery` 会在编译期报错。流式调用请直接用 `panelClient`。
 */
type UnaryMethodKeys<Desc extends DescService> = {
  [K in keyof Desc['method']]: Desc['method'][K]['methodKind'] extends 'unary'
    ? K
    : never
}[keyof Desc['method']]

/** 取出某个方法在描述符里的输入/输出消息 schema。 */
type MethodSchemas<Desc extends DescService, K extends keyof Desc['method']> = {
  input: Desc['method'][K]['input']
  output: Desc['method'][K]['output']
}

/** 方法输出消息的类型（即 `data` 的类型）。 */
type OutputOf<Desc extends DescService, K extends keyof Desc['method']> =
  MessageShape<MethodSchemas<Desc, K>['output']>

/** 方法入参类型（proto 的初始化形态，字段大多可选）。 */
type InputOf<Desc extends DescService, K extends keyof Desc['method']> =
  MessageInitShape<MethodSchemas<Desc, K>['input']>

/**
 * queryKey 默认自动生成，因此这里把它改成可选，允许调用方覆盖。
 *
 * 默认 key 为 `[服务全限定名, 方法名, 入参]`，不同服务的同名方法不会冲突，
 * 入参变化时自动重新请求。
 */
type WithOptionalKey<T> = Omit<T, 'queryKey'> & { queryKey?: QueryKey }

/** `useQuery` / `useSuspenseQuery` 的选项：queryFn 由 RPC 调用提供。 */
type QueryOptionsFor<Desc extends DescService, K extends keyof Desc['method']> =
  WithOptionalKey<
    Omit<UseQueryOptions<OutputOf<Desc, K>, Error, OutputOf<Desc, K>>, 'queryFn'>
  >

type SuspenseQueryOptionsFor<
  Desc extends DescService,
  K extends keyof Desc['method'],
> = WithOptionalKey<
  Omit<
    UseSuspenseQueryOptions<OutputOf<Desc, K>, Error, OutputOf<Desc, K>>,
    'queryFn'
  >
>

/** `useInfiniteQuery` 的选项：需要调用方给出 initialPageParam。 */
type InfiniteOptionsFor<
  Desc extends DescService,
  K extends keyof Desc['method'],
  TPageParam,
> = WithOptionalKey<
  Omit<
    UseInfiniteQueryOptions<
      OutputOf<Desc, K>,
      Error,
      InfiniteData<OutputOf<Desc, K>>,
      QueryKey,
      TPageParam
    >,
    'queryFn'
  >
>

type SuspenseInfiniteOptionsFor<
  Desc extends DescService,
  K extends keyof Desc['method'],
  TPageParam,
> = WithOptionalKey<
  Omit<
    UseSuspenseInfiniteQueryOptions<
      OutputOf<Desc, K>,
      Error,
      InfiniteData<OutputOf<Desc, K>>,
      QueryKey,
      TPageParam
    >,
    'queryFn'
  >
>

/** `useMutation` 的选项：mutationFn 由 RPC 调用提供，variables 即入参。 */
type MutationOptionsFor<
  Desc extends DescService,
  K extends keyof Desc['method'],
> = Omit<
  UseMutationOptions<OutputOf<Desc, K>, Error, InputOf<Desc, K>>,
  'mutationFn'
>

/**
 * 无限查询的入参工厂。
 *
 * gRPC 没有统一的游标字段名，所以不猜测分页参数，而是让调用方自己把
 * pageParam 映射成请求体：
 *
 * ```ts
 * rpc.list.useInfiniteQuery((cursor) => ({ pageToken: cursor }), {
 *   initialPageParam: '',
 *   getNextPageParam: (last) => last.nextPageToken || undefined,
 * })
 * ```
 */
type PageInputFactory<Desc extends DescService, K extends keyof Desc['method'], TPageParam> =
  (pageParam: TPageParam) => InputOf<Desc, K>

/** 已解析好的 query options，可直接交给 useQueries / prefetchQuery。 */
type ResolvedQueryOptions<Desc extends DescService, K extends keyof Desc['method']> =
  UseQueryOptions<OutputOf<Desc, K>, Error, OutputOf<Desc, K>, QueryKey>

type ResolvedInfiniteOptions<
  Desc extends DescService,
  K extends keyof Desc['method'],
  TPageParam,
> = UseInfiniteQueryOptions<
  OutputOf<Desc, K>,
  Error,
  InfiniteData<OutputOf<Desc, K>>,
  QueryKey,
  TPageParam
>

/** 单个 unary 方法在 `rpc` 对象上的完整形状。 */
export type RpcMethod<
  Desc extends DescService,
  K extends keyof Desc['method'],
> = {
  /** 直接调用，等价于底层 Connect client 方法。 */
  (request: InputOf<Desc, K>, options?: CallOptions): Promise<OutputOf<Desc, K>>

  /** 普通查询。data 类型为方法输出消息。 */
  useQuery(
    request: InputOf<Desc, K>,
    options?: QueryOptionsFor<Desc, K>,
  ): UseQueryResult<OutputOf<Desc, K>, Error>

  /** Suspense 查询，需在组件树上层有 <Suspense> 边界。 */
  useSuspenseQuery(
    request: InputOf<Desc, K>,
    options?: SuspenseQueryOptionsFor<Desc, K>,
  ): UseSuspenseQueryResult<OutputOf<Desc, K>, Error>

  /**
   * 无限查询。
   *
   * 默认 queryKey 只含服务名与方法名；若查询依赖外部变量（如筛选条件），
   * 请自行传 queryKey，否则条件变化不会触发重新请求。
   */
  useInfiniteQuery<TPageParam = number>(
    input: PageInputFactory<Desc, K, TPageParam>,
    options: InfiniteOptionsFor<Desc, K, TPageParam>,
  ): UseInfiniteQueryResult<InfiniteData<OutputOf<Desc, K>>, Error>

  /** Suspense 版无限查询。 */
  useSuspenseInfiniteQuery<TPageParam = number>(
    input: PageInputFactory<Desc, K, TPageParam>,
    options: SuspenseInfiniteOptionsFor<Desc, K, TPageParam>,
  ): UseSuspenseInfiniteQueryResult<InfiniteData<OutputOf<Desc, K>>, Error>

  /** 变更。`mutate(input)` 的入参即方法请求体。 */
  useMutation(
    options?: MutationOptionsFor<Desc, K>,
  ): UseMutationResult<OutputOf<Desc, K>, Error, InputOf<Desc, K>>

  /** 生成 query options，供 useQueries / prefetchQuery / 路由预加载使用。 */
  queryOptions(
    request: InputOf<Desc, K>,
    options?: QueryOptionsFor<Desc, K>,
  ): ResolvedQueryOptions<Desc, K>

  /** 生成无限查询的 options，用途同上。 */
  infiniteQueryOptions<TPageParam = number>(
    input: PageInputFactory<Desc, K, TPageParam>,
    options: InfiniteOptionsFor<Desc, K, TPageParam>,
  ): ResolvedInfiniteOptions<Desc, K, TPageParam>
}

/** 整个 `rpc` 对象：只暴露 unary 方法。 */
export type Rpc<Desc extends DescService> = {
  [K in UnaryMethodKeys<Desc>]: RpcMethod<Desc, K>
}

/**
 * 内部使用的宽松签名。
 *
 * 真正的类型安全由上面的公开类型保证；实现体用宽类型是为了避免和泛型推导
 * 纠缠——那些断言在运行时并不成立，写出来只会误导读者。
 */
type LooseCall = (request: unknown, options?: CallOptions) => Promise<unknown>
type LooseOptions = Record<string, unknown> & { queryKey?: QueryKey }
type LooseInputFactory = (pageParam: unknown) => unknown

/**
 * 为给定 service 构造 `rpc` 代理。
 *
 * 用 Proxy 而不是在构建期枚举方法名，是为了让运行时与生成代码始终同步：
 * proto 新增方法后无需修改这里，也不会出现「类型有、运行时没有」的错位。
 */
export function createRpc<Desc extends DescService>(
  service: Desc,
  client: Client<Desc>,
): Rpc<Desc> {
  // 缓存每个方法的包装函数：引用稳定，避免每次渲染都新建函数
  // 导致 react-query 的依赖判断失效。
  const cache = new Map<string, unknown>()

  return new Proxy({} as Rpc<Desc>, {
    get(_target, prop) {
      // 排除 symbol 与 then：防止被 Promise.resolve / 序列化探测误判为 thenable。
      if (typeof prop !== 'string' || prop === 'then') return undefined

      const cached = cache.get(prop)
      if (cached !== undefined) return cached

      const method = (client as Record<string, unknown>)[prop]
      if (typeof method !== 'function') return undefined
      const call = method as LooseCall

      const invoke = (request: unknown, options?: CallOptions) =>
        call(request, options)

      /** 普通查询的 options 组装。 */
      const buildQueryOptions = (request: unknown, options?: LooseOptions) => {
        const { queryKey, ...rest } = options ?? {}
        return {
          ...rest,
          queryKey: queryKey ?? [service.typeName, prop, request],
          queryFn: () => call(request),
        }
      }

      /**
       * 无限查询的 options 组装。
       *
       * 入参是函数，无法参与 key 的序列化，因此默认 key 只含服务名与方法名。
       * 依赖外部变量时由调用方显式传 queryKey。
       */
      const buildInfiniteOptions = (
        input: LooseInputFactory,
        options?: LooseOptions,
      ) => {
        const { queryKey, ...rest } = options ?? {}
        return {
          ...rest,
          queryKey: queryKey ?? [service.typeName, prop, 'infinite'],
          queryFn: ({ pageParam }: { pageParam: unknown }) =>
            call(input(pageParam)),
        }
      }

      const wrapped = Object.assign(invoke, {
        useQuery: (request: unknown, options?: LooseOptions) =>
          useQuery(buildQueryOptions(request, options) as never),

        useSuspenseQuery: (request: unknown, options?: LooseOptions) =>
          useSuspenseQuery(buildQueryOptions(request, options) as never),

        useInfiniteQuery: (input: LooseInputFactory, options?: LooseOptions) =>
          useInfiniteQuery(buildInfiniteOptions(input, options) as never),

        useSuspenseInfiniteQuery: (
          input: LooseInputFactory,
          options?: LooseOptions,
        ) =>
          useSuspenseInfiniteQuery(
            buildInfiniteOptions(input, options) as never,
          ),

        useMutation: (options?: LooseOptions) => {
          const { mutationFn: _ignored, ...rest } = options ?? {}
          return useMutation({
            ...rest,
            mutationFn: (variables: unknown) => call(variables),
          } as never)
        },

        queryOptions: buildQueryOptions,
        infiniteQueryOptions: buildInfiniteOptions,
      })

      cache.set(prop, wrapped)
      return wrapped
    },
  })
}
