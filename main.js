/**
 * cb-translate — 灵译 主进程入口
 *
 * 标准 Electron APP，通过 canbox-core 注入启动：
 *   electron -r canbox-core/injection.js cb-translate/
 *
 * canbox-core 负责环境初始化（统一 userData、日志）与公共服务 IPC
 *（store/db/misc），本文件负责创建窗口、加载前端页面以及翻译引擎的
 * 代理调用（百度翻译签名/请求/错误码映射在主进程完成，密钥不下发渲染层）。
 */
const { app, BrowserWindow, Menu, ipcMain, shell, Notification, safeStorage } = require('electron');
const path = require('path');
const { doBaiduTranslate } = require('./engines/baidu');

let mainWindow = null;

// 默认偏好
const DEFAULT_PREFS = {
    defaultFrom: 'auto',
    defaultTo: 'zh',
    historyMax: 200
};

// ---------------------------------------------------------------------------
// core 辅助
// ---------------------------------------------------------------------------
function corePath() {
    return global.__CANBOX_CORE_PATH__;
}

function usersDataPath() {
    return path.join(global.__CANBOX_ENV__.usersPath, 'data');
}

// 获取 settings store（baidu 密钥 / prefs / zoomLevel 均存于此）
function getSettingsStore() {
    const store = require(path.join(corePath(), 'lib', 'store'));
    return store.getStore(global.__CANBOX_ENV__.appId, 'settings', usersDataPath());
}

function getWinStateStore() {
    const store = require(path.join(corePath(), 'lib', 'store'));
    return store.getStore(global.__CANBOX_ENV__.appId, 'winState', usersDataPath());
}

// ---------------------------------------------------------------------------
// 百度凭据加密存储（safeStorage 自实现，不依赖 canbox-core 公共服务）
//
// 存储位置仍为 {Users}/data/{appId}/store/settings.json 的 baidu 节点，但落盘
// 前使用 Electron safeStorage（Windows DPAPI / macOS Keychain / Linux libsecret）
// 将 appid+secret 整体加密。settings.json 中只出现密文字符串，不再有明文凭据。
//
// settings.json baidu 节点两种形态：
//   - 加密态: { "encrypted": true,  "enc": "enc:v1:<base64>" }
//              enc 内容 = safeStorage.encryptString(JSON.stringify({appid, secret}))
//   - 降级明文（OS 无可用加密后端）: { "encrypted": false, "appid": "...", "secret": "..." }
//
// 兼容旧版本明文结构 {appid, secret}：读取时若 OS 支持加密则自动迁移为密文。
// 若系统加密能力后续可用（如 Linux 补齐 keyring），降级明文也会在读取时被迁移。
// ---------------------------------------------------------------------------
const CRED_ENC_PREFIX = 'enc:v1:';

function isEncryptionAvailable() {
    try {
        return safeStorage.isEncryptionAvailable();
    } catch (error) {
        return false;
    }
}

// 编码一份凭据（appid+secret → 存储节点）
function encodeCredentials(appid, secret) {
    if (isEncryptionAvailable()) {
        const plain = JSON.stringify({ appid, secret });
        const enc = safeStorage.encryptString(plain).toString('base64');
        return { encrypted: true, enc: CRED_ENC_PREFIX + enc };
    }
    // 系统不支持安全存储：降级明文并标记 encrypted=false
    return { encrypted: false, appid, secret };
}

// 解码 settings 中 baidu 节点 → 明文凭据
// 返回 { ok, code, appid, secret, encrypted }
//   code: 'OK'（可用）| 'EMPTY'（未配置）| 'DECRYPT'（密文解密失败，需重新配置）
function decodeCredentials(cfg) {
    if (!cfg || typeof cfg !== 'object') {
        return { ok: false, code: 'EMPTY', appid: '', secret: '', encrypted: isEncryptionAvailable() };
    }

    // 加密态
    if (cfg.enc && typeof cfg.enc === 'string' && cfg.enc.startsWith(CRED_ENC_PREFIX)) {
        try {
            const b64 = cfg.enc.slice(CRED_ENC_PREFIX.length);
            const plain = safeStorage.decryptString(Buffer.from(b64, 'base64'));
            const parsed = JSON.parse(plain);
            return { ok: true, code: 'OK', appid: parsed.appid || '', secret: parsed.secret || '', encrypted: true };
        } catch (error) {
            console.error('[cb-translate] 凭据解密失败:', error.message);
            return { ok: false, code: 'DECRYPT', appid: '', secret: '', encrypted: true };
        }
    }

    // 旧明文 / 降级明文 {appid, secret}
    const appid = cfg.appid || '';
    const secret = cfg.secret || '';
    if (appid || secret) {
        if (isEncryptionAvailable()) {
            // 自动迁移：明文 → 密文（写回）
            try {
                getSettingsStore().set('baidu', encodeCredentials(appid, secret));
                return { ok: true, code: 'OK', appid, secret, encrypted: true };
            } catch (error) {
                console.error('[cb-translate] 凭据迁移失败:', error.message);
                return { ok: true, code: 'OK', appid, secret, encrypted: false };
            }
        }
        return { ok: true, code: 'OK', appid, secret, encrypted: false };
    }
    return { ok: false, code: 'EMPTY', appid: '', secret: '', encrypted: isEncryptionAvailable() };
}

function getBaiduConfig() {
    const s = getSettingsStore();
    const cfg = s.get('baidu') || {};
    return decodeCredentials(cfg);
}

function getPrefs() {
    const s = getSettingsStore();
    return { ...DEFAULT_PREFS, ...(s.get('prefs') || {}) };
}

// appid 脱敏：abc12345 → ab*****45
function maskAppid(appid) {
    if (!appid) return '';
    if (appid.length <= 4) return '****';
    return appid.slice(0, 2) + '****' + appid.slice(-2);
}

// ---------------------------------------------------------------------------
// IPC: 翻译
// ---------------------------------------------------------------------------
ipcMain.handle('translate.doTranslate', async (_e, { q, from, to }) => {
    const { appid, secret } = getBaiduConfig();
    return doBaiduTranslate({ q, from, to, appid, secret });
});

// 当前是否已配置百度密钥（不返回 secret；appid 脱敏展示）
ipcMain.handle('translate.getBaiduStatus', () => {
    const cred = getBaiduConfig();
    const configured = cred.ok && Boolean(cred.appid && cred.secret);
    return {
        configured,
        decryptFailed: cred.code === 'DECRYPT',
        appid: maskAppid(cred.appid),
        encrypted: cred.encrypted
    };
});

// 保存百度密钥（支持部分更新：只传 appid 或只传 secret）
ipcMain.handle('translate.saveBaidu', (_e, payload) => {
    const current = getBaiduConfig();
    const base = current.ok ? current : { appid: '', secret: '' };
    const cleaned = {
        appid: (payload.appid !== undefined ? String(payload.appid) : base.appid).trim(),
        secret: (payload.secret !== undefined ? String(payload.secret) : base.secret).trim()
    };
    if (!cleaned.appid || !cleaned.secret) {
        return { success: false, msg: 'appid 与密钥均需配置，请补全后再保存' };
    }
    getSettingsStore().set('baidu', encodeCredentials(cleaned.appid, cleaned.secret));
    return { success: true, encrypted: isEncryptionAvailable() };
});

// 读取偏好（不含密钥）
ipcMain.handle('translate.getSettings', () => {
    const prefs = getPrefs();
    const cred = getBaiduConfig();
    const configured = cred.ok && Boolean(cred.appid && cred.secret);
    return {
        prefs,
        baidu: {
            configured,
            decryptFailed: cred.code === 'DECRYPT',
            appid: maskAppid(cred.appid),
            encrypted: cred.encrypted
        }
    };
});

// 保存偏好
ipcMain.handle('translate.saveSettings', (_e, prefs) => {
    const next = { ...DEFAULT_PREFS, ...(prefs || {}) };
    getSettingsStore().set('prefs', next);
    return { success: true, prefs: next };
});

// ---------------------------------------------------------------------------
// IPC: 缩放级别（canbox-core store 持久化）
// ---------------------------------------------------------------------------
ipcMain.handle('translate.getZoomLevel', () => {
    try {
        const level = getSettingsStore().get('zoomLevel');
        return level !== undefined ? parseFloat(level) : 1;
    } catch (error) {
        console.error('[cb-translate] 获取缩放级别失败:', error);
        return 1;
    }
});

ipcMain.handle('translate.saveZoomLevel', (_e, level) => {
    try {
        getSettingsStore().set('zoomLevel', level);
    } catch (error) {
        console.error('[cb-translate] 保存缩放级别失败:', error);
    }
});

// ---------------------------------------------------------------------------
// IPC: misc
// ---------------------------------------------------------------------------
ipcMain.handle('translate.openExternal', (_e, url) => {
    shell.openExternal(url);
    return { success: true };
});

ipcMain.handle('translate.notification', (_e, options) => {
    if (Notification.isSupported()) {
        const n = new Notification({
            title: options.title || '灵译',
            body: options.body || '',
            icon: path.join(__dirname, 'public', 'logo.png')
        });
        n.show();
        return { success: true };
    }
    return { success: false, msg: '系统不支持通知' };
});

// ---------------------------------------------------------------------------
// 创建主窗口
// ---------------------------------------------------------------------------
function createWindow() {
    const winStateStore = getWinStateStore();
    const savedBounds = winStateStore.get('bounds');

    mainWindow = new BrowserWindow({
        width: savedBounds ? savedBounds.width : 900,
        height: savedBounds ? savedBounds.height : 660,
        x: savedBounds ? savedBounds.x : undefined,
        y: savedBounds ? savedBounds.y : undefined,
        minWidth: 760,
        minHeight: 540,
        resizable: true,
        title: '灵译',
        icon: path.join(__dirname, 'public', 'logo.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    const isDev = process.env.NODE_ENV === 'development';
    console.log('[cb-translate] NODE_ENV =', JSON.stringify(process.env.NODE_ENV), 'isDev =', isDev);
    if (isDev) {
        mainWindow.loadURL('http://localhost:5180');
        mainWindow.webContents.on('did-finish-load', () => {
            mainWindow.webContents.openDevTools({ mode: 'detach' });
        });
    } else {
        mainWindow.loadFile(path.join(__dirname, 'build', 'index.html'));
    }

    // 窗口关闭前保存窗口状态
    mainWindow.on('close', () => {
        const bounds = mainWindow.getBounds();
        winStateStore.set('bounds', bounds);
    });

    // 缩放快捷键
    const applyZoom = (next) => {
        mainWindow.webContents.setZoomFactor(next);
        try {
            getSettingsStore().set('zoomLevel', next);
        } catch (e) { /* ignore */ }
    };
    mainWindow.webContents.on('before-input-event', (event, input) => {
        const ctrl = input.control || input.meta;
        if (ctrl && (input.key === '=' || input.key === '+')) {
            event.preventDefault();
            const current = mainWindow.webContents.getZoomFactor();
            applyZoom(Math.min(current + 0.1, 3.0));
        } else if (ctrl && input.key === '-') {
            event.preventDefault();
            const current = mainWindow.webContents.getZoomFactor();
            applyZoom(Math.max(current - 0.1, 0.5));
        } else if (ctrl && input.key === '0') {
            event.preventDefault();
            applyZoom(1.0);
        }
    });
}

app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();
});

app.on('window-all-closed', () => {
    app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
