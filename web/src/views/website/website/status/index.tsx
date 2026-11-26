import { $t } from '@/utils/i18n-t';
import Status from '@/components/status/index';
import { dateFormatSimple } from '@/utils/date';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElCard } from 'element-plus';
import { ElTag } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
    primaryDomain?: string;
    status?: string;
    expireDate?: string;
}

const emits = {};

const options = {
    name: 'status',
    props: {
        primaryDomain: {
            type: String,
            default: '',
        },
        status: {
            type: String,
            default: '',
        },
        expireDate: {
            type: String,
            default: '',
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const isEver = (time: string) => {
            const expireDate = new Date(time);
            return expireDate > new Date('9999-12-30');
        };
        return () => (
            <div class={'app-status'}>
                <ElCard>
                    <div>
                        <ElTag effect="dark" type="success">
                            {__panelSetupProps.primaryDomain}
                        </ElTag>
                        <span class={'status-content'}>
                            <Status
                                status={__panelSetupProps.status}
                                class={'span-font'}
                                key={__panelSetupProps.status}
                            />
                        </span>
                        <span class={'status-content'}>
                            <ElTag type="info">
                                {$t('website.expireDate')}
                                {': '}
                                {isEver(__panelSetupProps.expireDate) ? (
                                    <span>{$t('website.neverExpire')}</span>
                                ) : (
                                    <span>{dateFormatSimple(__panelSetupProps.expireDate)}</span>
                                )}
                            </ElTag>
                        </span>
                    </div>
                </ElCard>
            </div>
        );
    },
    options,
);
