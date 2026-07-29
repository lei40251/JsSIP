// ===== 工具函数 =====

// 生成随机 requestId
function genRequestId() 
{
  return `req-${ Math.random().toString(36)
    .slice(2) }${Date.now()}`;
}

// 对象按 ASCII 排序（仅一层）
function sortObject(obj) 
{
  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => 
    {
      acc[key] = obj[key];
      
      return acc;
    }, {});
}

// 构造 header 字符串
function buildHeaderString(headers) 
{
  const keys = [ 'Content-Type', 'X-Version', 'X-Timestamp', 'X-AID' ].sort();

  return keys
    .map((k) => `${k}:${headers[k]}`)
    .join('\r\n')
    .toLowerCase();
}

// HmacSHA256（浏览器版）
async function hmacSha256(key, data) 
{
  const enc = new TextEncoder();

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [ 'sign' ]
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    enc.encode(data)
  );

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ===== 核心：生成签名 =====
async function generateSignature({ secret, headers, body }) 
{
  // 1. header string
  const headerStr = buildHeaderString(headers);

  // 2. header签名
  const headerSign = await hmacSha256(secret, headerStr);

  // 3. body 排序
  const sortedBody = sortObject(body);
  const bodyStr = JSON.stringify(sortedBody);

  // 4. 最终签名
  const finalSign = await hmacSha256(headerSign, bodyStr);

  return finalSign;
}

// ===== 核心：发请求 =====
async function request({ url, method = 'POST', body = {}, secret }) 
{
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const headers = {
    'Content-Type' : 'application/json',
    'X-Version'    : '1.0.0',
    'X-Timestamp'  : timestamp,
    'X-AID'        : '10010001'
  };

  // 生成签名
  const signature = await generateSignature({
    secret,
    headers,
    body
  });

  // 写入 Authorization
  headers['Authorization'] = signature;
  headers['X-Request-ID'] = genRequestId();

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