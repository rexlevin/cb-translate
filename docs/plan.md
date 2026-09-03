# cb-translate「灵译」规划文档

> 状态：待确认
> 创建：2026-09-03

## 1. 项目概述

- **目录名**：`cb-translate`
- **产品中文名**：灵译
- **定位**：基于 Canbox 的轻量桌面翻译工具（对标 lfy），纯客户端调用在线翻译 API，无自有服务端
- **参考对象**：https://github.com/ldrfy/lfy （GPL-3.0，仅参考 UI/业务思路，不复制代码）
- **范式**：Canbox native APP（`.canbox-app` type=native + `main.js` + `preload.js` + Vite/Vue），参照 `cb-jsonbox` / `cb-hostsbox` / `cb-imagebox`

## 2. lfy 功能分析与裁剪

lfy（兰译）核心特性：

| 模块 | 说明 | 本期（v1） | 二期 |
|------|------|:---:|:---:|
| 翻译引擎 | baidu / tencent / google / bing / aliyun / huoshan / ollama | 仅百度 | 多引擎 + 对比 |
| 翻译交互 | 输入文本 → 选语言/引擎 → 结果展示 | ✅ | — |
| 复制即翻译 | 剪贴板/选中文本唤起 | — | ✅ |
| OCR 截图翻译 | 截屏识别图中文字再翻译 | — | ✅ |
| 偏好设置 | API Key、默认语言、行为项 | 百度 key + 基础项 | 扩展 |
| 历史记录 | 翻译历史复用 | ✅ | 增强 |

**v1 最小核心范围**：百度翻译引擎 + 基础翻译交互 + 历史记录 + 设置（百度 appid/密钥）。
OCR、剪贴板监听、其他引擎、多引擎对比均留二期。

## 3. UI / UX 设计（参照 lfy 主窗口）

单主窗口（无多余弹窗），参考 lfy 的 GNOME/adwaita 简洁风格，中文界面。

```
┌────────────────────────────────────────────────────────┐
│ [源语言 ▾] ⇄ [目标语言 ▾]            [历史] [设置]      │
├────────────────────────────────────────────────────────┤
│  原文输入区（textarea，支持多行，Ctrl+Enter 翻译）        │
│  字数提示 / 清空                                        │
├────────────────────────────────────────────────────────┤
│  译文结果区（百度翻译）                                  │
│  ─ 引擎标识 ──────────────────── [复制] [朗读*]          │
│  译文文本（可多行）                                     │
├────────────────────────────────────────────────────────┤
│  历史记录（侧栏/面板，可收起）                            │
│  ↕ 列表：原文+译文+语言+时间，点击回填，删除/清空          │
└────────────────────────────────────────────────────────┘
```

细节约定：

- **语言**：源语言默认 `自动检测(auto)`；目标语言默认中文/英文（按首译方向）；支持主流语言列表（中/英/日/韩/法/德/西/俄…，遵循百度语言码）
- **快捷键**：`Ctrl+Enter` 翻译、`Ctrl+1` 聚焦输入、`Esc` 关闭弹层
- **清空/粘贴**：工具栏按钮 + `Ctrl+V` 原生支持
- **复制**：一键复制译文（成功后轻提示）
- **历史**：每次成功翻译自动入库，最新在前；点击回填原文；右键删除单条；支持一键清空
- 窗口：默认约 860×640，可缩放，记录上次窗口 bounds（复用 core store `winState`）
- 字体/字号：跟随系统，文案走中英混杂最少化

## 4. 技术方案

### 4.1 工程范式（对齐现有 cb-* native APP）

```
cb-translate/
├── .canbox-app          # { version:1, electron:{range:"42.5.1"}, type:"native", webApp:null }
├── package.json         # main: main.js；含 id/logo/keywords/scripts
├── main.js              # 主进程：窗口创建 + 窗口状态 + 自有 IPC（翻译引擎、通知、缩放）
├── preload.js           # contextBridge：window.translate / window.translateDB
├── vite.config.js       # Vue3 + Vite，build → build/
├── index.html
├── logo.png
├── public/
├── docs/plan.md         # 本文档
└── src/
    ├── main.js          # Vue 入口
    ├── App.vue          # 整体布局
    ├── style.css
    ├── components/
    │   ├── LangBar.vue        # 语言切换条
    │   ├── SourceInput.vue    # 原文输入区
    │   ├── ResultPanel.vue    # 译文结果区
    │   ├── HistoryPanel.vue   # 历史记录面板
    │   └── SettingsDialog.vue # 设置对话框
    └── lib/
        └── langs.js           # 语言选项（code/name 映射）
```

主进程侧可放 `engines/baidu.js` 做引擎封装（签名、请求、错误码映射），为二期多引擎预留扩展位。

### 4.2 依赖

- 运行时依赖：`vue`、`element-plus`（对话框/消息/选择器等基础组件，与 jsonbox/hostsbox 同族）
- 可选：`@element-plus/icons-vue`
- devDependencies：`vite`、`@vitejs/plugin-vue`、`electron@42.5.1`、`electron-builder`、`cross-env`
- 不使用 pinia/vue-router（v1 单页 + 对话框即可，减少复杂度）；不依赖 canbox-core 之外的平台能力

### 4.3 百度翻译引擎（v1 唯一引擎）

调用百度翻译开放平台「通用文本翻译 API」：

- 文档：`https://fanyi-api.baidu.com/`（需用户自行注册应用，免费标准版有额度）
- 接口：`GET https://fanyi-api.baidu.com/api/trans/vip/translate`
- 参数：`q`、`from`、`to`、`appid`、`salt`、`sign = md5(appid+q+salt+密钥)`
- **请求必须在主进程发**（Node https/net），原因：避免浏览器 CORS；API 密钥不暴露给渲染层；失败可统一错误码映射
- 错误码映射为可读中文提示：52003 未授权、54001 签名错误、54003 访问频率受限、54004 配额不足/余额、58000 IP 受限等

实现要点：

- 主进程新增 IPC：`translate.doTranslate({ q, from, to })`
- 引擎读取 core store `settings` 中保存的 appid/密钥，请求成功后返回 `{ from, to, result: [{ src, dst }] }`
- 网络异常/超时/HTTP 非 200 → 统一错误结构返回渲染层提示

### 4.4 数据存储（canbox-core 黑盒 store/db）

- **设置**：store `settings`
  - `baidu.appid`、`baidu.secret`（密钥只在主进程读写，不通过 preload 回传明文）
  - `prefs.defaultFrom`（默认 `auto`）、`prefs.defaultTo`、`prefs.historyMax`（默认 200）
  - 打开设置时仅回传 `hasBaidu` + appid 脱敏串，用于 UI 展示是否已配置
- **历史**：db 文档（`type:'translate_history'`）
  - 字段：`_id`(uuid)、`type`、`q`、`dst`、`from`、`to`、`engine`、`time`
  - 读取：`canbox.db.allDocs`（渲染层过滤 + 按 time 倒序）
  - 上限：写入前按 `prefs.historyMax` 裁剪，防无限膨胀
- **窗口状态**：core store `winState`（bounds），复用 hostsbox/jsonbox 同款逻辑

### 4.5 preload 暴露面

| 对象 | 方法 | 说明 |
|------|------|------|
| `window.translate` | `doTranslate({q,from,to})` | 翻译（主进程代理） |
| | `getBaiduStatus()` | 是否已配置 + appid 脱敏 |
| | `saveBaidu(appid, secret)` | 保存/更新百度密钥 |
| | `getSettings()` / `saveSettings(prefs)` | 偏好读写 |
| | `getZoomLevel()` / `saveZoomLevel()` | 缩放持久化（core store） |
| | `openExternal(url)` | 打开外部链接（如注册页） |
| `window.translateDB` | `listHistory()` / `saveHistory(doc)` / `deleteHistory(id, rev)` / `clearHistory()` | 历史 CRUD（db 黑盒） |

## 5. IPC / 主进程清单

| 通道 | 用途 |
|------|------|
| `translate.doTranslate` | 主进程调用百度翻译并返回结果/错误 |
| `translate.getBaiduStatus` | 获取是否已配置（脱敏） |
| `translate.saveBaidu` | 保存百度 appid/密钥 |
| `translate.getSettings` / `translate.saveSettings` | 偏好 |
| `translate.getZoomLevel` / `translate.saveZoomLevel` | 缩放持久化 |
| `translate.openExternal` | 外部链接 |
| `translate.notification` | 系统通知（可选） |

数据持久化本身走 canbox-core store/db 通道，无需再包 IPC。

## 6. 目录/工程创建（下一步）

用户确认本文档后，按第 4.1 节结构创建工程骨架并实现 v1。

## 7. 里程碑（v1 验收标准）

1. `npm install` + `npm run dev` 可启动，canbox-core 注入正常（`canbox.misc.hello` 通过）
2. 输入文本选择语言后翻译成功，结果正确展示，错误码可读提示
3. 设置页可保存百度 appid/密钥，重启后仍生效
4. 历史自动记录、倒序展示、回填、删除、清空均可用；有上限裁剪
5. 窗口尺寸/位置记忆；`Ctrl+Enter` 等快捷键生效
6. `npm run build` 产物可被 canbox 正常加载（loadFile build/index.html）

## 8. 待确认问题

- [ ] 中文名「灵译」是否最终确认；是否需要英文标语（用于 description 窗口标题）
- [ ] 目标语言默认值（中文还是英文）
- [ ] 是否引入 Element Plus（推荐）还是完全手写轻样式
- [ ] author/homepage 等 package.json 元信息归属（沿用 rexlevin 家族仓库 GitHub org，还是新账号）
- [ ] 二期优先级排序：OCR > 复制即翻译 > 多引擎对比 > ollama，是否符合预期
