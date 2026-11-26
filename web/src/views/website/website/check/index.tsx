import { $t } from '@/utils/i18n-t';
import { Website } from '@/types/website';
import { routerToName } from '@/utils/router';
import { ref } from 'vue';
interface InstallRrops {
    items: Website.CheckRes[];
}
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElRow } from 'element-plus';
import { ElAlert } from 'element-plus';
import { ElCol } from 'element-plus';
import { ElTable } from 'element-plus';
import { ElTableColumn } from 'element-plus';
import { ElButton } from 'element-plus';
import DialogPro from '@/components/dialog-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'check',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        let open = ref(false);
        let items = ref([]);
        const acceptParams = async (__panelSetupProps: InstallRrops) => {
            items.value = __panelSetupProps.items;
            open.value = true;
        };
        const handleClose = () => {
            open.value = false;
        };
        const toPage = () => {
            routerToName('AppInstalled');
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DialogPro
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
                title={$t('app.checkTitle')}
                size="large"
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
                                        (toPage as any)($event);
                                    }}
                                >
                                    {$t('website.toApp')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            >
                <ElRow>
                    <ElAlert
                        type="warning"
                        description={$t('website.deleteHelper')}
                        center
                        show-icon
                        closable={false}
                    />
                    <ElCol span={24}>
                        <br />
                        <ElTable data={unref(items)} style={'width: 100%'}>
                            <ElTableColumn prop="name" label={$t('app.installName')} />
                            <ElTableColumn prop="appName" label={$t('app.appName')} />
                            <ElTableColumn prop="version" label={$t('app.version')} />
                            <ElTableColumn prop="status" label={$t('commons.table.status')} />
                        </ElTable>
                    </ElCol>
                </ElRow>
            </DialogPro>
        );
    },
    options,
);
