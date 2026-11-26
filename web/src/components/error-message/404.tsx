import { $t } from '@/utils/i18n-t';

import './404.styles.css';
import notFoundImg from '@/assets/images/404.svg';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: '404',
    props: {},
    emits: emits,
    __scopeId: 'data-v-6d0b395d',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => (
            <div class={'not-container'}>
                <img src={notFoundImg} alt="404" class={'not-img'} />
                <div class={'not-detail'}>
                    <h2>{'404'}</h2>
                    <h4>{$t('commons.msg.notFound')}</h4>
                </div>
            </div>
        );
    },
    options,
);
