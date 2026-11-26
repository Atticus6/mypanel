import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import permissionDirective from '@/directives/modules/permission';
import { ElDescriptions } from 'element-plus';
import { ElDescriptionsItem } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElTag } from 'element-plus';
import { ElText } from 'element-plus';
import { ElButton } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
    id?: number;
}

const emits = {};

const options = {
    name: 'resource',
    props: {
        id: {
            type: Number,
            default: 0,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const data = ref([]);
        const req = reactive({
            websiteID: __panelSetupProps.id,
            databaseID: 0,
            databaseType: '',
            db: '',
        });
        const databases = ref([]);
        const website = ref({
            type: '',
            dbID: 0,
            dbType: '',
        });
        const search = async () => {
            try {
                const res = await rpc.website.getResource({ id: __panelSetupProps.id });
                data.value = (res.items || []).map((item) => ({
                    ...item,
                    resourceID: item.resourceId,
                    detail: item.detailJson ? JSON.parse(item.detailJson) : undefined,
                })) as any;
            } catch (error) {}
        };
        const listDatabases = async () => {
            try {
                const res = await rpc.website.listDatabases({});
                databases.value = res.items as any;
                if (databases.value.length > 0 && website.value.dbID > 0) {
                    for (let i = 0; i < databases.value.length; i++) {
                        if (
                            databases.value[i].id === website.value.dbID &&
                            databases.value[i].type === website.value.dbType
                        ) {
                            req.db = databases.value[i].id + databases.value[i].type;
                            break;
                        }
                    }
                }
            } catch (error) {}
        };
        const changeDB = () => {
            for (let i = 0; i < databases.value.length; i++) {
                if (databases.value[i].id + databases.value[i].type === req.db) {
                    req.databaseID = databases.value[i].id;
                    req.databaseType = databases.value[i].type;
                    break;
                }
            }
        };
        const submit = async () => {
            try {
                await rpc.website.changeDatabase(req as any);
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                search();
            } catch (error) {}
        };
        const get = async () => {
            try {
                const res = await (rpc.website.getWebsite({ id: __panelSetupProps.id }) as Promise<any>);
                website.value = res.data;
                req.db = '';
                search();
                listDatabases();
            } catch (error) {}
        };
        onMounted(() => {
            get();
        });
        return () => (
            <div class={'p-w-400'}>
                <ElDescriptions border column={1}>
                    {(unref(data) || []).map((resource, index) => (
                        <div key={index}>
                            <ElDescriptionsItem label={$t('menu.' + resource.type)}>{resource.name}</ElDescriptionsItem>
                        </div>
                    ))}
                </ElDescriptions>
                {unref(website).type === 'static' || unref(website).type === 'runtime' ? (
                    <ElForm ref="changeForm" model={req} label-position="left" label-width="90px" class={'mt-5'}>
                        <ElFormItem label={$t('website.changeDatabase')} prop="db">
                            <ElSelect
                                modelValue={req.db}
                                onUpdate:modelValue={($v) => {
                                    req.db = $v as any;
                                }}
                                onChange={($event?: any) => {
                                    (changeDB as any)($event);
                                }}
                                class={'w-full'}
                            >
                                <ElOption label={$t('website.donotLinkeDB')} value={0} />
                                {(unref(databases) || []).map((item, index) => (
                                    <ElOption label={item.name} value={item.id + item.type} key={index}>
                                        <div class={'flex items-center justify-between'}>
                                            <span>{item.name}</span>
                                            <div>
                                                <ElTag>{item.databaseName}</ElTag>
                                                <ElTag class={'ml-1'}>
                                                    {item.from === 'local'
                                                        ? $t('commons.table.local')
                                                        : $t('database.remote')}
                                                </ElTag>
                                            </div>
                                        </div>
                                    </ElOption>
                                ))}
                            </ElSelect>
                            <ElText type="warning">{$t('website.changeDatabaseHelper1')}</ElText>
                            <ElText type="warning">{$t('website.changeDatabaseHelper2')}</ElText>
                        </ElFormItem>
                        <ElFormItem>
                            {withDirectives(
                                <ElButton
                                    type="primary"
                                    onClick={($event?: any) => {
                                        submit();
                                    }}
                                >
                                    {$t('commons.button.save')}
                                </ElButton>,
                                [[permissionDirective, true]],
                            )}
                        </ElFormItem>
                    </ElForm>
                ) : null}
            </div>
        );
    },
    options,
);
