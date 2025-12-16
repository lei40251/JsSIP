// --- 辅助函数：MD5 加密 (确保您已引入 CryptoJS) ---
function md5(str) 
{
  if (typeof CryptoJS === 'undefined' || !CryptoJS.MD5) 
  {
    logStatus('❌ 错误：CryptoJS 库未加载。MD5 鉴权将失败。', true);
    
    return 'MD5_ERROR';
  }
  
  return CryptoJS.MD5(str).toString()
    .toUpperCase();
}

// --- WebSocket 和状态变量 ---
let ws = null;
let intervalId = null;
let rtcPeerConnection = null; 
let audioContext = null;
let sourceNode = null;
let processor = null;
let sessionId = null; // 新增：用于保存会话 ID

const APP_ID_INPUT = document.getElementById('app_id');
const APP_SECRET_INPUT = document.getElementById('app_secret');
const STATUS_AREA = document.getElementById('status-area');
const CONNECT_BTN = document.getElementById('connect-btn');
const START_MIC_BTN = document.getElementById('start-mic-btn');
const STOP_MIC_BTN = document.getElementById('stop-mic-btn');
const VIDEO_ELEMENT = document.getElementById('digital-human-video');
const TEXT_INPUT = document.getElementById('text-input');
const SEND_TEXT_BTN = document.getElementById('send-text-btn');
const CLOSE_SESSION_BTN = document.getElementById('close-session-btn'); // 新增 DOM 元素

function logStatus(message, isError = false) 
{
  const timestamp = new Date().toLocaleTimeString();

  STATUS_AREA.textContent += `[${timestamp}] ${isError ? '❌ ERROR: ' : ''}${message}\n`;
  STATUS_AREA.scrollTop = STATUS_AREA.scrollHeight;
}

// --- 统一的清理函数 ---
function cleanup() 
{
  stopHeartBeat();
  stopMicStream();
  stopWhepPlayback();
  sessionId = null;

  // 禁用所有功能按钮
  CONNECT_BTN.disabled = false;
  START_MIC_BTN.disabled = true;
  STOP_MIC_BTN.disabled = true;
  TEXT_INPUT.disabled = true;
  SEND_TEXT_BTN.disabled = true;
  CLOSE_SESSION_BTN.disabled = true;
    
  // 清理 WebSocket
  if (ws) 
  {
    if (ws.readyState === WebSocket.OPEN) 
    {
      ws.close();
      logStatus('WebSocket 连接已关闭。');
    }
    ws = null;
  }
}

// --- 鉴权和连接逻辑 (更新了按钮启用) ---

function generateSignUrl() 
{
  // ... (鉴权逻辑保持不变)
  const appId = APP_ID_INPUT.value;
  const appSecret = APP_SECRET_INPUT.value;
  const ts = Math.floor(Date.now() / 1000); 

  if (!appId || !appSecret || appId.startsWith('YOUR') || appSecret.startsWith('YOUR')) 
  {
    logStatus('AppId 或 AppSecret 未设置或为默认值，请更新。', true);
    
    return null;
  }

  const signStr = appId + ts + appSecret;
  const sign = md5(signStr);

  const wssUrl = `wss://api.deepsound.cn/avatar/interactive/v1/ws?app_id=${appId}&timestamp=${ts}&sign=${sign}`;

  logStatus(`生成的签名: ${sign}`);
  logStatus(`连接 URL: ${wssUrl}`);
  
  return wssUrl;
}

function connectAndCreateSession() 
{
  if (ws && ws.readyState === WebSocket.OPEN) 
  {
    logStatus('WebSocket 已经连接。', false);
    
    return;
  }

  const wssUrl = generateSignUrl();

  if (!wssUrl) return;

  ws = new WebSocket(wssUrl);
  logStatus('尝试连接 WebSocket...');
  CONNECT_BTN.disabled = true;

  ws.onopen = () => 
  {
    logStatus('✅ WebSocket 连接成功。');
    startHeartBeat();
    sendCreateSession();
    // 连接成功后启用文本和关闭按钮
    TEXT_INPUT.disabled = false;
    SEND_TEXT_BTN.disabled = false;
    CLOSE_SESSION_BTN.disabled = false; // 启用结束按钮
  };

  ws.onmessage = (event) => 
  {
    try 
    {
      const data = JSON.parse(event.data);

      logStatus(`收到消息: ${JSON.stringify(data)}`);

      if (data.event === 'session' && data.status === 'CREATED' && data.data) 
      {
        const publishUrl = data.data.publish_url;

        sessionId = data.data.session_id; // 存储 session_id
                
        logStatus(`🎉 会话创建成功！Session ID: ${sessionId}`);
        logStatus(`📢 WHEP 视频流地址: ${publishUrl}`);
                
        startWhepPlayback(publishUrl);
                
        START_MIC_BTN.disabled = false;
      }
      else if (data.event === 'session' && data.status === 'CLOSED') 
      {
        logStatus('✅ 收到会话关闭确认，正在清理资源...');
        cleanup();
      }
    }
    catch (e) 
    {
      logStatus(`处理消息出错: ${e.message}`, true);
    }
  };

  ws.onclose = () => 
  {
    logStatus('❌ WebSocket 连接已关闭 (可能是正常关闭或异常断开)。');
    cleanup();
  };

  ws.onerror = (error) => 
  {
    logStatus(`❌ WebSocket 错误: ${error}`, true);
    cleanup();
  };
}

// --- 新增：关闭会话逻辑 ---

function closeSession() 
{
  if (!ws || ws.readyState !== WebSocket.OPEN) 
  {
    logStatus('WebSocket 未连接，无法发送关闭请求。', true);
    cleanup(); // 确保执行清理
    
    return;
  }

  if (!sessionId) 
  {
    logStatus('没有有效的 session_id，直接执行本地清理。', false);
    cleanup();
    
    return;
  }

  // 构造关闭请求消息
  const closeMsg = {
    'operation' : 'session.close', 
    'params'    : {
      'session_id' : sessionId
    }
  };

  logStatus(`➡️ 发送关闭会话请求: ${sessionId}`);
  ws.send(JSON.stringify(closeMsg));
    
  // 在发送后立即执行本地清理，避免服务器无响应导致界面卡死
  cleanup();
}


// --- WHEP 拉流核心逻辑 (保持不变) ---

async function startWhepPlayback(whepUrl) 
{
  if (rtcPeerConnection) 
  {
    logStatus('WHEP 拉流已在进行中或未清理。', false);
    
    return;
  }

  logStatus('➡️ 启动 WHEP 拉流过程...');

  try 
  {
    rtcPeerConnection = new RTCPeerConnection({
      iceServers : [ { urls: 'stun:stun.l.google.com:19302' } ] 
    });

    
    rtcPeerConnection.addTransceiver('video', { direction: 'recvonly' });
    rtcPeerConnection.addTransceiver('audio', { direction: 'recvonly' });

    rtcPeerConnection.ontrack = (event) => 
    {
      logStatus('✅ 收到媒体流轨道。');
      if (VIDEO_ELEMENT.srcObject !== event.streams[0]) 
      {
        VIDEO_ELEMENT.srcObject = event.streams[0];
        VIDEO_ELEMENT.play().catch((e) => 
        {
          logStatus('❌ 自动播放失败，请手动点击播放按钮。', true);
        });
      }
    };

    const offer = await rtcPeerConnection.createOffer();

    await rtcPeerConnection.setLocalDescription(offer);
        
    const response = await fetch(whepUrl, {
      method  : 'POST',
      headers : { 'Content-Type': 'application/sdp' },
      body    : rtcPeerConnection.localDescription.sdp
    });

    if (!response.ok) 
    {
      throw new Error(`WHEP 请求失败，状态码: ${response.status}`);
    }

    const answerSdp = await response.text();

    await rtcPeerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }));
        
    logStatus('🎉 WHEP 拉流信令交换完成，等待媒体传输...');

  }
  catch (error) 
  {
    logStatus(`❌ WHEP 拉流失败: ${error.message}`, true);
    stopWhepPlayback();
  }
}

function stopWhepPlayback() 
{
  if (rtcPeerConnection) 
  {
    rtcPeerConnection.close();
    rtcPeerConnection = null;
    logStatus('WebRTC 连接已关闭。');
  }
  if (VIDEO_ELEMENT.srcObject) 
  {
    VIDEO_ELEMENT.srcObject = null;
  }
}


// --- 其他逻辑 (心跳、创建会话、文本、麦克风) 保持不变或已融入清理函数 ---

function startHeartBeat() 
{
  // ... (心跳逻辑)
  logStatus('开始发送心跳包 (每秒一次)...');
  const heartBeatMsg = { 'operation': 'heart_beat', 'params': {} };

  intervalId = setInterval(() => 
  {
    if (ws && ws.readyState === WebSocket.OPEN) 
    {
      ws.send(JSON.stringify(heartBeatMsg));
    }
  }, 1000);
}

function stopHeartBeat() 
{
  // ... (心跳停止逻辑)
  if (intervalId) 
  {
    clearInterval(intervalId);
    intervalId = null;
    logStatus('停止发送心跳包。');
  }
}

function sendCreateSession() 
{
  // ... (会话创建逻辑)
  const createSessionMsg = {
    'operation' : 'session.create',
    'params'    : {
      'avatar'  : { 'id': '1001', 'bg_url': '' },
      'speaker' : { 'voice_name': 'ds_xiaowan', 'volume': '', 'pitch': '', 'speed': '' },
      'robot'   : { 'name': '' }
    }
  };

  if (ws && ws.readyState === WebSocket.OPEN) 
  {
    logStatus('发送创建会话请求...');
    ws.send(JSON.stringify(createSessionMsg));
  }
}

function sendText() 
{
  // ... (文本发送逻辑)
  if (!ws || ws.readyState !== WebSocket.OPEN) 
  {
    logStatus('WebSocket 未连接，无法发送文本。', true);
    
    return;
  }

  const content = TEXT_INPUT.value.trim();

  if (!content) 
  {
    logStatus('请输入要发送的文本内容。', false);
    
    return;
  }

  const textMsg = { 'operation': 'play.text', 'params': { 'content': content } };

  logStatus(`➡️ 发送文本消息: "${content}"`);
  ws.send(JSON.stringify(textMsg));
  TEXT_INPUT.value = '';
}

function floatTo16BitPCM(input) 
{
  const output = new DataView(new ArrayBuffer(input.length * 2));
  let offset = 0;

  for (let i = 0; i < input.length; i++, offset += 2) 
  {
    const s = Math.max(-1, Math.min(1, input[i]));

    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  
  return output.buffer;
}

async function startMicStream() 
{
  // ... (麦克风启动逻辑)
  if (!ws || ws.readyState !== WebSocket.OPEN) 
  {
    logStatus('WebSocket 未连接，请先连接。', true);
    
    return;
  }
  // ... (麦克风的具体实现)
  try 
  {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    sourceNode = audioContext.createMediaStreamSource(stream);
    processor = audioContext.createScriptProcessor(1024, 1, 1);
    processor.onaudioprocess = (e) => 
    {
      if (ws && ws.readyState === WebSocket.OPEN) 
      {
        const inputBuffer = e.inputBuffer.getChannelData(0);
        const pcm16k = floatTo16BitPCM(inputBuffer);
        const base64Content = btoa(String.fromCharCode.apply(null, new Uint8Array(pcm16k)));
        const audioStreamMsg = { 'operation': 'play.audio.stream', 'params': { 'content': base64Content } };

        ws.send(JSON.stringify(audioStreamMsg));
      }
    };

    sourceNode.connect(processor);
    processor.connect(audioContext.destination);

    logStatus('🎤 麦克风采集已启动，正在发送音频流...');
    START_MIC_BTN.disabled = true;
    STOP_MIC_BTN.disabled = false;

  }
  catch (error) 
  {
    logStatus(`❌ 无法获取麦克风: ${error.message}. 请检查权限。`, true);
  }
}

function stopMicStream() 
{
  // ... (麦克风停止逻辑)
  if (processor) 
  {
    processor.disconnect();
    processor.onaudioprocess = null;
    processor = null;
  }
  if (sourceNode) 
  {
    sourceNode.disconnect();
    sourceNode = null;
  }
  if (audioContext) 
  {
    audioContext.close();
    audioContext = null;
  }

  if (ws && ws.readyState === WebSocket.OPEN) 
  {
    const stopAudioMsg = { 'operation': 'play.audio.stream', 'params': { 'content': '' } };

    ws.send(JSON.stringify(stopAudioMsg));
    logStatus('停止麦克风采集，并发送音频流结束信号。');
  }

  START_MIC_BTN.disabled = false;
  STOP_MIC_BTN.disabled = true;
}


// --- 事件监听器 ---
CONNECT_BTN.addEventListener('click', connectAndCreateSession);
START_MIC_BTN.addEventListener('click', startMicStream);
STOP_MIC_BTN.addEventListener('click', stopMicStream);
SEND_TEXT_BTN.addEventListener('click', sendText);
TEXT_INPUT.addEventListener('keypress', (e) => 
{
  if (e.key === 'Enter') 
  {
    sendText();
  }
});

// 新增结束会话事件监听
CLOSE_SESSION_BTN.addEventListener('click', closeSession);

// 首次加载时提示用户
window.onload = () => 
{
  logStatus('请在 AppId 和 AppSecret 字段中填入您的真实信息。');
};