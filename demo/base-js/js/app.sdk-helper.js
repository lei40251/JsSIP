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
function getStreams(pc)
{
  const localStream = CRTC.Utils.getStreams(pc, 'local');
  const remoteStream = CRTC.Utils.getStreams(pc, 'remote');

  const audioTrack = localStream.audioStream.getAudioTracks().length > 0 ? localStream.audioStream.getAudioTracks()[0] : null;
  const videoTrack = (localStream.videoStream.getVideoTracks().length > 0) ? localStream.videoStream.getVideoTracks()[0] : null;
  const mediaStreamArray = [];

  let newCloneStream;

  if (videoTrack)
  {
    mediaStreamArray.push(videoTrack);
  }
  else if (audioTrack)
  {
    mediaStreamArray.push(audioTrack);
  }

  if (mediaStreamArray.length > 0)
  {
    newCloneStream = new MediaStream(mediaStreamArray);

    if (bindMediaStreamIfChanged(localVideo, newCloneStream))
    {
      newCloneStream.getTracks().length > 0 && newCloneStream.getTracks()[0].addEventListener('ended', function()
      {
        localVideo.srcObject = null;
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

  newCloneStream && (cloneStream = newCloneStream);

  setTimeout(() =>
  {
    bindMediaStreamIfChanged(remoteAudio, remoteStream.audioStream);

    remoteAudio.play()
      .catch(() => { });
  }, 100);

  if (bindMediaStreamIfChanged(remoteVideo, remoteStream.mediaStream))
  {
    remoteStream.videoStream.getVideoTracks().length > 0 && remoteStream.videoStream.getVideoTracks()[0].addEventListener('ended', function()
    {
      if (!tmpSession)
      {
        remoteVideo.srcObject = null;
      }
    });
  }

  Promise.all([ localVideo.play(), remoteAudio.play(), remoteVideo.play() ])
    .then(() => { })
    .catch(() => { });
}

/**
 * 停止所有媒体流渲染
 */
function stopStreams()
{
  remoteVideo.srcObject = null;
  remoteAudio.srcObject = null;
  localVideo.srcObject = null;
}

/**
 * 从 URL 查询参数中提取值
 *
 * @param {string} name - 参数名（区分大小写）
 * @returns {string|null} 参数值，不存在时返回 null
 */
function handleGetQuery(name)
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
  const statusDom = document.querySelector('#status');

  statusDom.innerText = `${statusDom.innerText}${text}\r\n`;
  statusDom.scrollTop = statusDom.scrollHeight;
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
function normalizeAiNsReductionLevel(value)
{
  const parsedLevel = parseInt(value, 10);

  if (Number.isNaN(parsedLevel))
  {
    return 80;
  }

  return Math.max(0, Math.min(100, parsedLevel));
}

/**
 * 从页面读取当前 AI 降噪强度。
 * 这里只负责从输入框取值并做归一化，方便媒体效果模块直接复用。
 *
 * @returns {number} 当前页面上的合法降噪强度
 */
function getCurrentAiNsLevel()
{
  const levelInput = document.querySelector('#aiNoiseReductionLevel');
  const currentValue = levelInput ? levelInput.value : '';

  return normalizeAiNsReductionLevel(currentValue);
}

/**
 * 构建当前选中麦克风对应的音频采集约束。
 * 呼出、接听和音视频升级应复用同一设备选择结果。
 *
 * @returns {MediaTrackConstraints} 音频采集约束
 */
function buildSelectedAudioConstraints()
{
  const constraints = {
    sampleRate   : 48000,
    channelCount : 1
  };

  if (selectMic)
  {
    constraints.deviceId = { exact: selectMic };
  }

  return constraints;
}

/**
 * 构建当前选中摄像头对应的视频采集约束。
 *
 * @returns {MediaTrackConstraints} 视频采集约束
 */
function buildSelectedVideoConstraints()
{
  const constraints = Object.assign({}, videoConstraints);

  if (selectCamera)
  {
    constraints.deviceId = { exact: selectCamera };
  }

  return constraints;
}

/**
 * 把透明度输入框的值统一转成 0-1。
 * 支持：
 * 1. 小数写法，例如 0.8
 * 2. 百分比写法，例如 80%
 *
 * @param {HTMLInputElement} inputEl - 透明度输入框
 * @returns {number|undefined} 归一化后的透明度，空值或非法值时返回 undefined
 */
function readCallMediaEffectsComposerOpacity(inputEl)
{
  const raw = String(inputEl.value).trim();

  if (!raw)
  {
    return undefined;
  }

  const normalized = raw.endsWith('%') ? raw.slice(0, -1).trim() : raw;
  const parsed = Number(normalized.replace(',', '.'));

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
function closeIncomingCallNotification()
{
  if (incomingCallNotification)
  {
    incomingCallNotification.close();
    incomingCallNotification = null;
  }
}

/**
 * 显示来电系统通知（Browser Notification API）
 *
 * @param {string} mode - 呼叫模式: 'audio' | 'video'
 * @param {string} fromNo - 主叫号码
 */
async function showIncomingCallNotification(mode, fromNo)
{
  if (typeof window === 'undefined' || !('Notification' in window))
  {
    if (!notificationUnsupportedLogged)
    {
      notificationUnsupportedLogged = true;
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
      closeIncomingCallNotification();
      incomingCallNotification = new Notification(title, {
        body,
        tag                : 'crtc-incoming-call',
        renotify           : true,
        requireInteraction : true,
        icon               : './imgs/logo.svg'
      });

      incomingCallNotification.onclick = function()
      {
        window.focus();
        closeIncomingCallNotification();
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
 * 检查摄像头可用性
 *
 * @returns {Promise<string>} 描述摄像头状态的文本
 */
async function checkCameraStatus()
{
  try
  {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((device) => device.kind === 'videoinput');

    if (videoDevices.length === 0)
    {
      return '系统没有摄像头';
    }

    await navigator.mediaDevices.getUserMedia({ video: true }).then(async(mediastream) =>
    {
      CRTC.Utils.closeMediaStream(mediastream);
    });
    haveACamera = true;

    return '摄像头可以正常使用';
  }
  catch (error)
  {
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError')
    {
      return '系统没有摄像头';
    }
    else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')
    {
      return '用户拒绝了摄像头权限';
    }
    else
    {
      return `摄像头错误: ${error.name}`;
    }
  }
}

/**
 * 更新摄像头和麦克风下拉列表
 */
async function updateDevices()
{
  await CRTC.Utils.getCameras()
    .then((cameras) =>
    {
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
function hasSameTrackSet(stream, tracks)
{
  if (!(stream instanceof MediaStream))
  {
    return false;
  }

  const currentTracks = stream.getTracks();

  if (currentTracks.length !== tracks.length)
  {
    return false;
  }

  return currentTracks.every((track, index) => track === tracks[index]);
}

/**
 * 仅在流发生变化时更新媒体元素的 srcObject
 *
 * @param {HTMLMediaElement} mediaEl - video 或 audio 元素
 * @param {MediaStream} stream - 目标媒体流
 * @returns {boolean} 是否执行了更新
 */
function bindMediaStreamIfChanged(mediaEl, stream)
{
  if (!mediaEl)
  {
    return false;
  }

  const nextTracks = stream instanceof MediaStream ? stream.getTracks() : [];

  if (stream instanceof MediaStream && hasSameTrackSet(mediaEl.srcObject, nextTracks))
  {
    return false;
  }

  mediaEl.srcObject = stream || null;

  return true;
}

// =============================================================================
// 屏幕共享通用浮层
// =============================================================================

/**
 * 展示本端或远端屏幕共享。点对点与三方模式共用同一组页面节点。
 *
 * @param {'local'|'remote'} mode - 当前展示的共享来源
 */
function openScreenShareDialog(mode)
{
  const dialog = document.querySelector('#screenShareDialog');
  const restoreButton = document.querySelector('#screenShareDialogRestore');
  const localScreen = document.querySelector('#screen');
  const remoteScreen = document.querySelector('#remoteVideo2');
  const title = document.querySelector('#screenShareDialogTitle');

  if (!dialog)
  {
    return;
  }

  dialog.dataset.mode = mode;
  dialog.classList.remove('hide');
  if (restoreButton) restoreButton.classList.add('hide');
  if (localScreen) localScreen.classList.toggle('hide', mode !== 'local');
  if (remoteScreen) remoteScreen.classList.toggle('hide', mode !== 'remote');
  if (title) title.textContent = mode === 'local' ? '本端屏幕共享' : '远端屏幕共享';
}

/**
 * 临时隐藏屏幕共享浮层，保留当前共享来源以便恢复。
 */
function minimizeScreenShareDialog()
{
  const dialog = document.querySelector('#screenShareDialog');
  const restoreButton = document.querySelector('#screenShareDialogRestore');

  if (dialog) dialog.classList.add('hide');
  if (restoreButton) restoreButton.classList.remove('hide');
}

/**
 * 关闭屏幕共享浮层。
 *
 * @param {'local'|'remote'} [mode] - 仅关闭指定来源；省略时无条件关闭
 */
function closeScreenShareDialog(mode)
{
  const dialog = document.querySelector('#screenShareDialog');
  const restoreButton = document.querySelector('#screenShareDialogRestore');

  if (!dialog || (mode && dialog.dataset.mode && dialog.dataset.mode !== mode))
  {
    return;
  }

  dialog.classList.add('hide');
  dialog.dataset.mode = '';
  if (restoreButton) restoreButton.classList.add('hide');
}

/**
 * 检测远端设备的操作系统类型
 *
 * @param {object} request - SIP 请求/响应对象
 * @returns {'ios' | 'android' | 'unknown'}
 */
function detectRemoteOS(request)
{
  if (!request || typeof request.getHeader !== 'function')
  {
    return 'unknown';
  }

  const userAgent = request.getHeader('User-Agent') || '';
  const server = request.getHeader('Server') || '';
  const headerText = `${userAgent} ${server}`.toLowerCase();

  if (!userAgent && !server)
  {
    return 'unknown';
  }

  if (
    headerText.includes('ios') ||
    headerText.includes('iphone')
  )
  {
    return 'ios';
  }

  return 'android';
}
