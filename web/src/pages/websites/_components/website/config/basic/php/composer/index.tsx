import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { newUUID } from '@/utils/id';
import TaskLog from '@/components/log/task/index';
import FileList from '@/components/file-list/index';
import { rpc } from '@/lib/rpc';

interface CodemodProps {
    [key: string]: any;
    websiteID?: number;
}

const emits = {};

const options = {
    name: 'composer',
    props: {
        websiteID: {
            type: Number,
            default: 0,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const req = reactive({
            websiteID: 0,
            command: 'install',
            extCommand: '',
            mirror: 'https://mirrors.aliyun.com/composer/',
            dir: '',
            user: 'www-data',
            taskID: '',
        });
        const loading = ref(false);
        const taskLogRef = ref();
        const dirRef = ref();
        const mirrors = [
            {
                label: i18n.global.t('runtime.aliyun') + '(mirrors.aliyun.com)',
                value: 'https://mirrors.aliyun.com/composer/',
            },
            {
                label: i18n.global.t('website.tencentCloud') + '(mirrors.cloud.tencent.com)',
                value: 'https://mirrors.cloud.tencent.com/composer/',
            },
            {
                label: i18n.global.t('commons.table.default') + '(repo.packagist.org)',
                value: 'https://repo.packagist.org',
            },
            {
                label: i18n.global.t('website.packagist') + '(packagist.phpcomposer.com)',
                value: 'https://packagist.phpcomposer.com',
            },
            {
                label: i18n.global.t('website.huaweicloud') + '(mirrors.huaweicloud.com)',
                value: 'https://mirrors.huaweicloud.com/repository/php',
            },
            {
                label: 'Packagist Mirror' + '(packagist.mirrors.sjtug.sjtu.edu.cn)',
                value: 'https://packagist.mirrors.sjtug.sjtu.edu.cn/',
            },
        ];
        const getPath = (execDir: string) => {
            req.dir = execDir;
        };
        const search = () => {
            loading.value = true;
            (rpc.website.getWebsite({ id: req.websiteID }) as Promise<any>)
                .then((res) => {
                    req.dir = res.data.sitePath + '/index';
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        const exec = async () => {
            const taskID = newUUID();
            req.taskID = taskID;
            try {
                await rpc.website.execComposer({
                    command: req.command,
                    extCommand: req.extCommand,
                    mirror: req.mirror,
                    dir: req.dir,
                    user: req.user,
                    websiteId: __panelSetupProps.websiteID,
                    taskId: taskID,
                });
                taskLogRef.value.openWithTaskID(taskID);
            } catch (error) {
                return;
            }
        };
        onMounted(() => {
            req.websiteID = __panelSetupProps.websiteID;
            search();
        });
        return () => (
            <>
                <ElForm label-position="right" label-width="100px">
                    <ElFormItem label={$t('website.execParameters')}>
                        <ElSelect v-model={req.command} class={'p-w-400'}>
                            <ElOption label="install" value="install" />
                            <ElOption label="update" value="update" />
                            <ElOption label="require" value="require" />
                            <ElOption label="create-project" value="create-project" />
                            <ElOption label={$t('container.custom')} value="custom" />
                        </ElSelect>
                    </ElFormItem>
                    <ElFormItem label={$t('website.extCommand')}>
                        <ElInput
                            modelValue={req.extCommand}
                            onUpdate:modelValue={($v) => {
                                req.extCommand = typeof $v === 'string' ? $v.trim() : $v;
                            }}
                            class={'p-w-400'}
                        />
                    </ElFormItem>
                    <ElFormItem label={$t('website.mirror')}>
                        <ElSelect v-model={req.mirror} class={'p-w-400'}>
                            {(mirrors || []).map((mirror) => (
                                <ElOption
                                    value={mirror.value}
                                    label={mirror.label + ' [' + mirror.value + ']'}
                                    key={mirror.label}
                                />
                            ))}
                        </ElSelect>
                    </ElFormItem>
                    <ElFormItem label={$t('website.execUser')}>
                        <ElSelect v-model={req.user} class={'p-w-400'}>
                            <ElOption label="www-data" value="www-data" />
                            <ElOption label="root" value="root" />
                        </ElSelect>
                    </ElFormItem>
                    <ElFormItem label={$t('website.execDir')}>
                        <ElInput
                            modelValue={req.dir}
                            onUpdate:modelValue={($v) => {
                                req.dir = typeof $v === 'string' ? $v.trim() : $v;
                            }}
                            class={'p-w-400'}
                            v-slots={{
                                prepend: () => (
                                    <>
                                        <ElButton
                                            icon="Folder"
                                            onClick={($event?: any) => {
                                                unref(dirRef).acceptParams({ dir: true, path: req.dir });
                                            }}
                                        />
                                    </>
                                ),
                            }}
                        />
                    </ElFormItem>
                    <ElFormItem>
                        {
                            <ElButton
                                type="primary"
                                onClick={($event?: any) => {
                                    (exec as any)($event);
                                }}
                                v-permission={true}
                            >
                                {$t('commons.button.handle')}
                            </ElButton>
                        }
                    </ElFormItem>
                </ElForm>
                <TaskLog
                    ref={taskLogRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <FileList
                    ref={dirRef}
                    dir={true}
                    onChoose={($event?: any) => {
                        (getPath as any)($event);
                    }}
                />
            </>
        );
    },
    options,
);
