/* Demo 公共辅助方法：媒体渲染、设备列表、通知和共享浮层。
 *
 * 本文件提供点对点和三方模式共用的工具函数，不包含 SDK API 调用封装。
 * 所有函数都是纯页面辅助逻辑，可直接查看代码理解实现。
 *
 * 主要功能：
 * 1. 媒体渲染：showStreams / clearStreams / setMedia
 * 2. 设备管理：loadDevices / getAudioOpts / getVideoOpts
 * 3. 系统通知：showNotice / closeNotice
 * 4. 共享浮层：openShareBox / minShareBox / closeShareBox
 * 5. 输入处理：normNsLevel / getNsLevel / readOpacity / getQuery
 * 6. 工具函数：sameTracks / onTrackEnd / getRemoteOs
 */
/* eslint-disable no-unused-vars */
/* eslint-disable max-len */
/* eslint-disable no-console */
/* eslint-disable no-undef */

/**
 * 获取并渲染本地和远端媒体流
 *
 * @param {RTCPeerConnection} pc - 用于获取媒体流的 RTCPeerConnection 实例
 *
 * 处理流程：
 * 1. 从连接中提取本地和远端流
 * 2. 克隆本地音视频轨道构造新的 MediaStream（兼容 MCU 等候室）
 * 3. 渲染远端音频（延迟 100ms 适配安卓微信无声问题）
 * 4. 渲染远端视频（监听 ended 清理残留黑框）
 * 5. 统一播放（兼容 Chrome 自动播放策略）
 */
function showStreams(pc)
{
  const local = CRTC.Utils.getStreams(pc, 'local');
  const remote = CRTC.Utils.getStreams(pc, 'remote');

  const audio = local.audioStream.getAudioTracks().length > 0 ? local.audioStream.getAudioTracks()[0] : null;
  const video = (local.videoStream.getVideoTracks().length > 0) ? local.videoStream.getVideoTracks()[0] : null;
  const tracks = [];

  let nextStream;

  if (video)
  {
    tracks.push(video);
  }
  else if (audio)
  {
    tracks.push(audio);
  }

  if (tracks.length > 0)
  {
    nextStream = new MediaStream(tracks);

    if (setMedia(localVid, nextStream))
    {
      nextStream.getTracks().length > 0 && nextStream.getTracks()[0].addEventListener('ended', function()
      {
        localVid.srcObject = null;
      });
    }
  }

  if (cloneStream)
  {
    if (!isRefer)
    {
      // cloneStream.getTracks().forEach((track) => track.stop());
    }
  }
  isRefer = false;

  nextStream && (cloneStream = nextStream);

  setTimeout(() =>
  {
    setMedia(remoteAud, remote.audioStream);

    remoteAud.play()
      .catch(() => { });
  }, 100);

  if (setMedia(remoteVid, remote.mediaStream))
  {
    remote.videoStream.getVideoTracks().length > 0 && remote.videoStream.getVideoTracks()[0].addEventListener('ended', function()
    {
      if (!tmpSession)
      {
        remoteVid.srcObject = null;
      }
    });
  }

  Promise.all([ localVid.play(), remoteAud.play(), remoteVid.play() ])
    .then(() => { })
    .catch(() => { });
}

/**
 * 停止所有媒体流渲染
 */
function clearStreams()
{
  remoteVid.srcObject = null;
  remoteAud.srcObject = null;
  localVid.srcObject = null;
}

/**
 * 从 URL 查询参数中提取值
 *
 * @param {string} name - 参数名（区分大小写）
 * @returns {string|null} 参数值，不存在时返回 null
 */
function getQuery(name)
{
  const reg = new RegExp(`(^|&)${name}=([^&]*)(&|$)`, 'i');
  const r = window.location.search.substr(1).match(reg);

  if (r != null) return unescape(r[2]);

  return null;
}

/**
 * 向页面状态栏追加文本
 *
 * @param {string} text - 要输出的内容
 */
function setStatus(text)
{
  const statusEl = document.querySelector('#status');

  statusEl.innerText = `${statusEl.innerText}${text}\r\n`;
  statusEl.scrollTop = statusEl.scrollHeight;
}

// =============================================================================
// 媒体效果通用输入处理
// =============================================================================

/**
 * 把 AI 降噪强度整理到 0-100。
 * 这个方法只负责处理输入值，不关心具体媒体链路怎么使用它。
 *
 * @param {string|number} value - 输入框里读到的原始值
 * @returns {number} 归一化后的强度，默认 80
 */
function normNsLevel(value)
{
  const level = parseInt(value, 10);

  if (Number.isNaN(level))
  {
    return 80;
  }

  return Math.max(0, Math.min(100, level));
}

/**
 * 从页面读取当前 AI 降噪强度。
 * 这里只负责从输入框取值并做归一化，方便媒体效果模块直接复用。
 *
 * @returns {number} 当前页面上的合法降噪强度
 */
function getNsLevel()
{
  const input = document.querySelector('#nsLevel');
  const value = input ? input.value : '';

  return normNsLevel(value);
}

/**
 * 构建当前选中麦克风对应的音频采集约束。
 * 呼出、接听和音视频升级应复用同一设备选择结果。
 *
 * @returns {MediaTrackConstraints} 音频采集约束
 */
function getAudioOpts()
{
  const opts = {
    sampleRate   : 48000,
    channelCount : 1
  };

  if (micId)
  {
    opts.deviceId = { exact: micId };
  }

  return opts;
}

/**
 * 构建当前选中摄像头对应的视频采集约束。
 *
 * @returns {MediaTrackConstraints} 视频采集约束
 */
function getVideoOpts()
{
  const opts = Object.assign({}, videoOpts);

  if (cameraId)
  {
    opts.deviceId = { exact: cameraId };
  }

  return opts;
}

/**
 * 把透明度输入框的值统一转成 0-1。
 * 支持：
 * 1. 小数写法，例如 0.8
 * 2. 百分比写法，例如 80%
 *
 * @param {HTMLInputElement} input - 透明度输入框
 * @returns {number|undefined} 归一化后的透明度，空值或非法值时返回 undefined
 */
function readOpacity(input)
{
  const raw = String(input.value).trim();

  if (!raw)
  {
    return undefined;
  }

  const clean = raw.endsWith('%') ? raw.slice(0, -1).trim() : raw;
  const parsed = Number(clean.replace(',', '.'));

  if (!Number.isFinite(parsed))
  {
    return undefined;
  }

  const opacity = parsed > 1 ? (parsed / 100) : parsed;

  return Math.max(0, Math.min(1, opacity));
}

/**
 * 关闭来电系统通知
 */
function closeNotice()
{
  if (callNotice)
  {
    callNotice.close();
    callNotice = null;
  }
}

/**
 * 显示来电系统通知（Browser Notification API）
 *
 * @param {string} mode - 呼叫模式: 'audio' | 'video'
 * @param {string} fromNo - 主叫号码
 */
async function showNotice(mode, fromNo)
{
  if (typeof window === 'undefined' || !('Notification' in window))
  {
    if (!noticeWarned)
    {
      noticeWarned = true;
      setStatus('当前浏览器不支持系统通知');
    }

    return;
  }

  const title = `收到${mode === 'video' ? '视频' : '音频'}呼叫`;
  const body = fromNo ? `来自 ${fromNo}，点击返回页面处理` : '点击返回页面处理';

  const show = () =>
  {
    try
    {
      closeNotice();
      callNotice = new Notification(title, {
        body,
        tag                : 'crtc-incoming-call',
        renotify           : true,
        requireInteraction : true,
        icon               : './imgs/logo.svg'
      });

      callNotice.onclick = function()
      {
        window.focus();
        closeNotice();
      };
    }
    catch (error)
    {
      setStatus(`系统通知失败: ${error.message || error}`);
    }
  };

  if (Notification.permission === 'granted')
  {
    show();

    return;
  }

  if (Notification.permission === 'default')
  {
    try
    {
      const permission = await Notification.requestPermission();

      permission === 'granted' && show();
    }
    catch (error)
    {
      setStatus(`系统通知授权失败: ${error.message || error}`);
    }
  }
}

/**
 * 更新摄像头和麦克风下拉列表
 */
async function loadDevices()
{
  await CRTC.Utils.getCameras()
    .then((cameras) =>
    {
      hasCamera = cameras.length > 0;
      let option = '<option selected value="">切换摄像头</option>';

      cameras.forEach((device) =>
      {
        option += `<option value="${device.deviceId}">${device.label}</option>`;
      });

      document.querySelector('#cameras').innerHTML = option;
    });

  await CRTC.Utils.getMicrophones()
    .then((microphones) =>
    {
      let menus = '<option selected value="">切换麦克风</option>';

      microphones.forEach((device) =>
      {
        menus += `<option value="${device.deviceId}">${device.label}</option>`;
      });

      document.querySelector('#mics').innerHTML = menus;
    });
}

/**
 * 检查两个 MediaStream 是否拥有相同的轨道集合
 *
 * @param {MediaStream} stream - 待比较的媒体流
 * @param {MediaStreamTrack[]} tracks - 目标轨道数组
 * @returns {boolean} 轨道集合完全相同时返回 true
 */
function sameTracks(stream, tracks)
{
  if (!(stream instanceof MediaStream))
  {
    return false;
  }

  const current = stream.getTracks();

  if (current.length !== tracks.length)
  {
    return false;
  }

  return current.every((track, index) => track === tracks[index]);
}

/**
 * 仅在流发生变化时更新媒体元素的 srcObject
 *
 * @param {HTMLMediaElement} el - video 或 audio 元素
 * @param {MediaStream} stream - 目标媒体流
 * @returns {boolean} 是否执行了更新
 */
function setMedia(el, stream)
{
  if (!el)
  {
    return false;
  }

  const tracks = stream instanceof MediaStream ? stream.getTracks() : [];

  if (stream instanceof MediaStream && sameTracks(el.srcObject, tracks))
  {
    return false;
  }

  el.srcObject = stream || null;

  return true;
}

/**
 * 监听媒体轨结束事件；浏览器不支持事件监听时直接忽略。
 *
 * @param {MediaStreamTrack} track - 要监听的媒体轨
 * @param {Function} listener - 轨结束时执行的回调
 */
function onTrackEnd(track, listener)
{
  if (track && track.addEventListener)
  {
    track.addEventListener('ended', listener, { once: true });
  }
}

// =============================================================================
// 共享画面与白板通用浮层
// =============================================================================

/**
 * 展示本端/远端屏幕共享或独立共享白板。点对点与三方模式共用同一组页面节点。
 *
 * @param {'local'|'remote'|'whiteboard'} mode - 当前展示的共享来源或共享白板
 */
function openShareBox(mode)
{
  const dialog = document.querySelector('#crtcMediaDialog');
  const restore = document.querySelector('#shareRestore');
  const local = document.querySelector('#screen');
  const remote = document.querySelector('#shareVid');
  const title = document.querySelector('#shareTitle');
  const subtitle = document.querySelector('#shareSub');
  const icon = document.querySelector('#shareIcon i');

  if (!dialog)
  {
    return;
  }

  dialog.dataset.mode = mode;
  dialog.classList.remove('hide');
  if (restore)
  {
    restore.classList.add('hide');
    restore.textContent = mode === 'whiteboard' ? '打开共享白板' : '打开屏幕共享';
  }
  if (local) local.classList.toggle('hide', mode !== 'local');
  if (remote) remote.classList.toggle('hide', mode !== 'remote');
  if (title)
  {
    title.textContent = mode === 'whiteboard' ? '共享白板' :
      (mode === 'local' ? '本端屏幕共享' : '远端屏幕共享');
  }
  if (subtitle)
  {
    subtitle.textContent = mode === 'whiteboard' ? '独立协作画布 · 标注内容实时同步' :
      '共享画面预览与实时标注';
  }
  if (icon)
  {
    icon.className = mode === 'whiteboard' ? 'bi bi-pencil-square' : 'bi bi-display';
  }
  if (typeof setInkMode === 'function') setInkMode(mode);
}

/**
 * 临时隐藏屏幕共享浮层，保留当前共享来源以便恢复。
 */
function minShareBox()
{
  const dialog = document.querySelector('#crtcMediaDialog');
  const restore = document.querySelector('#shareRestore');

  if (dialog) dialog.classList.add('hide');
  if (restore) restore.classList.remove('hide');
}

/**
 * 关闭屏幕共享浮层。
 *
 * @param {'local'|'remote'|'whiteboard'} [mode] - 仅关闭指定来源；省略时无条件关闭
 */
function closeShareBox(mode)
{
  const dialog = document.querySelector('#crtcMediaDialog');
  const restore = document.querySelector('#shareRestore');

  if (!dialog || (mode && dialog.dataset.mode && dialog.dataset.mode !== mode))
  {
    return;
  }

  dialog.classList.add('hide');
  dialog.dataset.mode = '';
  if (restore) restore.classList.add('hide');
  if (typeof setInkMode === 'function') setInkMode('');
}

/**
 * 检测远端设备的操作系统类型
 *
 * @param {object} request - SIP 请求/响应对象
 * @returns {'ios' | 'android' | 'unknown'}
 */
function getRemoteOs(request)
{
  if (!request || typeof request.getHeader !== 'function')
  {
    return 'unknown';
  }

  const agent = request.getHeader('User-Agent') || '';
  const server = request.getHeader('Server') || '';
  const text = `${agent} ${server}`.toLowerCase();

  if (!agent && !server)
  {
    return 'unknown';
  }

  if (
    text.includes('ios') ||
    text.includes('iphone')
  )
  {
    return 'ios';
  }

  return 'android';
}
