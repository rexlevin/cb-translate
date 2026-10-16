<template>
    <div class="result-panel" :class="{ empty: !hasContent }">
        <div class="panel-header">
            <span class="panel-title">译文</span>
            <div class="header-actions" v-if="hasContent && !error">
                <span v-if="detected" class="detected-tag">
                    识别为{{ langName(detected) }}
                </span>
                <el-button size="small" :icon="CopyDocument" text @click="copyResult">
                    复制
                </el-button>
            </div>
        </div>

        <!-- 加载中 -->
        <div v-if="loading" class="result-state">
            <el-icon class="is-loading spin-icon"><Loading /></el-icon>
            <span>正在翻译…</span>
        </div>

        <!-- 错误 -->
        <div v-else-if="error" class="error-state">
            <el-icon><WarningFilled /></el-icon>
            <span>{{ error }}</span>
        </div>

        <!-- 空 -->
        <div v-else-if="!hasContent" class="result-state placeholder">
            <el-icon class="placeholder-icon"><ChatLineSquare /></el-icon>
            <span>译文将显示在这里</span>
        </div>

        <!-- 译文 -->
        <div v-else class="result-content">
            <p v-for="(item, idx) in resultItems" :key="idx" class="result-item">{{ item.dst }}</p>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { CopyDocument, ChatLineSquare, Loading, WarningFilled } from '@element-plus/icons-vue'
import { langName } from '../lib/langs'

const props = defineProps({
    loading: { type: Boolean, default: false },
    error: { type: String, default: '' },
    resultItems: { type: Array, default: () => [] },
    detected: { type: String, default: '' }
})

const hasContent = computed(() => props.resultItems && props.resultItems.length > 0)

async function copyResult() {
    const text = props.resultItems.map(i => i.dst).join('\n')
    try {
        await navigator.clipboard.writeText(text)
        ElMessage.success('已复制到剪贴板')
    } catch (e) {
        ElMessage.error('复制失败: ' + (e.message || e))
    }
}
</script>

<style scoped>
.result-panel {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 200px;
    background: var(--app-panel);
    border: 1px solid var(--app-border);
    border-radius: 10px;
    padding: 12px 14px;
}

.result-panel.empty {
    background: rgba(255, 255, 255, 0.6);
    border-style: dashed;
}

.panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
}

.panel-title {
    font-size: calc(var(--app-font-ui) - 1px);
    font-weight: 600;
    color: var(--app-text-secondary);
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
}

.detected-tag {
    font-size: calc(var(--app-font-ui) - 2px);
    color: var(--app-success);
}

.result-state,
.error-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--app-text-secondary);
    font-size: calc(var(--app-font-ui) - 1px);
}

.error-state {
    color: #e5484d;
}

.spin-icon {
    font-size: 26px;
    color: var(--app-primary);
}

.placeholder-icon {
    font-size: 30px;
    color: #c3c9d6;
}

.result-content {
    flex: 1;
    overflow-y: auto;
    padding: 4px 2px;
}

.result-item {
    margin: 0 0 8px;
    font-size: var(--app-font-text);
    line-height: 1.8;
    word-break: break-word;
    user-select: text;
}
</style>
