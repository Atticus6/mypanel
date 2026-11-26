import { $t } from '@/utils/i18n-t';
import type { OpenrestyModule } from '@/gen/panel/agent/v1/openresty_pb';
import { rpc } from '@/lib/rpc';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
type ModuleForm = {
    name: string;
    operate: string;
    script: string;
    enable: boolean;
    params: string;
    packages: string;
    buildMode: OpenrestyModule['buildMode'];
    provider: OpenrestyModule['provider'];
    loadOrder: number;
    lastError: string;
};
import permissionDirective from '@/directives/modules/permission';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'operate',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const moduleForm = ref<FormInstance>();
        const open = ref(false);
        const mode = ref('create');
        const loading = ref(false);
        const dynamicSupported = ref(true);
        const defaultModule = (): ModuleForm => ({
            name: '',
            operate: 'create',
            script: '',
            enable: true,
            params: '',
            packages: '',
            buildMode: 'dynamic',
            provider: 'local',
            loadOrder: 50,
            lastError: '',
        });
        const module = ref(defaultModule());
        const rules = ref({
            name: [Rules.requiredInput, Rules.simpleName],
            params: [Rules.requiredInput],
            buildMode: [Rules.requiredSelect],
        });
        const handleClose = () => {
            open.value = false;
            ctx.emit('close', false);
        };
        const acceptParams = async (operate: string, editModule?: OpenrestyModule, supported?: boolean) => {
            mode.value = operate;
            dynamicSupported.value = supported ?? true;
            module.value = defaultModule();
            if ((operate === 'update' || operate === 'view') && editModule) {
                module.value = {
                    name: editModule.name,
                    script: editModule.script || '',
                    enable: editModule.enable,
                    params: editModule.params,
                    packages: editModule.packages || '',
                    buildMode: editModule.buildMode,
                    provider: editModule.provider,
                    loadOrder: editModule.loadOrder,
                    lastError: editModule.lastError || '',
                    operate,
                };
            }
            open.value = true;
        };
        const submit = async (form: FormInstance) => {
            await form.validate();
            loading.value = true;
            try {
                await rpc.openresty.updateModule({
                    operate: mode.value,
                    name: module.value.name,
                    script: module.value.script,
                    packages: module.value.packages,
                    enable: module.value.enable,
                    params: module.value.params,
                    buildMode: module.value.buildMode,
                    provider: module.value.provider,
                    loadOrder: module.value.loadOrder,
                });
                if (mode.value === 'update') {
                    MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                } else if (mode.value === 'create') {
                    MsgSuccess(i18n.global.t('commons.msg.createSuccess'));
                }
                handleClose();
            } finally {
                loading.value = false;
            }
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
                header={unref(mode) === 'view' ? $t('commons.button.view') : $t('nginx.' + unref(mode))}
                size="large"
                resource={unref(mode) === 'create' ? '' : unref(module).name}
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
                                {$t(unref(mode) === 'view' ? 'commons.button.close' : 'commons.button.cancel')}
                            </ElButton>
                            {unref(mode) !== 'view'
                                ? withDirectives(
                                      <ElButton
                                          type="primary"
                                          onClick={($event?: any) => {
                                              submit(unref(moduleForm));
                                          }}
                                          disabled={unref(loading)}
                                      >
                                          {$t('commons.button.confirm')}
                                      </ElButton>,
                                      [[permissionDirective, true]],
                                  )
                                : null}
                        </>
                    ),
                }}
            >
                <ElForm
                    ref={moduleForm}
                    label-position="top"
                    model={unref(module)}
                    rules={unref(rules)}
                    disabled={unref(mode) === 'view'}
                >
                    <ElFormItem label={$t('commons.table.name')} prop="name">
                        <ElInput
                            modelValue={unref(module).name}
                            onUpdate:modelValue={($v) => {
                                unref(module).name = typeof $v === 'string' ? $v.trim() : $v;
                            }}
                            disabled={unref(mode) === 'update'}
                        />
                    </ElFormItem>
                    <ElFormItem label={$t('nginx.buildMode')} prop="buildMode">
                        <ElRadioGroup
                            modelValue={unref(module).buildMode}
                            onUpdate:modelValue={($v) => {
                                unref(module).buildMode = $v as any;
                            }}
                        >
                            <ElRadioButton value="dynamic" disabled={!unref(dynamicSupported)}>
                                {$t('nginx.buildModeDynamic')}
                            </ElRadioButton>
                            <ElRadioButton value="static">{$t('nginx.buildModeStatic')}</ElRadioButton>
                        </ElRadioGroup>
                        {!unref(dynamicSupported) ? (
                            <ElText type="warning" class={'!ml-2'}>
                                {$t('nginx.dynamicUnsupported')}
                            </ElText>
                        ) : null}
                    </ElFormItem>
                    <ElFormItem label={$t('nginx.params')} prop="params">
                        <ElInput
                            modelValue={unref(module).params}
                            onUpdate:modelValue={($v) => {
                                unref(module).params = typeof $v === 'string' ? $v.trim() : $v;
                            }}
                            placeholder={$t('nginx.paramsHelper')}
                        />
                    </ElFormItem>
                    <ElFormItem label={$t('nginx.packages')} prop="packages">
                        <ElInput
                            modelValue={unref(module).packages}
                            onUpdate:modelValue={($v) => {
                                unref(module).packages = typeof $v === 'string' ? $v.trim() : $v;
                            }}
                            placeholder={$t('nginx.packagesHelper')}
                        />
                    </ElFormItem>
                    <ElFormItem label={$t('nginx.script')} prop="script">
                        <ElInput
                            modelValue={unref(module).script}
                            onUpdate:modelValue={($v) => {
                                unref(module).script = $v as any;
                            }}
                            type="textarea"
                            rows={10}
                            placeholder={$t('nginx.scriptHelper')}
                        />
                    </ElFormItem>
                    {unref(module).buildMode !== 'static' ? (
                        <ElFormItem label={$t('nginx.loadOrder')} prop="loadOrder">
                            <ElInputNumber
                                modelValue={unref(module).loadOrder}
                                onUpdate:modelValue={($v) => {
                                    unref(module).loadOrder = $v as any;
                                }}
                                min={0}
                                max={9999}
                            />
                        </ElFormItem>
                    ) : null}
                    {unref(module).lastError ? (
                        <ElAlert
                            type="error"
                            title={$t('nginx.buildFailed')}
                            description={unref(module).lastError}
                            closable={false}
                            show-icon
                            class={'!mb-4'}
                        />
                    ) : null}
                </ElForm>
            </DrawerPro>
        );
    },
    options,
);
