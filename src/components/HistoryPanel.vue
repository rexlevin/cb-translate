<template>
    <el-drawer
        :model-value="open"
        title="历史记录"
        direction="rtl"
        size="360px"
        :with-header="true"
        :append-to-body="false"
        @update:model-value="(v) => emit('update:open', v)"
    >
        <div class="history-panel">
            <div class="history-toolbar">
                <span class="count-tip">{{ list.length }} 条记录</span>
                <el-button size="small" type="danger" plain :icon="Delete"
                    :disabled="list.length === 0" @click="confirmClear">
                    清空
                </el-button>
            </div>

            <div v-if="list.length === 0" class="history-empty">
                <el-icon><Clock /></el-icon>
                <span>暂无历史记录</span>
            </div>

            <div v-else class="history-list">
                <div
                    v-for="item in list"
                    :key="item._id"
                    class="history-item"
                    @click="emit('select', item)"
                >
                    <div class="history-main">
                        <div class="history-text">{{ item.q }}</div>
                        <div class="history-text dst">{{ item.dst }}</div>
                    </div>
                    <div class="history-meta">
                        <span>{{ langName(item.from) }} → {{ langName(item.to) }}</span>
                        <el-button size="small" text :icon="Delete"
                            title="删除这条记录" @click.stop="emit('delete', item)">
                        </el-button>
                    </div>
                </div>
            </div>
        </div>
    </el-drawer>
</template>

<script setup>
import { ElMessageBox } from 'element-plus'
import { Delete, Clock } from '@element-plus/icons-vue'
import { langName } from '../lib/langs'

const props = defineProps({
    open: { type: Boolean, default: false },
    list: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:open', 'select', 'delete', 'clear'])

function confirmClear() {
    ElMessageBox.confirm('确定要清空全部历史记录吗？此操作不可恢复。', '清空历史', {
        confirmButtonText: '清空',
        cancelButtonText: '取消',
        type: 'warning'
    }).then(() => {
        emit('clear')
    }).catch(() => {})
}
</script>

<style scoped>
.history-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
}

.history-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
}

.count-tip {
    font-size: 12px;
    color: var(--app-text-secondary);
}

.history-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--app-text-secondary);
    font-size: 13px;
}

.history-empty .el-icon {
    font-size: 30px;
    color: #c3c9d6;
}

.history-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.history-item {
    background: var(--app-bg);
    border: 1px solid var(--app-border);
    border-radius: 8px;
    padding: 10px 12px;
    cursor: pointer;
    transition: border-color 0.15s;
}

.history-item:hover {
    border-color: var(--app-primary);
}

.history-main {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.history-text {
    font-size: 13px;
    color: var(--app-text);
    word-break: break-word;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    user-select: text;
}

.history-text.dst {
    color: var(--app-text-secondary);
    padding-left: 10px;
    border-left: 2px solid var(--app-primary-light);
}

.history-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 6px;
    font-size: 12px;
    color: var(--app-text-secondary);
}
</style>
