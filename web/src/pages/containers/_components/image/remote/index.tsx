import { $t } from '@/utils/i18n-t';
import { TABLE_OVERFLOW_TOOLTIP_OPTIONS } from '@/components/table/shared';
import { type RemoteImage } from '@/api/modules/container';
import { rpc } from '@/lib/rpc';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { showImageProxyRequired, isRuntimeProxyRequired } from '@/utils/image-remote';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    pull: (arg0?: string) => true,
};

const options = {
    name: 'remote',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode } = useGlobalStore();
        const visible = ref(false);
        const loading = ref(false);
        const opening = ref(false);
        const query = ref('');
        const submittedQuery = ref('');
        const page = ref(1);
        const total = ref(0);
        const items = ref<RemoteImage[]>([]);
        let controller: AbortController | undefined;
        let generation = 0;
        const cancelRequest = () => {
            generation++;
            controller?.abort();
            controller = undefined;
            loading.value = false;
            opening.value = false;
        };
        const warnProxy = (node: string) =>
            showImageProxyRequired('container.imageRemoteSearchProxyRequired', () => node === currentNode.value);
        const open = async () => {
            if (opening.value) return;
            cancelRequest();
            const version = generation;
            const node = currentNode.value;
            opening.value = true;
            try {
                if (node === 'local') {
                    const res = await rpc.core.setting.getBaseInfo({});
                    if (version !== generation || node !== currentNode.value) return;
                    if (isRuntimeProxyRequired(res)) {
                        await warnProxy(node);
                        return;
                    }
                }
                visible.value = true;
            } catch {
                // The request interceptor displays errors.
            } finally {
                if (version === generation) opening.value = false;
            }
        };
        const search = async (nextPage = 1, paginate = false) => {
            const keyword = paginate ? submittedQuery.value : query.value.trim();
            if (!keyword || !visible.value) return;
            cancelRequest();
            const version = generation;
            const node = currentNode.value;
            controller = new AbortController();
            loading.value = true;
            if (keyword !== submittedQuery.value) {
                items.value = [];
                total.value = 0;
                page.value = 1;
            }
            try {
                const res = await rpc.container.searchRemoteImages({ query: keyword, page: nextPage, pageSize: 20 });
                if (version !== generation || node !== currentNode.value || !visible.value) return;
                if (res.proxyRequired) {
                    await warnProxy(node);
                    return;
                }
                items.value = res.items as any;
                total.value = Number(res.total);
                page.value = nextPage;
                submittedQuery.value = keyword;
            } catch {
                // The request interceptor displays errors. Keep the last successful page when pagination fails.
            } finally {
                if (version === generation) loading.value = false;
            }
        };
        watch(currentNode, () => {
            cancelRequest();
            visible.value = false;
            query.value = '';
            submittedQuery.value = '';
            items.value = [];
            total.value = 0;
            page.value = 1;
        });
        onBeforeUnmount(cancelRequest);
        ctx.expose({ open });
        return () => (
            <DrawerPro
                v-model={visible.value}
                header={$t('container.imageRemoteSearch')}
                size="large"
                onClose={($event?: any) => {
                    (cancelRequest as any)($event);
                }}
            >
                <ElForm
                    onSubmit={($event?: any) => {
                        $event.preventDefault();
                        search(1);
                    }}
                >
                    <ElFormItem>
                        <ElInput
                            v-model={query.value}
                            maxlength={256}
                            clearable
                            placeholder={$t('commons.button.search')}
                            v-slots={{
                                append: () => (
                                    <>
                                        <ElButton
                                            loading={unref(loading)}
                                            disabled={!unref(query).trim()}
                                            onClick={($event?: any) => {
                                                search(1);
                                            }}
                                        >
                                            {$t('commons.button.search')}
                                        </ElButton>
                                    </>
                                ),
                            }}
                        />
                        <span class={'input-help'}>{$t('container.imageRemoteSearchHelper')}</span>
                    </ElFormItem>
                </ElForm>
                {
                    <ElTable
                        tooltip-options={TABLE_OVERFLOW_TOOLTIP_OPTIONS}
                        data={unref(items)}
                        v-loading={unref(loading)}
                    >
                        <ElTableColumn prop="name" label={$t('container.imageName')} min-width="180" />
                        <ElTableColumn
                            prop="description"
                            label={$t('commons.table.description')}
                            min-width="240"
                            show-overflow-tooltip
                        />
                        <ElTableColumn
                            label={$t('commons.table.operate')}
                            width="90"
                            v-slots={{
                                default: ({ row }) => (
                                    <>
                                        {
                                            <ElButton
                                                link
                                                type="primary"
                                                onClick={($event?: any) => {
                                                    ctx.emit('pull', row.name);
                                                }}
                                                v-permission={true}
                                            >
                                                {$t('container.pull')}
                                            </ElButton>
                                        }
                                    </>
                                ),
                            }}
                        />
                    </ElTable>
                }
                {unref(total) > 0 ? (
                    <ElPagination
                        current-page={unref(page)}
                        page-size={20}
                        total={unref(total)}
                        disabled={unref(loading)}
                        layout="total, prev, pager, next"
                        onCurrentChange={($event?: any) => {
                            search($event, true);
                        }}
                        class={'mt-4'}
                    />
                ) : null}
            </DrawerPro>
        );
    },
    options,
);
