/**
 * cb-translate 百度翻译引擎
 *
 * 调用百度翻译开放平台「通用文本翻译 API」：
 *   https://fanyi-api.baidu.com/api/trans/vip/translate
 *
 * 说明：
 * - 请求在主进程发起（避免浏览器 CORS，密钥不进入渲染层）
 * - 签名规则：sign = md5(appid + q + salt + 密钥)，q 为原始文本（不做 URL 编码）
 * - 免费标准版有字符额度限制，错误码统一映射为可读中文
 */
const crypto = require('crypto');
const https = require('https');

const BAIDU_ENDPOINT = 'https://fanyi-api.baidu.com/api/trans/vip/translate';
const REQUEST_TIMEOUT = 15000;

// 百度翻译通用错误码 → 可读提示
const BAIDU_ERRORS = {
    '52001': '请求超时，请稍后重试',
    '52002': '系统错误，请稍后重试',
    '52003': '未授权用户：请检查 appid 是否正确',
    '54000': '必填参数为空',
    '54001': '签名错误：请检查密钥是否正确',
    '54003': '访问频率受限，请稍后重试',
    '54004': '账户余额不足或免费额度已用完',
    '54005': '长 query 请求过于频繁，请稍后重试',
    '58000': '客户端 IP 不在白名单内',
    '58001': '译文语言方向不支持',
    '58002': '服务当前已关闭',
    '90107': '认证未通过或未生效'
};

/**
 * 通用 GET JSON 请求
 */
function httpGetJson(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            let raw = '';
            res.on('data', (chunk) => { raw += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(raw));
                } catch (e) {
                    reject(new Error('翻译接口返回数据解析失败'));
                }
            });
        });
        req.setTimeout(REQUEST_TIMEOUT, () => {
            req.destroy(new Error('请求超时'));
        });
        req.on('error', (e) => reject(e));
    });
}

/**
 * 执行百度翻译
 * @param {object} opts
 * @param {string} opts.q        待翻译文本
 * @param {string} opts.from     源语言码（如 auto）
 * @param {string} opts.to       目标语言码
 * @param {string} opts.appid    百度应用 appid
 * @param {string} opts.secret   百度应用密钥
 * @returns {Promise<{success:boolean, data?:object, code?:string, msg?:string}>}
 */
async function doBaiduTranslate({ q, from, to, appid, secret }) {
    if (!appid || !secret) {
        return { success: false, code: 'NOT_CONFIGURED', msg: '请先在设置中配置百度翻译 appid 与密钥' };
    }
    if (!q || !String(q).trim()) {
        return { success: false, code: 'EMPTY_TEXT', msg: '请输入要翻译的文本' };
    }

    const salt = String(Date.now());
    const sign = crypto
        .createHash('md5')
        .update(`${appid}${q}${salt}${secret}`, 'utf8')
        .digest('hex');

    const params = new URLSearchParams({ q, from, to, appid, salt, sign });
    const url = `${BAIDU_ENDPOINT}?${params.toString()}`;

    try {
        const resp = await httpGetJson(url);
        if (resp.error_code) {
            return {
                success: false,
                code: String(resp.error_code),
                msg: BAIDU_ERRORS[String(resp.error_code)] || resp.error_msg || '翻译失败'
            };
        }
        const result = (resp.trans_result || []).map(item => ({
            src: item.src,
            dst: item.dst
        }));
        return { success: true, data: { from: resp.from, to: resp.to, result } };
    } catch (e) {
        return { success: false, code: 'NETWORK', msg: '网络请求失败: ' + (e.message || e) };
    }
}

module.exports = { doBaiduTranslate, BAIDU_ERRORS };
