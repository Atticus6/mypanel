<script setup lang="ts">
import { useI18n } from 'vue-i18n';

definePage({ name: '500' });

const { t } = useI18n();
</script>

<template>
    <div class="not-container">
        <div class="not-detail">
            <h2>500</h2>
            <h4>{{ t('commons.res.serverError') }}</h4>
        </div>
    </div>
</template>

<style scoped lang="scss">
.not-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    .not-detail {
        display: flex;
        flex-direction: column;
        h2,
        h4 {
            padding: 0;
            margin: 0;
        }
        h2 {
            font-size: 60px;
            color: #434e59;
        }
        h4 {
            margin: 30px 0 20px;
            font-size: 19px;
            font-weight: normal;
            color: #848587;
        }
    }
}
</style>
