import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import { toPlainNumbers } from '@/lib/rpc/dashboard';
import { computeSize } from '@/utils/size';
import { dateFormatSimple } from '@/utils/date';
interface InfoProps {
    path: string;
}
import './index.styles.css';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'detail',
    props: {},
    emits: emits,
    __scopeId: 'data-v-b9e3fda8',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const localProps = ref<InfoProps>({
            path: '',
        });
        let open = ref(false);
        let data = ref();
        let loading = ref(false);
        const handleClose = () => {
            open.value = false;
        };
        const acceptParams = async (params: InfoProps): Promise<void> => {
            localProps.value = params;
            rpc.file.getFile({ path: params.path }).then((res) => {
                data.value = toPlainNumbers(res);
                open.value = true;
            });
        };
        const getDirSize = async (row: any) => {
            loading.value = true;
            await rpc.file
                .getSize({ path: row.path })
                .then((res) => {
                    data.value.dirSize = Number(res.size);
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                v-model={open.value}
                header={$t('file.info')}
                size="small"
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
            >
                <ElDescriptions column={1} border>
                    <ElDescriptionsItem label-class-name="detail-label" label={$t('file.fileName')}>
                        {unref(data).name}
                    </ElDescriptionsItem>
                    {unref(data).type != '' ? (
                        <ElDescriptionsItem label-class-name="detail-label" label={$t('commons.table.type')}>
                            {unref(data).type}
                        </ElDescriptionsItem>
                    ) : null}
                    <ElDescriptionsItem
                        class-name="detail-content"
                        label-class-name="detail-label"
                        label={$t('file.path')}
                    >
                        {unref(data).path}
                    </ElDescriptionsItem>
                    <ElDescriptionsItem label-class-name="detail-label" label={$t('file.size')}>
                        {unref(data).isDir ? (
                            <span>
                                <ElButton
                                    type="primary"
                                    link
                                    small
                                    onClick={($event?: any) => {
                                        getDirSize(unref(data));
                                    }}
                                    loading={unref(loading)}
                                >
                                    {unref(data).dirSize == undefined ? (
                                        <span>{$t('file.calculate')}</span>
                                    ) : (
                                        <span>{computeSize(unref(data).dirSize)}</span>
                                    )}
                                </ElButton>
                            </span>
                        ) : (
                            <span>{computeSize(unref(data).size)}</span>
                        )}
                    </ElDescriptionsItem>
                    <ElDescriptionsItem label-class-name="detail-label" label={$t('file.role')}>
                        {unref(data).mode}
                    </ElDescriptionsItem>
                    <ElDescriptionsItem label-class-name="detail-label" label={$t('commons.table.user')}>
                        {unref(data).user ? unref(data).user : '-'}
                        {' ('}
                        {unref(data).uid}
                        {') '}
                    </ElDescriptionsItem>
                    <ElDescriptionsItem label-class-name="detail-label" label={$t('file.group')}>
                        {unref(data).group ? unref(data).group : '-'}
                        {' ('}
                        {unref(data).gid}
                        {') '}
                    </ElDescriptionsItem>
                    <ElDescriptionsItem label-class-name="detail-label" label={$t('commons.table.updatedAt')}>
                        {dateFormatSimple(unref(data).modTime)}
                    </ElDescriptionsItem>
                </ElDescriptions>
            </DrawerPro>
        );
    },
    options,
);
