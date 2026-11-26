import { $t } from '@/utils/i18n-t';
import { ref } from 'vue';
import { dateFormatSimple } from '@/utils/date';
import { getProvider, getDNSName } from '@/utils/ssl';
import { rpc } from '@/lib/rpc';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElRadioGroup } from 'element-plus';
import { ElRadioButton } from 'element-plus';
import { ElDescriptions } from 'element-plus';
import { ElDescriptionsItem } from 'element-plus';
import { ElTag } from 'element-plus';
import { ElInput } from 'element-plus';
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
        const ssl = ref<any>({});
        const loading = ref(false);
        const handleClose = () => {
            open.value = false;
        };
        const acceptParams = (sslId: number) => {
            ssl.value = {};
            id.value = sslId;
            curr.value = 'detail';
            get();
            open.value = true;
        };
        const get = async () => {
            const res = await rpc.ssl.getByID({ id: id.value });
            ssl.value = res as any;
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
                header={$t('ssl.detail')}
                size="large"
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                v-slots={{
                    content: () => (
                        <>
                            {withDirectives(
                                <div>
                                    <ElRadioGroup
                                        modelValue={unref(curr)}
                                        onUpdate:modelValue={($v) => {
                                            curr.value = $v as any;
                                        }}
                                    >
                                        <ElRadioButton value="detail">{$t('ssl.msg')}</ElRadioButton>
                                        <ElRadioButton value="ssl">{$t('ssl.ssl')}</ElRadioButton>
                                        <ElRadioButton value="key">{$t('ssl.key')}</ElRadioButton>
                                    </ElRadioGroup>
                                    {unref(curr) === 'detail' ? (
                                        <div class={'mt-5'}>
                                            <ElDescriptions border column={1}>
                                                <ElDescriptionsItem label={$t('website.primaryDomain')}>
                                                    {unref(ssl).primaryDomain}
                                                </ElDescriptionsItem>
                                                <ElDescriptionsItem label={$t('website.otherDomains')}>
                                                    {unref(ssl).domains}
                                                </ElDescriptionsItem>
                                                <ElDescriptionsItem label={$t('ssl.commonName')}>
                                                    {unref(ssl).type}
                                                </ElDescriptionsItem>
                                                <ElDescriptionsItem label={$t('website.brand')}>
                                                    {unref(ssl).organization}
                                                </ElDescriptionsItem>
                                                <ElDescriptionsItem label={$t('ssl.startDate')}>
                                                    {dateFormatSimple(unref(ssl).startDate)}
                                                </ElDescriptionsItem>
                                                <ElDescriptionsItem label={$t('website.expireDate')}>
                                                    {dateFormatSimple(unref(ssl).expireDate)}
                                                </ElDescriptionsItem>
                                                <ElDescriptionsItem label={$t('ssl.applyType')}>
                                                    {getProvider(unref(ssl).provider)}
                                                </ElDescriptionsItem>
                                                {unref(ssl).dnsAccount && unref(ssl).dnsAccount.id > 0 ? (
                                                    <ElDescriptionsItem label={$t('website.dnsAccount')}>
                                                        {unref(ssl).dnsAccount.name}
                                                        <ElTag type="info">
                                                            {getDNSName(unref(ssl).dnsAccount.type)}
                                                        </ElTag>
                                                    </ElDescriptionsItem>
                                                ) : null}
                                                {unref(ssl).acmeAccount && unref(ssl).acmeAccount.id > 0 ? (
                                                    <ElDescriptionsItem label={$t('ssl.acmeAccount')}>
                                                        {unref(ssl).acmeAccount.email}
                                                    </ElDescriptionsItem>
                                                ) : null}
                                                {unref(ssl).pushDir ? (
                                                    <ElDescriptionsItem label={$t('ssl.pushDir')}>
                                                        {(unref(ssl).dir.split('\n') || []).map((dir) => (
                                                            <div key={dir}>{dir}</div>
                                                        ))}
                                                    </ElDescriptionsItem>
                                                ) : null}
                                            </ElDescriptions>
                                        </div>
                                    ) : unref(curr) === 'ssl' ? (
                                        <div class={'mt-5'}>
                                            <ElInput
                                                modelValue={unref(ssl).pem}
                                                onUpdate:modelValue={($v) => {
                                                    unref(ssl).pem = $v as any;
                                                }}
                                                rows={15}
                                                type="textarea"
                                                id="textArea"
                                            />
                                            <div>
                                                <br />
                                                <CopyButton content={unref(ssl).pem} isIcon={false} />
                                            </div>
                                        </div>
                                    ) : (
                                        <div class={'mt-5'}>
                                            <ElInput
                                                modelValue={unref(ssl).privateKey}
                                                onUpdate:modelValue={($v) => {
                                                    unref(ssl).privateKey = $v as any;
                                                }}
                                                rows={15}
                                                type="textarea"
                                                id="textArea"
                                            />
                                            <div>
                                                <br />
                                                <CopyButton content={unref(ssl).privateKey} isIcon={false} />
                                            </div>
                                        </div>
                                    )}
                                </div>,
                                [[vLoading, unref(loading)]],
                            )}
                        </>
                    ),
                }}
            />
        );
    },
    options,
);
