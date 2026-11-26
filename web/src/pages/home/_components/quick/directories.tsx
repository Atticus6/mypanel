import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { routerToFileWithPath } from '@/utils/router';
import FileList from '@/components/file-list/index';
import { Dashboard } from '@/types/dashboard';
import { rpc } from '@/lib/rpc';
type DirectoryRow = Dashboard.QuickDirectory & {
    key: number;
    savedPath: string;
    editing: boolean;
    busy: boolean;
};
import './directories.styles.css';

interface CodemodProps {
    [key: string]: any;
    count?: string;
    disabled?: boolean;
}

const emits = {
    change: (arg0?: number) => true,
};

const options = {
    name: 'directories',
    props: {
        count: String,
        disabled: Boolean,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-87a28a0f',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const rows = ref<DirectoryRow[]>([]);
        const searchInput = ref('');
        const searchTerm = ref('');
        const filteredRows = computed(() =>
            rows.value.filter(
                (row) =>
                    !row.id ||
                    row.editing ||
                    row.path.toLowerCase().includes(searchTerm.value) ||
                    (row.alias ?? '').toLowerCase().includes(searchTerm.value),
            ),
        );
        const search = () => {
            searchTerm.value = searchInput.value.trim().toLowerCase();
        };
        const fileRef = ref<InstanceType<typeof FileList>>();
        const selectingRow = ref<DirectoryRow>();
        const visible = ref(false);
        const loading = ref(false);
        const loaded = ref(false);
        let nextKey = 0;
        const setVisible = (value: boolean) => {
            if (value) visible.value = true;
        };
        const close = () => {
            visible.value = false;
        };
        const selectPath = (row: DirectoryRow) => {
            if (!row.editing || row.busy) return;
            selectingRow.value = row;
            fileRef.value?.acceptParams({ path: row.path, dir: false, isAll: true });
        };
        const loadPath = (path: string) => {
            const row = selectingRow.value;
            if (row?.editing && !row.busy) row.path = path;
        };
        const add = () => {
            rows.value.push({
                key: nextKey++,
                id: 0,
                path: '',
                alias: '',
                savedPath: '',
                editing: true,
                busy: false,
            });
        };
        const updateCount = () => ctx.emit('change', rows.value.filter((row) => row.id).length);
        const load = async () => {
            if (loading.value || rows.value.some((row) => row.busy)) return;
            loading.value = true;
            loaded.value = false;
            searchInput.value = '';
            searchTerm.value = '';
            rows.value = [];
            try {
                const { items } = await rpc.dashboard.getQuickDirectories({});
                rows.value = items.map((item) => ({
                    ...item,
                    alias: item.alias ?? '',
                    key: nextKey++,
                    savedPath: item.path,
                    editing: false,
                    busy: false,
                }));
                if (!rows.value.length) add();
                loaded.value = true;
                updateCount();
            } finally {
                loading.value = false;
            }
        };
        const save = async (row: DirectoryRow) => {
            if (row.busy || !row.path.trim()) return;
            row.busy = true;
            try {
                const payload = { path: row.path, alias: (row.alias ?? '').trim() };
                const data = row.id
                    ? await rpc.dashboard.updateQuickDirectory({ id: row.id, legacy: row.legacy ?? false, ...payload })
                    : await rpc.dashboard.createQuickDirectory(payload);
                Object.assign(row, data, { savedPath: data.path, editing: false });
                updateCount();
            } finally {
                row.busy = false;
            }
        };
        const remove = async (row: DirectoryRow) => {
            if (row.busy) return;
            if (row.id) {
                row.busy = true;
                try {
                    await ElMessageBox.confirm('', i18n.global.t('home.quickDirDelete', [row.savedPath]), {
                        confirmButtonText: i18n.global.t('commons.button.confirm'),
                        cancelButtonText: i18n.global.t('commons.button.cancel'),
                        customClass: 'quick-directory-delete',
                        type: 'warning',
                        center: true,
                    });
                } catch {
                    row.busy = false;
                    return;
                }
                try {
                    await rpc.dashboard.deleteQuickDirectory({ id: row.id, legacy: row.legacy ?? false });
                } catch (error) {
                    row.busy = false;
                    throw error;
                }
            }
            rows.value = rows.value.filter((item) => item.key !== row.key);
            if (!rows.value.length) add();
            updateCount();
        };
        return () => (
            <>
                <ElPopover
                    trigger="click"
                    placement="bottom"
                    width={680}
                    popper-style={{ maxWidth: 'calc(100vw - 32px)' }}
                    visible={unref(visible)}
                    onUpdate:visible={($event?: any) => {
                        (setVisible as any)($event);
                    }}
                    disabled={__panelSetupProps.disabled}
                    title={$t('home.quickDir')}
                    onShow={($event?: any) => {
                        (load as any)($event);
                    }}
                    v-slots={{
                        reference: () => (
                            <>
                                <ElButton link type="primary" disabled={__panelSetupProps.disabled}>
                                    {__panelSetupProps.count}
                                </ElButton>
                            </>
                        ),
                    }}
                >
                    {
                        <div class={'quick-directories'} v-loading={unref(loading)}>
                            <div class={'directory-search'}>
                                <ElInput
                                    v-model={searchInput.value}
                                    clearable
                                    prefix-icon="Search"
                                    placeholder={`${$t('file.path')} / ${$t('home.alias')}`}
                                    aria-label={$t('commons.button.search')}
                                    onKeyup={($event?: any) => {
                                        if (!($event.key === 'Enter')) return;
                                        (search as any)($event);
                                    }}
                                    onClear={($event?: any) => {
                                        (search as any)($event);
                                    }}
                                />
                                <ElButton
                                    disabled={unref(loading)}
                                    onClick={($event?: any) => {
                                        (search as any)($event);
                                    }}
                                >
                                    {$t('commons.button.search')}
                                </ElButton>
                            </div>
                            <div class={'directory-row directory-header'}>
                                <span>{$t('file.path')}</span>
                                <span>{$t('home.alias')}</span>
                                <span />
                            </div>
                            <div class={'directory-list'}>
                                {!unref(filteredRows).length ? (
                                    <div class={'directory-empty'}>{$t('commons.msg.noneData')}</div>
                                ) : null}
                                {(unref(filteredRows) || []).map((row) => (
                                    <div class={'directory-row'} key={row.key}>
                                        <ElInput
                                            v-model={row.path}
                                            readonly={!row.editing}
                                            disabled={row.busy}
                                            aria-label={$t('file.path')}
                                            v-slots={{
                                                prepend: () => (
                                                    <>
                                                        <ElButton
                                                            icon="Folder"
                                                            disabled={!row.editing || row.busy}
                                                            aria-label={$t('file.list')}
                                                            onClick={($event?: any) => {
                                                                selectPath(row);
                                                            }}
                                                        />
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElInput
                                            v-model={row.alias}
                                            readonly={!row.editing}
                                            disabled={row.busy}
                                            aria-label={$t('home.alias')}
                                        />
                                        <div class={'directory-actions'}>
                                            <ElButton
                                                link
                                                type={row.editing ? 'success' : 'primary'}
                                                icon={row.editing ? 'Check' : 'Edit'}
                                                aria-label={$t(
                                                    row.editing ? 'commons.button.save' : 'commons.button.edit',
                                                )}
                                                disabled={
                                                    unref(loading) || row.busy || (row.editing && !row.path.trim())
                                                }
                                                onClick={($event?: any) => {
                                                    row.editing ? save(row) : (row.editing = true);
                                                }}
                                            />
                                            {row.id || unref(rows).length > 1 ? (
                                                <ElButton
                                                    link
                                                    type={row.editing ? 'info' : 'danger'}
                                                    icon={row.editing ? 'Close' : 'Delete'}
                                                    aria-label={$t('commons.button.delete')}
                                                    disabled={unref(loading) || row.busy}
                                                    onClick={($event?: any) => {
                                                        remove(row);
                                                    }}
                                                />
                                            ) : null}
                                            {row.id ? (
                                                <ElButton
                                                    link
                                                    type="primary"
                                                    icon="Position"
                                                    title={$t('firewall.quickJump')}
                                                    aria-label={$t('firewall.quickJump')}
                                                    disabled={unref(loading) || row.busy}
                                                    onClick={($event?: any) => {
                                                        routerToFileWithPath(row.savedPath);
                                                    }}
                                                />
                                            ) : null}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <ElButton
                                link
                                type="primary"
                                icon="Plus"
                                disabled={unref(loading) || !unref(loaded)}
                                onClick={($event?: any) => {
                                    (add as any)($event);
                                }}
                                class={'directory-add'}
                            >
                                {$t('commons.button.add')}
                            </ElButton>
                        </div>
                    }
                    <div class={'directory-footer'}>
                        <ElButton
                            onClick={($event?: any) => {
                                (close as any)($event);
                            }}
                        >
                            {$t('commons.button.close')}
                        </ElButton>
                    </div>
                </ElPopover>
                <FileList
                    ref={fileRef}
                    onChoose={($event?: any) => {
                        (loadPath as any)($event);
                    }}
                    onClose={($event?: any) => {
                        selectingRow.value = undefined;
                    }}
                />
            </>
        );
    },
    options,
);
