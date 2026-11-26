import { $t } from '@/utils/i18n-t';
import { openPage } from '@/utils/router';
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { hasPermissionMetaAccess, hasRouteAccess } from '@/utils/rbac';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { rpc } from '@/lib/rpc';
import { listNodes } from '@/utils/node';
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { cn } from '@/utils/cn';
import { ElCard } from 'element-plus';
import { ElRadioGroup } from 'element-plus';
import { ElRadioButton } from 'element-plus';
import { ElBadge } from 'element-plus';
import { ElAlert } from 'element-plus';
import { ElLink } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
    buttons?: RouterButton[];
    showExpiresAt?: boolean;
}

const emits = {};

type SlotsShape = {
    'route-button': (arg?: unknown) => VNode[];
};

const options = {
    name: 'RouterButton',
    props: {
        buttons: {
            type: Array<RouterButton>,
            required: true,
        },
        showExpiresAt: {
            type: Boolean,
            default: false,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
    __scopeId: 'data-v-1b225bb8',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        const router = useRouter();
        const { currentNode, isEnterprise, isIntl, isXpackOrEE, productProExpires } = useGlobalStore();
        const buttonArray = computed(() => {
            return __panelSetupProps.buttons.filter((button) => {
                if (!hasPermissionMetaAccess(button.permission)) {
                    return false;
                }
                if (button.path || button.name) {
                    const route = router.resolve((button.path ? { path: button.path } : { name: button.name }) as any);
                    return route.matched.length === 0 || hasRouteAccess(route);
                }
                return true;
            });
        });
        const activeName = ref('');
        const currentNodeVersionMismatch = ref(false);
        const expiresInfo = ref(0);
        const expiresAlertVisible = ref(false);
        const expiresAlertKey = computed(() =>
            isEnterprise.value ? 'xpack.expiresEnterpriseAlert' : 'xpack.expiresProAlert',
        );
        const handleChange = async (label: string) => {
            const btn = buttonArray.value.find((btn) => btn.label === label);
            if (!btn || btn.disabled) {
                syncActiveName();
                return;
            }
            try {
                if (btn.path) await openPage({ path: btn.path });
                else if (btn.name) await openPage({ name: btn.name as any });
            } finally {
                syncActiveName();
            }
        };
        onMounted(() => {
            syncActiveName();
            loadExpiresAlert();
        });
        watch(
            () => [router.currentRoute.value.path, buttonArray.value.map((button) => button.label).join('|')],
            () => {
                syncActiveName();
            },
        );
        watch(
            () => [__panelSetupProps.showExpiresAt, productProExpires.value],
            () => {
                loadExpiresAlert();
            },
        );
        watch([currentNode, isXpackOrEE], checkCurrentNodeVersion, { immediate: true });
        async function checkCurrentNodeVersion() {
            const checkedNode = currentNode.value;
            if (checkedNode === 'local' || !isXpackOrEE.value) {
                currentNodeVersionMismatch.value = false;
                return;
            }

            try {
                const [settingRes, nodes] = await Promise.all([rpc.core.setting.getBaseInfo({}), listNodes('all')]);
                if (currentNode.value !== checkedNode) {
                    return;
                }
                const currentNodeInfo = nodes.find((item) => item.name === checkedNode);
                currentNodeVersionMismatch.value = Boolean(
                    currentNodeInfo?.version &&
                    settingRes.systemVersion &&
                    currentNodeInfo.version !== settingRes.systemVersion,
                );
            } catch {
                if (currentNode.value === checkedNode) {
                    currentNodeVersionMismatch.value = false;
                }
            }
        }
        function syncActiveName() {
            if (!buttonArray.value.length) {
                activeName.value = '';
                return;
            }
            if (buttonArray.value.length) {
                let isPathExist = false;
                const btn = buttonArray.value.find((btn) => {
                    return btn.path
                        ? router.currentRoute.value.path.startsWith(btn.path)
                        : btn.name && router.currentRoute.value.name === btn.name;
                });
                if (btn) {
                    isPathExist = true;
                    activeName.value = btn.label;
                }
                if (!isPathExist) {
                    activeName.value = buttonArray.value[0].label;
                }
            }
        }
        function getExpiresAlertDateKey() {
            const newDate = new Date();
            return newDate.getFullYear() + '-' + newDate.getMonth() + '-' + newDate.getDate();
        }
        function loadExpiresAlert() {
            const expires = productProExpires.value;
            if (!__panelSetupProps.showExpiresAt || !expires || expires === 0) {
                expiresInfo.value = 0;
                expiresAlertVisible.value = false;
                return;
            }

            if (getExpiresAlertDateKey() === localStorage.getItem('xpack-expires-alert')) {
                expiresInfo.value = 0;
                expiresAlertVisible.value = false;
                return;
            }

            const currentTimestamp = Date.now() / 1000;
            if (expires < currentTimestamp) {
                expiresInfo.value = 0;
                expiresAlertVisible.value = false;
                return;
            }

            const daySeconds = 24 * 60 * 60;
            const diffSeconds = Math.abs(expires - currentTimestamp);
            expiresInfo.value = Math.floor(diffSeconds / daySeconds) + 1;
            expiresAlertVisible.value = expiresInfo.value <= 15;
        }
        function goXpack() {
            if (isIntl.value && !isEnterprise.value) {
                window.open('https://1panel.hk/pricing', '_blank', 'noopener,noreferrer');
                return;
            }
            const url = isEnterprise.value ? 'https://1panel.cn/enterprise.html' : 'https://www.lxware.cn/1panel';
            window.open(url, '_blank', 'noopener,noreferrer');
        }
        function handleExpiresAlertClose() {
            localStorage.setItem('xpack-expires-alert', getExpiresAlertDateKey());
            loadExpiresAlert();
        }
        return () => (
            <div>
                <ElCard class={'router_card p-1 sm:p-0'}>
                    <div
                        class={
                            'flex w-full flex-col justify-start sm:items-center items-start sm:justify-between sm:flex-row'
                        }
                    >
                        <ElRadioGroup
                            modelValue={unref(activeName)}
                            onUpdate:modelValue={($v) => {
                                activeName.value = $v as any;
                            }}
                            onChange={($event?: any) => {
                                (handleChange as any)($event);
                            }}
                        >
                            {(unref(buttonArray) || []).map((button, index) => (
                                <ElRadioButton
                                    label={button.label}
                                    value={button.label}
                                    disabled={button.disabled}
                                    size="large"
                                    class={cn('router_card_button', { 'opacity-50': button.disabled })}
                                    key={index}
                                >
                                    {button.count ? (
                                        <ElBadge value={button.count} is-dot>
                                            <span>{button.label}</span>
                                        </ElBadge>
                                    ) : null}
                                </ElRadioButton>
                            ))}
                        </ElRadioGroup>
                        <div class={'flex flex-col gap-2 sm:flex-row'}>{ctx.slots['route-button']?.(undefined)}</div>
                    </div>
                </ElCard>
                {unref(currentNodeVersionMismatch) ? (
                    <div class={'mt-3'}>
                        <ElAlert
                            type="warning"
                            closable={false}
                            show-icon
                            title={$t('setting.currentNodeVersionNotSame')}
                        />
                    </div>
                ) : null}
                {__panelSetupProps.showExpiresAt &&
                unref(expiresAlertVisible) &&
                unref(productProExpires) &&
                unref(productProExpires) !== 0 ? (
                    <div class={'mt-3'}>
                        <ElAlert
                            type="warning"
                            onClose={($event?: any) => {
                                (handleExpiresAlertClose as any)($event);
                            }}
                            v-slots={{
                                title: () => (
                                    <>
                                        <div>
                                            <div
                                                class={
                                                    'flex flex-col gap-2 items-center justify-center w-full sm:flex-row'
                                                }
                                            >
                                                <span>{$t(unref(expiresAlertKey), [unref(expiresInfo)])}</span>
                                                <ElLink
                                                    icon="Position"
                                                    type="primary"
                                                    onClick={($event?: any) => {
                                                        (goXpack as any)($event);
                                                    }}
                                                    class={'cursor-pointer'}
                                                    style={'font-size: 12px'}
                                                >
                                                    {$t('firewall.quickJump')}
                                                </ElLink>
                                            </div>
                                        </div>
                                    </>
                                ),
                            }}
                        />
                    </div>
                ) : null}
            </div>
        );
    },
    options,
);
