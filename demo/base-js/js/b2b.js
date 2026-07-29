/* B2B 请求辅助函数，由 app-ui-binding.js 的外呼按钮调用。 */
/* eslint-disable no-unused-vars */

// ===== 工具函数 =====

// 生成随机 requestId
function getReqId()
{
  return `req-${ Math.random().toString(36)
    .slice(2) }${Date.now()}`;
}

// 对象按 ASCII 排序（仅一层）
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

// 构造 header 字符串
function getHeaderText(headers)
{
  const keys = [ 'Content-Type', 'X-Version', 'X-Timestamp', 'X-AID' ].sort();

  return keys
    .map((k) => `${k}:${headers[k]}`)
    .join('\r\n')
    .toLowerCase();
}

// HmacSHA256（浏览器版）
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

// ===== 核心：生成签名 =====
async function signB2b({ secret, headers, body })
{
  // 先签请求头，再用结果签请求体。
  const head = getHeaderText(headers);
  const headSig = await hmac256(secret, head);
  const sorted = sortObj(body);
  const text = JSON.stringify(sorted);

  return hmac256(headSig, text);
}

// ===== 核心：发请求 =====
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

  // 写入 Authorization
  headers['Authorization'] = sig;
  headers['X-Request-ID'] = getReqId();

  // 发起请求
  const res = await fetch(url, {
    method,
    headers,
    body : JSON.stringify(body)
  });

  // 返回结果
  const data = await res.json();

  return {
    status : res.status,
    data
  };
}
