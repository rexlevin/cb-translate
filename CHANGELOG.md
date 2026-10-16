# Changelog

本文件记录项目的所有版本变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/)。

## [0.0.2] - 2026-10-16

### feat | 新功能 / Features

新增 Ctrl+, 快捷键打开「设置」界面
设置中新增「界面字号」与「原文/译文框字号」调整，调整后即时生效并自动保存
设置弹层宽度与表单标签随界面字号等比缩放，保证大字号下排版稳定
启动应用后自动聚焦原文输入框，可直接开始输入

Add Ctrl+, shortcut to open the Settings dialog
Add "UI font size" and "source/translation font size" options in Settings; changes take effect and are saved immediately
Settings dialog width and form labels scale proportionally with the UI font size, keeping the layout stable at large sizes
Auto-focus the source input on startup for immediate typing

### fix | 问题修复 / Bug Fixes

未配置百度翻译凭据时，仅调整字号等偏好后点击保存，不再被「请完整输入 APP ID 与密钥」拦截

When Baidu credentials are not configured, saving preference-only changes (e.g. font size) is no longer blocked by the "please enter APP ID and secret" validation

### build | 其他 / Others

.canbox-app 新增 category 字段（utility）

Add category field (utility) to .canbox-app

## [0.0.1] - 2026-09-22

### feat | 新功能 / Features

灵译（cb-translate）首个版本发布，轻量桌面翻译工具，支持多引擎切换、文本翻译、历史记录

Initial release of cb-translate, a lightweight desktop translation tool with multi-engine switching, text translation, and history

### chore | 维护 / Maintenance

锁定 electron 版本为 42.5.1
添加 GitHub Actions release 发布脚本

Lock electron version to 42.5.1
Add GitHub Actions release workflow
