import { $t } from '@/utils/i18n-t';
import { onBeforeUnmount, ref } from 'vue';
import { dateFormatForSecond } from '@/utils/date';
import VCharts from '@/components/v-charts/index';
import i18n from '@/lang';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    containerID: string;
    container: string;
}
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElCard } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;

}

const emits = {};



const options = {
        name: "monitor",
        props: {},
        emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const title = ref();
        const monitorVisible = ref(false);
        const timeInterval = ref();
        let timer: NodeJS.Timer | null = null;
        let isInit = ref<boolean>(true);
        const dialogData = ref<DialogProps>({
            containerID: '',
            container: '',
        });
        const acceptParams = async (params: DialogProps): Promise<void> => {
            monitorVisible.value = true;
            dialogData.value.containerID = params.containerID;
            title.value = params.container;
            cpuDatas.value = [];
            memDatas.value = [];
            cacheDatas.value = [];
            ioReadDatas.value = [];
            ioWriteDatas.value = [];
            netTxDatas.value = [];
            netRxDatas.value = [];
            timeDatas.value = [];
            timeInterval.value = 5;
            isInit.value = true;
            loadData();
            timer = setInterval(async () => {
                if (monitorVisible.value) {
                    isInit.value = false;
                    loadData();
                }
            }, 1000 * timeInterval.value);
        };
        const cpuDatas = ref<Array<string>>([]);
        const memDatas = ref<Array<string>>([]);
        const cacheDatas = ref<Array<string>>([]);
        const ioReadDatas = ref<Array<string>>([]);
        const ioWriteDatas = ref<Array<string>>([]);
        const netTxDatas = ref<Array<string>>([]);
        const netRxDatas = ref<Array<string>>([]);
        const timeDatas = ref<Array<string>>([]);
        const chartsOption = ref({ cpuChart: null, memoryChart: null, ioChart: null, networkChart: null });
        const changeTimer = () => {
            clearInterval(Number(timer));
            timer = setInterval(async () => {
                if (monitorVisible.value) {
                    loadData();
                }
            }, 1000 * timeInterval.value);
        };
        const loadData = async () => {
            const res = await rpc.container.sampleContainerStats({ id: dialogData.value.containerID });
            cpuDatas.value.push(res.cpuPercent.toFixed(2));
            if (cpuDatas.value.length > 20) {
                cpuDatas.value.splice(0, 1);
            }
            memDatas.value.push(res.memory.toFixed(2));
            if (memDatas.value.length > 20) {
                memDatas.value.splice(0, 1);
            }
            cacheDatas.value.push(res.cache.toFixed(2));
            if (cacheDatas.value.length > 20) {
                cacheDatas.value.splice(0, 1);
            }
            ioReadDatas.value.push(res.ioRead.toFixed(2));
            if (ioReadDatas.value.length > 20) {
                ioReadDatas.value.splice(0, 1);
            }
            ioWriteDatas.value.push(res.ioWrite.toFixed(2));
            if (ioWriteDatas.value.length > 20) {
                ioWriteDatas.value.splice(0, 1);
            }
            netTxDatas.value.push(res.networkTx.toFixed(2));
            if (netTxDatas.value.length > 20) {
                netTxDatas.value.splice(0, 1);
            }
            netRxDatas.value.push(res.networkRx.toFixed(2));
            if (netRxDatas.value.length > 20) {
                netRxDatas.value.splice(0, 1);
            }
            timeDatas.value.push(dateFormatForSecond(res.shotTime));
            if (timeDatas.value.length > 20) {
                timeDatas.value.splice(0, 1);
            }
        
            chartsOption.value['cpuChart'] = {
                title: 'CPU',
                xData: timeDatas.value,
                yData: [
                    {
                        name: 'CPU',
                        data: cpuDatas.value,
                    },
                ],
                formatStr: '%',
            };
        
            chartsOption.value['memoryChart'] = {
                title: i18n.global.t('monitor.memory'),
                xData: timeDatas.value,
                yData: [
                    {
                        name: i18n.global.t('monitor.memory'),
                        data: memDatas.value,
                    },
                    {
                        name: i18n.global.t('container.cache'),
                        data: cacheDatas.value,
                    },
                ],
                formatStr: 'MB',
            };
        
            chartsOption.value['ioChart'] = {
                title: i18n.global.t('monitor.disk') + ' IO',
                xData: timeDatas.value,
                yData: [
                    {
                        name: i18n.global.t('monitor.read'),
                        data: ioReadDatas.value,
                    },
                    {
                        name: i18n.global.t('monitor.write'),
                        data: ioWriteDatas.value,
                    },
                ],
                formatStr: 'MB',
            };
        
            chartsOption.value['networkChart'] = {
                title: i18n.global.t('monitor.network'),
                xData: timeDatas.value,
                yData: [
                    {
                        name: i18n.global.t('monitor.up'),
                        data: netTxDatas.value,
                    },
                    {
                        name: i18n.global.t('monitor.down'),
                        data: netRxDatas.value,
                    },
                ],
                formatStr: 'KB',
            };
        };
        const handleClose = async () => {
            monitorVisible.value = false;
            clearInterval(Number(timer));
            timer = null;
            chartsOption.value = { cpuChart: null, memoryChart: null, ioChart: null, networkChart: null };
        };
        onBeforeUnmount(() => {
            handleClose;
        });
        ctx.expose({
    acceptParams,
});
        return () => (
            <DrawerPro modelValue={unref(monitorVisible)} onUpdate:modelValue={$v => { monitorVisible.value = $v as any }} header={$t('menu.monitor')} onClose={($event?: any) => { (handleClose as any)($event); }} resource={unref(title)} size="large"><ElForm label-position="top" onSubmit={($event?: any) => { $event.preventDefault(); ; }}><ElFormItem label={$t('container.refreshTime')}><ElSelect modelValue={unref(timeInterval)} onUpdate:modelValue={$v => { timeInterval.value = $v as any }} onChange={($event?: any) => { (changeTimer as any)($event); }}><ElOption label="3s" value={3} /><ElOption label="5s" value={5} /><ElOption label="10s" value={10} /><ElOption label="30s" value={30} /><ElOption label="60s" value={60} /></ElSelect></ElFormItem></ElForm><ElCard>{(unref(chartsOption)['cpuChart']) ? <VCharts height="200px" id="cpuChart" type="line" renderer="svg" option={unref(chartsOption)['cpuChart']} /> : null}</ElCard><ElCard class={"mt-2.5"}>{(unref(chartsOption)['memoryChart']) ? <VCharts height="200px" id="memoryChart" type="line" renderer="svg" option={unref(chartsOption)['memoryChart']} /> : null}</ElCard><ElCard class={"mt-2.5"}>{(unref(chartsOption)['ioChart']) ? <VCharts height="200px" id="ioChart" type="line" renderer="svg" option={unref(chartsOption)['ioChart']} /> : null}</ElCard><ElCard class={"mt-2.5"}>{(unref(chartsOption)['networkChart']) ? <VCharts height="200px" id="networkChart" type="line" renderer="svg" option={unref(chartsOption)['networkChart']} /> : null}</ElCard></DrawerPro>
        );
    },
    options,
);
