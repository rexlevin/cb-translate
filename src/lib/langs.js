/**
 * 语言选项（遵循百度翻译语言代码）
 * from 支持 auto（自动检测）
 */
export const LANGS = [
    { code: 'auto', name: '自动检测' },
    { code: 'zh', name: '中文(简体)' },
    { code: 'cht', name: '中文(繁体)' },
    { code: 'en', name: '英语' },
    { code: 'jp', name: '日语' },
    { code: 'kor', name: '韩语' },
    { code: 'fra', name: '法语' },
    { code: 'de', name: '德语' },
    { code: 'spa', name: '西班牙语' },
    { code: 'ru', name: '俄语' },
    { code: 'pt', name: '葡萄牙语' },
    { code: 'it', name: '意大利语' },
    { code: 'ara', name: '阿拉伯语' },
    { code: 'th', name: '泰语' },
    { code: 'vie', name: '越南语' },
    { code: 'id', name: '印尼语' },
    { code: 'nl', name: '荷兰语' },
    { code: 'pl', name: '波兰语' },
    { code: 'tr', name: '土耳其语' },
    { code: 'hi', name: '印地语' }
];

// 目标语言列表（不含 auto）
export const TARGET_LANGS = LANGS.filter(l => l.code !== 'auto');

// 语言码 → 名称
export function langName(code) {
    const found = LANGS.find(l => l.code === code);
    return found ? found.name : code || '';
}
