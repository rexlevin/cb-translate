<template>
    <div class="lang-bar">
        <el-select
            :model-value="from"
            size="default"
            class="lang-select"
            @update:model-value="(v) => emit('update:from', v)"
        >
            <el-option v-for="l in LANGS" :key="l.code" :label="l.name" :value="l.code" />
        </el-select>

        <el-button
            class="swap-btn"
            :icon="Sort"
            circle
            :disabled="from === 'auto'"
            :title="from === 'auto' ? '自动检测方向不可交换' : '交换语言方向'"
            @click="emit('swap')"
        />

        <el-select
            :model-value="to"
            size="default"
            class="lang-select"
            @update:model-value="(v) => emit('update:to', v)"
        >
            <el-option v-for="l in TARGET_LANGS" :key="l.code" :label="l.name" :value="l.code" />
        </el-select>

        <span class="engine-tag">百度翻译</span>
    </div>
</template>

<script setup>
import { Sort } from '@element-plus/icons-vue'
import { LANGS, TARGET_LANGS } from '../lib/langs'

const props = defineProps({
    from: { type: String, default: 'auto' },
    to: { type: String, default: 'zh' }
})
const emit = defineEmits(['update:from', 'update:to', 'swap'])
</script>

<style scoped>
.lang-bar {
    display: flex;
    align-items: center;
    gap: 8px;
}

.lang-select {
    width: 150px;
}

.swap-btn {
    flex: none;
}

.engine-tag {
    margin-left: auto;
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 12px;
    color: var(--app-primary-dark);
    background: rgba(91, 110, 245, 0.1);
    border: 1px solid rgba(91, 110, 245, 0.25);
    white-space: nowrap;
}
</style>
