import { $t } from '@/utils/i18n-t';
import { ref, nextTick, computed } from 'vue';
import { rpc } from '@/lib/rpc';
import { Website } from '@/types/website';
import { routerToNameWithParams } from '@/utils/router';
import { Rules } from '@/global/form-rules';
import { GetPunyCodeDomain, isPunycoded } from '@/utils/misc';
interface Props {
    row: Website.Website;
    defaultHttpPort: number;
    defaultHttpsPort: number;
    hideName?: boolean;
    showFavorite?: boolean;
}
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import permissionDirective from '@/directives/modules/permission';
import { cn } from '@/utils/cn';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElTooltip } from 'element-plus';
import { ElText } from 'element-plus';
import { ElPopover } from 'element-plus';
import { ElButton } from 'element-plus';
import CopyButton from '@/components/copy-button/index';
import SvgIcon from '@/components/svg-icon/svg-icon';

interface CodemodProps {
    [key: string]: any;
    row?: Website.Website;
    defaultHttpPort?: number;
    defaultHttpsPort?: number;
    hideName?: boolean;
    showFavorite?: boolean;
}

const emits = {
    favoriteChange: (...args: unknown[]) => true,
    domainEdit: (...args: unknown[]) => true,
};

const options = {
    name: 'domain',
    props: {
        row: { type: null },
        defaultHttpPort: Number,
        defaultHttpsPort: Number,
        hideName: Boolean,
        showFavorite: Boolean,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-ecb336bc',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const inputRef = ref();
        const isEditing = ref(false);
        const domains = ref<any[]>([]);
        const formData = reactive({
            domainName: '',
        });
        const rules = ref({
            domainName: [Rules.requiredInput, Rules.linuxName],
        });
        const formRef = ref();
        const ipv6Regex =
            /^(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?:(?::[0-9a-fA-F]{1,4}){1,6})|:(?:(?::[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(?::[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(?:ffff(?::0{1,4}){0,1}:){0,1}(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
        const isIPv6 = (domain: string): boolean => {
            const cleanDomain = domain.replace(/^\[|\]$/g, '');
            return ipv6Regex.test(cleanDomain);
        };
        const popoverWidth = computed(() => {
            if (domains.value.length === 0) return 300;

            let maxLength = 0;
            domains.value.forEach((domain) => {
                const url = getUrl(domain, __panelSetupProps.row);
                maxLength = Math.max(maxLength, url.length);
            });

            const calculatedWidth = 200 + maxLength * 8 + 60 + 40;

            return Math.min(Math.max(calculatedWidth, 300), 800);
        });
        const startEdit = () => {
            formData.domainName = __panelSetupProps.row.primaryDomain;
            isEditing.value = true;
            nextTick(() => {
                inputRef.value?.focus();
                inputRef.value?.select();
            });
        };
        const saveEdit = async () => {
            await formRef.value.validate((valid) => {
                if (valid) {
                    const editValue = formData.domainName.trim();
                    if (editValue && editValue !== __panelSetupProps.row.primaryDomain) {
                        ctx.emit('domainEdit', __panelSetupProps.row, editValue);
                    }
                    isEditing.value = false;
                }
            });
        };
        const cancelEdit = () => {
            formData.domainName = __panelSetupProps.row.primaryDomain;
            isEditing.value = false;
        };
        const openConfig = (id: number) => {
            routerToNameWithParams('WebsiteConfig', { id: id, tab: 'basic' });
        };
        const searchDomains = (id: number) => {
            rpc.website.listDomains({ websiteId: id }).then((res) => {
                domains.value = res.items;
            });
        };
        const openUrl = (url: string) => {
            window.open(url);
        };
        const getUrl = (domain: Website.Domain, website: Website.Website): string => {
            const protocol = website.protocol.toLowerCase();
            let domainStr = domain.domain;

            const cleanDomain = domainStr.replace(/^\[|\]$/g, '');

            if (isIPv6(cleanDomain)) {
                domainStr = `[${cleanDomain}]`;
            }

            let url = `${protocol}://${domainStr}`;

            if (protocol === 'http' && domain.port && domain.port !== 80) {
                url = `${url}:${domain.port}`;
            } else if (protocol === 'https') {
                let port = domain.port;
                if (!domain.ssl) {
                    port = __panelSetupProps.defaultHttpsPort || 443;
                }
                if (port && port !== 443) {
                    url = `${url}:${port}`;
                }
            }

            return url;
        };
        const favoriteWebsite = (row: Website.Website) => {
            ctx.emit('favoriteChange', row);
        };
        const getDisplayDomain = (domain: string) => {
            if (!isPunycoded(domain)) {
                return domain;
            }
            return `${domain} (${GetPunyCodeDomain(domain)})`;
        };
        const shouldShowDomainTooltip = (domain: string) => {
            return getDisplayDomain(domain).length > 30;
        };
        return () => (
            <div class={'name-row'}>
                <div
                    class={cn('name-main', {
                        'name-main--actions-only': __panelSetupProps.hideName && !unref(isEditing),
                    })}
                >
                    {unref(isEditing) ? (
                        <ElForm
                            model={formData}
                            rules={unref(rules)}
                            ref={formRef}
                            onSubmit={($event?: any) => {
                                $event.preventDefault();
                            }}
                        >
                            <ElFormItem prop="domainName" class={'inline-form-item'}>
                                <ElInput
                                    modelValue={formData.domainName}
                                    onUpdate:modelValue={($v) => {
                                        formData.domainName = $v as any;
                                    }}
                                    onKeyup={($event?: any) => {
                                        $event.preventDefault();
                                        if (!($event.key === 'Enter')) return;
                                        (saveEdit as any)($event);
                                    }}
                                    onBlur={($event?: any) => {
                                        (saveEdit as any)($event);
                                    }}
                                    ref={inputRef}
                                    class={'domain-input'}
                                />
                            </ElFormItem>
                        </ElForm>
                    ) : !__panelSetupProps.hideName ? (
                        <ElTooltip
                            effect="dark"
                            placement="bottom-start"
                            popper-class="website-domain-tooltip"
                            show-after={300}
                            disabled={!shouldShowDomainTooltip(__panelSetupProps.row.primaryDomain)}
                            v-slots={{
                                content: () => (
                                    <>
                                        <div class={'website-domain-tooltip__content'}>
                                            {getDisplayDomain(__panelSetupProps.row.primaryDomain)}
                                        </div>
                                    </>
                                ),
                            }}
                        >
                            <ElText
                                type="primary"
                                onClick={($event?: any) => {
                                    openConfig(__panelSetupProps.row.id);
                                }}
                                class={'domain-text cursor-pointer'}
                            >
                                <span class={'domain-text__content'}>
                                    {__panelSetupProps.row.primaryDomain}
                                    {isPunycoded(__panelSetupProps.row.primaryDomain) ? (
                                        <span class={'text-gray-400'}>
                                            {' ('}
                                            {GetPunyCodeDomain(__panelSetupProps.row.primaryDomain)}
                                            {') '}
                                        </span>
                                    ) : null}
                                </span>
                            </ElText>
                        </ElTooltip>
                    ) : null}
                    {__panelSetupProps.row.type != 'stream' ? (
                        <ElPopover
                            placement="right"
                            trigger="hover"
                            width={unref(popoverWidth)}
                            onBeforeEnter={($event?: any) => {
                                searchDomains(__panelSetupProps.row.id);
                            }}
                            v-slots={{
                                reference: () => (
                                    <>
                                        <ElButton link icon="Promotion" class={'ml-2.5'} />
                                    </>
                                ),
                            }}
                        >
                            <table>
                                <tbody>
                                    {(unref(domains) || []).map((domain, index) => (
                                        <tr key={index}>
                                            <td>
                                                <ElButton
                                                    type="primary"
                                                    link
                                                    onClick={($event?: any) => {
                                                        openUrl(getUrl(domain, __panelSetupProps.row));
                                                    }}
                                                >
                                                    {getUrl(domain, __panelSetupProps.row)}
                                                </ElButton>
                                            </td>
                                            <td>
                                                <CopyButton content={getUrl(domain, __panelSetupProps.row)} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </ElPopover>
                    ) : null}
                    {!unref(isEditing)
                        ? withDirectives(
                              <ElButton
                                  link
                                  icon="edit"
                                  onClick={($event?: any) => {
                                      (startEdit as any)($event);
                                  }}
                                  class={'ml-2.5'}
                              />,
                              [[permissionDirective, true]],
                          )
                        : null}
                </div>
                {__panelSetupProps.showFavorite ? (
                    <div>
                        <ElTooltip
                            effect="dark"
                            content={
                                __panelSetupProps.row.favorite ? $t('commons.table.unpin') : $t('commons.table.pin')
                            }
                            placement="top-start"
                        >
                            {withDirectives(
                                <ElButton
                                    link
                                    size={__panelSetupProps.hideName ? 'default' : 'large'}
                                    type={__panelSetupProps.row.favorite ? 'warning' : 'info'}
                                    onClick={($event?: any) => {
                                        favoriteWebsite(__panelSetupProps.row);
                                    }}
                                    class={cn('website-pin-button', { 'is-pinned': __panelSetupProps.row.favorite })}
                                >
                                    <SvgIcon iconName="p-pushpin" className="website-pin-icon" />
                                </ElButton>,
                                [[permissionDirective, true]],
                            )}
                        </ElTooltip>
                    </div>
                ) : null}
            </div>
        );
    },
    options,
);
