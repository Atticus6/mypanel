import { $t } from '@/utils/i18n-t';
interface RootCertInfo {
    id: number;
    createAt: Date;
    name: string;
    mode: string;
    encryptionMode: string;
    passPhrase: string;
    description: string;
    publicKey: string;
    privateKey: string;
}
import { readCachedPageSize } from '@/utils/panel-cache';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import Operate from '@/pages/views/host/ssh/ssh/certification/operate/index';
import { copyText } from '@/utils/clipboard';
import { Base64 } from 'js-base64';
import { rpc } from '@/lib/rpc';
import './index.styles.css';
import permissionDirective from '@/directives/modules/permission';
import { nodeAdminDirective } from '@/directives/modules/permission';
import DrawerPro from '@/components/drawer-pro/index';
import ComplexTable from '@/components/table/complex/ComplexTable';
import FuTableOperations from '@/components/table/TableOperations';
import DialogPro from '@/components/dialog-pro/index';
import OpDialog from '@/components/del-dialog/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'certification',
    props: {},
    emits: emits,
    __scopeId: 'data-v-37125a8b',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref();
        const drawerVisible = ref();
        const data = ref();
        const selects = ref<any>([]);
        const paginationConfig = reactive({
            cacheSizeKey: 'login-log-page-size',
            currentPage: 1,
            pageSize: readCachedPageSize('login-log-page-size') || 20,
            total: 0,
            small: true,
        });
        const forceDelete = ref();
        const operateIDs = ref();
        const opRef = ref();
        const currentRow = ref();
        const connOpen = ref();
        const currentUser = ref();
        const acceptParams = async (user: string): Promise<void> => {
            search();
            currentUser.value = user || 'root';
            drawerVisible.value = true;
        };
        const loadPassPhrase = () => {
            if (currentRow.value.passPhrase === '') {
                return '-';
            }
            let pass = Base64.decode(currentRow.value.passPhrase);
            return pass === '<UN-SET>' ? i18n.global.t('ssh.unSyncPass') : '';
        };
        const onCopy = async (content: string) => {
            content = Base64.decode(content);
            copyText(content);
        };
        const dialogRef = ref();
        const onOpenDialog = async (
            title: string,
            rowData: Partial<RootCertInfo> = {
                mode: 'generate',
                encryptionMode: 'ed25519',
            },
        ) => {
            let params = {
                title,
                rowData: { ...rowData },
            };
            dialogRef.value!.acceptParams(params);
        };
        const onDownload = async (row: RootCertInfo, type: string) => {
            let name = row.name;
            let content;
            if (type === 'publicKey') {
                name = row.name + '.pub';
                content = Base64.decode(row.publicKey);
            } else {
                content = Base64.decode(row.privateKey);
            }
            const downloadUrl = window.URL.createObjectURL(new Blob([content], { type: 'application/octet-stream' }));
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = downloadUrl;
            a.download = name;
            const event = new MouseEvent('click');
            a.dispatchEvent(event);

            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(downloadUrl);
            }, 100);
        };
        const search = async () => {
            let params = {
                page: paginationConfig.currentPage,
                pageSize: paginationConfig.pageSize,
            };
            loading.value = true;
            await rpc.ssh
                .searchCerts(params)
                .then((res) => {
                    loading.value = false;
                    data.value = res.items as any;
                    paginationConfig.total = Number(res.total);
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const onSync = async () => {
            ElMessageBox.confirm(i18n.global.t('ssh.syncHelper'), i18n.global.t('commons.button.sync'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
                type: 'info',
            }).then(async () => {
                loading.value = true;
                await rpc.ssh
                    .syncCerts({})
                    .then(() => {
                        loading.value = false;
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        search();
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            });
        };
        const onDelete = async (row: RootCertInfo | null) => {
            let names = [];
            let ids = [];
            forceDelete.value = false;
            if (row) {
                ids = [row.id];
                names = [row.name + ' - ' + row.encryptionMode];
            } else {
                for (const item of selects.value) {
                    names.push(item.name + ' - ' + item.encryptionMode);
                    ids.push(item.id);
                }
            }
            operateIDs.value = ids;
            opRef.value.acceptParams({
                title: i18n.global.t('commons.button.delete'),
                names: names,
                msg: i18n.global.t('commons.msg.operatorHelper', [
                    i18n.global.t('menu.cronjob'),
                    i18n.global.t('commons.button.delete'),
                ]),
                api: null,
                params: null,
            });
        };
        const onSubmitDelete = async () => {
            loading.value = true;
            await rpc.ssh
                .deleteCerts(operateIDs.value, forceDelete.value)
                .then(() => {
                    loading.value = false;
                    MsgSuccess(i18n.global.t('commons.msg.deleteSuccess'));
                    search();
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const handleClose = () => {
            drawerVisible.value = false;
        };
        const buttons = [
            {
                label: i18n.global.t('commons.button.edit'),
                permission: true,
                nodeAdmin: true,
                click: (row: RootCertInfo) => {
                    onOpenDialog('edit', row);
                },
            },
            {
                label: i18n.global.t('commons.button.view'),
                click: (row: RootCertInfo) => {
                    currentRow.value = row;
                    connOpen.value = true;
                },
            },
            {
                label: i18n.global.t('commons.button.delete'),
                permission: true,
                nodeAdmin: true,
                click: (row: RootCertInfo) => {
                    onDelete(row);
                },
            },
        ];
        ctx.expose({
            acceptParams,
        });
        return () => (
            <div>
                <DrawerPro
                    modelValue={unref(drawerVisible)}
                    onUpdate:modelValue={($v) => {
                        drawerVisible.value = $v as any;
                    }}
                    header={$t('ssh.pubkey')}
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                    size="large"
                    v-slots={{
                        footer: () => (
                            <>
                                <span class={'dialog-footer'}>
                                    <ElButton
                                        onClick={($event?: any) => {
                                            drawerVisible.value = false;
                                        }}
                                    >
                                        {$t('commons.button.cancel')}
                                    </ElButton>
                                </span>
                            </>
                        ),
                    }}
                >
                    <div class={'mb-4'}>
                        <ElAlert closable={false}>{$t('ssh.pubKeyHelper', [unref(currentUser)])}</ElAlert>
                    </div>
                    {withDirectives(
                        <ElButton
                            type="primary"
                            plain
                            onClick={($event?: any) => {
                                onOpenDialog('create');
                            }}
                        >
                            {$t('commons.button.create')}
                        </ElButton>,
                        [
                            [permissionDirective, true],
                            [nodeAdminDirective, true],
                        ],
                    )}
                    {withDirectives(
                        <ElButton
                            plain
                            onClick={($event?: any) => {
                                onSync();
                            }}
                        >
                            {$t('commons.button.sync')}
                        </ElButton>,
                        [
                            [permissionDirective, true],
                            [nodeAdminDirective, true],
                        ],
                    )}
                    {withDirectives(
                        <ElButton
                            plain
                            disabled={unref(selects).length === 0}
                            onClick={($event?: any) => {
                                onDelete(null);
                            }}
                        >
                            {$t('commons.button.delete')}
                        </ElButton>,
                        [
                            [permissionDirective, true],
                            [nodeAdminDirective, true],
                        ],
                    )}
                    <ComplexTable
                        pagination-config={paginationConfig}
                        selects={unref(selects)}
                        onUpdate:selects={($v) => {
                            selects.value = $v as any;
                        }}
                        data={unref(data)}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                        heightDiff={320}
                    >
                        <ElTableColumn type="selection" fix />
                        <ElTableColumn label={$t('commons.table.name')} show-overflow-tooltip prop="name" />
                        <ElTableColumn label={$t('ssh.encryptionMode')} prop="encryptionMode" />
                        <ElTableColumn label={$t('commons.table.description')} prop="description" />
                        <FuTableOperations width="200px" buttons={buttons} label={$t('commons.table.operate')} />
                    </ComplexTable>
                </DrawerPro>
                <DialogPro
                    modelValue={unref(connOpen)}
                    onUpdate:modelValue={($v) => {
                        connOpen.value = $v as any;
                    }}
                    title={$t('ssh.pubkey')}
                    size="small"
                    showClose={false}
                    v-slots={{
                        footer: () => (
                            <>
                                <span class={'dialog-footer'}>
                                    <ElButton
                                        onClick={($event?: any) => {
                                            connOpen.value = false;
                                        }}
                                    >
                                        {$t('commons.button.cancel')}
                                    </ElButton>
                                </span>
                            </>
                        ),
                    }}
                >
                    <ElDescriptions column={1} border class={'margin-top'}>
                        <ElDescriptionsItem align="center" label={$t('ssh.password')}>
                            <div>
                                <span>{loadPassPhrase()}</span>
                            </div>
                            {unref(currentRow).passPhrase &&
                            Base64.decode(unref(currentRow).passPhrase) !== '<UN-SET>' ? (
                                <ElButton
                                    size="small"
                                    icon="CopyDocument"
                                    onClick={($event?: any) => {
                                        onCopy(unref(currentRow).passPhrase);
                                    }}
                                >
                                    {$t('commons.button.copy')}
                                </ElButton>
                            ) : null}
                        </ElDescriptionsItem>
                        <ElDescriptionsItem align="center" label={$t('ssh.publicKey')}>
                            <ElButtonGroup size="small">
                                <ElButton
                                    icon="CopyDocument"
                                    onClick={($event?: any) => {
                                        onCopy(unref(currentRow).publicKey);
                                    }}
                                >
                                    {$t('commons.button.copy')}
                                </ElButton>
                                <ElButton
                                    icon="Download"
                                    onClick={($event?: any) => {
                                        onDownload(unref(currentRow), 'publicKey');
                                    }}
                                >
                                    {$t('commons.button.download')}
                                </ElButton>
                            </ElButtonGroup>
                        </ElDescriptionsItem>
                        <ElDescriptionsItem align="center" label={$t('ssh.privateKey')}>
                            <ElButtonGroup size="small">
                                <ElButton
                                    icon="CopyDocument"
                                    onClick={($event?: any) => {
                                        onCopy(unref(currentRow).privateKey);
                                    }}
                                >
                                    {$t('commons.button.copy')}
                                </ElButton>
                                <ElButton
                                    icon="Download"
                                    onClick={($event?: any) => {
                                        onDownload(unref(currentRow), 'privateKey');
                                    }}
                                >
                                    {$t('commons.button.download')}
                                </ElButton>
                            </ElButtonGroup>
                        </ElDescriptionsItem>
                    </ElDescriptions>
                </DialogPro>
                <OpDialog
                    ref={opRef}
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                    onSubmit={($event?: any) => {
                        onSubmitDelete();
                    }}
                    v-slots={{
                        content: () => (
                            <>
                                <ElForm ref="deleteForm" label-position="left">
                                    <ElFormItem>
                                        <ElCheckbox
                                            modelValue={unref(forceDelete)}
                                            onUpdate:modelValue={($v) => {
                                                forceDelete.value = $v as any;
                                            }}
                                            label={$t('website.forceDelete')}
                                        />
                                        <span class={'input-help'}>{$t('website.forceDeleteHelper')}</span>
                                    </ElFormItem>
                                </ElForm>
                            </>
                        ),
                    }}
                />
                <Operate
                    ref={dialogRef}
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                />
            </div>
        );
    },
    options,
);
