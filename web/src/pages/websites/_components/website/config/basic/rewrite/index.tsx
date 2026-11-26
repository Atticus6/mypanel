import { $t } from '@/utils/i18n-t';
import { Rewrites } from '@/global/mimetype';
import { MsgSuccess } from '@/utils/message';
import CodemirrorPro from '@/components/codemirror-pro/index';
import i18n from '@/lang';
import { rpc } from '@/lib/rpc';
import CustomRewrite from '@/pages/websites/_components/website/config/basic/rewrite/custom/index';
import OpDialog from '@/components/del-dialog/index';

interface CodemodProps {
    [key: string]: any;
    id?: number;
}

const emits = {};

const options = {
    name: 'rewrite',
    props: {
        id: {
            type: Number,
            default: 0,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref(false);
        const content = ref(' ');
        const codeRef = ref();
        const customRef = ref();
        const id = computed(() => {
            return __panelSetupProps.id;
        });
        const req = reactive({
            websiteID: id.value,
            name: 'default',
        });
        const update = reactive({
            websiteID: id.value,
            content: 'd',
            name: '',
        });
        const rewrites = ref([]);
        const deleteRef = ref();
        const getRewrite = async (rewrite: string) => {
            loading.value = true;
            req.name = rewrite;
            req.websiteID = id.value;
            try {
                const res = await rpc.website.getRewrite({ websiteId: id.value, name: rewrite });
                content.value = res.content;
                if (res.content == '') {
                    content.value = ' ';
                }
                setCursorPosition();
            } catch (error) {
            } finally {
                loading.value = false;
            }
        };
        const setCursorPosition = () => {
            nextTick(() => {
                const codeMirrorInstance = codeRef.value?.codemirror;
                codeMirrorInstance?.setCursor(0, 0);
            });
        };
        const submit = async () => {
            update.name = req.name;
            update.websiteID = id.value;
            update.content = content.value;
            loading.value = true;
            try {
                await rpc.website.updateRewrite({
                    websiteId: id.value,
                    name: update.name,
                    content: content.value,
                });
                MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
            } catch (error) {
            } finally {
                loading.value = false;
            }
        };
        const opCustomRewrite = async () => {
            customRef.value.acceptParams(content.value);
        };
        const deleteCustomRewrite = (name: string) => {
            deleteRef.value.acceptParams({
                title: i18n.global.t('commons.button.delete'),
                names: [name],
                msg: i18n.global.t('commons.msg.operatorHelper', [
                    i18n.global.t('container.template'),
                    i18n.global.t('commons.button.delete'),
                ]),
                api: (params: { name: string; operate: string; content?: string }) =>
                    rpc.website.operateCustomRewrite({
                        name: params.name,
                        operate: params.operate as any,
                        content: params.content || '',
                    }),
                params: { name: name, operate: 'delete' },
            });
        };
        const init = () => {
            rpc.website.listCustomRewrite({}).then((res) => {
                rewrites.value = [];
                if (res) {
                    for (const d of res.items) {
                        rewrites.value.push({
                            resource: 'custom',
                            name: d,
                        });
                    }
                }
                for (const r of Rewrites) {
                    rewrites.value.push({
                        resource: 'default',
                        name: r,
                    });
                }
            });
            (rpc.website.getWebsite({ id: id.value }) as Promise<any>).then((res) => {
                const name = res.data.rewrite == '' ? 'default' : 'current';
                if (name === 'current') {
                    req.name = 'current';
                }
                getRewrite(name);
            });
        };
        onMounted(() => {
            init();
        });
        return () => (
            <div>
                <ElFormItem label={$t('website.rewriteMode')}>
                    <ElSelect
                        v-model={req.name}
                        filterable
                        onChange={($event?: any) => {
                            getRewrite(req.name);
                        }}
                        class={'p-w-200'}
                    >
                        <ElOption label={$t('website.current')} value={'current'} />
                        {(unref(rewrites) || []).map((rewrite, index) => (
                            <ElOption label={rewrite.name} value={rewrite.name} key={index}>
                                <span>{rewrite.name}</span>
                                {rewrite.resource == 'custom' ? (
                                    <ElButton
                                        link
                                        icon="Close"
                                        onClick={($event?: any) => {
                                            deleteCustomRewrite(rewrite.name);
                                        }}
                                        class={'float-right mt-1.5'}
                                        v-permission={true}
                                    />
                                ) : null}
                            </ElOption>
                        ))}
                    </ElSelect>
                </ElFormItem>
                <ElText type="warning">{$t('website.rewriteHelper2')}</ElText>
                <CodemirrorPro v-model={content.value} mode="nginx" heightDiff={500} />
                <div class={'mt-2'}>
                    <ElFormItem>
                        <ElAlert title={$t('website.rewriteHelper')} type="info" closable={false} />
                    </ElFormItem>
                    {
                        <ElButton
                            type="primary"
                            onClick={($event?: any) => {
                                submit();
                            }}
                            v-permission={true}
                        >
                            {$t('nginx.saveAndReload')}
                        </ElButton>
                    }
                    {
                        <ElButton
                            type="primary"
                            onClick={($event?: any) => {
                                opCustomRewrite();
                            }}
                            disabled={unref(content) == ''}
                            v-permission={true}
                        >
                            {$t('website.saveCustom')}
                        </ElButton>
                    }
                </div>
                <CustomRewrite
                    ref={customRef}
                    onClose={($event?: any) => {
                        init();
                    }}
                />
                <OpDialog
                    ref={deleteRef}
                    onSearch={($event?: any) => {
                        init();
                    }}
                />
            </div>
        );
    },
    options,
);
