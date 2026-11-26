import { $t } from '@/utils/i18n-t';
import { reactive, ref } from 'vue';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { ElForm } from 'element-plus';
import { MsgSuccess } from '@/utils/message';
import { checkIp, checkIpV6 } from '@/utils/validate';
import { rpc } from '@/lib/rpc';
type FormInstance = InstanceType<typeof ElForm>;
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElRow } from 'element-plus';
import { ElCol } from 'element-plus';
import { ElTable } from 'element-plus';
import { ElTableColumn } from 'element-plus';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;

}

const emits = {
    'search': () => true,
};



const options = {
        name: "create",
        props: {},
        emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref(false);
        const drawerVisible = ref(false);
        const form = reactive({
            name: '',
            parentNetworkCard: '',
            labelStr: '',
            labels: [] as Array<string>,
            optionStr: '',
            options: [] as Array<string>,
            driver: '',
            ipv4: true,
            subnet: '',
            gateway: '',
            ipRange: '',
            auxAddress: [],
            ipv6: false,
            subnetV6: '',
            gatewayV6: '',
            ipRangeV6: '',
            auxAddressV6: [],
        });
        const acceptParams = (): void => {
            form.name = '';
            form.labelStr = '';
            form.labels = [];
            form.optionStr = '';
            form.options = [];
            form.driver = 'bridge';
            form.parentNetworkCard = '';
            form.ipv4 = true;
            form.subnet = '';
            form.gateway = '';
            form.ipRange = '';
            form.auxAddress = [];
            form.ipv6 = false;
            form.subnetV6 = '';
            form.gatewayV6 = '';
            form.ipRangeV6 = '';
            form.auxAddressV6 = [];
            drawerVisible.value = true;
            loadNetworkOptions();
        };
        const handleClose = () => {
            drawerVisible.value = false;
        };
        const netOptions = ref();
        const rules = reactive({
            name: [Rules.requiredInput],
            driver: [Rules.requiredSelect],
            parentNetworkCard: [Rules.requiredSelect],
            subnet: [{ validator: checkCidr, trigger: 'blur' }, Rules.requiredInput],
            gateway: [{ validator: checkGateway, trigger: 'blur' }],
            ipRange: [{ validator: checkCidr, trigger: 'blur' }],
            subnetV6: [{ validator: checkFixedCidrV6, trigger: 'blur' }, Rules.requiredInput],
            gatewayV6: [{ validator: checkGatewayV6, trigger: 'blur' }],
            ipRangeV6: [{ validator: checkFixedCidrV6, trigger: 'blur' }],
        });
        function checkGateway(rule: any, value: any, callback: any) {
            if (value === '') {
                callback();
            }
            if (checkIp(value)) {
                return callback(new Error(i18n.global.t('commons.rule.formatErr')));
            }
            callback();
        }
        function checkGatewayV6(rule: any, value: any, callback: any) {
            if (value === '') {
                callback();
            }
            if (checkIpV6(value)) {
                return callback(new Error(i18n.global.t('commons.rule.formatErr')));
            }
            callback();
        }
        function checkCidr(rule: any, value: any, callback: any) {
            if (value === '') {
                callback();
            }
            const reg =
                /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\/([0-9]|[1-2][0-9]|3[0-2]))$/;
            if (!reg.test(value)) {
                return callback(new Error(i18n.global.t('commons.rule.formatErr')));
            }
            callback();
        }
        function checkFixedCidrV6(rule: any, value: any, callback: any) {
            if (value === '') {
                callback();
            }
            if (!form.subnetV6 || form.subnetV6.indexOf('/') === -1) {
                return callback(new Error(i18n.global.t('commons.rule.formatErr')));
            }
            if (checkIpV6(form.subnetV6.split('/')[0])) {
                return callback(new Error(i18n.global.t('commons.rule.formatErr')));
            }
            const reg = /^(?:[1-9]|[1-9][0-9]|1[0-1][0-9]|12[0-8])$/;
            if (!reg.test(form.subnetV6.split('/')[1])) {
                return callback(new Error(i18n.global.t('commons.rule.formatErr')));
            }
            callback();
        }
        const handleV4Add = () => {
            let item = {
                key: '',
                value: '',
            };
            form.auxAddress.push(item);
        };
        const handleV4Delete = (index: number) => {
            form.auxAddress.splice(index, 1);
        };
        const handleV6Add = () => {
            let item = {
                key: '',
                value: '',
            };
            form.auxAddressV6.push(item);
        };
        const handleV6Delete = (index: number) => {
            form.auxAddressV6.splice(index, 1);
        };
        const loadNetworkOptions = async () => {
            const res = await rpc.monitor.listNetworkOptions({});
            netOptions.value = res.items;
        };
        const formRef = ref<FormInstance>();
        const onSubmit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                if (form.labelStr !== '') {
                    form.labels = form.labelStr.split('\n');
                }
                if (form.optionStr !== '') {
                    form.options = form.optionStr.split('\n');
                }
                loading.value = true;
                if (form.driver === 'macvlan') {
                    form.options.push('parent=' + form.parentNetworkCard);
                }
                await rpc.container.createNetwork(form)
                    .then(() => {
                        loading.value = false;
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        ctx.emit('search');
                        drawerVisible.value = false;
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            });
        };
        ctx.expose({
    acceptParams,
});
        return () => (
            <DrawerPro modelValue={unref(drawerVisible)} onUpdate:modelValue={$v => { drawerVisible.value = $v as any }} header={$t('commons.button.create')} onClose={($event?: any) => { (handleClose as any)($event); }} size="large" v-slots={{ "footer": () => <><span class={"dialog-footer"}><ElButton disabled={unref(loading)} onClick={($event?: any) => { drawerVisible.value = false; }}>{$t('commons.button.cancel')}</ElButton><ElButton disabled={unref(loading)} type="primary" onClick={($event?: any) => { onSubmit(unref(formRef)); }}>{$t('commons.button.confirm')}</ElButton></span></> }}>{withDirectives(<ElForm ref={formRef} label-position="top" model={form} rules={rules} label-width="80px"><ElFormItem label={$t('container.networkName')} prop="name"><ElInput clearable modelValue={form.name} onUpdate:modelValue={$v => { form.name = typeof $v === 'string' ? $v.trim() : $v }} /></ElFormItem><ElFormItem label={$t('container.driver')} prop="driver"><ElSelect modelValue={form.driver} onUpdate:modelValue={$v => { form.driver = $v as any }}><ElOption label="bridge" value="bridge" /><ElOption label="ipvlan" value="ipvlan" /><ElOption label="macvlan" value="macvlan" /><ElOption label="overlay" value="overlay" /></ElSelect></ElFormItem>{(form.driver === 'macvlan') ? <ElFormItem label={$t('container.parentNetworkCard')} prop="parentNetworkCard"><ElSelect modelValue={form.parentNetworkCard} onUpdate:modelValue={$v => { form.parentNetworkCard = $v as any }}>{((unref(netOptions) || [])).map((item) => <span key={item}>{(item !== 'all') ? <ElOption label={item} value={item} /> : null}</span>)}</ElSelect></ElFormItem> : null}<ElCheckbox modelValue={form.ipv4} onUpdate:modelValue={$v => { form.ipv4 = $v as any }}>{"IPv4"}</ElCheckbox>{(form.ipv4) ? <div><ElRow type="flex" justify="center" gutter={20}><ElCol span={12}><ElFormItem label={$t('container.subnet')} prop="subnet"><ElInput placeholder="172.13.0.0/16" clearable modelValue={form.subnet} onUpdate:modelValue={$v => { form.subnet = typeof $v === 'string' ? $v.trim() : $v }} /></ElFormItem></ElCol><ElCol span={12}><ElFormItem label={$t('container.gateway')} prop="gateway"><ElInput placeholder="172.13.10.254" clearable modelValue={form.gateway} onUpdate:modelValue={$v => { form.gateway = typeof $v === 'string' ? $v.trim() : $v }} /></ElFormItem></ElCol><ElCol span={12}><ElFormItem label={$t('container.scope')} prop="ipRange"><ElInput placeholder="172.13.1.0/24" clearable modelValue={form.ipRange} onUpdate:modelValue={$v => { form.ipRange = typeof $v === 'string' ? $v.trim() : $v }} /></ElFormItem></ElCol><ElCol span={12} /></ElRow><ElFormItem label={$t('container.auxAddress')} prop="auxAddress">{(form.auxAddress.length !== 0) ? <ElTable data={form.auxAddress}><ElTableColumn label={$t('container.label')} min-width="100" v-slots={{ "default": ({ row }) => <><ElInput placeholder="my-router" modelValue={row.key} onUpdate:modelValue={$v => { row.key = $v as any }} /></> }} /><ElTableColumn label="IP" min-width="150" v-slots={{ "default": ({ row }) => <><ElInput placeholder="172.13.1.13" modelValue={row.value} onUpdate:modelValue={$v => { row.value = $v as any }} /></> }} /><ElTableColumn min-width="40" v-slots={{ "default": (scope) => <><ElButton link type="primary" onClick={($event?: any) => { handleV4Delete(scope.$index); }}>{$t('commons.button.delete')}</ElButton></> }} /></ElTable> : null}<ElButton onClick={($event?: any) => { handleV4Add(); }} class={"mt-2"}>{$t('commons.button.add')}</ElButton></ElFormItem></div> : null}<ElCheckbox modelValue={form.ipv6} onUpdate:modelValue={$v => { form.ipv6 = $v as any }} class={"mb-4"}>{"IPv6"}</ElCheckbox>{(form.ipv6) ? <div><ElRow type="flex" justify="center" gutter={20}><ElCol span={12}><ElFormItem label={$t('container.subnet')} prop="subnetV6"><ElInput placeholder="2408:400e::/48" clearable modelValue={form.subnetV6} onUpdate:modelValue={$v => { form.subnetV6 = typeof $v === 'string' ? $v.trim() : $v }} /></ElFormItem></ElCol><ElCol span={12}><ElFormItem label={$t('container.gateway')} prop="gatewayV6"><ElInput placeholder="2408:400e::1" clearable modelValue={form.gatewayV6} onUpdate:modelValue={$v => { form.gatewayV6 = typeof $v === 'string' ? $v.trim() : $v }} /></ElFormItem></ElCol><ElCol span={12}><ElFormItem label={$t('container.scope')} prop="ipRangeV6"><ElInput placeholder="2408:400e::/64" clearable modelValue={form.ipRangeV6} onUpdate:modelValue={$v => { form.ipRangeV6 = typeof $v === 'string' ? $v.trim() : $v }} /></ElFormItem></ElCol><ElCol span={12} /></ElRow><ElFormItem label={$t('container.auxAddress')} prop="auxAddressV6">{(form.auxAddressV6.length !== 0) ? <ElTable data={form.auxAddressV6}><ElTableColumn label={$t('container.label')} min-width="100" v-slots={{ "default": ({ row }) => <><ElInput placeholder="my-router" modelValue={row.key} onUpdate:modelValue={$v => { row.key = $v as any }} /></> }} /><ElTableColumn label="IP" min-width="150" v-slots={{ "default": ({ row }) => <><ElInput placeholder="2408:400e::3" modelValue={row.value} onUpdate:modelValue={$v => { row.value = $v as any }} /></> }} /><ElTableColumn min-width="40" v-slots={{ "default": (scope) => <><ElButton link type="primary" onClick={($event?: any) => { handleV6Delete(scope.$index); }}>{$t('commons.button.delete')}</ElButton></> }} /></ElTable> : null}<ElButton onClick={($event?: any) => { handleV6Add(); }} class={"mt-2"}>{$t('commons.button.add')}</ElButton></ElFormItem></div> : null}<ElFormItem label={$t('container.option')} prop="optionStr"><ElInput type="textarea" placeholder={$t('container.tagHelper')} rows={3} modelValue={form.optionStr} onUpdate:modelValue={$v => { form.optionStr = $v as any }} /></ElFormItem><ElFormItem label={$t('container.tag')} prop="labelStr"><ElInput type="textarea" placeholder={$t('container.tagHelper')} rows={3} modelValue={form.labelStr} onUpdate:modelValue={$v => { form.labelStr = $v as any }} /></ElFormItem></ElForm>, [[vLoading, unref(loading)]])}</DrawerPro>
        );
    },
    options,
);
