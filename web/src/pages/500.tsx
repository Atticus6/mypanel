import { useI18n } from 'vue-i18n';
definePage({ name: '500' });
import './500.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: '500',
    props: {},
    emits: emits,
    __scopeId: 'data-v-6696b58f',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { t } = useI18n();
        return () => (
            <div class={'not-container'}>
                <div class={'not-detail'}>
                    <h2>{'500'}</h2>
                    <h4>{unref(t)('commons.res.serverError')}</h4>
                </div>
            </div>
        );
    },
    options,
);
