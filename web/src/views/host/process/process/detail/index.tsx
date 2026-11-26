import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import { ref } from 'vue';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElTabs } from 'element-plus';
import { ElTabPane } from 'element-plus';
import { ElDescriptions } from 'element-plus';
import { ElDescriptionsItem } from 'element-plus';
import { ElTable } from 'element-plus';
import { ElTableColumn } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';
import CodemirrorPro from '@/components/codemirror-pro/index';

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
        const data = ref({
            name: '',
            envs: [] as string[],
            status: '',
            PID: 0,
            PPID: 0,
            numThreads: 0,
            numConnections: 0,
            diskRead: '',
            diskWrite: '',
            username: '',
            startTime: '',
            cmdLine: '',
            rss: '',
            swap: '',
            vms: '',
            hwm: '',
            data: '',
            stack: '',
            locked: '',
            openFiles: [],
            connects: [],
        });
        const resourceName = ref('');
        const activeName = ref('basic');
        const envStr = ref('');
        const loading = ref(false);
        const handleClose = () => {
            open.value = false;
        };
        const acceptParams = async (pid: number): Promise<void> => {
            open.value = true;
            activeName.value = 'basic';
            loading.value = true;
            try {
                const res = await rpc.process.getProcessInfo({ pid });
                data.value = JSON.parse(res.detailJson || '{}');
                resourceName.value = data.value.name;
                if (data.value.envs) {
                    envStr.value = data.value.envs.join('\n');
                }
            } catch (error) {
            } finally {
                loading.value = false;
            }
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
                header={$t('app.detail')}
                resource={unref(resourceName)}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="large"
                v-slots={{
                    content: () => (
                        <>
                            {withDirectives(
                                <ElTabs
                                    modelValue={unref(activeName)}
                                    onUpdate:modelValue={($v) => {
                                        activeName.value = $v as any;
                                    }}
                                    type="card"
                                >
                                    <ElTabPane label={$t('process.basic')} name="basic">
                                        <ElDescriptions column={2} border>
                                            <ElDescriptionsItem label={$t('commons.table.name')} min-width="100px">
                                                {unref(data).name}
                                            </ElDescriptionsItem>
                                            <ElDescriptionsItem label={$t('commons.table.status')}>
                                                {unref(data).status}
                                            </ElDescriptionsItem>
                                            <ElDescriptionsItem label={$t('process.pid')}>
                                                {unref(data).PID}
                                            </ElDescriptionsItem>
                                            <ElDescriptionsItem label={$t('process.ppid')}>
                                                {unref(data).PPID}
                                            </ElDescriptionsItem>
                                            <ElDescriptionsItem label={$t('process.numThreads')}>
                                                {unref(data).numThreads}
                                            </ElDescriptionsItem>
                                            <ElDescriptionsItem label={$t('process.numConnections')}>
                                                {unref(data).numConnections}
                                            </ElDescriptionsItem>
                                            <ElDescriptionsItem label={$t('process.diskRead')}>
                                                {unref(data).diskRead}
                                            </ElDescriptionsItem>
                                            <ElDescriptionsItem label={$t('process.diskWrite')}>
                                                {unref(data).diskWrite}
                                            </ElDescriptionsItem>
                                            <ElDescriptionsItem label={$t('commons.table.user')}>
                                                {unref(data).username}
                                            </ElDescriptionsItem>
                                            <ElDescriptionsItem label={$t('process.startTime')}>
                                                {unref(data).startTime}
                                            </ElDescriptionsItem>
                                            <ElDescriptionsItem label={$t('process.cmdLine')}>
                                                {unref(data).cmdLine}
                                            </ElDescriptionsItem>
                                        </ElDescriptions>
                                    </ElTabPane>
                                    <ElTabPane label={$t('process.mem')} name="mem">
                                        <ElDescriptions column={2} border>
                                            <ElDescriptionsItem label={'rss'}>{unref(data).rss}</ElDescriptionsItem>
                                            <ElDescriptionsItem label={'pss'}>
                                                {(unref(data) as any).pss}
                                            </ElDescriptionsItem>
                                            <ElDescriptionsItem label={'uss'}>
                                                {(unref(data) as any).uss}
                                            </ElDescriptionsItem>
                                            <ElDescriptionsItem label={'swap'}>{unref(data).swap}</ElDescriptionsItem>
                                            <ElDescriptionsItem label={'shared'}>
                                                {(unref(data) as any).shared}
                                            </ElDescriptionsItem>
                                            <ElDescriptionsItem label={'vms'}>{unref(data).vms}</ElDescriptionsItem>
                                            <ElDescriptionsItem label={'hwm'}>{unref(data).hwm}</ElDescriptionsItem>
                                            <ElDescriptionsItem label={'data'}>{unref(data).data}</ElDescriptionsItem>
                                            <ElDescriptionsItem label={'stack'}>{unref(data).stack}</ElDescriptionsItem>
                                            <ElDescriptionsItem label={'locked'}>
                                                {unref(data).locked}
                                            </ElDescriptionsItem>
                                            <ElDescriptionsItem label={'text'}>
                                                {(unref(data) as any).text}
                                            </ElDescriptionsItem>
                                            <ElDescriptionsItem label={'dirty'}>
                                                {(unref(data) as any).dirty}
                                            </ElDescriptionsItem>
                                        </ElDescriptions>
                                    </ElTabPane>
                                    <ElTabPane label={$t('process.openFiles')} name="openFiles">
                                        <ElTable
                                            max-height="800px"
                                            data={unref(data).openFiles}
                                            border
                                            class={'w-full'}
                                        >
                                            <ElTableColumn prop="path" label={$t('menu.files')} />
                                            <ElTableColumn prop="fd" label="fd" width="100px" />
                                        </ElTable>
                                    </ElTabPane>
                                    <ElTabPane label={$t('process.env')} name="env">
                                        <CodemirrorPro
                                            placeholder={$t('commons.msg.noneData')}
                                            modelValue={unref(envStr)}
                                            onUpdate:modelValue={($v) => {
                                                envStr.value = $v as any;
                                            }}
                                            heightDiff={300}
                                            disabled={true}
                                        />
                                    </ElTabPane>
                                    <ElTabPane label={$t('process.net')} name="net">
                                        <ElTable max-height="800px" data={unref(data).connects} border class={'w-full'}>
                                            <ElTableColumn
                                                prop="localaddr"
                                                label={$t('process.laddr')}
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>
                                                            <span>{row.localaddr.ip}</span>
                                                            {row.localaddr.port > 0 ? (
                                                                <span>
                                                                    {':'}
                                                                    {row.localaddr.port}
                                                                </span>
                                                            ) : null}
                                                        </>
                                                    ),
                                                }}
                                            />
                                            <ElTableColumn
                                                prop="remoteaddr"
                                                label={$t('process.raddr')}
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>
                                                            <span>{row.remoteaddr.ip}</span>
                                                            {row.remoteaddr.port > 0 ? (
                                                                <span>
                                                                    {':'}
                                                                    {row.remoteaddr.port}
                                                                </span>
                                                            ) : null}
                                                        </>
                                                    ),
                                                }}
                                            />
                                            <ElTableColumn prop="status" label={$t('commons.table.status')} />
                                        </ElTable>
                                    </ElTabPane>
                                </ElTabs>,
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
