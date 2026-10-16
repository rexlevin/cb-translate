<template>
    <el-dialog
        :model-value="open"
        title="设置"
        :width="dialogWidth"
        :append-to-body="true"
        @update:model-value="(v) => emit('update:open', v)"
    >
        <div class="settings-body">
            <!-- 百度翻译配置 -->
            <el-divider content-position="left">百度翻译</el-divider>
            <el-alert
                type="info"
                :closable="false"
                show-icon
                title="需要到百度翻译开放平台注册应用，获取 APP ID 与密钥（免费标准版有额度限制）。"
                class="settings-tip"
            />

            <el-form :label-width="labelWidthSm" class="settings-form">
                <el-form-item label="状态">
                    <div class="status-block">
                        <div class="status-line">
                            <el-tag :type="statusTagType" size="small">
                                {{ statusText }}
                            </el-tag>
                            <span v-if="isConfigured && baiduStatus.appid" class="appid-mask">
                                APP ID: {{ baiduStatus.appid }}
                            </span>
                            <el-link
                                v-if="isConfigured && !editing"
                                type="primary"
                                :underline="false"
                                class="edit-link"
                                @click="startEdit"
                            >
                                修改配置
                            </el-link>
                            <el-link
                                v-if="isConfigured && editing"
                                type="info"
                                :underline="false"
                                class="edit-link"
                                @click="cancelEdit"
                            >
                                取消修改
                            </el-link>
                        </div>
                        <!-- 存储安全状态提示 -->
                        <div v-if="baiduStatus.decryptFailed" class="enc-note warn">
                            <span>本地密钥无法解密（系统环境可能已变更），请重新输入完整配置后保存。</span>
                        </div>
                        <div v-else-if="isConfigured" class="enc-note" :class="baiduStatus.encrypted ? 'ok' : 'warn'">
                            <span v-if="baiduStatus.encrypted">
                                密钥已通过系统安全存储加密，settings.json 中不保存明文。
                            </span>
                            <span v-else>
                                当前系统不支持安全存储，密钥将以明文保存在本地，请注意防范。
                            </span>
                        </div>
                    </div>
                </el-form-item>

                <!-- 输入区：未配置时始终显示；已配置时仅修改模式显示 -->
                <template v-if="!isConfigured || editing">
                    <el-form-item v-if="isConfigured" label="APP ID">
                        <el-input
                            v-model="form.appid"
                            placeholder="留空表示保持原 APP ID"
                            autocomplete="off"
                        />
                    </el-form-item>
                    <el-form-item v-else label="APP ID">
                        <el-input v-model="form.appid" placeholder="百度翻译 APP ID" autocomplete="off" />
                    </el-form-item>

                    <el-form-item label="密钥">
                        <el-input
                            v-model="form.secret"
                            :placeholder="isConfigured ? '留空表示保持原密钥' : '百度翻译密钥'"
                            type="password"
                            show-password
                            autocomplete="off"
                        />
                    </el-form-item>
                </template>

                <el-form-item label="申请地址">
                    <el-link type="primary" :underline="false" @click="openRegister">
                        百度翻译开放平台 →
                    </el-link>
                </el-form-item>
            </el-form>

            <!-- 偏好 -->
            <el-divider content-position="left">翻译偏好</el-divider>
            <el-form :label-width="labelWidthSm" class="settings-form">
                <el-form-item label="默认目标语">
                    <el-select v-model="form.defaultTo" style="width: 100%">
                        <el-option v-for="l in TARGET_LANGS" :key="l.code" :label="l.name" :value="l.code" />
                    </el-select>
                </el-form-item>

                <el-form-item label="历史上限">
                    <el-input-number
                        v-model="form.historyMax"
                        :min="10"
                        :max="1000"
                        :step="10"
                        style="width: 100%"
                    />
                </el-form-item>
            </el-form>

            <!-- 外观 -->
            <el-divider content-position="left">外观</el-divider>
            <el-form :label-width="labelWidthLg" class="settings-form">
                <el-form-item label="界面字号">
                    <div class="size-row">
                        <el-input-number
                            :model-value="form.uiFontSize"
                            :min="12"
                            :max="20"
                            :step="1"
                            controls-position="right"
                            @change="(v) => onFontChange('uiFontSize', v)"
                        />
                        <span class="unit">px</span>
                    </div>
                </el-form-item>

                <el-form-item label="原文/译文框字号">
                    <div class="size-row">
                        <el-input-number
                            :model-value="form.textFontSize"
                            :min="12"
                            :max="32"
                            :step="1"
                            controls-position="right"
                            @change="(v) => onFontChange('textFontSize', v)"
                        />
                        <span class="unit">px</span>
                    </div>
                </el-form-item>
            </el-form>

            <!-- 快捷键 -->
            <el-divider content-position="left">快捷键</el-divider>
            <ul class="shortcut-list">
                <li v-for="s in SHORTCUTS" :key="s.desc">
                    <span class="keys">
                        <kbd v-for="(k, i) in s.keys" :key="k + i">{{ k }}</kbd>
                    </span>
                    <span class="desc">{{ s.desc }}</span>
                </li>
            </ul>
        </div>

        <template #footer>
            <el-button @click="emit('update:open', false)">取消</el-button>
            <el-button type="primary" :loading="saving" @click="save">
                {{ editing ? '确认修改' : '保存' }}
            </el-button>
        </template>
    </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { TARGET_LANGS } from '../lib/langs'

const props = defineProps({
    open: { type: Boolean, default: false },
    baiduStatus: { type: Object, default: () => ({ configured: false, appid: '', encrypted: true, decryptFailed: false }) },
    prefs: { type: Object, default: () => ({ defaultTo: 'zh', historyMax: 200, uiFontSize: 14, textFontSize: 16 }) }
})
const emit = defineEmits(['update:open', 'save', 'font-change'])

// 已实现的快捷键清单（与 App.vue 中的实际监听保持同步）
const SHORTCUTS = [
    { keys: ['Ctrl', ','], desc: '打开设置' },
    { keys: ['Esc'], desc: '关闭设置' },
    { keys: ['Ctrl', '滚轮'], desc: '缩放界面' },
    { keys: ['Ctrl', '='], desc: '放大界面' },
    { keys: ['Ctrl', '-'], desc: '缩小界面' },
    { keys: ['Ctrl', '0'], desc: '界面缩放重置为 100%' },
    { keys: ['Ctrl', '1'], desc: '聚焦原文输入框' },
    { keys: ['Ctrl', 'Enter'], desc: '翻译' }
]

const form = ref({
    appid: '',
    secret: '',
    defaultTo: 'zh',
    historyMax: 200,
    uiFontSize: 14,
    textFontSize: 16
})

const saving = ref(false)
// editing：仅对"已配置"状态有意义——控制是否展开修改输入区
const editing = ref(false)

const isConfigured = computed(() => Boolean(props.baiduStatus.configured && !props.baiduStatus.decryptFailed))

const statusText = computed(() => {
    if (props.baiduStatus.decryptFailed) return '解密失败'
    return isConfigured.value ? '已配置' : '未配置'
})

const statusTagType = computed(() => {
    if (props.baiduStatus.decryptFailed) return 'danger'
    return isConfigured.value ? 'success' : 'warning'
})

// 弹层随"界面字号"等比放大：宽度与 label 宽度同步缩放，避免大字号下排版错乱
// （基准 14px 时：弹层 460px、label 90/120px，并以视口宽度 92vw 兜底）
const fontRatio = computed(() => (Number(form.value.uiFontSize) || 14) / 14)
const dialogWidth = computed(() => `min(${Math.round(460 * fontRatio.value)}px, 92vw)`)
const labelWidthSm = computed(() => `${Math.round(90 * fontRatio.value)}px`)
const labelWidthLg = computed(() => `${Math.round(120 * fontRatio.value)}px`)

// 当前完整偏好（saveSettings 为整对象覆盖，必须提交全部字段）
function currentPrefs() {
    return {
        defaultTo: form.value.defaultTo,
        historyMax: form.value.historyMax,
        uiFontSize: form.value.uiFontSize,
        textFontSize: form.value.textFontSize
    }
}

// 字号即时保存：以"已保存偏好"为基准只覆盖字号，避免顺带提交尚未保存的其他字段
function prefsWithFonts() {
    return {
        ...props.prefs,
        uiFontSize: form.value.uiFontSize,
        textFontSize: form.value.textFontSize
    }
}

// 字号调整：变更即保存并生效，无需点"保存"，也不受百度凭据状态影响
async function onFontChange(key, val) {
    if (val === undefined || val === null || val === '') return
    form.value[key] = Number(val)
    try {
        const res = await window.translate.saveSettings(prefsWithFonts())
        if (res && res.success) {
            emit('font-change', res.prefs)
        } else {
            ElMessage.error((res && res.msg) || '保存字号失败')
        }
    } catch (e) {
        ElMessage.error('保存字号失败: ' + (e.message || e))
    }
}

watch(() => props.open, (val) => {
    if (val) {
        editing.value = false
        form.value = {
            appid: '',
            secret: '',
            defaultTo: props.prefs.defaultTo || 'zh',
            historyMax: props.prefs.historyMax || 200,
            uiFontSize: props.prefs.uiFontSize || 14,
            textFontSize: props.prefs.textFontSize || 16
        }
    }
})

function startEdit() {
    editing.value = true
}

function cancelEdit() {
    editing.value = false
    // 丢弃未保存的输入
    form.value.appid = ''
    form.value.secret = ''
}

function openRegister() {
    window.translate.openExternal('https://fanyi-api.baidu.com/')
}

async function save() {
    saving.value = true
    try {
        // 凭据仅在"用户实际填写了 APP ID 或密钥"时才校验并保存；
        // 未填写时只保存偏好（字号/默认目标语/历史上限），不因缺少凭据而拦截保存
        const baiduPayload = {}
        const enteredAppid = form.value.appid.trim()
        const enteredSecret = form.value.secret.trim()

        if (props.baiduStatus.decryptFailed) {
            // 解密失败：旧值不可用，填写则必须两者齐全
            if (enteredAppid || enteredSecret) {
                if (!enteredAppid || !enteredSecret) {
                    ElMessage.error('密钥无法解密，请完整输入新的 APP ID 与密钥')
                    return
                }
                baiduPayload.appid = enteredAppid
                baiduPayload.secret = enteredSecret
            }
        } else if (enteredAppid || enteredSecret) {
            if (isConfigured.value) {
                // 已配置：留空表示保持不变，支持部分更新
                if (enteredAppid) baiduPayload.appid = enteredAppid
                if (enteredSecret) baiduPayload.secret = enteredSecret
            } else {
                // 首次配置：必须两者齐全
                if (!enteredAppid || !enteredSecret) {
                    ElMessage.error('请完整输入 APP ID 与密钥')
                    return
                }
                baiduPayload.appid = enteredAppid
                baiduPayload.secret = enteredSecret
            }
        }

        if (Object.keys(baiduPayload).length > 0) {
            const baiduRes = await window.translate.saveBaidu(baiduPayload)
            if (!baiduRes.success) {
                ElMessage.error(baiduRes.msg || '保存百度密钥失败')
                return
            }
        }

        const prefsRes = await window.translate.saveSettings(currentPrefs())
        if (!prefsRes.success) {
            ElMessage.error(prefsRes.msg || '保存偏好失败')
            return
        }

        emit('save', prefsRes.prefs)
        ElMessage.success('设置已保存')
        editing.value = false
        emit('update:open', false)
    } finally {
        saving.value = false
    }
}
</script>

<style scoped>
.settings-body {
    max-height: 60vh;
    overflow-y: auto;
}

.settings-tip {
    margin-bottom: 6px;
}

.settings-form {
    margin-top: 12px;
}

.status-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
}

.status-line {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
}

.edit-link {
    margin-left: auto;
}

.appid-mask {
    font-size: calc(var(--app-font-ui) - 2px);
    color: var(--app-text-secondary);
}

.enc-note {
    font-size: calc(var(--app-font-ui) - 2px);
    line-height: 1.5;
    border-radius: 6px;
    padding: 4px 8px;
}

.enc-note.ok {
    color: #67a06b;
    background: rgba(103, 194, 107, 0.1);
}

.enc-note.warn {
    color: #c46b2b;
    background: rgba(230, 162, 60, 0.12);
}

.size-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
}

.size-row .unit {
    font-size: calc(var(--app-font-ui) - 2px);
    color: var(--app-text-secondary);
}

.shortcut-list {
    list-style: none;
    margin: 0;
    padding: 0 2px;
}

.shortcut-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 6px 12px;
    padding: 6px 0;
    font-size: calc(var(--app-font-ui) - 1px);
    color: var(--app-text);
    border-bottom: 1px dashed var(--app-border);
}

.shortcut-list li:last-child {
    border-bottom: none;
}

.shortcut-list .keys {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex: none;
}

.shortcut-list kbd {
    display: inline-block;
    min-width: 20px;
    padding: 1px 6px;
    font-family: inherit;
    font-size: calc(var(--app-font-ui) - 2px);
    text-align: center;
    color: var(--app-text-secondary);
    background: var(--app-hover);
    border: 1px solid var(--app-border);
    border-bottom-width: 2px;
    border-radius: 4px;
}

.shortcut-list .desc {
    color: var(--app-text-secondary);
    text-align: right;
    word-break: break-word;
}

/* 弹层标题随"界面字号"缩放，保持整体一致 */
:deep(.el-dialog__title) {
    font-size: calc(var(--app-font-ui) + 3px);
}
</style>
