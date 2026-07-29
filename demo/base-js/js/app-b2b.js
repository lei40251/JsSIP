/* B2B（Business-to-Business）呼入请求辅助模块。
 *
 * 该文件提供 B2B 场景下与第三方平台对接的 HTTP 签名和请求能力，由 app-events.js
 * 中的 B2B 外呼按钮（#b2bVideo / #b2bVideoSend）调用。
 *
 * 核心流程：
 * 1. 通过 b2bReq() 向第三方 B2B 接口发起带签名的 HTTP 请求
 * 2. 第一个请求获取 callId 字符串
 * 3. 第二个请求用 callId 查询真实被叫号码
 * 4. 外层拿到号码后再通过 SDK 的 call() API 发起 SIP 呼叫
 *
 * 安全机制：使用 HmacSHA256 双重签名（请求头签名 + 请求体签名），
 * 确保请求头（时间戳/版本号/应用ID）和请求体（业务参数）均不可篡改。
 * 签名计算全程使用浏览器原生 Web Crypto API，不依赖第三方库。
 */
/* eslint-disable no-unused-vars */

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 生成随机的请求 ID（requestId）。
 * 格式：req-{9位随机字符串}{13位时间戳}
 * 用于每次 B2B 请求的唯一追踪和日志关联。
 *
 * @returns {string} 随机 requestId
 */
function getReqId()
{
  return `req-${ Math.random().toString(36)
    .slice(2) }${Date.now()}`;
}

/**
 * 对对象的键按 ASCII 码排序（仅一层，不递归）。
 * 用于确保签名计算时 body 字段顺序一致，避免不同序列化导致签名不同。
 *
 * @param {object} obj - 待排序的扁平对象
 * @returns {object} 键按 ASCII 排序后的新对象
 */
function sortObj(obj)
{
  return Object.keys(obj)
    .sort()
    .reduce((out, key) =>
    {
      out[key] = obj[key];

      return out;
    }, {});
}

/**
 * 把请求头对象转成固定的规范化字符串。
 * 只取 Content-Type、X-Version、X-Timestamp、X-AID 四个必选头部，
 * 按 key 排序后以 `key:value` 格式拼接，换行分隔，最后统一转小写。
 *
 * 为什么要排序：确保发送方和接收方用完全相同的字符串计算签名。
 *
 * @param {object} headers - HTTP 请求头键值对
 * @returns {string} 格式化后的请求头规范字符串
 */
function getHeaderText(headers)
{
  const keys = [ 'Content-Type', 'X-Version', 'X-Timestamp', 'X-AID' ].sort();

  return keys
    .map((k) => `${k}:${headers[k]}`)
    .join('\r\n')
    .toLowerCase();
}

/**
 * 使用 Web Crypto API 计算 HmacSHA256 哈希。
 * 浏览器端不依赖任何第三方库，使用原生 crypto.subtle 实现。
 *
 * 流程：
 * 1. 将密钥字符串编码为 ArrayBuffer
 * 2. 用 crypto.subtle.importKey 导入 HMAC 密钥
 * 3. 用 crypto.subtle.sign 计算签名
 * 4. 转为 hex 字符串返回
 *
 * @param {string} key - HMAC 密钥（明文）
 * @param {string} data - 待签名的原始数据
 * @returns {Promise<string>} hex 格式的签名结果
 */
async function hmac256(key, data)
{
  const enc = new TextEncoder();

  const hKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [ 'sign' ]
  );

  const sig = await crypto.subtle.sign(
    'HMAC',
    hKey,
    enc.encode(data)
  );

  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// =============================================================================
// 核心签名与请求
// =============================================================================

/**
 * 【核心】生成 B2B 请求签名。
 *
 * 签名机制（双重签名）：
 * 1. 第一层：HmacSHA256(secret, 规范化请求头字符串) → 得到中间签名
 * 2. 第二层：HmacSHA256(中间签名, 排序后的 JSON 请求体) → 得到最终签名
 *
 * 为什么要双重签名：
 * - 第一层确保请求头不可篡改（时间戳防重放、版本号约束接口）
 * - 第二层确保请求体不可篡改（业务参数完整性校验）
 *
 * @param {object} params - 签名参数
 * @param {string} params.secret - B2B 接口约定的共享密钥
 * @param {object} params.headers - 包含 X-Version、X-Timestamp、X-AID 等
 * @param {object} params.body - 请求体对象（key-value）
 * @returns {Promise<string>} hex 格式的最终签名
 */
async function signB2b({ secret, headers, body })
{
  // 先签请求头，用结果再签请求体。
  const head = getHeaderText(headers);
  const headSig = await hmac256(secret, head);
  const sorted = sortObj(body);
  const text = JSON.stringify(sorted);

  return hmac256(headSig, text);
}

/**
 * 【核心】发起带 B2B 签名的 HTTP 请求。
 *
 * 完整流程：
 * 1. 生成当前时间戳（秒级）
 * 2. 组装标准请求头：
 *    - Content-Type: application/json（请求体格式）
 *    - X-Version: 1.0.0（B2B 接口版本号）
 *    - X-Timestamp: 当前 Unix 秒时间戳（防重放攻击）
 *    - X-AID: 10010001（应用标识，由平台分配）
 * 3. 调用 signB2b() 生成签名
 * 4. 将签名写入 Authorization 头部，并追加 X-Request-ID 用于日志追踪
 * 5. 使用 fetch API 发起 HTTP 请求
 * 6. 解析 JSON 响应并返回 { status, data }
 *
 * @param {object} params - 请求参数
 * @param {string} params.url - B2B 接口完整 URL
 * @param {string} [params.method='POST'] - HTTP 方法
 * @param {object} [params.body={}] - 请求体对象（会被 JSON.stringify）
 * @param {string} params.secret - B2B 共享密钥
 * @returns {Promise<{status: number, data: any}>} HTTP 状态码和解析后的响应数据
 *
 * @example
 * // 在 app-events.js 中的 B2B 视频呼叫按钮使用示例：
 * b2bReq({
 *   url    : 'https://pro.vsbc.com:5085/b2b/tapi/v1/getInCallIdStr',
 *   method : 'POST',
 *   secret : '共享密钥',
 *   body   : { 'caller': '电话号码' }
 * })
 *   .then((callId) => {
 *     // callId.data.data 为服务端返回的 callId 字符串
 *     return b2bReq({
 *       url    : 'https://pro.vsbc.com:5085/b2b/tapi/v1/status',
 *       secret : '共享密钥',
 *       body   : { 'callId': callId.data.data, 'cmd': 'query' }
 *     });
 *   })
 *   .then((callNo) => {
 *     // callNo.data.data.stat 格式: "被叫号码&随路数据"
 *     const stat = callNo.data.data.stat.split('&');
 *     xdata = stat[1];      // 随路数据
 *     callee = stat[0];     // 真实被叫号码
 *     call('onlyVideo');    // 发起 SDK 视频呼叫
 *   });
 */
async function b2bReq({ url, method = 'POST', body = {}, secret })
{
  const time = Math.floor(Date.now() / 1000).toString();

  const headers = {
    'Content-Type' : 'application/json',
    'X-Version'    : '1.0.0',
    'X-Timestamp'  : time,
    'X-AID'        : '10010001'
  };

  // 生成签名
  const sig = await signB2b({
    secret,
    headers,
    body
  });

  // 写入 Authorization 和请求 ID
  headers['Authorization'] = sig;
  headers['X-Request-ID'] = getReqId();

  // 发起 HTTP 请求
  const res = await fetch(url, {
    method,
    headers,
    body : JSON.stringify(body)
  });

  // 解析并返回结果
  const data = await res.json();

  return {
    status : res.status,
    data
  };
}
