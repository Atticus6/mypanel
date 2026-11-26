import { $t } from '@/utils/i18n-t';
import { loadMonacoLanguageSupport, setupMonacoEnvironment } from '@/utils/monaco';
type MonacoEditorApi = typeof import('monaco-editor/editor');
import './index.styles.css';
import DialogPro from '@/components/dialog-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    confirm: (...args: unknown[]) => true,
};

const options = {
    name: 'diff',
    props: {},
    emits: emits,
    __scopeId: 'data-v-47f64d90',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const open = ref(false);
        const newContent = ref('');
        const oldContent = ref('');
        let monaco: MonacoEditorApi | null = null;
        let originalModel: ReturnType<MonacoEditorApi['editor']['createModel']> | null = null;
        let modifiedModel: ReturnType<MonacoEditorApi['editor']['createModel']> | null = null;
        let editor: ReturnType<MonacoEditorApi['editor']['createDiffEditor']> | null = null;
        const container = ref();
        const ensureMonaco = async () => {
            if (monaco) {
                return monaco;
            }
            setupMonacoEnvironment();
            const [monacoModule] = await Promise.all([import('monaco-editor/editor'), loadMonacoLanguageSupport()]);
            monaco = monacoModule;
            return monaco;
        };
        const disposeModels = () => {
            originalModel?.dispose();
            modifiedModel?.dispose();
            originalModel = null;
            modifiedModel = null;
        };
        const handleClose = () => {
            open.value = false;
            if (editor) {
                editor.dispose();
                editor = null;
            }
            disposeModels();
        };
        const acceptParams = async (oldCompose: string, newCompose: string) => {
            oldContent.value = oldCompose;
            newContent.value = newCompose;
            open.value = true;
            await initEditor();
        };
        const confirm = (useEditor: boolean) => {
            let content = '';
            if (useEditor) {
                content = editor.getModifiedEditor().getValue();
            } else {
                content = '';
            }
            ctx.emit('confirm', content);
            handleClose();
        };
        const initEditor = async () => {
            const monacoApi = await ensureMonaco();
            await nextTick();

            if (!container.value) {
                return;
            }

            if (editor) {
                editor.dispose();
                editor = null;
            }
            disposeModels();

            originalModel = monacoApi.editor.createModel(oldContent.value, 'yaml');
            modifiedModel = monacoApi.editor.createModel(newContent.value, 'yaml');

            editor = monacoApi.editor.createDiffEditor(container.value, {
                theme: 'vs-dark',
                readOnly: false,
                automaticLayout: true,
                folding: true,
                glyphMargin: true,
                roundedSelection: false,
                overviewRulerBorder: false,
                renderMarginRevertIcon: true,
                renderGutterMenu: false,
            });

            editor.setModel({
                original: originalModel,
                modified: modifiedModel,
            });
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DialogPro
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
                title={$t('app.composeDiff')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="w-90"
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        (handleClose as any)($event);
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    type="primary"
                                    onClick={($event?: any) => {
                                        confirm(true);
                                    }}
                                >
                                    {$t('app.useNew')}
                                </ElButton>
                                <ElButton
                                    onClick={($event?: any) => {
                                        confirm(false);
                                    }}
                                >
                                    {$t('app.useDefault')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            >
                <div>
                    <ElText type="warning">{$t('app.diffHelper')}</ElText>
                    <div ref={container} class={'compose-diff'} />
                </div>
            </DialogPro>
        );
    },
    options,
);
