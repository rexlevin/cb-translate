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
                    <div class="status-line">
                        <el-tag :type="baiduStatus.configured ? 'success' : 'warning'" size="small">
                            {{ baiduStatus.configured ? '已配置' : '未配置' }}
                        </el-tag>
                        <span v-if="baiduStatus.configured && baiduStatus.appid" class="appid-mask">
                            APP ID: {{ baiduStatus.appid }}
                        </span>
                    </div>
                </el-form-item>

                <el-form-item label="APP ID">
                    <el-input v-model="form.appid" placeholder="百度翻译 APP ID" autocomplete="off" />
                </el-form-item>

                <el-form-item label="密钥">
                    <el-input
                        v-model="form.secret"
                        placeholder="百度翻译密钥（已配置时留空则保持不变）"
                        type="password"
                        show-password
                        autocomplete="off"
                    />
                </el-form-item>

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
            <el-button type="primary" :loading="saving" @click="save">保存</el-button>
        </template>
    </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { TARGET_LANGS } from '../lib/langs'

const props = defineProps({
    open: { type: Boolean, default: false },
    baiduStatus: { type: Object, default: () => ({ configured: false, appid: '' }) },
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

watch(() => props.open, (val) => {
    if (val) {
        form.value = {
            appid: '',
            secret: '',
            defaultTo: props.prefs.defaultTo || 'zh',
            historyMax: props.prefs.historyMax || 200
        }
    }
})

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

        // 只提交非空字段（密钥留空表示不修改）
        const baiduPayload = {}
        if (payload.appid) baiduPayload.appid = payload.appid
        if (payload.secret) baiduPayload.secret = payload.secret

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

.status-line {
    display: flex;
    align-items: center;
    gap: 10px;
}

.appid-mask {
    font-size: 12px;
    color: var(--app-text-secondary);
}
</style>
