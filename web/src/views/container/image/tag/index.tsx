import { $t } from '@/utils/i18n-t';
import { reactive, ref } from 'vue';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { ElForm } from 'element-plus';
import { Container } from '@/types/container';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    repos: Array<Container.RepoOptions>;
    imageID: string;
    tags: Array<string>;
}
type FormInstance = InstanceType<typeof ElForm>;
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElInputTag } from 'element-plus';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'tag',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref(false);
        const inputTagRef = ref();
        const drawerVisible = ref(false);
        const repos = ref();
        const form = reactive({
            imageID: '',
            fromRepo: false,
            repo: '',
            originName: '',

            tags: [],
        });
        const rules = reactive({
            tags: [{ validator: checkTags, trigger: 'blur', required: true }],
        });
        function checkTags(rule: any, value: any, callback: any) {
            if (value.length === 0) {
                return callback(new Error(i18n.global.t('commons.rule.requiredInput')));
            }
            for (const item of value) {
                if (item === '' || typeof item === 'undefined' || item == null) {
                    return callback(new Error(i18n.global.t('commons.rule.imageName')));
                } else {
                    const reg = /^[a-zA-Z0-9]{1}[a-z:@A-Z0-9_/.-]{0,255}$/;
                    if (!reg.test(item) && item !== '') {
                        return callback(new Error(i18n.global.t('commons.rule.imageName')));
                    } else {
                        return callback();
                    }
                }
            }
            callback();
        }
        const acceptParams = async (params: DialogProps): Promise<void> => {
            drawerVisible.value = true;
            form.imageID = params.imageID;
            form.originName = params.tags?.length !== 0 ? params.tags[0] : '';
            form.tags = params.tags || [];
            form.fromRepo = false;
            form.repo = '';
            repos.value = params.repos;
        };
        const handleClose = () => {
            drawerVisible.value = false;
        };
        const formRef = ref<FormInstance>();
        const handleAdd = (val: string) => {
            form.tags = form.tags?.filter((item) => item !== val);
            form.tags.push(val);
        };
        const setInputValue = async (text) => {
            await nextTick();
            const inputEl = inputTagRef.value?.$el?.querySelector('input');
            if (!inputEl) return;

            inputEl.value = text;
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            inputEl.dispatchEvent(new Event('change', { bubbles: true }));
            inputEl.setSelectionRange(text.length, text.length);
        };
        const onSubmit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                let params = {
                    sourceID: form.imageID,
                    tags: form.tags,
                };
                loading.value = true;
                await rpc.container
                    .tagImage(params as any)
                    .then(async () => {
                        loading.value = false;
                        drawerVisible.value = false;
                        ctx.emit('search');
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            });
        };
        const changeRepo = (val) => {
            if (val === 'Docker Hub') {
                return;
            }
            for (const item of repos.value) {
                if (item.name == val) {
                    form.tags.push(item.downloadUrl + '/' + form.originName);
                    return;
                }
            }
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                modelValue={unref(drawerVisible)}
                onUpdate:modelValue={($v) => {
                    drawerVisible.value = $v as any;
                }}
                header={$t('container.imageTag')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="large"
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    disabled={unref(loading)}
                                    onClick={($event?: any) => {
                                        drawerVisible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    disabled={unref(loading)}
                                    type="primary"
                                    onClick={($event?: any) => {
                                        onSubmit(unref(formRef));
                                    }}
                                >
                                    {$t('commons.button.save')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            >
                {withDirectives(
                    <ElForm
                        label-position="top"
                        ref={formRef}
                        model={form}
                        rules={rules}
                        label-width="80px"
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                    >
                        <ElFormItem label={$t('app.source')}>
                            <ElCheckbox
                                modelValue={form.fromRepo}
                                onUpdate:modelValue={($v) => {
                                    form.fromRepo = $v as any;
                                }}
                            >
                                {$t('container.imageRepo')}
                            </ElCheckbox>
                        </ElFormItem>
                        {form.fromRepo ? (
                            <ElFormItem label={$t('container.repoName')} rules={Rules.requiredSelect} prop="repo">
                                <ElSelect
                                    clearable
                                    filterable
                                    modelValue={form.repo}
                                    onUpdate:modelValue={($v) => {
                                        form.repo = $v as any;
                                    }}
                                    onChange={($event?: any) => {
                                        (changeRepo as any)($event);
                                    }}
                                >
                                    {(unref(repos) || []).map((item) => (
                                        <ElOption value={item.name} label={item.name} key={item.id} />
                                    ))}
                                </ElSelect>
                            </ElFormItem>
                        ) : null}
                        <ElFormItem label={$t('container.imageTag')} prop="tags">
                            <ElInputTag
                                ref={inputTagRef}
                                onAddTag={($event?: any) => {
                                    (handleAdd as any)($event);
                                }}
                                modelValue={form.tags}
                                onUpdate:modelValue={($v) => {
                                    form.tags = $v as any;
                                }}
                                v-slots={{
                                    tag: ({ value }) => (
                                        <>
                                            <ElButton
                                                onClick={($event?: any) => {
                                                    setInputValue(value);
                                                }}
                                                size="small"
                                                link
                                                type="info"
                                            >
                                                {value}
                                            </ElButton>
                                        </>
                                    ),
                                }}
                            />
                            <span class={'input-help'}>{$t('container.imageTagHelper')}</span>
                        </ElFormItem>
                    </ElForm>,
                    [[vLoading, unref(loading)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
