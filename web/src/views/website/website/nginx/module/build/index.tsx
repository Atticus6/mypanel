import { $t } from '@/utils/i18n-t';
import { computed, ref } from 'vue';
import { ElMessageBox, FormInstance } from 'element-plus';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import { newUUID } from '@/utils/id';
import TaskLog from '@/components/log/task/index';
import { Rules } from '@/global/form-rules';
import type { OpenrestyModule } from '@/gen/panel/agent/v1/openresty_pb';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import permissionDirective from '@/directives/modules/permission';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElText } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElCheckboxGroup } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElSwitch } from 'element-plus';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'build',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const open = ref(false);
        const loading = ref(false);
        const buildForm = ref<FormInstance>();
        const build = ref({
            mirror: 'http://archive.ubuntu.com/ubuntu',
            modules: [] as string[],
            force: false,
        });
        const moduleOptions = ref<OpenrestyModule[]>([]);
        const staticModules = ref<OpenrestyModule[]>([]);
        const dynamicSupported = ref(true);
        const rules = computed(() => ({
            mirror: [Rules.requiredSelect],
            modules: staticModules.value.length === 0 ? [Rules.requiredSelect] : [],
        }));
        const taskLogRef = ref();
        const acceptParams = async () => {
            getModules();
            open.value = true;
        };
        const getModules = async () => {
            try {
                const res = await rpc.openresty.getModules({});
                build.value.mirror = res.mirror;
                dynamicSupported.value = res.dynamicSupported;
                moduleOptions.value = res.dynamicSupported
                    ? res.items.filter((item) => item.enable && item.buildMode === 'dynamic')
                    : [];
                staticModules.value = res.items.filter((item) => item.enable && item.buildMode === 'static');
                build.value.modules = moduleOptions.value.map((item) => item.name);
            } catch (error) {}
        };
        const submit = async (form: FormInstance) => {
            await form.validate();
            await ElMessageBox.confirm(i18n.global.t('nginx.buildWarn'), i18n.global.t('nginx.build'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
            });
            const taskID = newUUID();
            loading.value = true;
            try {
                await rpc.openresty.build({
                    taskId: taskID,
                    mirror: build.value.mirror,
                    modules: build.value.modules,
                    force: build.value.force,
                });
                handleClose();
                openTaskLog(taskID);
            } finally {
                loading.value = false;
            }
        };
        const openTaskLog = (taskID: string) => {
            taskLogRef.value.openWithTaskID(taskID);
        };
        const handleClose = () => {
            open.value = false;
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <>
                <DrawerPro
                    modelValue={unref(open)}
                    onUpdate:modelValue={($v) => {
                        open.value = $v as any;
                    }}
                    header={$t('nginx.build')}
                    size="normal"
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                    v-slots={{
                        footer: () => (
                            <>
                                <ElButton
                                    onClick={($event?: any) => {
                                        (handleClose as any)($event);
                                    }}
                                    disabled={unref(loading)}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                {withDirectives(
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            submit(unref(buildForm));
                                        }}
                                        disabled={unref(loading)}
                                    >
                                        {$t('commons.button.confirm')}
                                    </ElButton>,
                                    [[permissionDirective, true]],
                                )}
                            </>
                        ),
                    }}
                >
                    <ElForm ref={buildForm} label-position="top" model={unref(build)} rules={unref(rules)}>
                        <ElFormItem>
                            <ElText type="info">{$t('nginx.buildPurposeHint')}</ElText>
                        </ElFormItem>
                        <ElFormItem label={$t('nginx.mirrorUrl')} prop="mirror">
                            <ElSelect
                                modelValue={unref(build).mirror}
                                onUpdate:modelValue={($v) => {
                                    unref(build).mirror = $v as any;
                                }}
                            >
                                <ElOption
                                    value="http://archive.ubuntu.com/ubuntu/"
                                    label="http://archive.ubuntu.com/ubuntu/"
                                />
                                <ElOption
                                    value="http://mirrors.aliyun.com/ubuntu/"
                                    label="http://mirrors.aliyun.com/ubuntu/"
                                />
                                <ElOption
                                    value="http://mirrors.tuna.tsinghua.edu.cn/ubuntu/"
                                    label="http://mirrors.tuna.tsinghua.edu.cn/ubuntu/"
                                />
                                <ElOption
                                    value="http://mirrors.ustc.edu.cn/ubuntu/"
                                    label="http://mirrors.ustc.edu.cn/ubuntu/"
                                />
                            </ElSelect>
                        </ElFormItem>
                        {unref(moduleOptions).length > 0 ? (
                            <ElFormItem label={$t('nginx.modulesToBuild')} prop="modules">
                                <ElCheckboxGroup
                                    modelValue={unref(build).modules}
                                    onUpdate:modelValue={($v) => {
                                        unref(build).modules = $v as any;
                                    }}
                                >
                                    {(unref(moduleOptions) || []).map((item) => (
                                        <ElCheckbox value={item.name} key={item.name}>
                                            {item.name}
                                        </ElCheckbox>
                                    ))}
                                </ElCheckboxGroup>
                            </ElFormItem>
                        ) : null}
                        {!unref(dynamicSupported) ? (
                            <ElFormItem>
                                <ElText type="warning">{$t('nginx.dynamicUnsupported')}</ElText>
                            </ElFormItem>
                        ) : null}
                        {unref(staticModules).length > 0 ? (
                            <ElFormItem label={$t('nginx.staticModules')}>
                                <div>
                                    {(unref(staticModules) || []).map((item) => (
                                        <div class={'!mb-1'} key={item.name}>
                                            <ElText>{item.name}</ElText>
                                        </div>
                                    ))}
                                    <ElText type="info" size="small">
                                        {$t('nginx.staticModulesHelper')}
                                    </ElText>
                                </div>
                            </ElFormItem>
                        ) : null}
                        <ElFormItem label={$t('nginx.forceBuild')}>
                            <ElSwitch
                                modelValue={unref(build).force}
                                onUpdate:modelValue={($v) => {
                                    unref(build).force = $v as any;
                                }}
                            />
                        </ElFormItem>
                    </ElForm>
                </DrawerPro>
                <TaskLog ref={taskLogRef} />
            </>
        );
    },
    options,
);
