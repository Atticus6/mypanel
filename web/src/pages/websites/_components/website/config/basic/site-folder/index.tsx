import { $t } from '@/utils/i18n-t';
import { Website } from '@/types/website';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { routerToFileWithPath } from '@/utils/router';
import { rpc } from '@/lib/rpc';
import './index.styles.css';
import { FolderOpened } from '@element-plus/icons-vue';

interface CodemodProps {
    [key: string]: any;
    id?: number;
}

const emits = {};

const options = {
    name: 'site-folder',
    props: {
        id: {
            type: Number,
            default: 0,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-0b812b2a',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const websiteId = computed(() => {
            return Number(__panelSetupProps.id);
        });
        const website = ref<any>({});
        const loading = ref(false);
        const configDir = ref(false);
        const update = reactive({
            id: 0,
            siteDir: '/',
        });
        const updatePermission = reactive({
            id: 0,
            user: '1000',
            group: '1000',
        });
        const siteForm = ref<FormInstance>();
        const dirs = ref([]);
        const dirConfig = ref<Website.DirConfig>({
            dirs: [''],
            user: '',
            userGroup: '',
            msg: '',
        });
        const search = () => {
            loading.value = true;
            (rpc.website.getWebsite({ id: websiteId.value }) as Promise<any>)
                .then((res) => {
                    website.value = res.data;
                    update.id = website.value.id;
                    update.siteDir = website.value.siteDir.startsWith('/')
                        ? website.value.siteDir
                        : '/' + website.value.siteDir;
                    updatePermission.id = website.value.id;
                    updatePermission.group = website.value.group === '' ? '1000' : website.value.group;
                    updatePermission.user = website.value.user === '' ? '1000' : website.value.user;
                    if (
                        (website.value.type === 'static' || website.value.runtimeID > 0) &&
                        website.value.type != 'subsite'
                    ) {
                        configDir.value = true;
                        getConfig();
                    }
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        const submit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            await formEl.validate((valid) => {
                if (!valid) {
                    return;
                }
                loading.value = true;
                rpc.website
                    .updateSiteDir({
                        id: update.id,
                        siteDir: update.siteDir,
                    })
                    .then(() => {
                        MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                        search();
                    })
                    .finally(() => {
                        loading.value = false;
                    });
            });
        };
        const submitPermission = async () => {
            if (updatePermission.user === '' || updatePermission.group === '') {
                return;
            }
            loading.value = true;
            rpc.website
                .updateSitePermission({
                    id: updatePermission.id,
                    user: updatePermission.user,
                    group: updatePermission.group,
                })
                .then(() => {
                    MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                    search();
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        const initData = () => {
            dirs.value = [];
        };
        const getConfig = async () => {
            try {
                const res = await rpc.website.getSiteDir({ id: __panelSetupProps.id });
                dirs.value = res.dirs;
                dirConfig.value = {
                    dirs: res.dirs,
                    user: res.user,
                    userGroup: res.group,
                    msg: '',
                };
            } catch (error) {}
        };
        onMounted(() => {
            initData();
            search();
        });
        return () => (
            <div v-loading={unref(loading)}>
                <div class={'site-form-wrapper'}>
                    <ElForm ref={siteForm} model={update} label-width="100px" class={'site-form moblie-form'}>
                        <ElFormItem label={$t('website.siteAlias')}>{unref(website).alias}</ElFormItem>
                        <ElFormItem label={$t('website.primaryPath')}>
                            <ElSpace wrap>
                                {unref(website).sitePath + '/index'}
                                <ElButton
                                    type="primary"
                                    link
                                    onClick={($event?: any) => {
                                        routerToFileWithPath(unref(website).sitePath + '/index');
                                    }}
                                >
                                    <ElIcon>
                                        <FolderOpened />
                                    </ElIcon>
                                </ElButton>
                            </ElSpace>
                            {unref(configDir) ? <span class={'input-help'}>{$t('php.indexHelper')}</span> : null}
                        </ElFormItem>
                        {unref(configDir) ? (
                            <ElFormItem label={$t('website.runDir')}>
                                <ElSpace wrap>
                                    <ElSelect v-model={update.siteDir} filterable class={'p-w-200'}>
                                        {(unref(dirs) || []).map((item, index) => (
                                            <ElOption label={item} value={item} key={index} />
                                        ))}
                                    </ElSelect>
                                    {
                                        <ElButton
                                            type="primary"
                                            onClick={($event?: any) => {
                                                submit(unref(siteForm));
                                            }}
                                            v-permission={true}
                                        >
                                            {$t('nginx.saveAndReload')}
                                        </ElButton>
                                    }
                                </ElSpace>
                                <span class={'input-help'}>{$t('website.runDirHelper2')}</span>
                            </ElFormItem>
                        ) : null}
                        {unref(configDir) ? (
                            <ElFormItem label={$t('website.userGroup')}>
                                <ElSpace wrap>
                                    <ElInput
                                        v-model={updatePermission.user}
                                        class={'user-num-input'}
                                        v-slots={{ prepend: () => <>{$t('commons.table.user')}</> }}
                                    />
                                    <ElInput
                                        v-model={updatePermission.group}
                                        class={'user-num-input'}
                                        v-slots={{ prepend: () => <>{$t('website.uGroup')}</> }}
                                    />
                                    {
                                        <ElButton
                                            type="primary"
                                            onClick={($event?: any) => {
                                                submitPermission();
                                            }}
                                            v-permission={true}
                                        >
                                            {$t('commons.button.save')}
                                        </ElButton>
                                    }
                                </ElSpace>
                            </ElFormItem>
                        ) : null}
                    </ElForm>
                    {unref(configDir) ? <ElText type="warning">{$t('website.runUserHelper')}</ElText> : null}
                    <br />
                    {unref(dirConfig).msg != '' ? <ElText type="danger">{unref(dirConfig).msg}</ElText> : null}
                    <br />
                    <ElDescriptions title={$t('website.folderTitle')} column={1} border>
                        <ElDescriptionsItem label="ssl">{$t('website.sslFolder')}</ElDescriptionsItem>
                        <ElDescriptionsItem label="log">{$t('logs.websiteLog')}</ElDescriptionsItem>
                        <ElDescriptionsItem label="index">{$t('website.indexFolder')}</ElDescriptionsItem>
                    </ElDescriptions>
                </div>
            </div>
        );
    },
    options,
);
