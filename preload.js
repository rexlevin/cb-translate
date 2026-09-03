/**
 * cb-translate preload
 *
 * 通过 ipcRenderer.invoke 调用 IPC 通道，再用 contextBridge 暴露给渲染进程。
 *
 * 对外暴露：
 * - window.translate
 *   - doTranslate({q, from, to})   翻译（主进程代理百度引擎）
 *   - getBaiduStatus()             是否已配置 + appid 脱敏
 *   - saveBaidu({appid, secret})   保存百度密钥
 *   - getSettings()                偏好 + 百度状态
 *   - saveSettings(prefs)          保存偏好
 *   - getZoomLevel() / saveZoomLevel(level)  缩放持久化
 *   - setZoom(factor)              设置 webFrame 缩放
 *   - openExternal(url)            打开外部链接
 *   - notification(options)        系统通知
 *
 * - window.translateDB（历史记录，canbox.db 黑盒）
 *   - listHistory()                所有历史（倒序）
 *   - saveHistory(doc)             写入一条历史（按 prefs.historyMax 自动裁剪）
 *   - deleteHistory(id, rev)       删除单条
 *   - clearHistory()               清空历史
 */
const { contextBridge, ipcRenderer, webFrame } = require('electron');
const path = require('path');
const crypto = require('crypto');
const pkg = require(path.join(__dirname, 'package.json'));

// 校验 canbox-core 是否已通过 -r injection.js 注入
ipcRenderer.invoke('canbox.misc.hello').then(() => {
    console.log('[cb-translate preload] canbox-core 已加载');
}).catch(err => {
    console.error('[cb-translate preload] canbox-core 未加载: %o', err);
});

window.addEventListener('DOMContentLoaded', () => {
    document.title = pkg.description + ' - v' + pkg.version;
});

// 读取偏好（historyMax 用于裁剪）
async function getHistoryMax() {
    try {
        const ret = await ipcRenderer.invoke('translate.getSettings');
        return (ret && ret.prefs && ret.prefs.historyMax) || 200;
    } catch (err) {
        console.error('[cb-translate preload] 读取 historyMax 失败:', err);
        return 200;
    }
}

// 从 db 拉全部 translate_history 文档
async function fetchAllHistoryDocs() {
    const result = await ipcRenderer.invoke('canbox.db.allDocs', { include_docs: true });
    if (!result || !result.rows) return [];
    return result.rows
        .map(row => row.doc)
        .filter(doc => doc && doc.type === 'translate_history');
}

contextBridge.exposeInMainWorld('translate', {
    doTranslate: (payload) => ipcRenderer.invoke('translate.doTranslate', payload),

    getBaiduStatus: () => ipcRenderer.invoke('translate.getBaiduStatus'),

    saveBaidu: (payload) => ipcRenderer.invoke('translate.saveBaidu', payload),

    getSettings: () => ipcRenderer.invoke('translate.getSettings'),

    saveSettings: (prefs) => ipcRenderer.invoke('translate.saveSettings', prefs),

    getZoomLevel: async () => {
        try {
            const level = await ipcRenderer.invoke('translate.getZoomLevel');
            return level;
        } catch (error) {
            console.error('[cb-translate preload] 获取缩放级别失败:', error);
            return 1;
        }
    },

    saveZoomLevel: (level) => {
        ipcRenderer.invoke('translate.saveZoomLevel', level).catch(err => {
            console.error('[cb-translate preload] 保存缩放级别失败:', err);
        });
    },

    setZoom: (factor) => {
        webFrame.setZoomFactor(factor);
    },

    getZoomFactor: () => webFrame.getZoomFactor(),

    openExternal: (url) => {
        ipcRenderer.invoke('translate.openExternal', url).catch(err => {
            console.error('[cb-translate preload] 打开外部链接失败:', err);
        });
    },

    notification: (options) => {
        ipcRenderer.invoke('translate.notification', options).catch(err => {
            console.error('[cb-translate preload] 通知发送失败:', err);
        });
    }
});

// 历史记录 DB API
contextBridge.exposeInMainWorld('translateDB', {
    // 获取所有历史（按 time 倒序）
    listHistory: async () => {
        try {
            const docs = await fetchAllHistoryDocs();
            docs.sort((a, b) => (b.time || 0) - (a.time || 0));
            return { success: true, data: docs };
        } catch (error) {
            console.error('[cb-translate preload] listHistory 错误:', error);
            return { success: false, msg: error.message };
        }
    },

    // 写入一条历史并裁剪到 historyMax
    saveHistory: async (entry) => {
        try {
            const doc = {
                type: 'translate_history',
                ...entry,
                time: Date.now()
            };
            if (!doc._id) {
                doc._id = crypto.randomUUID();
            }
            const result = await ipcRenderer.invoke('canbox.db.put', doc);

            // 裁剪：超过 historyMax 时删除最旧的多余记录
            try {
                const historyMax = await getHistoryMax();
                const docs = await fetchAllHistoryDocs();
                docs.sort((a, b) => (a.time || 0) - (b.time || 0)); // 最旧在前
                const overflow = docs.length - historyMax;
                if (overflow > 0) {
                    const toRemove = docs.slice(0, overflow).map(d => ({ _id: d._id, _rev: d._rev, _deleted: true }));
                    await ipcRenderer.invoke('canbox.db.bulkDocs', toRemove);
                }
            } catch (trimErr) {
                console.warn('[cb-translate preload] 历史裁剪失败:', trimErr);
            }

            return { success: true, id: result.id, rev: result.rev };
        } catch (error) {
            console.error('[cb-translate preload] saveHistory 错误:', error);
            return { success: false, msg: error.message };
        }
    },

    // 删除单条
    deleteHistory: async (id, rev) => {
        try {
            await ipcRenderer.invoke('canbox.db.remove', { _id: id, _rev: rev });
            return { success: true };
        } catch (error) {
            return { success: false, msg: error.message };
        }
    },

    // 清空全部历史
    clearHistory: async () => {
        try {
            const docs = await fetchAllHistoryDocs();
            if (docs.length > 0) {
                const toRemove = docs.map(d => ({ _id: d._id, _rev: d._rev, _deleted: true }));
                await ipcRenderer.invoke('canbox.db.bulkDocs', toRemove);
            }
            return { success: true };
        } catch (error) {
            return { success: false, msg: error.message };
        }
    }
});
