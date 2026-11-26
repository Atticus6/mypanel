import { createApp } from 'vue';
import { PiniaColada } from '@pinia/colada';
import App from './App';

import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import * as Icons from '@element-plus/icons-vue';

import '@/styles/index.scss';
import '@/styles/common.scss';
import '@/assets/iconfont/iconfont.css';
import '@/assets/iconfont/iconfont.js';
import '@/styles/style.css';
import { loadXpackStyles } from '@/extensions/theme';

loadXpackStyles();

import router from '@/routers/index';
import i18n, { ensureFallbackLocale, loadLocaleMessages } from '@/lang/index';
import pinia from '@/store/index';
import SvgIcon from './components/svg-icon/svg-icon';
import Components from '@/components';

import directives from '@/directives/index';

const bootstrap = async () => {
    const currentLocale = i18n.global.locale.value;

    await Promise.all([loadLocaleMessages(currentLocale), ensureFallbackLocale()]);

    const app = createApp(App);
    app.component('SvgIcon', SvgIcon);
    app.use(ElementPlus);

    Object.keys(Icons).forEach((key) => {
        app.component(key, Icons[key as keyof typeof Icons]);
    });

    app.use(pinia);
    app.use(PiniaColada, {
        // 查询默认 30 秒内视为新鲜，避免切页面时重复请求同一份数据。
        queryOptions: { staleTime: 30_000 },
    });
    app.use(router);
    app.use(i18n);
    app.use(Components);
    app.use(directives);

    app.mount('#app');
};

bootstrap();
