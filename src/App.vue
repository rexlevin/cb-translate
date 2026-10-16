<template>
    <div id="app" class="app-layout">
        <!-- 顶部工具栏 -->
        <header class="app-header">
            <div class="brand">
                <span class="brand-dot" />
                <span class="brand-name">灵译</span>
            </div>

            <div class="header-actions">
                <el-button
                    :icon="Clock"
                    :type="historyOpen ? 'primary' : 'default'"
                    plain
                    size="small"
                    @click="toggleHistory"
                >
                    历史
                </el-button>
                <el-button :icon="Setting" size="small" @click="settingsOpen = true">
                    设置
                </el-button>
            </div>
        </header>

        <!-- 主体 -->
        <main class="app-main">
            <div class="translate-col">
                <!-- 语言选择栏 -->
                <div class="lang-row">
                    <LangBar
                        :from="from"
                        :to="to"
                        @update:from="onChangeFrom"
                        @update:to="onChangeTo"
                        @swap="onSwap"
                    />
                </div>

                <!-- 原文输入 -->
                <SourceInput
                    ref="sourceInputRef"
                    v-model="sourceText"
                    :from="from"
                    :loading="translating"
                    @translate="handleTranslate"
                />

                <!-- 译文结果 -->
                <ResultPanel
                    :loading="translating"
                    :error="errorMsg"
                    :result-items="resultItems"
                    :detected="detectedLang"
                />
            </div>
        </main>

        <!-- 历史记录抽屉 -->
        <HistoryPanel
            v-model:open="historyOpen"
            :list="historyList"
            @select="onHistorySelect"
            @delete="onHistoryDelete"
            @clear="onHistoryClear"
        />

        <!-- 设置对话框 -->
        <SettingsDialog
            v-model:open="settingsOpen"
            :baidu-status="baiduStatus"
            :prefs="prefs"
            @save="onSettingsSaved"
            @font-change="onFontChanged"
        />
    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Clock, Setting } from '@element-plus/icons-vue'
import LangBar from './components/LangBar.vue'
import SourceInput from './components/SourceInput.vue'
import ResultPanel from './components/ResultPanel.vue'
import HistoryPanel from './components/HistoryPanel.vue'
import SettingsDialog from './components/SettingsDialog.vue'

// ---------------------------------------------------------------
// 状态
// ---------------------------------------------------------------
const sourceText = ref('')
const from = ref('auto')
const to = ref('zh')
const translating = ref(false)
const errorMsg = ref('')
const resultItems = ref([])
const detectedLang = ref('')

const historyOpen = ref(false)
const settingsOpen = ref(false)
const historyList = ref([])

const prefs = ref({ defaultTo: 'zh', historyMax: 200, uiFontSize: 14, textFontSize: 16 })
const baiduStatus = ref({ configured: false, appid: '' })

const sourceInputRef = ref(null)

// 字号范围（与设置界面一致）
const MIN_FONT = 12
const MAX_UI_FONT = 20
const MAX_TEXT_FONT = 32

// 缩放
const zoomLevel = ref(1)
const MIN_ZOOM = 0.8
const MAX_ZOOM = 1.5
const ZOOM_STEP = 0.1

// ---------------------------------------------------------------
// 生命周期
// ---------------------------------------------------------------
onMounted(async () => {
    // 读取偏好与百度状态
    try {
        const settings = await window.translate.getSettings()
        if (settings && settings.prefs) {
            prefs.value = settings.prefs
            if (prefs.value.defaultTo) to.value = prefs.value.defaultTo
            applyFontSizes(prefs.value)
        }
        if (settings && settings.baidu) {
            baiduStatus.value = settings.baidu
        }
    } catch (e) {
        console.error('[灵译] 读取设置失败:', e)
    }

    // 恢复缩放
    try {
        const saved = await window.translate.getZoomLevel()
        if (saved && saved !== null && saved !== undefined) {
            zoomLevel.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, saved))
            window.translate.setZoom(zoomLevel.value)
        }
    } catch (e) { /* ignore */ }

    // Ctrl+1 聚焦输入框
    document.addEventListener('keydown', handleGlobalKeydown)
    document.addEventListener('wheel', handleWheel, { passive: false })

    // 启动即聚焦原文输入框，便于直接输入
    focusSourceInput()
})

// 聚焦原文输入框（等待 DOM 就绪后执行一次）
function focusSourceInput() {
    nextTick(() => {
        sourceInputRef.value?.focusInput()
        // 部分环境下窗口获得焦点晚于挂载，补一次聚焦
        setTimeout(() => sourceInputRef.value?.focusInput(), 120)
    })
}

onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleGlobalKeydown)
    document.removeEventListener('wheel', handleWheel)
})

// ---------------------------------------------------------------
// 语言方向
// ---------------------------------------------------------------
function onChangeFrom(val) {
    if (val === to.value && val !== 'auto') {
        // 源语言与目标语言相同：把目标语言调成默认相反方向
        to.value = (val === 'zh') ? 'en' : 'zh'
    }
    from.value = val
}

function onChangeTo(val) {
    to.value = val
}

function onSwap() {
    if (from.value === 'auto') {
        ElMessage.info('自动检测方向不可交换')
        return
    }
    const oldFrom = from.value
    from.value = to.value
    to.value = oldFrom
}

// ---------------------------------------------------------------
// 翻译
// ---------------------------------------------------------------
async function handleTranslate() {
    const text = sourceText.value.trim()
    if (!text) {
        ElMessage.warning('请输入要翻译的文本')
        return
    }

    if (!baiduStatus.value.configured) {
        ElMessage.warning('请先在设置中配置百度翻译 APP ID 与密钥')
        settingsOpen.value = true
        return
    }

    translating.value = true
    errorMsg.value = ''
    detectedLang.value = ''
    resultItems.value = []

    try {
        const res = await window.translate.doTranslate({ q: text, from: from.value, to: to.value })
        if (res && res.success) {
            const items = (res.data && res.data.result) || []
            resultItems.value = items
            // 自动检测时，展示实际检测到的语言
            if (res.data.from && from.value === 'auto') {
                detectedLang.value = res.data.from
            }

            // 写入历史（原文 = 拼接的 src，译文 = 拼接的 dst）
            const q = items.map(i => i.src).join('\n') || text
            const dst = items.map(i => i.dst).join('\n')
            window.translateDB.saveHistory({
                q,
                dst,
                from: from.value,
                to: to.value,
                engine: 'baidu'
            }).then(() => {
                refreshHistory()
            }).catch(err => {
                console.warn('[灵译] 保存历史失败:', err)
            })
        } else {
            errorMsg.value = (res && res.msg) || '翻译失败，请稍后重试'
            if (res && res.code === 'NOT_CONFIGURED') {
                settingsOpen.value = true
            }
        }
    } catch (e) {
        errorMsg.value = '翻译出错: ' + (e.message || e)
    } finally {
        translating.value = false
    }
}

// ---------------------------------------------------------------
// 历史记录
// ---------------------------------------------------------------
async function toggleHistory() {
    historyOpen.value = !historyOpen.value
    if (historyOpen.value) {
        await refreshHistory()
    }
}

async function refreshHistory() {
    try {
        const res = await window.translateDB.listHistory()
        if (res && res.success) {
            historyList.value = res.data
        }
    } catch (e) {
        console.error('[灵译] 读取历史失败:', e)
    }
}

function onHistorySelect(item) {
    sourceText.value = item.q || ''
    from.value = item.from || 'auto'
    to.value = item.to || 'zh'
    // 直接回填该条译文
    errorMsg.value = ''
    resultItems.value = [{ dst: item.dst || '' }]
    detectedLang.value = ''
    historyOpen.value = false
    sourceInputRef.value?.focusInput()
}

async function onHistoryDelete(item) {
    const res = await window.translateDB.deleteHistory(item._id, item._rev)
    if (res && res.success) {
        ElMessage.success('已删除')
        await refreshHistory()
    } else {
        ElMessage.error((res && res.msg) || '删除失败')
    }
}

async function onHistoryClear() {
    const res = await window.translateDB.clearHistory()
    if (res && res.success) {
        ElMessage.success('已清空历史记录')
        historyList.value = []
    } else {
        ElMessage.error((res && res.msg) || '清空失败')
    }
}

// ---------------------------------------------------------------
// 设置
// ---------------------------------------------------------------
// 将字号写入 CSS 变量：--app-font-ui 影响整体界面，--app-font-text 影响原文/译文框；
// 同步覆盖 --el-font-size-base 让 Element Plus 组件文字跟随界面字号
function applyFontSizes(sizes = {}) {
    const ui = Math.max(MIN_FONT, Math.min(MAX_UI_FONT, Number(sizes.uiFontSize) || 14))
    const text = Math.max(MIN_FONT, Math.min(MAX_TEXT_FONT, Number(sizes.textFontSize) || 16))
    const root = document.documentElement.style
    root.setProperty('--app-font-ui', ui + 'px')
    root.setProperty('--app-font-text', text + 'px')
    root.setProperty('--el-font-size-base', ui + 'px')
}

// 字号即时保存回执：只同步偏好并应用字号，不做其他副作用
function onFontChanged(newPrefs) {
    if (newPrefs) prefs.value = newPrefs
    applyFontSizes(prefs.value)
}

// 设置界面点击"保存"：同步偏好、字号、百度状态
async function onSettingsSaved(newPrefs) {
    if (newPrefs) prefs.value = newPrefs
    applyFontSizes(prefs.value)
    // 若保存了密钥，刷新百度状态
    try {
        const st = await window.translate.getBaiduStatus()
        if (st) baiduStatus.value = st
    } catch (e) { /* ignore */ }
    if (prefs.value.defaultTo) to.value = prefs.value.defaultTo
}

// ---------------------------------------------------------------
// 快捷键 / 缩放
// ---------------------------------------------------------------
function handleGlobalKeydown(e) {
    // Ctrl+, 打开设置（用物理按键 code 判断，避免输入法/修饰键干扰）
    if ((e.ctrlKey || e.metaKey) && e.code === 'Comma') {
        e.preventDefault()
        settingsOpen.value = true
        return
    }
    // Ctrl+1 聚焦输入
    if (e.ctrlKey && e.key === '1') {
        e.preventDefault()
        sourceInputRef.value?.focusInput()
        return
    }
    // Ctrl+Enter 翻译（textarea 内已处理，这里兜底全局）
    if (e.ctrlKey && e.key === 'Enter') {
        const tag = document.activeElement && document.activeElement.tagName
        if (tag !== 'TEXTAREA' && tag !== 'INPUT') {
            e.preventDefault()
            handleTranslate()
        }
        return
    }
}

function handleWheel(e) {
    if (e.ctrlKey) {
        e.preventDefault()
        // 以实际缩放倍率为基数步进，避免与主进程键盘缩放脱节
        const current = window.translate.getZoomFactor?.() || zoomLevel.value
        const next = e.deltaY < 0
            ? Math.min(current + ZOOM_STEP, MAX_ZOOM)
            : Math.max(current - ZOOM_STEP, MIN_ZOOM)
        zoomLevel.value = next
        window.translate.setZoom(next)
        window.translate.saveZoomLevel(next)
    }
}
</script>

<style scoped>
.app-layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background:
        radial-gradient(1200px 400px at 80% -10%, rgba(91, 110, 245, 0.08), transparent 60%),
        radial-gradient(900px 400px at -10% 110%, rgba(125, 140, 250, 0.08), transparent 60%),
        var(--app-bg);
}

.app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 52px;
    padding: 0 18px;
    flex: none;
    border-bottom: 1px solid var(--app-border);
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(8px);
    -webkit-app-region: drag;
}

.app-header .el-button {
    -webkit-app-region: no-drag;
}

.brand {
    display: flex;
    align-items: center;
    gap: 9px;
}

.brand-dot {
    width: 22px;
    height: 22px;
    border-radius: 7px;
    background: linear-gradient(135deg, var(--app-primary-light), var(--app-primary-dark));
    box-shadow: 0 2px 6px rgba(91, 110, 245, 0.35);
}

.brand-name {
    font-size: calc(var(--app-font-ui) + 2px);
    font-weight: 700;
    letter-spacing: 0.5px;
    background: linear-gradient(90deg, var(--app-primary), var(--app-primary-dark));
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.app-main {
    flex: 1;
    min-height: 0;
    padding: 14px 16px;
}

.translate-col {
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
}

.lang-row {
    flex: none;
    background: var(--app-panel);
    border: 1px solid var(--app-border);
    border-radius: 10px;
    padding: 8px 12px;
}
</style>
