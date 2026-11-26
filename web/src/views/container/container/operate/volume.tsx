import { $t } from '@/utils/i18n-t';
interface Volume {
    type: string;
    sourceDir: string;
    containerDir: string;
    mode: string;
}
import { TABLE_TOOLTIP_OPTIONS } from '@/components/table/shared';
import { ref, onMounted } from 'vue';
import { rpc } from '@/lib/rpc';
import './volume.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElTableColumn } from 'element-plus';
import { ElRadioGroup } from 'element-plus';
import { ElRadioButton } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElTooltip } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElIcon } from 'element-plus';
import { ElRadio } from 'element-plus';
import { ElButton } from 'element-plus';
import ComplexTable from '@/components/table/complex/ComplexTable';
import { Bottom } from '@element-plus/icons-vue';

interface CodemodProps {
    [key: string]: any;
    volumes?: Volume[];
}

const emits = {};

const options = {
    name: 'volume',
    props: {
        volumes: { type: Array<Volume>, default: [] },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-0f492278',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const tmpVolumes = ref([]);
        const volumeOptions = ref();
        watch(
            () => __panelSetupProps.volumes,
            (newVal) => {
                tmpVolumes.value = newVal || [];
            },
        );
        const loadVolumeOptions = async () => {
            const res = await rpc.container.listVolumes({});
            volumeOptions.value = res.items;
        };
        const handleVolumesAdd = () => {
            let item = {
                type: 'volume',
                sourceDir: '',
                containerDir: '',
                mode: 'rw',
                shared: 'private',
            };
            tmpVolumes.value.push(item);
        };
        const handleVolumesDelete = (index: number) => {
            tmpVolumes.value.splice(index, 1);
        };
        const loadVolumes = () => {
            return tmpVolumes.value;
        };
        onMounted(() => {
            tmpVolumes.value = __panelSetupProps.volumes || [];
            loadVolumeOptions();
        });
        ctx.expose({
            loadVolumes,
        });
        return () => (
            <div>
                {unref(tmpVolumes) ? (
                    <ComplexTable data={unref(tmpVolumes)} style={'width: 100%'}>
                        <ElTableColumn
                            label={$t('container.server')}
                            min-width="200"
                            v-slots={{
                                default: ({ row }) => (
                                    <>
                                        <ElRadioGroup
                                            modelValue={row.type}
                                            onUpdate:modelValue={($v) => {
                                                row.type = $v as any;
                                            }}
                                        >
                                            <ElRadioButton value="volume">{$t('container.volumeOption')}</ElRadioButton>
                                            <ElRadioButton value="bind">{$t('container.hostOption')}</ElRadioButton>
                                        </ElRadioGroup>
                                    </>
                                ),
                            }}
                        />
                        <ElTableColumn
                            label={$t('container.server') + ' -> ' + $t('container.containerDir')}
                            min-width="400"
                            v-slots={{
                                default: ({ row }) => (
                                    <>
                                        {row.type === 'volume' ? (
                                            <ElSelect
                                                filterable
                                                modelValue={row.sourceDir}
                                                onUpdate:modelValue={($v) => {
                                                    row.sourceDir = $v as any;
                                                }}
                                            >
                                                {(unref(volumeOptions) || []).map((item, indexV) => (
                                                    <div key={indexV}>
                                                        <ElTooltip
                                                            hide-after={20}
                                                            content={item.option}
                                                            {...TABLE_TOOLTIP_OPTIONS}
                                                        >
                                                            <ElOption
                                                                value={item.option}
                                                                label={item.option.substring(0, 30)}
                                                            />
                                                        </ElTooltip>
                                                    </div>
                                                ))}
                                            </ElSelect>
                                        ) : (
                                            <ElInput
                                                modelValue={row.sourceDir}
                                                onUpdate:modelValue={($v) => {
                                                    row.sourceDir = $v as any;
                                                }}
                                            />
                                        )}
                                        <ElIcon>
                                            <Bottom />
                                        </ElIcon>
                                        <ElInput
                                            modelValue={row.containerDir}
                                            onUpdate:modelValue={($v) => {
                                                row.containerDir = $v as any;
                                            }}
                                        />
                                    </>
                                ),
                            }}
                        />
                        <ElTableColumn
                            label={$t('container.mode')}
                            min-width="180"
                            v-slots={{
                                default: ({ row }) => (
                                    <>
                                        <ElRadioGroup
                                            modelValue={row.mode}
                                            onUpdate:modelValue={($v) => {
                                                row.mode = $v as any;
                                            }}
                                        >
                                            <ElRadio value="rw">{$t('container.modeRW')}</ElRadio>
                                            <ElRadio value="ro">{$t('container.modeR')}</ElRadio>
                                        </ElRadioGroup>
                                    </>
                                ),
                            }}
                        />
                        <ElTableColumn
                            label={$t('container.sharedLabel')}
                            min-width="180"
                            v-slots={{
                                default: ({ row }) => (
                                    <>
                                        {row.type !== 'volume' ? (
                                            <ElSelect
                                                popper-class="tall-options"
                                                modelValue={row.shared}
                                                onUpdate:modelValue={($v) => {
                                                    row.shared = $v as any;
                                                }}
                                            >
                                                <ElOption value="private" label={$t('container.private')}>
                                                    <div class={'title'}>{$t('container.private')}</div>
                                                    <div class={'description'}>{$t('container.privateHelper')}</div>
                                                </ElOption>
                                                <ElOption value="rprivate" label={$t('container.rprivate')}>
                                                    <div class={'title'}>{$t('container.rprivate')}</div>
                                                    <div class={'description'}>{$t('container.rprivateHelper')}</div>
                                                </ElOption>
                                                <ElOption value="shared" label={$t('container.shared')}>
                                                    <div class={'title'}>{$t('container.shared')}</div>
                                                    <div class={'description'}>{$t('container.sharedHelper')}</div>
                                                </ElOption>
                                                <ElOption value="rshared" label={$t('container.rshared')}>
                                                    <div class={'title'}>{$t('container.rshared')}</div>
                                                    <div class={'description'}>{$t('container.rsharedHelper')}</div>
                                                </ElOption>
                                                <ElOption value="slave" label={$t('container.slave')}>
                                                    <div class={'title'}>{$t('container.slave')}</div>
                                                    <div class={'description'}>{$t('container.slaveHelper')}</div>
                                                </ElOption>
                                                <ElOption value="rslave" label={$t('container.rslave')}>
                                                    <div class={'title'}>{$t('container.rslave')}</div>
                                                    <div class={'description'}>{$t('container.rslaveHelper')}</div>
                                                </ElOption>
                                            </ElSelect>
                                        ) : (
                                            <span>{'-'}</span>
                                        )}
                                    </>
                                ),
                            }}
                        />
                        <ElTableColumn
                            min-width="80"
                            fixed={'right'}
                            v-slots={{
                                default: (scope) => (
                                    <>
                                        <ElButton
                                            link
                                            type="primary"
                                            onClick={($event?: any) => {
                                                handleVolumesDelete(scope.$index);
                                            }}
                                        >
                                            {$t('commons.button.delete')}
                                        </ElButton>
                                    </>
                                ),
                            }}
                        />
                    </ComplexTable>
                ) : null}
                <ElButton
                    onClick={($event?: any) => {
                        handleVolumesAdd();
                    }}
                    class={'mt-2'}
                >
                    {$t('commons.button.add')}
                </ElButton>
            </div>
        );
    },
    options,
);
