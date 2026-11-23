<template>
    <div>
        <div v-if="showButton">
            <RouterButton :buttons="buttons"></RouterButton>
        </div>
        <LayoutContent>
            <RouterViewCache />
        </LayoutContent>
    </div>
</template>

<script lang="ts" setup>
import i18n from '@/lang';
import { onMounted, ref } from 'vue';
import { rpc } from '@/lib/rpc';
import bus from '@/global/bus';
let showButton = ref(false);

let buttons = [
    {
        label: i18n.global.t('app.all'),
        path: '/apps/all',
    },
    {
        label: i18n.global.t('app.installed'),
        path: '/apps/installed',
    },
    {
        label: i18n.global.t('app.canUpgrade'),
        path: '/apps/upgrade',
        count: 0,
    },
    {
        label: i18n.global.t('commons.button.set'),
        path: '/apps/setting',
    },
];

const search = () => {
    rpc.app
        .searchInstalled({ update: true, page: 1, pageSize: 100 })
        .then((res) => {
            buttons[2].count = res.items.length;
        })
        .finally(() => {
            showButton.value = true;
        });
};

onMounted(() => {
    search();
    bus.on('upgrade', () => {
        showButton.value = false;
        search();
    });
});
</script>
