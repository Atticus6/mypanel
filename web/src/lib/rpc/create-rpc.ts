import {
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryCache,
    type EntryKey,
    type UseInfiniteQueryOptions,
    type UseMutationOptions,
    type UseQueryOptions,
    type UseQueryReturn,
} from '@pinia/colada';
import { createClient, type CallOptions, type Client, type Transport } from '@connectrpc/connect';
import {
    create,
    type DescMessage,
    type DescMethod,
    type DescService,
    type MessageInitShape,
    type MessageShape,
} from '@bufbuild/protobuf';
import { createValidator } from '@bufbuild/protovalidate';

/**
 * 只保留 unary 方法名。
 *
 * 流式方法没有 `useQuery` 语义，类型层直接排除，
 * 误用 `rpc.x.watch.useQuery` 会在编译期报错。
 */
type UnaryMethodKeys<S extends DescService> = {
    [K in keyof S['method']]: S['method'][K]['methodKind'] extends 'unary' ? K : never;
}[keyof S['method']];

/**
 * 服务在注册表里的两种形态：叶子服务或命名空间。
 */
type ServiceLike = DescService | { [key: string]: ServiceLike };

/**
 * 从服务描述符推导出的 rpc 对象。
 */
export type ServiceRpc<S extends DescService> = {
    [M in UnaryMethodKeys<S>]: RpcMethod<S, M>;
};

export type Rpc<T extends Record<string, ServiceLike>> = {
    [K in keyof T]: T[K] extends DescService
        ? ServiceRpc<T[K]>
        : T[K] extends Record<string, ServiceLike>
          ? Rpc<T[K]>
          : never;
};

type InputOf<S extends DescService, M extends keyof S['method']> = MessageInitShape<S['method'][M]['input']>;
type OutputOf<S extends DescService, M extends keyof S['method']> = MessageShape<S['method'][M]['output']>;

/**
 * 单字段校验错误，fieldPath 与 Element Plus 的 form-item prop 对齐。
 */
export interface ViolationItem {
    fieldPath: string;
    ruleId: string;
    message: string;
}

export type ValidateResult = { kind: 'valid' } | { kind: 'invalid'; violations: ViolationItem[]; message: string };

/**
 * 无限查询的分页参数映射。
 *
 * gRPC 没有统一游标字段，由调用方决定游标放在哪个字段。
 */
export type PageMapper<TPageParam> = (pageParam: TPageParam) => Record<string, unknown>;

export interface InfiniteOptions<TData, TPageParam> {
    initialPageParam: TPageParam;
    getNextPageParam: (last: TData) => TPageParam | undefined | null;
    key?: EntryKey;
}

/**
 * 一个 RPC 方法上挂载的全部入口。
 *
 * 这些入口由 `createRpc` 的统一工厂生成，不存在为单个接口手写的包装。
 */
export interface RpcMethod<S extends DescService, M extends UnaryMethodKeys<S>> {
    (input: InputOf<S, M>, options?: CallOptions): Promise<OutputOf<S, M>>;
    key(input: InputOf<S, M>): EntryKey;
    queryOptions(
        input: InputOf<S, M> | (() => InputOf<S, M>),
        options?: Omit<UseQueryOptions<OutputOf<S, M>>, 'key' | 'query'>,
    ): () => UseQueryOptions<OutputOf<S, M>>;
    useQuery(
        input: InputOf<S, M> | (() => InputOf<S, M>),
        options?: Omit<UseQueryOptions<OutputOf<S, M>>, 'key' | 'query'>,
    ): UseQueryReturn<OutputOf<S, M>>;
    useSuspenseQuery(
        input: InputOf<S, M> | (() => InputOf<S, M>),
        options?: Omit<UseQueryOptions<OutputOf<S, M>>, 'key' | 'query'>,
    ): Promise<UseQueryReturn<OutputOf<S, M>>>;
    useInfiniteQuery(
        page: PageMapper<any>,
        options: InfiniteOptions<OutputOf<S, M>, any>,
    ): ReturnType<typeof useInfiniteQuery<OutputOf<S, M>, Error, any>>;
    useMutation(
        options?: Omit<UseMutationOptions<OutputOf<S, M>, InputOf<S, M>>, 'mutation'>,
    ): ReturnType<typeof useMutation<OutputOf<S, M>, InputOf<S, M>>>;
    validate(input: InputOf<S, M>): ValidateResult;
    refresh(input: InputOf<S, M>): Promise<unknown>;
}

const validator = createValidator();

/**
 * 稳定化入参：去掉 undefined、递归排序对象键。
 *
 * query key 参与缓存命中，字段顺序不同但语义相同的入参必须得到同一 key。
 */
export function normalizeInput(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(normalizeInput);
    }
    if (value && typeof value === 'object') {
        if (value instanceof Uint8Array) {
            return Array.from(value);
        }
        const record = value as Record<string, unknown>;
        const sorted: Record<string, unknown> = {};
        for (const key of Object.keys(record).sort()) {
            if (record[key] === undefined) {
                continue;
            }
            sorted[key] = normalizeInput(record[key]);
        }
        return sorted;
    }
    if (typeof value === 'bigint') {
        return value.toString();
    }
    return value;
}

/**
 * 把 protovalidate 的字段路径转成 Element Plus 认识的写法。
 *
 * protovalidate 用 `items[0].port`，Element Plus 用 `items.0.port`。
 */
export function toFormPath(fieldPath: string): string {
    return fieldPath.replace(/\[(\d+)\]/g, '.$1');
}

/**
 * 为单个 unary 方法构造全部入口。
 */
function createMethod<S extends DescService, M extends UnaryMethodKeys<S>>(
    service: S,
    method: M,
    client: Client<S>,
): RpcMethod<S, M> {
    const methodDesc = (service.method as Record<string, DescMethod>)[method as string];
    const inputSchema = methodDesc.input as DescMessage;

    const resolveInput = (input: InputOf<S, M> | (() => InputOf<S, M>)): InputOf<S, M> =>
        typeof input === 'function' ? (input as () => InputOf<S, M>)() : input;

    const key = (input: InputOf<S, M>): EntryKey =>
        [service.typeName, String(method), normalizeInput(input)] as unknown as EntryKey;

    const call = (input: InputOf<S, M>, options?: CallOptions): Promise<OutputOf<S, M>> =>
        (client[method] as unknown as (i: InputOf<S, M>, o?: CallOptions) => Promise<OutputOf<S, M>>)(input, options);

    const queryOptions = (
        input: InputOf<S, M> | (() => InputOf<S, M>),
        options?: Omit<UseQueryOptions<OutputOf<S, M>>, 'key' | 'query'>,
    ) => {
        return (() => ({
            key: key(resolveInput(input)),
            query: () => call(resolveInput(input)),
            ...options,
        })) as unknown as () => UseQueryOptions<OutputOf<S, M>>;
    };

    const validate = (input: InputOf<S, M>): ValidateResult => {
        try {
            const result = validator.validate(inputSchema, create(inputSchema, input as never));
            if (result.kind === 'valid') {
                return { kind: 'valid' };
            }
            const violations = (result.violations ?? []).map((item) => ({
                fieldPath: toFormPath(String(item.field ?? '')),
                ruleId: item.ruleId ?? '',
                message: item.message,
            }));
            return { kind: 'invalid', violations, message: violations[0]?.message ?? '' };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { kind: 'invalid', violations: [], message };
        }
    };

    const entry = Object.assign((input: InputOf<S, M>, options?: CallOptions) => call(input, options), {
        key,
        queryOptions,
        useQuery: (
            input: InputOf<S, M> | (() => InputOf<S, M>),
            options?: Omit<UseQueryOptions<OutputOf<S, M>>, 'key' | 'query'>,
        ) => useQuery(queryOptions(input, options) as never),
        useSuspenseQuery: async (
            input: InputOf<S, M> | (() => InputOf<S, M>),
            options?: Omit<UseQueryOptions<OutputOf<S, M>>, 'key' | 'query'>,
        ) => {
            const query = useQuery(queryOptions(input, options) as never);
            // Colada 没有原生 Suspense：缓存命中直接返回，未命中等待一次请求，
            // 失败时 refresh(true) 会抛错，交给上层 <Suspense> / onErrorCaptured。
            if (query.status.value !== 'success') {
                await query.refresh(true);
            }
            return query;
        },
        useInfiniteQuery: (page: PageMapper<any>, options: InfiniteOptions<OutputOf<S, M>, any>) =>
            useInfiniteQuery({
                key: (options.key ?? [service.typeName, String(method), 'infinite']) as EntryKey,
                initialPageParam: options.initialPageParam,
                getNextPageParam: options.getNextPageParam,
                query: ({ pageParam }) => call(page(pageParam) as InputOf<S, M>),
            } as UseInfiniteQueryOptions<OutputOf<S, M>, Error, any, any>),
        useMutation: (options?: Omit<UseMutationOptions<OutputOf<S, M>, InputOf<S, M>>, 'mutation'>) =>
            useMutation({
                mutation: (input: InputOf<S, M>) => call(input),
                ...options,
            }),
        validate,
        refresh: (input: InputOf<S, M>) => {
            const cache = useQueryCache();
            return cache.invalidateQueries({ key: key(input) });
        },
    });

    return entry as unknown as RpcMethod<S, M>;
}

/**
 * 为单个服务构造 rpc 命名空间。
 */
function createService<S extends DescService>(service: S, transport: Transport): ServiceRpc<S> {
    const client = createClient(service, transport);
    const result: Record<string, unknown> = {};
    for (const method of Object.keys(service.method)) {
        result[method] = createMethod(service, method as UnaryMethodKeys<S>, client);
    }
    return result as ServiceRpc<S>;
}

/**
 * 根据 service 注册表生成 rpc 对象。
 *
 * 注册表只登记 descriptor，不登记方法，也不写 hook：
 * 新增 proto 方法后重新生成即可，前端不需要改代码。
 */
export function createRpc<T extends Record<string, ServiceLike>>(services: T, transport: Transport): Rpc<T> {
    const build = (node: ServiceLike): unknown => {
        if ('typeName' in node && 'method' in node) {
            return createService(node as DescService, transport);
        }
        const result: Record<string, unknown> = {};
        for (const [name, child] of Object.entries(node as Record<string, ServiceLike>)) {
            result[name] = build(child);
        }
        return result;
    };
    return build(services) as Rpc<T>;
}
