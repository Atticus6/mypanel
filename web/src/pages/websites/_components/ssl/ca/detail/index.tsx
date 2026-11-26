import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import DrawerPro from '@/components/drawer-pro/index';
import CopyButton from '@/components/copy-button/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'detail',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const open = ref(false);
        const id = ref(0);
        const curr = ref('detail');
        const ca = ref<any>({});
        const loading = ref(false);
        const handleClose = () => {
            open.value = false;
        };
        const acceptParams = (caID: number) => {
            ca.value = {};
            id.value = caID;
            curr.value = 'detail';
            get();
            open.value = true;
        };
        const get = async () => {
            ca.value = await rpc.ssl.getCA({ id: id.value });
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                v-model={open.value}
                header={$t('ssl.organizationDetail')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="normal"
            >
                {
                    <div v-loading={unref(loading)}>
                        <ElRadioGroup v-model={curr.value}>
                            <ElRadioButton value="detail">{$t('ssl.organizationDetail')}</ElRadioButton>
                            <ElRadioButton value="ssl">{$t('ssl.ssl')}</ElRadioButton>
                            <ElRadioButton value="key">{$t('ssl.key')}</ElRadioButton>
                        </ElRadioGroup>
                        {unref(curr) === 'detail' ? (
                            <div class={'mt-5'}>
                                <ElDescriptions border column={1}>
                                    <ElDescriptionsItem label={$t('commons.table.name')}>
                                        {unref(ca).name}
                                    </ElDescriptionsItem>
                                    <ElDescriptionsItem label={$t('ssl.commonName')}>
                                        {unref(ca).commonName}
                                    </ElDescriptionsItem>
                                    <ElDescriptionsItem label={$t('website.brand')}>
                                        {unref(ca).organization}
                                    </ElDescriptionsItem>
                                    <ElDescriptionsItem label={$t('ssl.department')}>
                                        {unref(ca).organizationUint}
                                    </ElDescriptionsItem>
                                    <ElDescriptionsItem label={$t('ssl.country')}>
                                        {unref(ca).country}
                                    </ElDescriptionsItem>
                                    <ElDescriptionsItem label={$t('ssl.province')}>
                                        {unref(ca).province}
                                    </ElDescriptionsItem>
                                    <ElDescriptionsItem label={$t('ssl.city')}>{unref(ca).city}</ElDescriptionsItem>
                                </ElDescriptions>
                            </div>
                        ) : unref(curr) === 'ssl' ? (
                            <div class={'mt-5'}>
                                <ElInput v-model={unref(ca).csr} rows={15} type="textarea" id="textArea" />
                                <div>
                                    <br />
                                    <CopyButton content={unref(ca).csr} isIcon={false} />
                                </div>
                            </div>
                        ) : (
                            <div class={'mt-5'}>
                                <ElInput v-model={unref(ca).privateKey} rows={15} type="textarea" id="textArea" />
                                <div>
                                    <br />
                                    <CopyButton content={unref(ca).privateKey} isIcon={false} />
                                </div>
                            </div>
                        )}
                    </div>
                }
            </DrawerPro>
        );
    },
    options,
);
