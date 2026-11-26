import { $t } from '@/utils/i18n-t';
import { File } from '@/types/file';
import { rpc } from '@/lib/rpc';
import { computed, nextTick, reactive, ref } from 'vue';
import i18n from '@/lang';
import { MsgSuccess, MsgWarning } from '@/utils/message';
import { useSearchableForSelect } from '@/views/host/file-management/hooks/searchable';
import { computeSize } from '@/utils/size';
import { debounce } from '@/utils/misc';
interface DialogProps {
    path?: string;
    dir: boolean;
    isAll?: boolean;
    disabled?: boolean;
    multiple?: boolean;
    selectedPaths?: string[];
}
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElLink } from 'element-plus';
import { ElIcon } from 'element-plus';
import { ElTooltip } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElPopover } from 'element-plus';
import { ElTable } from 'element-plus';
import { ElTableColumn } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElTag } from 'element-plus';
import DialogPro from '@/components/dialog-pro/index';
import { HomeFilled } from '@element-plus/icons-vue';
import SvgIcon from '@/components/svg-icon/svg-icon';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    choose: (...args: unknown[]) => true,
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'file-list',
    props: {},
    emits: emits,
    __scopeId: 'data-v-bd741571',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const data = ref([]);
        const loading = ref(false);
        const paths = ref<string[]>([]);
        const req = reactive({ path: '/', expand: true, page: 1, pageSize: 300, showHidden: true });
        const selectRow = ref({ path: '', name: '' });
        const selectRows = ref<Array<{ path: string; name: string }>>([]);
        const selectedPathSet = computed(() => new Set(selectRows.value.map((item) => item.path)));
        const isMultiple = ref(false);
        const rowRefs = ref();
        const open = ref(false);
        const newFolder = ref();
        const disBtn = ref(false);
        const favorites = ref<File.Favorite[]>([]);
        const { searchableStatus, searchablePath, searchableInputRef, searchableInputBlur } =
            useSearchableForSelect(paths);
        const oldUrl = ref<string>('');
        const form = reactive({
            path: '/',
            dir: false,
            isAll: false,
            disabled: false,
        });
        const acceptParams = (__panelSetupProps: DialogProps): void => {
            form.path = __panelSetupProps.path || '/';
            form.dir = __panelSetupProps.dir;
            form.isAll = __panelSetupProps.isAll || false;
            form.disabled = __panelSetupProps.disabled || false;
            isMultiple.value = __panelSetupProps.multiple || false;
            disBtn.value = false;
            selectRows.value = [...new Set(__panelSetupProps.selectedPaths || [])].map((path) => ({
                path,
                name: path,
            }));
            selectRow.value = { path: '', name: '' };
            openPage();
            req.path = form.path;
            oldUrl.value = form.path;
            search(req);
            open.value = true;
        };
        const selectFile = () => {
            if (isMultiple.value) {
                ctx.emit(
                    'choose',
                    selectRows.value.map((r) => r.path),
                );
            } else {
                if (selectRow.value) {
                    ctx.emit('choose', selectRow.value.path);
                }
            }
            handleClose();
        };
        const handleClose = () => {
            open.value = false;
            selectRow.value = { path: '', name: '' };
            selectRows.value = [];
            ctx.emit('close');
        };
        const openPage = () => {
            open.value = true;
            selectRow.value.path = form.dir ? form.path || '/' : '';
        };
        const openDir = async (row: File.File, column: any, event: any) => {
            if (event?.target?.tagName === 'BUTTON' || event?.target?.tagName === 'SPAN') {
                return;
            }
            if (row.isDir) {
                const name = row.name;
                paths.value.push(name);
                if (req.path === '/') {
                    req.path = req.path + name;
                } else {
                    req.path = req.path + '/' + name;
                }
                loading.value = true;
                await search(req)
                    .then(() => {
                        loading.value = false;
                        if (form.isAll || form.dir) {
                            selectRow.value.path = req.path;
                        } else {
                            selectRow.value.path = '';
                        }
                    })
                    .catch(() => {
                        loading.value = false;
                    });
                return;
            }
            // Handle file click
            const fullPath = (req.path === '/' ? req.path : req.path + '/') + row.name;
            if (isMultiple.value && (form.isAll || !form.dir)) {
                // Multiple mode: toggle selection
                const index = selectRows.value.findIndex((r) => r.path === fullPath);
                if (index > -1) {
                    selectRows.value.splice(index, 1);
                } else {
                    selectRows.value.push({ path: fullPath, name: row.name });
                }
                return;
            }
            // Single mode: original behavior
            if (form.isAll || !form.dir) {
                selectRow.value.path = fullPath;
                return;
            }
            selectRow.value.path = '';
        };
        const handleRowClick = (row: any, column: any, event: any) => {
            if (row.isCreate) {
                return;
            }
            debouncedOpenDir(row, column, event);
        };
        const debouncedOpenDir = debounce(openDir, 300);
        const jump = async (index: number) => {
            oldUrl.value = req.path;
            let path = '';
            if (index !== -1) {
                const jPaths = paths.value.slice(0, index + 1);
                path = '/' + jPaths.join('/');
            }
            path = path || '/';
            req.path = path;
            selectRow.value.path = form.dir ? req.path : '';
            await search(req);
            open.value = true;
        };
        const jumpPath = async () => {
            loading.value = true;
            try {
                oldUrl.value = req.path;
                getPaths(searchablePath.value);
                req.path = searchablePath.value || '/';
                search(req);
            } finally {
                loading.value = false;
            }
        };
        const getFileSize = async (path: string) => {
            updateByPath(path, { btnLoading: true });
            try {
                const res = await rpc.file.getFile({ path });
                updateByPath(path, { dirSize: Number(res.size) });
            } finally {
                updateByPath(path, { btnLoading: false });
            }
        };
        const getDirSize = async (path: string) => {
            updateByPath(path, { btnLoading: true });
            try {
                const res = await rpc.file.getSize({ path });
                updateByPath(path, { dirSize: Number(res.size) });
            } finally {
                updateByPath(path, { btnLoading: false });
            }
        };
        const updateByPath = (path: string, patch: Partial<(typeof data.value)[0]>) => {
            data.value = data.value.map((item) => (item.path === path ? { ...item, ...patch } : item));
        };
        const getPaths = (reqPath: string) => {
            const pathArray = reqPath.split('/');
            paths.value = [];
            let base = '/';
            for (const p of pathArray) {
                if (p != '') {
                    if (base.endsWith('/')) {
                        base = base + p;
                    } else {
                        base = base + '/' + p;
                    }
                    paths.value.push(p);
                }
            }
        };
        const search = async (req: File.ReqFile) => {
            req.dir = form.dir;
            loading.value = true;
            await rpc.file
                .listFiles(req)
                .then((res) => {
                    if (!res.path) {
                        req.path = oldUrl.value;
                        getPaths(oldUrl.value);
                        MsgWarning(i18n.global.t('commons.res.notFound'));
                        return;
                    }
                    data.value = (res.items || []).map((item) => ({ ...item, size: Number(item.size) }));
                    req.path = res.path;
                    const pathArray = req.path.split('/');
                    paths.value = [];
                    for (const p of pathArray) {
                        if (p != '') {
                            paths.value.push(p);
                        }
                    }
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        let addForm = reactive({
            path: '',
            name: '',
            isDir: true,
            mode: 0o755,
            isLink: false,
            isSymlink: true,
            linkPath: '',
        });
        const onAddItem = async (isDir: boolean) => {
            const createRow = data.value?.find((row: { isCreate: any }) => row.isCreate);
            if (createRow) {
                MsgWarning(i18n.global.t('commons.msg.creatingInfo'));
                return;
            }
            newFolder.value = isDir ? i18n.global.t('file.noNameFolder') : i18n.global.t('file.noNameFile');
            if (form.dir === isDir) {
                selectRow.value.name = newFolder.value;
                const basePath = req.path === '/' ? req.path : `${req.path}/`;
                selectRow.value.path = `${basePath}${newFolder.value}`;
            }
            data.value?.unshift({
                path: selectRow.value.path,
                isCreate: true,
                isDir: isDir,
                name: newFolder.value,
            });
            disBtn.value = true;
            await nextTick();
            rowRefs.value.focus();
        };
        const cancelFolder = (row: any) => {
            data.value.shift();
            row.isCreate = false;
            disBtn.value = false;
            selectRow.value.path = form.dir ? req.path : '';
            newFolder.value = '';
        };
        const handleChange = (value: string, row: any) => {
            row.name = value;
            const basePath = req.path === '/' ? req.path : `${req.path}/`;
            selectRow.value.path = `${basePath}${value}`;
            if (row.isDir) {
                if (form.isAll || form.dir) {
                    selectRow.value.path = `${basePath}${value}`;
                } else {
                    selectRow.value.path = '';
                }
                return;
            }
            if (form.isAll || !form.dir) {
                selectRow.value.path = `${basePath}${value}`;
                return;
            }
            selectRow.value.path = '';
        };
        const createFolder = async (row: any) => {
            const basePath = req.path === '/' ? req.path : `${req.path}/`;
            addForm.path = `${basePath}${newFolder.value}`;
            if (addForm.path.indexOf('.1panel_clash') > -1) {
                MsgWarning(i18n.global.t('file.clashDidNotSupport'));
                return;
            }
            addForm.isDir = row.isDir;
            addForm.name = newFolder.value;
            loading.value = true;
            rpc.file
                .createFile({
                    path: addForm.path,
                    isDir: addForm.isDir,
                    mode: BigInt(addForm.mode),
                    isLink: addForm.isLink,
                    isSymlink: addForm.isSymlink,
                    linkPath: addForm.linkPath,
                })
                .then(async () => {
                    row.isCreate = false;
                    disBtn.value = false;
                    MsgSuccess(i18n.global.t('commons.msg.createSuccess'));
                    await search(req);
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        const toggleDirectory = (path: string) => {
            const index = selectRows.value.findIndex((item) => item.path === path);
            if (index >= 0) {
                selectRows.value.splice(index, 1);
            } else {
                selectRows.value.push({ path, name: path });
            }
        };
        const removeSelected = (index: number) => {
            selectRows.value.splice(index, 1);
        };
        const loadFavorites = async () => {
            try {
                const res = await rpc.file.searchFavorites({ page: 1, pageSize: 100 });
                favorites.value = res.items || [];
            } catch {}
        };
        const jumpToFavorite = async (item: File.Favorite) => {
            const targetPath = item.isDir ? item.path : item.path.substring(0, item.path.lastIndexOf('/')) || '/';
            oldUrl.value = req.path;
            req.path = targetPath;
            getPaths(targetPath);
            selectRow.value.path = form.dir ? targetPath : '';
            await search(req);
            if (!item.isDir && (form.isAll || !form.dir)) {
                selectRow.value.path = item.path;
            }
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DialogPro
                title={$t('file.list')}
                size="w-60"
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
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
                                        (selectFile as any)($event);
                                    }}
                                    disabled={unref(disBtn) || (unref(isMultiple) && unref(selectRows).length === 0)}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            >
                <div>
                    <div
                        onClick={($event?: any) => {
                            searchableStatus.value = true;
                        }}
                        class={'address-bar flex flex-grow items-center rounded-md px-4 py-2 shadow-md'}
                        style={[{}, { display: !unref(searchableStatus) ? '' : 'none' }]}
                    >
                        <span class={'root mr-1'}>
                            <ElLink
                                onClick={($event?: any) => {
                                    $event.stopPropagation();
                                    jump(-1);
                                }}
                            >
                                <ElIcon size={20}>
                                    <HomeFilled />
                                </ElIcon>
                            </ElLink>
                        </span>
                        {unref(paths).length > 0 ? (
                            <span>
                                {(unref(paths) || []).map((_, index) => (
                                    <span class={'inline-flex items-center'} key={index}>
                                        <span class={'arrow mr-1 ml-1'}>{'>'}</span>
                                        <ElTooltip effect="dark" content={unref(paths)[index]} placement="top">
                                            <ElLink
                                                onClick={($event?: any) => {
                                                    $event.stopPropagation();
                                                    jump(index);
                                                }}
                                                class={'path-segment pathname mr-1 cursor-pointer'}
                                            >
                                                {unref(paths)[index].length > 25
                                                    ? unref(paths)[index].substring(0, 22) + '...'
                                                    : unref(paths)[index]}
                                            </ElLink>
                                        </ElTooltip>
                                    </span>
                                ))}
                            </span>
                        ) : null}
                    </div>
                    <ElInput
                        ref={searchableInputRef}
                        modelValue={unref(searchablePath)}
                        onUpdate:modelValue={($v) => {
                            searchablePath.value = $v as any;
                        }}
                        onBlur={($event?: any) => {
                            unref(searchableInputBlur);
                        }}
                        onKeyup={($event?: any) => {
                            if (!($event.key === 'Enter')) return;
                            jumpPath();
                            searchableStatus.value = false;
                        }}
                        class={'rounded-md border px-4 py-2 shadow-md'}
                        style={[{}, { display: unref(searchableStatus) ? '' : 'none' }]}
                    />
                </div>
                <ElButton
                    link
                    onClick={($event?: any) => {
                        jump(unref(paths).length - 2);
                    }}
                    type="primary"
                    size="small"
                    class={'float-left mt-4'}
                >
                    {$t('file.top')}
                </ElButton>
                <div class={'float-right mt-4'}>
                    <ElPopover
                        placement="bottom-end"
                        width={300}
                        trigger="click"
                        onShow={($event?: any) => {
                            (loadFavorites as any)($event);
                        }}
                        v-slots={{
                            reference: () => (
                                <>
                                    <ElButton link type="primary" size="small">
                                        {$t('file.favorite')}
                                    </ElButton>
                                </>
                            ),
                        }}
                    >
                        {unref(favorites).length === 0 ? (
                            <div class={'py-3 text-center text-sm text-gray-400'}>{$t('commons.msg.noneData')}</div>
                        ) : (
                            <div class={'favorite-list max-h-52 overflow-y-auto'}>
                                {(unref(favorites) || []).map((item) => (
                                    <div
                                        onClick={($event?: any) => {
                                            jumpToFavorite(item);
                                        }}
                                        class={'favorite-item flex cursor-pointer items-center rounded px-2 py-1.5'}
                                        key={item.id}
                                    >
                                        <SvgIcon
                                            iconName={item.isDir ? 'p-file-folder' : 'p-file-normal'}
                                            class={'mr-2 flex-shrink-0'}
                                        />
                                        <ElTooltip content={item.path} placement="top">
                                            <span class={'dialog-object-name text-sm'}>{item.name}</span>
                                        </ElTooltip>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ElPopover>
                    <ElButton
                        link
                        onClick={($event?: any) => {
                            onAddItem(true);
                        }}
                        type="primary"
                        size="small"
                    >
                        {$t('commons.button.createNewFolder')}
                    </ElButton>
                    <ElButton
                        link
                        onClick={($event?: any) => {
                            onAddItem(false);
                        }}
                        type="primary"
                        size="small"
                    >
                        {$t('commons.button.createNewFile')}
                    </ElButton>
                </div>
                {withDirectives(
                    <div>
                        <ElTable
                            data={unref(data)}
                            highlight-current-row
                            height="40vh"
                            onRowClick={($event?: any) => {
                                (handleRowClick as any)($event);
                            }}
                            class={'dialog-file-list cursor-pointer'}
                        >
                            {unref(isMultiple) && form.dir ? (
                                <ElTableColumn
                                    width="48"
                                    v-slots={{
                                        default: ({ row }) => (
                                            <>
                                                {row.isDir && !row.isCreate ? (
                                                    <ElCheckbox
                                                        model-value={unref(selectedPathSet).has(row.path)}
                                                        onClick={($event?: any) => {
                                                            $event.stopPropagation();
                                                        }}
                                                        onChange={($event?: any) => {
                                                            toggleDirectory(row.path);
                                                        }}
                                                    />
                                                ) : null}
                                            </>
                                        ),
                                    }}
                                />
                            ) : null}
                            <ElTableColumn
                                prop="name"
                                show-overflow-tooltip
                                fix
                                v-slots={{
                                    default: ({ row }) => (
                                        <>
                                            <SvgIcon
                                                iconName={row.isDir ? 'p-file-folder' : 'p-file-normal'}
                                                class={'table-icon'}
                                            />
                                            {!row.isCreate ? (
                                                <>{row.name}</>
                                            ) : (
                                                <>
                                                    <ElInput
                                                        ref={rowRefs}
                                                        modelValue={unref(newFolder)}
                                                        onUpdate:modelValue={($v) => {
                                                            newFolder.value = $v as any;
                                                        }}
                                                        placeholder="new folder"
                                                        onInput={($event?: any) => {
                                                            handleChange(unref(newFolder), row);
                                                        }}
                                                        class={'p-w-200'}
                                                    />
                                                    <ElButton
                                                        link
                                                        onClick={($event?: any) => {
                                                            createFolder(row);
                                                        }}
                                                        type="primary"
                                                        size="small"
                                                        class={'ml-2'}
                                                    >
                                                        {$t('commons.button.save')}
                                                    </ElButton>
                                                    <ElButton
                                                        link
                                                        onClick={($event?: any) => {
                                                            cancelFolder(row);
                                                        }}
                                                        type="primary"
                                                        size="small"
                                                        class={'!ml-2'}
                                                    >
                                                        {$t('commons.button.cancel')}
                                                    </ElButton>
                                                </>
                                            )}
                                        </>
                                    ),
                                }}
                            />
                            <ElTableColumn
                                prop="size"
                                width="160px"
                                fix
                                v-slots={{
                                    default: ({ row }) => (
                                        <>
                                            {!row.isCreate ? (
                                                <ElButton
                                                    type="primary"
                                                    link
                                                    small
                                                    loading={row.btnLoading}
                                                    onClick={($event?: any) => {
                                                        row.isDir ? getDirSize(row.path) : getFileSize(row.path);
                                                    }}
                                                >
                                                    {row.isDir ? (
                                                        <span>
                                                            {row.dirSize === undefined ? (
                                                                <span>{$t('file.calculate')}</span>
                                                            ) : (
                                                                <span>{computeSize(row.dirSize)}</span>
                                                            )}
                                                        </span>
                                                    ) : (
                                                        <span>{computeSize(row.size)}</span>
                                                    )}
                                                </ElButton>
                                            ) : null}
                                        </>
                                    ),
                                }}
                            />
                        </ElTable>
                    </div>,
                    [[vLoading, unref(loading)]],
                )}
                <div class={'file-list-bottom'}>
                    {unref(isMultiple) && form.dir ? (
                        <ElCheckbox
                            model-value={unref(selectedPathSet).has(req.path)}
                            onChange={($event?: any) => {
                                toggleDirectory(req.path);
                            }}
                        >
                            {req.path}
                        </ElCheckbox>
                    ) : null}
                    {!unref(isMultiple) && unref(selectRow)?.path ? (
                        <div>
                            {$t('file.currentSelect')}
                            <ElTooltip content={unref(selectRow).path} placement="top">
                                <ElTag type="success">
                                    <div class={'path'}>
                                        <span>{unref(selectRow).path}</span>
                                    </div>
                                </ElTag>
                            </ElTooltip>
                        </div>
                    ) : null}
                    {unref(isMultiple) && unref(selectRows).length > 0 ? (
                        <div>
                            {$t('file.currentSelect')}
                            {(unref(selectRows) || []).map((item, index) => (
                                <ElTag
                                    type="success"
                                    closable
                                    onClose={($event?: any) => {
                                        removeSelected(index);
                                    }}
                                    class={'mr-1 mb-1'}
                                    key={item.path}
                                >
                                    <ElTooltip content={item.path} placement="top">
                                        <div class={'path'}>
                                            <span>{item.path}</span>
                                        </div>
                                    </ElTooltip>
                                </ElTag>
                            ))}
                        </div>
                    ) : null}
                </div>
            </DialogPro>
        );
    },
    options,
);
