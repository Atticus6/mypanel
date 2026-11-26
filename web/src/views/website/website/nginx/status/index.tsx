import { $t } from '@/utils/i18n-t';
interface OpenrestyStatusView {
    accepts: number;
    handled: number;
    active: number;
    requests: number;
    reading: number;
    writing: number;
    waiting: number;
}
import { rpc } from '@/lib/rpc';
import { onMounted, ref } from 'vue';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElForm } from 'element-plus';
import { ElRow } from 'element-plus';
import { ElFormItem } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
    status?: string;
}

const emits = {};

const options = {
    name: 'status',
    props: {
        status: {
            type: String,
            default: 'Running',
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        let data = ref<OpenrestyStatusView>({
            accepts: 0,
            handled: 0,
            requests: 0,
            reading: 0,
            waiting: 0,
            writing: 0,
            active: 0,
        });
        const get = async () => {
            if (__panelSetupProps.status != 'Running') {
                return;
            }
            data.value = await rpc.openresty.getStatus({});
        };
        onMounted(() => {
            get();
        });
        return () => (
            <div>
                <ElForm label-position="top">
                    <ElRow type="flex" justify="center" class={'ml-5'}>
                        <ElFormItem
                            class={'w-1/4'}
                            v-slots={{
                                label: () => (
                                    <>
                                        <span class={'status-label'}>{$t('nginx.connections')}</span>
                                    </>
                                ),
                            }}
                        >
                            <span class={'status-count'}>{unref(data).active}</span>
                        </ElFormItem>
                        <ElFormItem
                            class={'w-1/4'}
                            v-slots={{
                                label: () => (
                                    <>
                                        <span class={'status-label'}>{$t('nginx.accepts')}</span>
                                    </>
                                ),
                            }}
                        >
                            <span class={'status-count'}>{unref(data).accepts}</span>
                        </ElFormItem>
                        <ElFormItem
                            class={'w-1/4'}
                            v-slots={{
                                label: () => (
                                    <>
                                        <span class={'status-label'}>{$t('nginx.handled')}</span>
                                    </>
                                ),
                            }}
                        >
                            <span class={'status-count'}>{unref(data).handled}</span>
                        </ElFormItem>
                        <ElFormItem
                            class={'w-1/4'}
                            v-slots={{
                                label: () => (
                                    <>
                                        <span class={'status-label'}>{$t('nginx.requests')}</span>
                                    </>
                                ),
                            }}
                        >
                            <span class={'status-count'}>{unref(data).requests}</span>
                        </ElFormItem>
                        <ElFormItem
                            class={'w-1/4'}
                            v-slots={{
                                label: () => (
                                    <>
                                        <span class={'status-label'}>{$t('nginx.reading')}</span>
                                    </>
                                ),
                            }}
                        >
                            <span class={'status-count'}>{unref(data).reading}</span>
                        </ElFormItem>
                        <ElFormItem
                            class={'w-1/4'}
                            v-slots={{
                                label: () => (
                                    <>
                                        <span class={'status-label'}>{$t('nginx.writing')}</span>
                                    </>
                                ),
                            }}
                        >
                            <span class={'status-count'}>{unref(data).writing}</span>
                        </ElFormItem>
                        <ElFormItem
                            class={'w-1/4'}
                            v-slots={{
                                label: () => (
                                    <>
                                        <span class={'status-label'}>{$t('nginx.waiting')}</span>
                                    </>
                                ),
                            }}
                        >
                            <span class={'status-count'}>{unref(data).waiting}</span>
                        </ElFormItem>
                        <ElFormItem class={'w-1/4'} />
                    </ElRow>
                </ElForm>
            </div>
        );
    },
    options,
);
