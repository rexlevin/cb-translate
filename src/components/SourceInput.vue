<template>
    <div class="source-panel">
        <div class="panel-header">
            <span class="panel-title">原文</span>
            <div class="header-actions">
                <el-button size="small" :icon="Delete" text @click="clear" :disabled="!modelValue">
                    清空
                </el-button>
            </div>
        </div>

        <el-input
            ref="textareaRef"
            v-model="innerText"
            type="textarea"
            class="source-input"
            :rows="7"
            resize="none"
            maxlength="6000"
            :placeholder="from === 'auto'
                ? '输入文本，自动检测语言…（Ctrl+Enter 翻译）'
                : '输入文本…（Ctrl+Enter 翻译）'"
            @keydown.enter.ctrl.prevent="emit('translate')"
            @input="syncText"
        />

        <div class="panel-footer">
            <span class="char-count">{{ innerText.length }} / 6000</span>
            <div class="footer-actions">
                <el-button :icon="RefreshLeft" @click="clear" :disabled="!modelValue">清空</el-button>
                <el-button
                    type="primary"
                    :icon="Promotion"
                    :loading="loading"
                    :disabled="!innerText.trim()"
                    @click="emit('translate')"
                >
                    翻译
                </el-button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { Delete, RefreshLeft, Promotion } from '@element-plus/icons-vue'

const props = defineProps({
    modelValue: { type: String, default: '' },
    from: { type: String, default: 'auto' },
    loading: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'translate'])

const textareaRef = ref(null)
const innerText = ref(props.modelValue)

watch(() => props.modelValue, (v) => {
    if (v !== innerText.value) {
        innerText.value = v
    }
})

function syncText() {
    emit('update:modelValue', innerText.value)
}

function clear() {
    innerText.value = ''
    emit('update:modelValue', '')
}

function focusInput() {
    textareaRef.value?.focus()
}

defineExpose({ focusInput })
</script>

<style scoped>
.source-panel {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    background: var(--app-panel);
    border: 1px solid var(--app-border);
    border-radius: 10px;
    padding: 12px 14px;
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

.header-actions .el-button {
    height: 24px;
}

.source-input {
    flex: 1;
    height: 0;
}

.source-input :deep(.el-textarea) {
    height: 100%;
}

.source-input :deep(.el-textarea__inner) {
    height: 100% !important;
    border: none;
    box-shadow: none;
    padding: 4px 2px;
    font-size: var(--app-font-text);
    line-height: 1.7;
    resize: none;
    background: transparent;
}

.panel-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px dashed var(--app-border);
}

.char-count {
    font-size: calc(var(--app-font-ui) - 2px);
    color: var(--app-text-secondary);
}
</style>
