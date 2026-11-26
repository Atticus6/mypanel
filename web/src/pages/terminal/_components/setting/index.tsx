import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import { Terminal } from '@xterm/xterm';
import OperateDialog from '@/pages/terminal/_components/setting/default-conn/index';
import '@xterm/xterm/css/xterm.css';
import { FitAddon } from '@xterm/addon-fit';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { TerminalDockSessionStore, TerminalStore } from '@/store';
import './index.styles.css';
import LayoutContent from '@/components/layout-content/index';
import OpDialog from '@/components/del-dialog/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'setting',
    props: {},
    emits: emits,
    __scopeId: 'data-v-58f935df',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref(false);
        const terminalStore = TerminalStore();
        const dockSessions = TerminalDockSessionStore();
        const dialogRef = ref();
        const terminalElement = ref<HTMLDivElement | null>(null);
        const fitAddon = new FitAddon();
        const term = ref();
        const previewResizeObserver = ref<ResizeObserver>();
        const DEFAULT_FONT_FAMILY = "Monaco, Menlo, Consolas, 'Courier New', monospace";
        const selectedFontFamilies = ref<string[]>([]);
        const fontFamilyOptions = [
            { label: 'Monaco', value: 'Monaco' },
            { label: 'Menlo', value: 'Menlo' },
            { label: 'Consolas', value: 'Consolas' },
            { label: 'JetBrains Mono', value: "'JetBrains Mono'" },
            { label: 'Fira Code', value: "'Fira Code'" },
            { label: 'Cascadia Code', value: "'Cascadia Code'" },
            { label: 'Source Code Pro', value: "'Source Code Pro'" },
            { label: 'Ubuntu Mono', value: "'Ubuntu Mono'" },
            { label: 'DejaVu Sans Mono', value: "'DejaVu Sans Mono'" },
            { label: 'Courier New', value: "'Courier New'" },
            { label: 'monospace', value: 'monospace' },
        ];
        const form = reactive({
            showTerminalButton: true,
            lineHeight: 1.2,
            letterSpacing: 1.2,
            fontSize: 12,
            fontFamily: DEFAULT_FONT_FAMILY,
            backgroundColor: '#000000',
            foregroundColor: '#f5f5f5',
            cursorBlink: 'Enable',
            cursorStyle: 'underline',
            scrollback: 1000,
            scrollSensitivity: 6,
            showDefaultConn: false,
            defaultConn: '',
        });
        const resetConn = ref(false);
        const opRef = ref();
        const splitFontFamily = (value: string): string[] => {
            return value
                .split(',')
                .map((item) => item.trim())
                .filter((item) => item.length > 0);
        };
        const syncFontFamilyFromSelected = () => {
            const values = selectedFontFamilies.value.map((item) => item.trim()).filter((item) => item.length > 0);
            form.fontFamily = values.join(', ');
        };
        const ensureFontFamily = () => {
            if (selectedFontFamilies.value.length > 0) return;
            selectedFontFamilies.value = splitFontFamily(DEFAULT_FONT_FAMILY);
            form.fontFamily = DEFAULT_FONT_FAMILY;
            if (term.value) {
                changeItem();
            }
        };
        watch(
            selectedFontFamilies,
            () => {
                syncFontFamilyFromSelected();
                if (!term.value) return;
                changeItem();
            },
            { deep: true },
        );
        const acceptParams = () => {
            search(true);
            loadConnShow();
            iniTerm();
        };
        onMounted(() => {
            previewResizeObserver.value = new ResizeObserver(() => {
                if (!term.value) return;
                fitAddon.fit();
            });
            if (terminalElement.value) {
                previewResizeObserver.value.observe(terminalElement.value);
            }
        });
        onBeforeUnmount(() => {
            previewResizeObserver.value?.disconnect();
        });
        const search = async (withReset?: boolean) => {
            loading.value = true;
            await rpc.core.setting
                .getTerminal({})
                .then((res) => {
                    loading.value = false;
                    form.showTerminalButton = res.showTerminalButton !== 'Disable';
                    form.lineHeight = Number(res.lineHeight);
                    form.letterSpacing = Number(res.letterSpacing);
                    form.fontSize = Number(res.fontSize);
                    form.fontFamily = res.fontFamily || DEFAULT_FONT_FAMILY;
                    selectedFontFamilies.value = splitFontFamily(form.fontFamily);
                    form.backgroundColor = res.backgroundColor || '#000000';
                    form.foregroundColor = res.foregroundColor || '#f5f5f5';
                    form.cursorBlink = res.cursorBlink;
                    form.cursorStyle = res.cursorStyle;
                    form.scrollback = Number(res.scrollback);
                    form.scrollSensitivity = Number(res.scrollSensitivity);
                    terminalStore.fontFamily = res.fontFamily || '';

                    if (withReset) {
                        changeItem();
                    }
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const changeTerminalButton = async () => {
            const showTerminalButton = form.showTerminalButton;
            loading.value = true;
            try {
                if (!showTerminalButton && dockSessions.entries.length > 0) {
                    await ElMessageBox.confirm(
                        i18n.global.t('terminal.disableShortcutConfirm'),
                        i18n.global.t('terminal.showTerminalButton'),
                        {
                            confirmButtonText: i18n.global.t('commons.button.confirm'),
                            cancelButtonText: i18n.global.t('commons.button.cancel'),
                            type: 'warning',
                        },
                    );
                }
                await rpc.core.setting.updateTerminal({
                    showTerminalButton: showTerminalButton ? 'Enable' : 'Disable',
                });
                terminalStore.showTerminalButton = showTerminalButton;
                if (!showTerminalButton) dockSessions.closeAll();
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            } catch {
                form.showTerminalButton = !showTerminalButton;
            } finally {
                loading.value = false;
            }
        };
        const loadConnShow = async () => {
            await rpc.agentSetting.getLocalConn({}).then((res) => {
                form.showDefaultConn = res.localSshConnShow === 'Enable';
                if (res.addr && res.port && res.user) {
                    form.defaultConn = res.user + '@' + res.addr + ':' + res.port;
                } else {
                    form.defaultConn = '-';
                }
                resetConn.value = false;
            });
        };
        const changeShow = async () => {
            let op = form.showDefaultConn ? i18n.global.t('xpack.waf.allow') : i18n.global.t('xpack.waf.deny');
            opRef.value.acceptParams({
                title: i18n.global.t('terminal.defaultConn'),
                names: [],
                msg: i18n.global.t('terminal.defaultConnHelper', [op]),
                api: null,
                params: {},
            });
        };
        const submitChangeShow = async () => {
            loading.value = true;
            await rpc.agentSetting
                .setDefaultConn({
                    withReset: resetConn.value,
                    defaultConn: form.showDefaultConn ? 'Enable' : 'Disable',
                })
                .then(() => {
                    loading.value = false;
                    loadConnShow();
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        const iniTerm = () => {
            const defaultFontFamily = "Monaco, Menlo, Consolas, 'Courier New', monospace";
            const fontFamily = form.fontFamily || defaultFontFamily;

            term.value = new Terminal({
                lineHeight: 1.2,
                fontSize: 12,
                fontFamily: fontFamily,
                theme: {
                    background: '#000000',
                    foreground: '#f5f5f5',
                },
                cursorBlink: true,
                cursorStyle: 'block',
                scrollback: 1000,
                scrollSensitivity: 6,
            });
            term.value.open(terminalElement.value);
            applyPreviewBackground();
            term.value.loadAddon(fitAddon);
            term.value.write('the first line \r\nthe second line');
            fitAddon.fit();
        };
        const applyPreviewBackground = () => {
            if (!terminalElement.value) return;
            terminalElement.value.style.backgroundColor = form.backgroundColor || '#000000';
            terminalElement.value.style.backgroundImage = '';
            terminalElement.value.style.backgroundSize = '';
            terminalElement.value.style.backgroundPosition = '';
            terminalElement.value.style.backgroundRepeat = '';
            terminalElement.value.style.imageRendering = '';
        };
        const changeItem = () => {
            const defaultFontFamily = "Monaco, Menlo, Consolas, 'Courier New', monospace";
            const fontFamily = form.fontFamily || defaultFontFamily;

            term.value.options.lineHeight = form.lineHeight;
            term.value.options.letterSpacing = form.letterSpacing;
            term.value.options.fontSize = form.fontSize;
            term.value.options.fontFamily = fontFamily;
            term.value.options.theme = {
                ...(term.value.options.theme || {}),
                background: form.backgroundColor,
                foreground: form.foregroundColor,
            };
            term.value.options.cursorBlink = form.cursorBlink === 'Enable';
            term.value.options.cursorStyle = form.cursorStyle;
            term.value.options.scrollback = form.scrollback;
            term.value.options.scrollSensitivity = form.scrollSensitivity;
            applyPreviewBackground();

            fitAddon.fit();
        };
        const onSetDefault = () => {
            form.lineHeight = 1.2;
            form.letterSpacing = 0;
            form.fontSize = 12;
            form.fontFamily = DEFAULT_FONT_FAMILY;
            selectedFontFamilies.value = splitFontFamily(DEFAULT_FONT_FAMILY);
            form.backgroundColor = '#000000';
            form.foregroundColor = '#f5f5f5';
            form.cursorBlink = 'Enable';
            form.cursorStyle = 'block';
            form.scrollback = 1000;
            form.scrollSensitivity = 6;

            changeItem();
        };
        const onSave = () => {
            ensureFontFamily();
            ElMessageBox.confirm(i18n.global.t('terminal.saveHelper'), i18n.global.t('container.setting'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
                type: 'info',
            }).then(async () => {
                loading.value = true;
                try {
                    let param = {
                        lineHeight: form.lineHeight + '',
                        letterSpacing: form.letterSpacing + '',
                        fontSize: form.fontSize + '',
                        fontFamily: form.fontFamily,
                        backgroundColor: form.backgroundColor,
                        foregroundColor: form.foregroundColor,
                        cursorBlink: form.cursorBlink,
                        cursorStyle: form.cursorStyle,
                        scrollback: form.scrollback + '',
                        scrollSensitivity: form.scrollSensitivity + '',
                    };
                    await rpc.core.setting.updateTerminal(param);
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    terminalStore.$patch({
                        lineHeight: form.lineHeight,
                        letterSpacing: form.letterSpacing,
                        fontSize: form.fontSize,
                        fontFamily: form.fontFamily,
                        backgroundColor: form.backgroundColor,
                        foregroundColor: form.foregroundColor,
                        cursorBlink: form.cursorBlink,
                        cursorStyle: form.cursorStyle,
                        scrollback: form.scrollback,
                        scrollSensitivity: form.scrollSensitivity,
                    });
                } finally {
                    loading.value = false;
                }
            });
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <div v-loading={unref(loading)}>
                <LayoutContent
                    title={$t('container.setting')}
                    divider={true}
                    v-slots={{
                        main: () => (
                            <>
                                <ElForm model={form} label-position="left" label-width="150px">
                                    <ElRow>
                                        <ElCol span={1}>
                                            <br />
                                        </ElCol>
                                        <ElCol xs={24} sm={20} md={15} lg={12} xl={12}>
                                            <ElFormItem label={$t('terminal.lineHeight')}>
                                                <ElInputNumber
                                                    min={1}
                                                    max={2.0}
                                                    precision={1}
                                                    step={0.1}
                                                    v-model={form.lineHeight}
                                                    onChange={($event?: any) => {
                                                        changeItem();
                                                    }}
                                                    class={'formInput'}
                                                />
                                            </ElFormItem>
                                            <ElFormItem label={$t('terminal.letterSpacing')}>
                                                <ElInputNumber
                                                    min={0}
                                                    max={3.5}
                                                    precision={1}
                                                    step={0.5}
                                                    v-model={form.letterSpacing}
                                                    onChange={($event?: any) => {
                                                        changeItem();
                                                    }}
                                                    class={'formInput'}
                                                />
                                            </ElFormItem>
                                            <ElFormItem label={$t('terminal.fontSize')}>
                                                <ElInputNumber
                                                    step={1}
                                                    min={12}
                                                    max={20}
                                                    v-model={form.fontSize}
                                                    onChange={($event?: any) => {
                                                        changeItem();
                                                    }}
                                                    class={'formInput'}
                                                />
                                            </ElFormItem>
                                            <ElFormItem label={$t('terminal.fontFamily')}>
                                                <ElSelect
                                                    clearable
                                                    v-model={selectedFontFamilies.value}
                                                    multiple
                                                    filterable
                                                    allow-create
                                                    default-first-option
                                                    reserve-keyword={false}
                                                    class={'formInput'}
                                                >
                                                    {(fontFamilyOptions || []).map((item) => (
                                                        <ElOption
                                                            label={item.label}
                                                            value={item.value}
                                                            key={item.value}
                                                        />
                                                    ))}
                                                </ElSelect>
                                                <span class={'input-help'}>
                                                    {$t('terminal.fontFamilySupportHelper')}
                                                </span>
                                            </ElFormItem>
                                            <ElFormItem label={$t('terminal.backgroundColor')}>
                                                <ElColorPicker
                                                    v-model={form.backgroundColor}
                                                    onChange={($event?: any) => {
                                                        changeItem();
                                                    }}
                                                />
                                            </ElFormItem>
                                            <ElFormItem label={$t('terminal.foregroundColor')}>
                                                <ElColorPicker
                                                    v-model={form.foregroundColor}
                                                    onChange={($event?: any) => {
                                                        changeItem();
                                                    }}
                                                />
                                            </ElFormItem>
                                            <ElFormItem>
                                                <div ref={terminalElement} class={'terminal'} />
                                            </ElFormItem>
                                            <ElFormItem label={$t('terminal.cursorBlink')}>
                                                <ElSwitch
                                                    v-model={form.cursorBlink}
                                                    active-value="Enable"
                                                    inactive-value="Disable"
                                                    onChange={($event?: any) => {
                                                        changeItem();
                                                    }}
                                                />
                                            </ElFormItem>
                                            <ElFormItem label={$t('terminal.cursorStyle')}>
                                                <ElSelect
                                                    v-model={form.cursorStyle}
                                                    onChange={($event?: any) => {
                                                        changeItem();
                                                    }}
                                                    class={'formInput'}
                                                >
                                                    <ElOption value="block" label={$t('terminal.cursorBlock')} />
                                                    <ElOption
                                                        value="underline"
                                                        label={$t('terminal.cursorUnderline')}
                                                    />
                                                    <ElOption value="bar" label={$t('terminal.cursorBar')} />
                                                </ElSelect>
                                            </ElFormItem>
                                            <ElFormItem label={$t('terminal.scrollback')}>
                                                <ElInputNumber
                                                    step={50}
                                                    min={0}
                                                    max={10000}
                                                    v-model={form.scrollback}
                                                    onChange={($event?: any) => {
                                                        changeItem();
                                                    }}
                                                    class={'formInput'}
                                                />
                                            </ElFormItem>
                                            <ElFormItem label={$t('terminal.scrollSensitivity')}>
                                                <ElInputNumber
                                                    step={1}
                                                    min={0}
                                                    max={16}
                                                    v-model={form.scrollSensitivity}
                                                    onChange={($event?: any) => {
                                                        changeItem();
                                                    }}
                                                    class={'formInput'}
                                                />
                                            </ElFormItem>
                                            <ElFormItem>
                                                <ElButton
                                                    onClick={($event?: any) => {
                                                        onSetDefault();
                                                    }}
                                                    plain
                                                >
                                                    {$t('commons.button.setDefault')}
                                                </ElButton>
                                                <ElButton
                                                    onClick={($event?: any) => {
                                                        search(true);
                                                    }}
                                                    plain
                                                >
                                                    {$t('commons.button.reset')}
                                                </ElButton>
                                                <ElButton
                                                    onClick={($event?: any) => {
                                                        (onSave as any)($event);
                                                    }}
                                                    type="primary"
                                                >
                                                    {$t('commons.button.save')}
                                                </ElButton>
                                            </ElFormItem>
                                            <ElDivider border-style="dashed" />
                                            <ElFormItem label={$t('terminal.defaultConn')}>
                                                <ElSwitch
                                                    v-model={form.showDefaultConn}
                                                    onChange={($event?: any) => {
                                                        (changeShow as any)($event);
                                                    }}
                                                />
                                            </ElFormItem>
                                            <ElFormItem label={$t('xpack.node.connInfo')}>
                                                <ElInput
                                                    disabled
                                                    v-model={form.defaultConn}
                                                    v-slots={{
                                                        append: () => (
                                                            <>
                                                                <ElButton
                                                                    onClick={($event?: any) => {
                                                                        unref(dialogRef).acceptParams(false);
                                                                    }}
                                                                    icon="Setting"
                                                                >
                                                                    {$t('commons.button.set')}
                                                                </ElButton>
                                                            </>
                                                        ),
                                                    }}
                                                />
                                            </ElFormItem>
                                            <ElDivider border-style="dashed" />
                                            <ElFormItem label={$t('terminal.showTerminalButton')}>
                                                <ElSwitch
                                                    v-model={form.showTerminalButton}
                                                    onChange={($event?: any) => {
                                                        (changeTerminalButton as any)($event);
                                                    }}
                                                />
                                                <span class={'input-help'}>
                                                    {$t('terminal.showTerminalButtonHelper')}
                                                </span>
                                            </ElFormItem>
                                        </ElCol>
                                    </ElRow>
                                </ElForm>
                            </>
                        ),
                    }}
                />
                <OperateDialog
                    onSearch={($event?: any) => {
                        (loadConnShow as any)($event);
                    }}
                    ref={dialogRef}
                />
                <OpDialog
                    ref={opRef}
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                    onCancel={($event?: any) => {
                        (loadConnShow as any)($event);
                    }}
                    onSubmit={($event?: any) => {
                        (submitChangeShow as any)($event);
                    }}
                    v-slots={{
                        content: () => (
                            <>
                                {!form.showDefaultConn ? (
                                    <ElForm ref="deleteForm" label-position="left" class={'mt-4 mb-1'}>
                                        <ElFormItem>
                                            <ElCheckbox v-model={resetConn.value} label={$t('terminal.withReset')} />
                                        </ElFormItem>
                                    </ElForm>
                                ) : null}
                            </>
                        ),
                    }}
                />
            </div>
        );
    },
    options,
);
