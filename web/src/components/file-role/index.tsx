import { $t } from '@/utils/i18n-t';
import { Rules } from '@/global/form-rules';
interface Role {
    r: boolean;
    w: boolean;
    x: boolean;
}
interface RoleForm {
    owner: Role;
    group: Role;
    public: Role;
    mode: string;
}
interface Props {
    mode: string;
}

interface CodemodProps {
    [key: string]: any;
    mode?: string;
}

const emits = {
    getMode: (...args: unknown[]) => true,
};

const options = {
    name: 'file-role',
    props: {
        mode: String,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const roles = ref<string[]>(['0', '1', '2', '3', '4', '5', '6', '7']);
        const rules = reactive<FormRules>({
            mode: [Rules.requiredInput, Rules.filePermission],
        });
        const { mode } = toRefs(__panelSetupProps);
        const ruleForm = ref<FormInstance>();
        let form = ref<RoleForm>({
            owner: { r: true, w: true, x: true },
            group: { r: true, w: true, x: true },
            public: { r: true, w: false, x: true },
            mode: '0755',
        });
        const calculate = (role: Role) => {
            let num = 0;
            if (role.r) {
                num = num + 4;
            }
            if (role.w) {
                num = num + 2;
            }
            if (role.x) {
                num = num + 1;
            }

            return num;
        };
        const getRole = computed(() => {
            const value =
                '0' +
                String(calculate(form.value.owner)) +
                String(calculate(form.value.group)) +
                String(calculate(form.value.public));
            return value;
        });
        watch(
            () => getRole.value,
            (newVal) => {
                form.value.mode = newVal;
            },
        );
        watch(
            () => form.value.mode,
            (newVal) => {
                ctx.emit('getMode', Number.parseInt(newVal, 8));
            },
        );
        const getRoleNum = (roleStr: string, role: Role) => {
            if (roles.value.indexOf(roleStr) < 0) {
                return;
            }
            switch (roleStr) {
                case '0':
                    role.x = false;
                    role.w = false;
                    role.r = false;
                    break;
                case '1':
                    role.x = true;
                    role.w = false;
                    role.r = false;
                    break;
                case '2':
                    role.x = false;
                    role.w = true;
                    role.r = false;
                    break;
                case '3':
                    role.x = true;
                    role.w = true;
                    role.r = false;
                    break;
                case '4':
                    role.x = false;
                    role.w = false;
                    role.r = true;
                    break;
                case '5':
                    role.x = true;
                    role.w = false;
                    role.r = true;
                    break;
                case '6':
                    role.x = false;
                    role.w = true;
                    role.r = true;
                    break;
                case '7':
                    role.x = true;
                    role.w = true;
                    role.r = true;
                    break;
            }
        };
        const changeMode = (val: string) => {
            if (val === '' || val.length !== 4) {
                return;
            }
            getRoleNum(val[1], form.value.owner);
            getRoleNum(val[2], form.value.group);
            getRoleNum(val[3], form.value.public);
        };
        const updateMode = () => {
            form.value.mode = mode.value;
            changeMode(form.value.mode);
        };
        onUpdated(() => {
            updateMode();
        });
        onMounted(() => {
            updateMode();
        });
        return () => (
            <div>
                <ElForm ref={ruleForm} label-position="left" model={unref(form)} label-width="100px" rules={rules}>
                    <ElFormItem label={$t('file.owner')}>
                        <ElCheckbox
                            modelValue={unref(form).owner.r}
                            onUpdate:modelValue={($v) => {
                                unref(form).owner.r = $v as any;
                            }}
                            label={$t('file.rRole')}
                        />
                        <ElCheckbox
                            modelValue={unref(form).owner.w}
                            onUpdate:modelValue={($v) => {
                                unref(form).owner.w = $v as any;
                            }}
                            label={$t('file.wRole')}
                        />
                        <ElCheckbox
                            modelValue={unref(form).owner.x}
                            onUpdate:modelValue={($v) => {
                                unref(form).owner.x = $v as any;
                            }}
                            label={$t('file.xRole')}
                        />
                    </ElFormItem>
                    <ElFormItem label={$t('file.group')}>
                        <ElCheckbox
                            modelValue={unref(form).group.r}
                            onUpdate:modelValue={($v) => {
                                unref(form).group.r = $v as any;
                            }}
                            label={$t('file.rRole')}
                        />
                        <ElCheckbox
                            modelValue={unref(form).group.w}
                            onUpdate:modelValue={($v) => {
                                unref(form).group.w = $v as any;
                            }}
                            label={$t('file.wRole')}
                        />
                        <ElCheckbox
                            modelValue={unref(form).group.x}
                            onUpdate:modelValue={($v) => {
                                unref(form).group.x = $v as any;
                            }}
                            label={$t('file.xRole')}
                        />
                    </ElFormItem>
                    <ElFormItem label={$t('file.public')}>
                        <ElCheckbox
                            modelValue={unref(form).public.r}
                            onUpdate:modelValue={($v) => {
                                unref(form).public.r = $v as any;
                            }}
                            label={$t('file.rRole')}
                        />
                        <ElCheckbox
                            modelValue={unref(form).public.w}
                            onUpdate:modelValue={($v) => {
                                unref(form).public.w = $v as any;
                            }}
                            label={$t('file.wRole')}
                        />
                        <ElCheckbox
                            modelValue={unref(form).public.x}
                            onUpdate:modelValue={($v) => {
                                unref(form).public.x = $v as any;
                            }}
                            label={$t('file.xRole')}
                        />
                    </ElFormItem>
                    <ElFormItem label={$t('file.role')} required prop="mode">
                        <ElInput
                            modelValue={unref(form).mode}
                            onUpdate:modelValue={($v) => {
                                unref(form).mode = $v as any;
                            }}
                            maxlength="4"
                            onInput={($event?: any) => {
                                (changeMode as any)($event);
                            }}
                        />
                    </ElFormItem>
                </ElForm>
            </div>
        );
    },
    options,
);
