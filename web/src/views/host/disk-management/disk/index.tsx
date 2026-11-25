import { Host } from '@/types/host';
import DiskRouter from '@/views/host/disk-management/index.vue';
import DiskCard from '@/views/host/disk-management/components/disk-card.vue';
import Partition from '@/views/host/disk-management/partition/index.vue';
import { rpc } from '@/lib/rpc';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import MainDiv from '@/components/main-div/index.vue';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'disk',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref(false);
        const partitionRef = ref();
        const diskInfo = ref<Host.CompleteDiskInfo>();
        const getDisk = async () => {
            try {
                loading.value = true;
                const res = await rpc.host.getDisks({});
                diskInfo.value = res as unknown as Host.CompleteDiskInfo;
            } catch (error) {
            } finally {
                loading.value = false;
            }
        };
        onMounted(() => {
            getDisk();
        });
        return () => (
            <div>
                <DiskRouter />
                {withDirectives(
                    <MainDiv height-diff={140} class={'mt-2'}>
                        {unref(diskInfo)?.systemDisks ? (
                            <div>
                                {unref(diskInfo).systemDisks.map((disk, index) => (
                                    <DiskCard diskInfo={disk} scope="system" class={'mt-2'} key={index} />
                                ))}
                            </div>
                        ) : null}
                        {unref(diskInfo)?.unpartitionedDisks ? (
                            <div>
                                {unref(diskInfo).unpartitionedDisks.map((disk, index) => (
                                    <DiskCard
                                        diskInfo={disk}
                                        scope="unpartitioned"
                                        onPartition={($event?: any) => {
                                            (diskInfo) =>
                                                unref(partitionRef).acceptParams(unref(diskInfo), 'partition');
                                        }}
                                        onSearch={($event?: any) => {
                                            () => getDisk();
                                        }}
                                        class={'mt-2'}
                                        key={index}
                                    />
                                ))}
                            </div>
                        ) : null}
                        {unref(diskInfo)?.disks ? (
                            <div>
                                {unref(diskInfo).disks.map((disk, index) => (
                                    <DiskCard
                                        diskInfo={disk}
                                        onMount={($event?: any) => {
                                            (diskInfo) => unref(partitionRef).acceptParams(unref(diskInfo), 'mount');
                                        }}
                                        scope="normal"
                                        onSearch={($event?: any) => {
                                            () => getDisk();
                                        }}
                                        class={'mt-2'}
                                        key={index}
                                    />
                                ))}
                            </div>
                        ) : null}
                    </MainDiv>,
                    [[vLoading, unref(loading)]],
                )}
                <Partition
                    ref={partitionRef}
                    onSearch={($event?: any) => {
                        (getDisk as any)($event);
                    }}
                />
            </div>
        );
    },
    options,
);
