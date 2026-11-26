import { $t } from '@/utils/i18n-t';
import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf';
type Init<T extends DescMessage> = MessageInitShape<T>;
import { ContainerLimitSchema } from '@/gen/panel/agent/v1/container_pb';
type ResourceLimit = Omit<Init<typeof ContainerLimitSchema>, 'memory'> & { memory: number };
interface ExtraHost {
    hostname: string;
    ip: string;
}
interface Port {
    host: string;
    hostIP: string;
    containerPort: string;
    hostPort: string;
    protocol: string;
}
interface ContainerNetwork {
    network: string;
    ipv4: string;
    ipv6: string;
    macAddr: string;
    links?: Array<string>;
    aliases?: Array<string>;
    driverOpts?: Record<string, string>;
    gwPriority?: number;
    linkLocalIPs?: Array<string>;
}
interface ContainerHelper {
    taskID: string;
    name: string;
    image: string;
    imageInput: boolean;
    forcePull: boolean;
    networks: Array<ContainerNetwork>;
    hostname: string;
    domainName: string;
    dns: Array<string>;
    cmdStr: string;
    entrypointStr: string;
    memoryItem: number;
    cmd: Array<string>;
    workingDir: string;
    user: string;
    openStdin: boolean;
    tty: boolean;
    entrypoint: Array<string>;
    publishAllPorts: boolean;
    exposedPorts: Array<Port>;
    nanoCPUs: number;
    cpuShares: number;
    memory: number;
    volumes: Array<Container.Volume>;
    extraHosts: Array<ExtraHost>;
    privileged: boolean;
    autoRemove: boolean;
    labels: Array<string>;
    env: Array<string>;
    restartPolicy: string;
}
import { reactive, ref } from 'vue';
import { Rules, checkFloatNumberRange, checkNumberRange } from '@/global/form-rules';
import i18n from '@/lang';
import { ElForm } from 'element-plus';
import Confirm from '@/views/container/container/operate/confirm';
import Volume from '@/views/container/container/operate/volume';
import type { Container } from '@/types/container';
import Network from '@/views/container/container/operate/network';
import ExtraHosts from '@/views/website/components/extra-hosts/index';
import { MsgError } from '@/utils/message';
import TaskLog from '@/components/log/task/index';
import { checkIpV4V6, checkPort } from '@/utils/validate';
import { newUUID } from '@/utils/id';
import router from '@/routers';
import TerminalDialog from '@/views/host/file-management/terminal/index';
import { routerToName, routerToNameWithQuery } from '@/utils/router';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { rpc } from '@/lib/rpc';
type FormInstance = InstanceType<typeof ElForm>;
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElRow } from 'element-plus';
import { ElCol } from 'element-plus';
import { ElCard } from 'element-plus';
import { ElAlert } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElIcon } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElRadioGroup } from 'element-plus';
import { ElRadio } from 'element-plus';
import { ElTable } from 'element-plus';
import { ElTableColumn } from 'element-plus';
import { ElTabs } from 'element-plus';
import { ElTabPane } from 'element-plus';
import { ElDivider } from 'element-plus';
import LayoutContent from '@/components/layout-content/index';
import { Position } from '@element-plus/icons-vue';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'operate',
    props: {},
    emits: emits,
    __scopeId: 'data-v-4860706d',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isAdminOrNodeAdmin } = useGlobalStore();
        const loading = ref(false);
        const isCreate = ref();
        const confirmRef = ref();
        const volumeRef = ref();
        const networkRef = ref();
        const form = reactive<ContainerHelper>({
            taskID: '',
            name: '',
            image: '',
            imageInput: false,
            forcePull: false,
            networks: [{ network: 'bridge', ipv4: '', ipv6: '', macAddr: '' }],
            hostname: '',
            domainName: '',
            dns: [],
            cmdStr: '',
            entrypointStr: '',
            memoryItem: 0,
            cmd: [],
            workingDir: '',
            user: '',
            openStdin: false,
            tty: false,
            entrypoint: [],
            publishAllPorts: false,
            exposedPorts: [],
            nanoCPUs: 0,
            cpuShares: 1024,
            memory: 0,
            volumes: [],
            extraHosts: [],
            privileged: false,
            autoRemove: false,
            labels: [],
            env: [],
            restartPolicy: 'no',
        });
        const search = async () => {
            if (!isCreate.value) {
                loading.value = true;
                await rpc.container
                    .containerInfo({ name: form.name })
                    .then((res) => JSON.parse(res.infoJson || '{}'))
                    .then((res) => {
                        loading.value = false;
                        form.name = res.name;
                        form.image = res.image;
                        form.networks = res.networks;
                        form.hostname = res.hostname;
                        form.domainName = res.domainName;
                        form.dns = res.dns || [];
                        form.openStdin = res.openStdin;
                        form.tty = res.tty;
                        form.publishAllPorts = res.publishAllPorts;
                        form.nanoCPUs = res.nanoCPUs;
                        form.cpuShares = res.cpuShares;
                        form.privileged = res.privileged;
                        form.autoRemove = res.autoRemove;
                        form.restartPolicy = res.restartPolicy;
                        form.memory = Number(Number(res.memory).toFixed(2));
                        form.user = res.user;
                        form.workingDir = res.workingDir;

                        let itemCmd = '';
                        form.cmd = res.cmd || [];
                        for (const item of form.cmd) {
                            if (item.indexOf(' ') !== -1) {
                                itemCmd += `"${escapeQuotes(item)}" `;
                            } else {
                                itemCmd += item + ' ';
                            }
                        }
                        form.cmdStr = itemCmd.trimEnd();
                        let itemEntrypoint = '';
                        form.entrypoint = res.entrypoint || [];
                        for (const item of form.entrypoint) {
                            if (item.indexOf(' ') !== -1) {
                                itemEntrypoint += `"${escapeQuotes(item)}" `;
                            } else {
                                itemEntrypoint += item + ' ';
                            }
                        }
                        form.entrypointStr = itemEntrypoint.trimEnd();

                        form.labels = res.labels || [];
                        form.env = res.env || [];
                        form.exposedPorts = res.exposedPorts || [];
                        for (const item of form.exposedPorts) {
                            if (item.hostIP) {
                                item.host = item.hostIP + ':' + item.hostPort;
                            } else {
                                item.host = item.hostPort;
                            }
                        }
                        form.volumes = res.volumes || [];
                        form.extraHosts = res.extraHosts || [];
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            }
            loadLimit();
            loadImageOptions();
        };
        const taskLogRef = ref();
        const images = ref();
        const limits = ref<ResourceLimit>({
            cpu: null as number,
            memory: null as number,
        });
        const rules = reactive({
            name: [Rules.requiredInput, Rules.containerName],
            image: [Rules.imageName],
            cpuShares: [Rules.integerNumberWith0, checkNumberRange(0, 262144)],
            nanoCPUs: [Rules.floatNumber],
            memory: [Rules.floatNumber],
        });
        const formRef = ref<FormInstance>();
        const goBack = () => {
            routerToName('ContainerItem');
        };
        const closeTask = () => {
            taskLogRef.value.handleClose();
            checkExist();
        };
        const dialogTerminalRef = ref();
        const toTerminal = () => {
            dialogTerminalRef.value!.acceptParams({ cwd: '$HOME', command: '/bin/sh' });
        };
        const handlePortsAdd = () => {
            let item = {
                host: '',
                hostIP: '',
                containerPort: '',
                hostPort: '',
                protocol: 'tcp',
            };
            form.exposedPorts.push(item);
        };
        const handlePortsDelete = (index: number) => {
            form.exposedPorts.splice(index, 1);
        };
        const goRouter = async () => {
            routerToName('AppInstalled');
        };
        const loadLimit = async () => {
            const res = await rpc.container.getLimit({});
            limits.value = { cpu: res.cpu, memory: Number(res.memory) } as any;
            limits.value.memory = Number((limits.value.memory / 1024 / 1024).toFixed(2));
        };
        const loadImageOptions = async () => {
            images.value = (await rpc.container.listImages({})).items;
        };
        const onSubmit = async (formEl: FormInstance | undefined) => {
            form.volumes = volumeRef.value.loadVolumes();
            if (form.volumes.length !== 0) {
                for (const item of form.volumes) {
                    if (!item.containerDir || !item.sourceDir) {
                        MsgError(i18n.global.t('container.volumeHelper'));
                        return;
                    }
                }
            }
            form.networks = networkRef.value.loadNetworks();
            if (form.volumes.length !== 0) {
                for (const item of form.networks) {
                    if (!item.network) {
                        MsgError(i18n.global.t('container.volumeHelper'));
                        return;
                    }
                }
            }
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                if (isCreate.value) {
                    submit();
                } else {
                    confirmRef.value.acceptParams({ isFromApp: isFromApp(form) });
                }
            });
        };
        const submit = async () => {
            form.cmd = [];
            form.taskID = newUUID();
            if (form.cmdStr) {
                let itemCmd = splitStringIgnoringQuotes(form.cmdStr);
                for (const item of itemCmd) {
                    form.cmd.push(item.replace(/(?<!\\)"/g, '').replaceAll('\\"', '"'));
                }
            }
            form.entrypoint = [];
            if (form.entrypointStr) {
                let itemEntrypoint = splitStringIgnoringQuotes(form.entrypointStr);
                for (const item of itemEntrypoint) {
                    form.entrypoint.push(item.replace(/(?<!\\)"/g, '').replaceAll('\\"', '"'));
                }
            }
            if (form.publishAllPorts) {
                form.exposedPorts = [];
            } else {
                if (!checkPortValid()) {
                    return;
                }
            }
            form.memory = Number(form.memory);
            form.nanoCPUs = Number(form.nanoCPUs);

            loading.value = true;
            if (isCreate.value) {
                await rpc.container
                    .createContainer({ payloadJson: JSON.stringify(form) })
                    .then(() => {
                        loading.value = false;
                        openTaskLog(form.taskID);
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            } else {
                await rpc.container
                    .updateContainer({ payloadJson: JSON.stringify(form) })
                    .then(() => {
                        loading.value = false;
                        openTaskLog(form.taskID);
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            }
        };
        const openTaskLog = (taskID: string) => {
            taskLogRef.value.openWithTaskID(taskID);
        };
        const checkPortValid = () => {
            if (form.exposedPorts.length === 0) {
                return true;
            }
            for (const port of form.exposedPorts) {
                if (port.host.indexOf(':') !== -1) {
                    port.hostIP = port.host.substring(0, port.host.lastIndexOf(':'));
                    if (checkIpV4V6(port.hostIP)) {
                        MsgError(i18n.global.t('firewall.addressFormatError'));
                        return false;
                    }
                    port.hostPort = port.host.substring(port.host.lastIndexOf(':') + 1);
                } else {
                    port.hostIP = '';
                    port.hostPort = port.host;
                }
                if (port.hostPort.indexOf('-') !== -1) {
                    if (checkPort(port.hostPort.split('-')[0])) {
                        MsgError(i18n.global.t('firewall.portFormatError'));
                        return false;
                    }
                    if (checkPort(port.hostPort.split('-')[1])) {
                        MsgError(i18n.global.t('firewall.portFormatError'));
                        return false;
                    }
                } else {
                    if (checkPort(port.hostPort)) {
                        MsgError(i18n.global.t('firewall.portFormatError'));
                        return false;
                    }
                }
                if (port.containerPort.indexOf('-') !== -1) {
                    if (checkPort(port.containerPort.split('-')[0])) {
                        MsgError(i18n.global.t('firewall.portFormatError'));
                        return false;
                    }
                    if (checkPort(port.containerPort.split('-')[1])) {
                        MsgError(i18n.global.t('firewall.portFormatError'));
                        return false;
                    }
                } else {
                    if (checkPort(port.containerPort)) {
                        MsgError(i18n.global.t('firewall.portFormatError'));
                        return false;
                    }
                }
            }
            return true;
        };
        const isFromApp = (rowData: ContainerHelper) => {
            if (rowData && rowData.labels) {
                return rowData.labels.indexOf('createdBy=Apps') > -1;
            }
            return false;
        };
        const checkExist = async () => {
            let params = {
                page: 1,
                pageSize: 1,
                state: 'all',
                name: form.name,
                filters: '',
                orderBy: 'createdAt',
                order: 'null',
            };
            await rpc.container.search(params).then((res) => {
                if (res.items?.length === 1) {
                    isCreate.value = false;
                    routerToNameWithQuery('ContainerCreate', { name: form.name, t: Date.now() });
                    return;
                } else {
                    isCreate.value = true;
                }
            });
        };
        const escapeQuotes = (input) => {
            return input.replace(/(?<!\\)"/g, '\\"');
        };
        const splitStringIgnoringQuotes = (input) => {
            input = input.replace(/\\"/g, '<quota>');
            const regex = /"([^"]*)"|(\S+)/g;
            const result = [];
            let match;

            while ((match = regex.exec(input)) !== null) {
                if (match[1]) {
                    result.push(match[1].replaceAll('<quota>', '\\"'));
                } else if (match[2]) {
                    result.push(match[2].replaceAll('<quota>', '\\"'));
                }
            }

            return result;
        };
        onMounted(() => {
            if (router.currentRoute.value.query.name) {
                isCreate.value = false;
                form.name = String(router.currentRoute.value.query.name);
            } else {
                isCreate.value = true;
            }
            search();
        });
        return () => (
            <div>
                <LayoutContent
                    back-name="ContainerItem"
                    title={
                        unref(isCreate) ? $t('commons.button.create') : $t('commons.button.edit') + ' - ' + form.name
                    }
                    v-slots={{
                        main: () => (
                            <>
                                {withDirectives(
                                    <ElForm
                                        ref={formRef}
                                        label-position="top"
                                        model={form}
                                        rules={rules}
                                        label-width="80px"
                                    >
                                        <ElRow type="flex" justify="center" gutter={20}>
                                            <ElCol span={20}>
                                                <ElCard>
                                                    {!unref(isCreate) && isFromApp(form) ? (
                                                        <ElAlert
                                                            title={$t('container.containerFromAppHelper')}
                                                            closable={false}
                                                            type="error"
                                                        />
                                                    ) : null}
                                                    {unref(isCreate) ? (
                                                        <ElButton
                                                            disabled={!unref(isAdminOrNodeAdmin)}
                                                            type="primary"
                                                            icon="EditPen"
                                                            plain
                                                            onClick={($event?: any) => {
                                                                toTerminal();
                                                            }}
                                                        >
                                                            {$t('container.commandInput')}
                                                        </ElButton>
                                                    ) : null}
                                                    <ElFormItem
                                                        label={$t('commons.table.name')}
                                                        prop="name"
                                                        class={'mt-5'}
                                                    >
                                                        <ElInput
                                                            disabled={!unref(isCreate)}
                                                            clearable
                                                            modelValue={form.name}
                                                            onUpdate:modelValue={($v) => {
                                                                form.name = typeof $v === 'string' ? $v.trim() : $v;
                                                            }}
                                                            class={'mini-form-item'}
                                                        />
                                                        {!unref(isCreate) && isFromApp(form) ? (
                                                            <span class={'input-help'}>
                                                                {$t('container.containerFromAppHelper1')}
                                                                <ElButton
                                                                    size="small"
                                                                    text
                                                                    type="primary"
                                                                    onClick={($event?: any) => {
                                                                        goRouter();
                                                                    }}
                                                                    style={'margin-left: -5px'}
                                                                >
                                                                    <ElIcon>
                                                                        <Position />
                                                                    </ElIcon>
                                                                    {$t('firewall.quickJump')}
                                                                </ElButton>
                                                            </span>
                                                        ) : null}
                                                    </ElFormItem>
                                                    <ElFormItem label={$t('container.image')} prop="image">
                                                        <ElCheckbox
                                                            modelValue={form.imageInput}
                                                            onUpdate:modelValue={($v) => {
                                                                form.imageInput = $v as any;
                                                            }}
                                                            label={$t('container.input')}
                                                        />
                                                    </ElFormItem>
                                                    <ElFormItem>
                                                        {!form.imageInput ? (
                                                            <ElSelect
                                                                filterable
                                                                modelValue={form.image}
                                                                onUpdate:modelValue={($v) => {
                                                                    form.image = $v as any;
                                                                }}
                                                                class={'mini-form-item'}
                                                            >
                                                                {(unref(images) || []).map((item, index) => (
                                                                    <ElOption value={item} label={item} key={index} />
                                                                ))}
                                                            </ElSelect>
                                                        ) : (
                                                            <ElInput
                                                                modelValue={form.image}
                                                                onUpdate:modelValue={($v) => {
                                                                    form.image = $v as any;
                                                                }}
                                                                class={'mini-form-item'}
                                                            />
                                                        )}
                                                    </ElFormItem>
                                                    <ElFormItem prop="forcePull">
                                                        <ElCheckbox
                                                            modelValue={form.forcePull}
                                                            onUpdate:modelValue={($v) => {
                                                                form.forcePull = $v as any;
                                                            }}
                                                        >
                                                            {$t('container.forcePull')}
                                                        </ElCheckbox>
                                                        <span class={'input-help'}>
                                                            {$t('container.forcePullHelper')}
                                                        </span>
                                                    </ElFormItem>
                                                    <ElFormItem prop="autoRemove">
                                                        <ElCheckbox
                                                            modelValue={form.autoRemove}
                                                            onUpdate:modelValue={($v) => {
                                                                form.autoRemove = $v as any;
                                                            }}
                                                        >
                                                            {$t('container.autoRemove')}
                                                        </ElCheckbox>
                                                    </ElFormItem>
                                                    <ElFormItem label={$t('commons.table.port')}>
                                                        <ElRadioGroup
                                                            modelValue={form.publishAllPorts}
                                                            onUpdate:modelValue={($v) => {
                                                                form.publishAllPorts = $v as any;
                                                            }}
                                                            class={'ml-4'}
                                                        >
                                                            <ElRadio value={false}>
                                                                {$t('container.exposePort')}
                                                            </ElRadio>
                                                            <ElRadio value={true}>{$t('container.exposeAll')}</ElRadio>
                                                        </ElRadioGroup>
                                                    </ElFormItem>
                                                    {!form.publishAllPorts ? (
                                                        <ElFormItem>
                                                            {form.exposedPorts.length !== 0 ? (
                                                                <ElTable data={form.exposedPorts}>
                                                                    <ElTableColumn
                                                                        label={$t('container.server')}
                                                                        min-width="200"
                                                                        v-slots={{
                                                                            default: ({ row }) => (
                                                                                <>
                                                                                    <ElInput
                                                                                        placeholder={$t(
                                                                                            'container.serverExample',
                                                                                        )}
                                                                                        modelValue={row.host}
                                                                                        onUpdate:modelValue={($v) => {
                                                                                            row.host = $v as any;
                                                                                        }}
                                                                                    />
                                                                                </>
                                                                            ),
                                                                        }}
                                                                    />
                                                                    <ElTableColumn
                                                                        label={$t('menu.container')}
                                                                        min-width="120"
                                                                        v-slots={{
                                                                            default: ({ row }) => (
                                                                                <>
                                                                                    <ElInput
                                                                                        placeholder={$t(
                                                                                            'container.containerExample',
                                                                                        )}
                                                                                        modelValue={row.containerPort}
                                                                                        onUpdate:modelValue={($v) => {
                                                                                            row.containerPort =
                                                                                                $v as any;
                                                                                        }}
                                                                                    />
                                                                                </>
                                                                            ),
                                                                        }}
                                                                    />
                                                                    <ElTableColumn
                                                                        label={$t('commons.table.protocol')}
                                                                        min-width="100"
                                                                        v-slots={{
                                                                            default: ({ row }) => (
                                                                                <>
                                                                                    <ElRadioGroup
                                                                                        modelValue={row.protocol}
                                                                                        onUpdate:modelValue={($v) => {
                                                                                            row.protocol = $v as any;
                                                                                        }}
                                                                                    >
                                                                                        <ElRadio value="tcp">
                                                                                            {'tcp'}
                                                                                        </ElRadio>
                                                                                        <ElRadio value="udp">
                                                                                            {'udp'}
                                                                                        </ElRadio>
                                                                                    </ElRadioGroup>
                                                                                </>
                                                                            ),
                                                                        }}
                                                                    />
                                                                    <ElTableColumn
                                                                        min-width="80"
                                                                        v-slots={{
                                                                            default: (scope) => (
                                                                                <>
                                                                                    <ElButton
                                                                                        link
                                                                                        type="primary"
                                                                                        onClick={($event?: any) => {
                                                                                            handlePortsDelete(
                                                                                                scope.$index,
                                                                                            );
                                                                                        }}
                                                                                    >
                                                                                        {$t('commons.button.delete')}
                                                                                    </ElButton>
                                                                                </>
                                                                            ),
                                                                        }}
                                                                    />
                                                                </ElTable>
                                                            ) : null}
                                                            <ElButton
                                                                onClick={($event?: any) => {
                                                                    handlePortsAdd();
                                                                }}
                                                                class={'mt-2 ml-3'}
                                                            >
                                                                {$t('commons.button.add')}
                                                            </ElButton>
                                                        </ElFormItem>
                                                    ) : null}
                                                </ElCard>
                                                <ElTabs type="border-card" class={'mt-5'}>
                                                    <ElTabPane label={$t('container.network')}>
                                                        <Network ref={networkRef} networks={form.networks} />
                                                        <ElDivider border-style="dashed" />
                                                        <ElRow gutter={20}>
                                                            <ElCol xs={24} sm={10} md={10} lg={10} xl={10}>
                                                                <ElFormItem
                                                                    label={$t('toolbox.device.hostname')}
                                                                    prop="hostname"
                                                                >
                                                                    <ElInput
                                                                        modelValue={form.hostname}
                                                                        onUpdate:modelValue={($v) => {
                                                                            form.hostname = $v as any;
                                                                        }}
                                                                    />
                                                                </ElFormItem>
                                                            </ElCol>
                                                            <ElCol xs={24} sm={10} md={10} lg={10} xl={10}>
                                                                <ElFormItem label="Domain" prop="domainName">
                                                                    <ElInput
                                                                        modelValue={form.domainName}
                                                                        onUpdate:modelValue={($v) => {
                                                                            form.domainName = $v as any;
                                                                        }}
                                                                    />
                                                                </ElFormItem>
                                                            </ElCol>
                                                            <ElCol xs={24} sm={10} md={10} lg={10} xl={10}>
                                                                <ElFormItem label="DNS" prop="dns">
                                                                    {(form.dns || []).map((_, index) => (
                                                                        <div class={'w-full'} key={index}>
                                                                            <ElInput
                                                                                modelValue={form.dns[index]}
                                                                                onUpdate:modelValue={($v) => {
                                                                                    form.dns[index] = $v as any;
                                                                                }}
                                                                                class={'mt-2'}
                                                                                v-slots={{
                                                                                    append: () => (
                                                                                        <>
                                                                                            <ElButton
                                                                                                link
                                                                                                icon="Delete"
                                                                                                onClick={(
                                                                                                    $event?: any,
                                                                                                ) => {
                                                                                                    form.dns.splice(
                                                                                                        index,
                                                                                                        1,
                                                                                                    );
                                                                                                }}
                                                                                            />
                                                                                        </>
                                                                                    ),
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    ))}
                                                                    <ElButton
                                                                        onClick={($event?: any) => {
                                                                            form.dns.push('');
                                                                        }}
                                                                        class={'mt-2'}
                                                                    >
                                                                        {$t('commons.button.add')}
                                                                    </ElButton>
                                                                </ElFormItem>
                                                            </ElCol>
                                                        </ElRow>
                                                    </ElTabPane>
                                                    <ElTabPane label={$t('container.mount')}>
                                                        <Volume ref={volumeRef} volumes={form.volumes} />
                                                    </ElTabPane>
                                                    <ElTabPane label={$t('runtime.extraHosts')}>
                                                        <ExtraHosts extraHosts={form.extraHosts} />
                                                    </ElTabPane>
                                                    <ElTabPane label={$t('terminal.command')}>
                                                        <ElRow gutter={20}>
                                                            <ElCol xs={24} sm={20} md={20} lg={20} xl={20}>
                                                                <ElFormItem label="Command" prop="cmdStr">
                                                                    <ElInput
                                                                        modelValue={form.cmdStr}
                                                                        onUpdate:modelValue={($v) => {
                                                                            form.cmdStr = $v as any;
                                                                        }}
                                                                        placeholder={$t('container.cmdHelper')}
                                                                    />
                                                                </ElFormItem>
                                                            </ElCol>
                                                        </ElRow>
                                                        <ElRow gutter={20}>
                                                            <ElCol xs={24} sm={20} md={20} lg={20} xl={20}>
                                                                <ElFormItem label="Entrypoint" prop="entrypointStr">
                                                                    <ElInput
                                                                        modelValue={form.entrypointStr}
                                                                        onUpdate:modelValue={($v) => {
                                                                            form.entrypointStr = $v as any;
                                                                        }}
                                                                        placeholder={$t('container.entrypointHelper')}
                                                                    />
                                                                </ElFormItem>
                                                            </ElCol>
                                                        </ElRow>
                                                        <ElRow gutter={20}>
                                                            <ElCol xs={24} sm={10} md={10} lg={10} xl={10}>
                                                                <ElFormItem
                                                                    label={$t('container.workingDir')}
                                                                    prop="workingDir"
                                                                >
                                                                    <ElInput
                                                                        modelValue={form.workingDir}
                                                                        onUpdate:modelValue={($v) => {
                                                                            form.workingDir = $v as any;
                                                                        }}
                                                                    />
                                                                </ElFormItem>
                                                            </ElCol>
                                                            <ElCol xs={24} sm={10} md={10} lg={10} xl={10}>
                                                                <ElFormItem
                                                                    label={$t('commons.table.user')}
                                                                    prop="user"
                                                                >
                                                                    <ElInput
                                                                        modelValue={form.user}
                                                                        onUpdate:modelValue={($v) => {
                                                                            form.user = $v as any;
                                                                        }}
                                                                    />
                                                                </ElFormItem>
                                                            </ElCol>
                                                        </ElRow>
                                                        <ElFormItem label={$t('container.console')}>
                                                            <ElCheckbox
                                                                modelValue={form.tty}
                                                                onUpdate:modelValue={($v) => {
                                                                    form.tty = $v as any;
                                                                }}
                                                            >
                                                                {$t('container.tty')}
                                                            </ElCheckbox>
                                                            <ElCheckbox
                                                                modelValue={form.openStdin}
                                                                onUpdate:modelValue={($v) => {
                                                                    form.openStdin = $v as any;
                                                                }}
                                                            >
                                                                {$t('container.openStdin')}
                                                            </ElCheckbox>
                                                        </ElFormItem>
                                                    </ElTabPane>
                                                    <ElTabPane label={$t('container.resource')}>
                                                        <ElFormItem label={$t('container.cpuShare')} prop="cpuShares">
                                                            <ElInput
                                                                modelValue={form.cpuShares}
                                                                onUpdate:modelValue={($v) => {
                                                                    form.cpuShares = $v === '' ? $v : Number($v);
                                                                }}
                                                                class={'mini-form-item'}
                                                            />
                                                            <span class={'input-help'}>
                                                                {$t('container.cpuShareHelper')}
                                                            </span>
                                                        </ElFormItem>
                                                        <ElFormItem
                                                            label={$t('container.cpuQuota')}
                                                            prop="nanoCPUs"
                                                            rules={checkFloatNumberRange(0, Number(unref(limits).cpu))}
                                                        >
                                                            <ElInput
                                                                modelValue={form.nanoCPUs}
                                                                onUpdate:modelValue={($v) => {
                                                                    form.nanoCPUs = $v as any;
                                                                }}
                                                                class={'mini-form-item'}
                                                                v-slots={{
                                                                    append: () => (
                                                                        <>
                                                                            <div style={'width: 35px'}>
                                                                                {$t('commons.units.core')}
                                                                            </div>
                                                                        </>
                                                                    ),
                                                                }}
                                                            />
                                                            <span class={'input-help'}>
                                                                {$t('container.limitHelper', [unref(limits).cpu])}
                                                                {$t('commons.units.core')}
                                                            </span>
                                                        </ElFormItem>
                                                        <ElFormItem
                                                            label={$t('container.memoryLimit')}
                                                            prop="memory"
                                                            rules={checkFloatNumberRange(
                                                                0,
                                                                Number(unref(limits).memory),
                                                            )}
                                                        >
                                                            <ElInput
                                                                modelValue={form.memory}
                                                                onUpdate:modelValue={($v) => {
                                                                    form.memory = $v as any;
                                                                }}
                                                                class={'mini-form-item'}
                                                                v-slots={{
                                                                    append: () => (
                                                                        <>
                                                                            <div style={'width: 35px'}>{'MB'}</div>
                                                                        </>
                                                                    ),
                                                                }}
                                                            />
                                                            <span class={'input-help'}>
                                                                {$t('container.limitHelper', [unref(limits).memory])}
                                                                {'MB '}
                                                            </span>
                                                        </ElFormItem>
                                                        <ElFormItem>
                                                            <ElCheckbox
                                                                modelValue={form.privileged}
                                                                onUpdate:modelValue={($v) => {
                                                                    form.privileged = $v as any;
                                                                }}
                                                            >
                                                                {$t('container.privileged')}
                                                            </ElCheckbox>
                                                            <span class={'input-help'}>
                                                                {$t('container.privilegedHelper')}
                                                            </span>
                                                        </ElFormItem>
                                                    </ElTabPane>
                                                    <ElTabPane
                                                        label={$t('container.tag') + ' & ' + $t('container.env')}
                                                    >
                                                        <ElRow gutter={20}>
                                                            <ElCol xs={24} sm={20} md={20} lg={20} xl={20}>
                                                                <ElFormItem label={$t('container.tag')} prop="labels">
                                                                    {(form.labels || []).map((_, index) => (
                                                                        <div class={'w-full'} key={index}>
                                                                            <ElInput
                                                                                placeholder="e.g. key=val"
                                                                                modelValue={form.labels[index]}
                                                                                onUpdate:modelValue={($v) => {
                                                                                    form.labels[index] = $v as any;
                                                                                }}
                                                                                class={'mt-2'}
                                                                                v-slots={{
                                                                                    append: () => (
                                                                                        <>
                                                                                            <ElButton
                                                                                                link
                                                                                                icon="Delete"
                                                                                                onClick={(
                                                                                                    $event?: any,
                                                                                                ) => {
                                                                                                    form.labels.splice(
                                                                                                        index,
                                                                                                        1,
                                                                                                    );
                                                                                                }}
                                                                                            />
                                                                                        </>
                                                                                    ),
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    ))}
                                                                    <ElButton
                                                                        onClick={($event?: any) => {
                                                                            form.labels.push('');
                                                                        }}
                                                                        class={'mt-2'}
                                                                    >
                                                                        {$t('commons.button.add')}
                                                                    </ElButton>
                                                                </ElFormItem>
                                                            </ElCol>
                                                            <ElCol xs={24} sm={20} md={20} lg={20} xl={20}>
                                                                <ElFormItem label={$t('container.env')} prop="envStr">
                                                                    {(form.env || []).map((_, index) => (
                                                                        <div class={'w-full'} key={index}>
                                                                            <ElInput
                                                                                placeholder="e.g. key=val"
                                                                                modelValue={form.env[index]}
                                                                                onUpdate:modelValue={($v) => {
                                                                                    form.env[index] = $v as any;
                                                                                }}
                                                                                class={'mt-2'}
                                                                                v-slots={{
                                                                                    append: () => (
                                                                                        <>
                                                                                            <ElButton
                                                                                                link
                                                                                                icon="Delete"
                                                                                                onClick={(
                                                                                                    $event?: any,
                                                                                                ) => {
                                                                                                    form.env.splice(
                                                                                                        index,
                                                                                                        1,
                                                                                                    );
                                                                                                }}
                                                                                            />
                                                                                        </>
                                                                                    ),
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    ))}
                                                                    <ElButton
                                                                        onClick={($event?: any) => {
                                                                            form.env.push('');
                                                                        }}
                                                                        class={'mt-2'}
                                                                    >
                                                                        {$t('commons.button.add')}
                                                                    </ElButton>
                                                                </ElFormItem>
                                                            </ElCol>
                                                        </ElRow>
                                                    </ElTabPane>
                                                    <ElTabPane label={$t('container.restartPolicy')}>
                                                        <ElFormItem prop="restartPolicy">
                                                            <ElRadioGroup
                                                                modelValue={form.restartPolicy}
                                                                onUpdate:modelValue={($v) => {
                                                                    form.restartPolicy = $v as any;
                                                                }}
                                                            >
                                                                <ElRadio value="no">{$t('container.no')}</ElRadio>
                                                                <ElRadio value="always">
                                                                    {$t('container.always')}
                                                                </ElRadio>
                                                                <ElRadio value="on-failure">
                                                                    {$t('container.onFailure')}
                                                                </ElRadio>
                                                                <ElRadio value="unless-stopped">
                                                                    {$t('container.unlessStopped')}
                                                                </ElRadio>
                                                            </ElRadioGroup>
                                                        </ElFormItem>
                                                    </ElTabPane>
                                                </ElTabs>
                                                <ElFormItem class={'mt-5'}>
                                                    <ElButton
                                                        disabled={unref(loading)}
                                                        onClick={($event?: any) => {
                                                            (goBack as any)($event);
                                                        }}
                                                    >
                                                        {$t('commons.button.back')}
                                                    </ElButton>
                                                    <ElButton
                                                        disabled={unref(loading)}
                                                        type="primary"
                                                        onClick={($event?: any) => {
                                                            onSubmit(unref(formRef));
                                                        }}
                                                    >
                                                        {$t('commons.button.confirm')}
                                                    </ElButton>
                                                </ElFormItem>
                                            </ElCol>
                                        </ElRow>
                                    </ElForm>,
                                    [[vLoading, unref(loading)]],
                                )}
                            </>
                        ),
                    }}
                />
                <Confirm
                    ref={confirmRef}
                    onSubmit={($event?: any) => {
                        (submit as any)($event);
                    }}
                />
                <TaskLog
                    ref={taskLogRef}
                    width="70%"
                    show-close={false}
                    v-slots={{
                        'task-footer': () => (
                            <>
                                <ElButton
                                    onClick={($event?: any) => {
                                        (goBack as any)($event);
                                    }}
                                >
                                    {$t('commons.table.backToList')}
                                </ElButton>
                                <ElButton
                                    type="primary"
                                    onClick={($event?: any) => {
                                        (closeTask as any)($event);
                                    }}
                                >
                                    {$t('commons.table.keepEdit')}
                                </ElButton>
                            </>
                        ),
                    }}
                />
                <TerminalDialog ref={dialogTerminalRef} />
            </div>
        );
    },
    options,
);
