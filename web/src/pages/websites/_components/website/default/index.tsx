import { $t } from '@/utils/i18n-t';
import { Website } from '@/types/website';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { EditorState } from '@codemirror/state';
import { basicSetup, EditorView } from 'codemirror';
import { html } from '@codemirror/lang-html';
import { php } from '@codemirror/lang-php';
import { oneDark } from '@codemirror/theme-one-dark';
import './index.styles.css';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'default',
    props: {},
    emits: emits,
    __scopeId: 'data-v-6b3f3b84',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        let open = ref(false);
        let websites = ref<any>();
        let defaultId = ref(-1);
        let loading = ref(false);
        const activeTab = ref('site');
        const content = ref('');
        const view = ref();
        const htmlRef = ref();
        const htmlLoaded = ref(false);
        const req = reactive({
            type: '404',
            sync: false,
        });
        const acceptParams = () => {
            activeTab.value = 'site';
            defaultId.value = 0;
            req.type = '404';
            htmlLoaded.value = false;
            destroyEditor();
            get();
            open.value = true;
        };
        const handleClose = () => {
            open.value = false;
            destroyEditor();
        };
        const get = async () => {
            const res = await rpc.website.list({});
            websites.value = res.items as any;
            websites.value.forEach((website: Website.WebsiteDTO) => {
                if (website.defaultServer) {
                    defaultId.value = website.id;
                }
            });
        };
        const changeTab = async () => {
            if (activeTab.value === 'html' && !htmlLoaded.value) {
                await getHtml();
            }
        };
        const getHtml = async () => {
            loading.value = true;
            try {
                const res = await rpc.website.getDefaultHtml({ type: req.type });
                content.value = res.content;
                htmlLoaded.value = true;
                await nextTick();
                initEditor();
            } finally {
                loading.value = false;
            }
        };
        const destroyEditor = () => {
            if (view.value) {
                view.value.destroy();
                view.value = undefined;
            }
        };
        const initEditor = () => {
            destroyEditor();
            let extensions = [basicSetup, oneDark];
            if (req.type === 'php') {
                extensions.push(php());
            } else {
                extensions.push(html());
            }
            const startState = EditorState.create({
                doc: content.value,
                extensions: extensions,
            });
            if (htmlRef.value) {
                view.value = new EditorView({
                    state: startState,
                    parent: htmlRef.value,
                });
            }
        };
        const submit = () => {
            if (activeTab.value === 'html') {
                submitHtml();
                return;
            }
            submitDefaultServer();
        };
        const submitDefaultServer = () => {
            loading.value = true;
            rpc.website
                .changeDefault({ id: defaultId.value })
                .then(() => {
                    MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                    handleClose();
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        const submitHtml = async () => {
            loading.value = true;
            try {
                const content = view.value.state.doc.toString();
                await rpc.website.updateDefaultHtml({ type: req.type, content, sync: req.sync });
                MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
            } finally {
                loading.value = false;
            }
        };
        ctx.expose({ acceptParams });
        return () => (
            <DrawerPro
                v-model={open.value}
                header={$t('website.advancedSettings')}
                size="normal"
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                v-slots={{
                    content: () => (
                        <>
                            <ElTabs
                                v-model={activeTab.value}
                                tab-position="left"
                                onTabChange={($event?: any) => {
                                    (changeTab as any)($event);
                                }}
                            >
                                <ElTabPane label={$t('website.defaultServer')} name="site">
                                    {
                                        <ElForm
                                            onSubmit={($event?: any) => {
                                                $event.preventDefault();
                                            }}
                                            label-position="top"
                                            v-loading={unref(loading)}
                                        >
                                            <ElFormItem label={$t('website.defaultServer')}>
                                                <ElSelect v-model={defaultId.value}>
                                                    <ElOption
                                                        value={0}
                                                        label={$t('website.noDefaultServer')}
                                                        key={-1}
                                                    />
                                                    {(unref(websites) || []).map((website, key) => (
                                                        <ElOption
                                                            value={website.id}
                                                            label={website.primaryDomain}
                                                            key={key}
                                                        />
                                                    ))}
                                                </ElSelect>
                                            </ElFormItem>
                                        </ElForm>
                                    }
                                    <ElAlert
                                        closable={false}
                                        v-slots={{
                                            default: () => (
                                                <>
                                                    <span class={'whitespace-pre-line'}>
                                                        {$t('website.defaultServerHelper')}
                                                    </span>
                                                </>
                                            ),
                                        }}
                                    />
                                </ElTabPane>
                                <ElTabPane label={$t('website.defaultHtml')} name="html">
                                    {
                                        <ElSelect
                                            v-model={req.type}
                                            onChange={($event?: any) => {
                                                getHtml();
                                            }}
                                            class={'w-full'}
                                            v-loading={unref(loading)}
                                        >
                                            <ElOption value={'404'} label={$t('website.website404')} />
                                            <ElOption value={'domain404'} label={$t('website.domain404')} />
                                            <ElOption value={'index'} label={$t('website.indexHtml')} />
                                            <ElOption value={'php'} label={$t('website.indexPHP')} />
                                            <ElOption value={'stop'} label={$t('website.stopHtml')} />
                                        </ElSelect>
                                    }
                                    <div class={'mt-1.5'}>
                                        {req.type == '404' ? (
                                            <ElText type="info">{$t('website.website404Helper')}</ElText>
                                        ) : null}
                                    </div>
                                    <div class={'mt-1.5'}>
                                        <ElCheckbox v-model={req.sync}>{$t('website.syncHtmlHelper')}</ElCheckbox>
                                    </div>
                                    <div ref={htmlRef} class={'default-html'} />
                                </ElTabPane>
                            </ElTabs>
                        </>
                    ),
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        (handleClose as any)($event);
                                    }}
                                    disabled={unref(loading)}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                {
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            submit();
                                        }}
                                        disabled={unref(loading)}
                                        v-permission={true}
                                    >
                                        {$t(
                                            unref(activeTab) === 'site'
                                                ? 'commons.button.confirm'
                                                : 'commons.button.save',
                                        )}
                                    </ElButton>
                                }
                            </span>
                        </>
                    ),
                }}
            />
        );
    },
    options,
);
