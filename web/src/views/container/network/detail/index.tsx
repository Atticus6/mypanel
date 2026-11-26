import { $t } from '@/utils/i18n-t';
import { ref, computed } from 'vue';
import CodemirrorPro from '@/components/codemirror-pro/index';
import { copyText } from '@/utils/clipboard';
interface DialogProps {
    data: any;
}
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElTabs } from 'element-plus';
import { ElTabPane } from 'element-plus';
import { ElDescriptions } from 'element-plus';
import { ElDescriptionsItem } from 'element-plus';
import { ElText } from 'element-plus';
import { ElTag } from 'element-plus';
import { ElTable } from 'element-plus';
import { ElTableColumn } from 'element-plus';
import { ElButton } from 'element-plus';
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
    __scopeId: 'data-v-483f409b',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const visible = ref(false);
        const activeTab = ref('overview');
        const networkData = ref<any>(null);
        const rawJson = ref('');
        const acceptParams = (__panelSetupProps: DialogProps): void => {
            visible.value = true;
            activeTab.value = 'overview';

            try {
                if (typeof __panelSetupProps.data === 'string') {
                    networkData.value = JSON.parse(__panelSetupProps.data);
                } else {
                    networkData.value = __panelSetupProps.data;
                }
                rawJson.value = JSON.stringify(networkData.value, null, 2);
            } catch (e) {
                console.error('Failed to parse network data:', e);
            }
        };
        const handleClose = () => {
            visible.value = false;
            networkData.value = null;
            rawJson.value = '';
        };
        const formatDate = (dateStr: string): string => {
            if (!dateStr || dateStr === '0001-01-01T00:00:00Z') {
                return '-';
            }
            try {
                const date = new Date(dateStr);
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const d = String(date.getDate()).padStart(2, '0');
                const h = String(date.getHours()).padStart(2, '0');
                const minute = String(date.getMinutes()).padStart(2, '0');
                const second = String(date.getSeconds()).padStart(2, '0');
                return `${y}-${m}-${d} ${h}:${minute}:${second}`;
            } catch {
                return dateStr;
            }
        };
        const containerList = computed(() => {
            if (!networkData.value?.Containers) {
                return [];
            }

            return Object.entries(networkData.value.Containers).map(([id, container]: [string, any]) => ({
                id,
                name: container.Name || '-',
                ipv4: container.IPv4Address || '',
                ipv6: container.IPv6Address || '',
                mac: container.MacAddress || '',
                endpointId: container.EndpointID || '',
            }));
        });
        const handleCopyRawJson = () => {
            copyText(rawJson.value);
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                modelValue={unref(visible)}
                onUpdate:modelValue={($v) => {
                    visible.value = $v as any;
                }}
                header={$t('commons.button.view')}
                size="large"
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        visible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            >
                <ElTabs
                    modelValue={unref(activeTab)}
                    onUpdate:modelValue={($v) => {
                        activeTab.value = $v as any;
                    }}
                    type="border-card"
                >
                    <ElTabPane label={$t('container.network')} name="overview">
                        <ElDescriptions column={1} border title={$t('home.baseInfo')}>
                            <ElDescriptionsItem label={$t('commons.table.name')}>
                                <ElText>{unref(networkData)?.Name || '-'}</ElText>
                                <CopyButton content={unref(networkData)?.Name || ''} />
                            </ElDescriptionsItem>
                            <ElDescriptionsItem label="ID">
                                <ElText class={'text-xs'}>{unref(networkData)?.Id?.substring(0, 12)}</ElText>
                                <CopyButton content={unref(networkData)?.Id || ''} />
                            </ElDescriptionsItem>
                            <ElDescriptionsItem label={$t('container.driver')}>
                                {unref(networkData)?.Driver || '-'}
                            </ElDescriptionsItem>
                            {unref(networkData)?.Options?.parent ? (
                                <ElDescriptionsItem label={$t('container.parentNetworkCard')}>
                                    {unref(networkData)?.Options?.parent}
                                </ElDescriptionsItem>
                            ) : null}
                            <ElDescriptionsItem label={$t('commons.table.createdAt')}>
                                {formatDate(unref(networkData)?.Created)}
                            </ElDescriptionsItem>
                            <ElDescriptionsItem label="IPv4">
                                <ElTag type={unref(networkData)?.EnableIPv4 ? 'success' : 'info'}>
                                    {unref(networkData)?.EnableIPv4
                                        ? $t('commons.status.enable')
                                        : $t('commons.status.disable')}
                                </ElTag>
                            </ElDescriptionsItem>
                            <ElDescriptionsItem label="IPv6">
                                <ElTag type={unref(networkData)?.EnableIPv6 ? 'success' : 'info'}>
                                    {unref(networkData)?.EnableIPv6
                                        ? $t('commons.status.enable')
                                        : $t('commons.status.disable')}
                                </ElTag>
                            </ElDescriptionsItem>
                        </ElDescriptions>
                        <ElDescriptions column={1} border title="IPAM" class={'mt-4'}>
                            <ElDescriptionsItem label={$t('container.driver')}>
                                {unref(networkData)?.IPAM?.Driver || '-'}
                            </ElDescriptionsItem>
                            {(unref(networkData)?.IPAM?.Config || []).map((config, index) => (
                                <ElDescriptionsItem
                                    label={
                                        $t('container.subnet') + (Number(index) > 0 ? ' ' + (Number(index) + 1) : '')
                                    }
                                    key={index}
                                >
                                    {config ? (
                                        <div>
                                            {config.Subnet ? (
                                                <ElTag type="info" label={$t('container.subnet')}>
                                                    {$t('container.subnet')}
                                                    {': '}
                                                    {config.Subnet}
                                                </ElTag>
                                            ) : null}
                                            {config.Gateway ? (
                                                <ElTag type="info" label={$t('container.gateway')} class={'ml-2'}>
                                                    {$t('container.gateway')}
                                                    {': '}
                                                    {config.Gateway}
                                                </ElTag>
                                            ) : null}
                                            {config.IPRange ? (
                                                <ElTag type="info" label={$t('container.scope')} class={'ml-2'}>
                                                    {$t('container.scope')}
                                                    {': '}
                                                    {config.IPRange}
                                                </ElTag>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <span>{'-'}</span>
                                    )}
                                </ElDescriptionsItem>
                            ))}
                        </ElDescriptions>
                        <div class={'mt-4'}>
                            <span class={'text-el-color-primary block text-base font-medium'}>
                                {$t('menu.container')}
                            </span>
                            <ElTable data={unref(containerList)} border class={'mt-2'}>
                                <ElTableColumn
                                    label={$t('commons.table.name')}
                                    min-width="120"
                                    v-slots={{
                                        default: ({ row }) => (
                                            <>
                                                <ElText>{row.name}</ElText>
                                                <CopyButton content={row.name} />
                                            </>
                                        ),
                                    }}
                                />
                                <ElTableColumn
                                    label="IPv4"
                                    min-width="100"
                                    v-slots={{ default: ({ row }) => <>{row.ipv4 || '-'}</> }}
                                />
                                <ElTableColumn
                                    label="IPv6"
                                    min-width="100"
                                    v-slots={{ default: ({ row }) => <>{row.ipv6 || '-'}</> }}
                                />
                                <ElTableColumn
                                    label="MAC"
                                    min-width="120"
                                    v-slots={{ default: ({ row }) => <>{row.mac || '-'}</> }}
                                />
                                <ElTableColumn
                                    label="Endpoint ID"
                                    width="120"
                                    v-slots={{
                                        default: ({ row }) => (
                                            <>
                                                <ElText class={'text-xs'}>
                                                    {row.endpointId?.substring(0, 12) || '-'}
                                                </ElText>
                                            </>
                                        ),
                                    }}
                                />
                            </ElTable>
                        </div>
                    </ElTabPane>
                    <ElTabPane label={$t('commons.button.view')} name="raw">
                        <div class={'mb-2 flex justify-start'}>
                            <ElButton
                                type="primary"
                                onClick={($event?: any) => {
                                    (handleCopyRawJson as any)($event);
                                }}
                                icon="DocumentCopy"
                                size="default"
                            >
                                {$t('commons.button.copy')}
                            </ElButton>
                        </div>
                        <CodemirrorPro
                            modelValue={unref(rawJson)}
                            onUpdate:modelValue={($v) => {
                                rawJson.value = $v as any;
                            }}
                            height-diff={270}
                            readonly={true}
                            mode="json"
                        />
                    </ElTabPane>
                </ElTabs>
            </DrawerPro>
        );
    },
    options,
);
