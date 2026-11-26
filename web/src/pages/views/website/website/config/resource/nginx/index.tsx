import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import { File } from '@/types/file';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import CodemirrorPro from '@/components/codemirror-pro/index';
import permissionDirective from '@/directives/modules/permission';

interface CodemodProps {
    [key: string]: any;
    id?: number;
}

const emits = {};

const options = {
    name: 'nginx',
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
        const id = computed(() => {
            return __panelSetupProps.id;
        });
        let data = ref<File.File>();
        let loading = ref(false);
        let content = ref('');
        const get = () => {
            loading.value = true;
            rpc.website
                .getNginxFile({ id: id.value, type: 'openresty' })
                .then((res) => {
                    data.value = res as any;
                    content.value = res.content;
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        const submit = () => {
            loading.value = true;
            rpc.website
                .updateNginxFile({
                    id: id.value,
                    content: content.value,
                })
                .then(() => {
                    MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        onMounted(() => {
            get();
        });
        return () =>
            withDirectives(
                <div>
                    <CodemirrorPro
                        modelValue={unref(content)}
                        onUpdate:modelValue={($v) => {
                            content.value = $v as any;
                        }}
                        mode="nginx"
                        heightDiff={400}
                    />
                    {withDirectives(
                        <ElButton
                            type="primary"
                            onClick={($event?: any) => {
                                submit();
                            }}
                            class={'mt-2.5'}
                        >
                            {$t('nginx.saveAndReload')}
                        </ElButton>,
                        [[permissionDirective, true]],
                    )}
                </div>,
                [[vLoading, unref(loading)]],
            );
    },
    options,
);
