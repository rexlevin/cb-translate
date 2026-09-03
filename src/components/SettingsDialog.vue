<template>
    <el-dialog
        :model-value="open"
        title="设置"
        width="460px"
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

            <el-form label-width="90px" class="settings-form">
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
            <el-form label-width="90px" class="settings-form">
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
    prefs: { type: Object, default: () => ({ defaultTo: 'zh', historyMax: 200 }) }
})
const emit = defineEmits(['update:open', 'save'])

const form = ref({
    appid: '',
    secret: '',
    defaultTo: 'zh',
    historyMax: 200
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

watch(() => props.open, (val) => {
    if (val) {
        editing.value = false
        form.value = {
            appid: '',
            secret: '',
            defaultTo: props.prefs.defaultTo || 'zh',
            historyMax: props.prefs.historyMax || 200
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
        const payload = {
            appid: form.value.appid.trim(),
            secret: form.value.secret.trim(),
            defaultTo: form.value.defaultTo,
            historyMax: form.value.historyMax
        }

        // 需要写凭据的场景：未配置首次配置 / 已配置进入修改模式
        const needCreds = !isConfigured.value || editing.value
        const baiduPayload = {}

        if (needCreds) {
            // 解密失败：后端无可合并的旧值，必须两者都填
            if (props.baiduStatus.decryptFailed) {
                if (!payload.appid || !payload.secret) {
                    ElMessage.error('密钥无法解密，请完整输入新的 APP ID 与密钥')
                    return
                }
                baiduPayload.appid = payload.appid
                baiduPayload.secret = payload.secret
            } else {
                // 部分更新：留空表示保持不变
                if (payload.appid) baiduPayload.appid = payload.appid
                if (payload.secret) baiduPayload.secret = payload.secret
                if (!isConfigured.value && (!baiduPayload.appid || !baiduPayload.secret)) {
                    ElMessage.error('请完整输入 APP ID 与密钥')
                    return
                }
            }
        }

        if (Object.keys(baiduPayload).length > 0) {
            const baiduRes = await window.translate.saveBaidu(baiduPayload)
            if (!baiduRes.success) {
                ElMessage.error(baiduRes.msg || '保存百度密钥失败')
                return
            }
        }

        const prefsRes = await window.translate.saveSettings({
            defaultTo: payload.defaultTo,
            historyMax: payload.historyMax
        })
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
    gap: 10px;
}

.edit-link {
    margin-left: auto;
}

.appid-mask {
    font-size: 12px;
    color: var(--app-text-secondary);
}

.enc-note {
    font-size: 12px;
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
</style>
