/* eslint-disable max-len */
/* eslint-disable no-console */
/* eslint-disable no-undef */

// =============================================================================
// 页面级 UI 事件绑定
// =============================================================================

// ---- 模式选择 ----
// 用户点击"点对点"或"三方"按钮后，通过 initializeDemoMode 创建 UA 并启动。
// 模式一旦选定不可切换（需刷新页面重新选择）。

document.querySelector('#initializePointToPoint').onclick = function()
{
  initializeDemoMode('point-to-point');
};

document.querySelector('#initializeConference').onclick = function()
{
  initializeDemoMode('conference');
};

// ---- 屏幕共享浮层控制 ----
// 点对点与三方模式共用屏幕共享浮层，页面级按钮统一在此绑定。
// 关闭按钮调用 minimizeScreenShareDialog（隐藏浮层，保留恢复按钮）。
// 恢复按钮读取 dialog.dataset.mode 恢复之前的状态。

document.querySelector('#screenShareDialogClose').onclick = minimizeScreenShareDialog;
document.querySelector('#screenShareDialogRestore').onclick = function()
{
  const dialog = document.querySelector('#screenShareDialog');

  if (dialog && dialog.dataset.mode)
  {
    openScreenShareDialog(dialog.dataset.mode);
  }
};

// ---- 三方会议控制按钮 ----
// 三方会议静态按钮只负责调用会议模块公开给 Demo 的操作函数。
// 按钮的禁用/启用状态由 updateConferenceUi() 统一管理。

// "添加成员"：根据当前会议状态自动分配 B 或 C 角色
document.querySelector('#conferenceCallVideo').onclick = function()
{
  const role = getConferenceNextRole();

  callConferenceVideo({ role }).catch((error) => setStatus(`会议呼叫失败：${error.message || error}`));
};

// "静默呼叫 A"：点对点模式下以静默 C 身份接入
document.querySelector('#conferenceSilentJoin').onclick = function()
{
  callConferenceAsSilentC().catch((error) => setStatus(`静默接入呼叫失败：${error.message || error}`));
};

// "接听来电"：仅在有待接听的会议来电时可用
document.querySelector('#conferenceAnswerVideo').onclick = answerPendingConferenceVideo;
document.querySelector('#conferenceHangupAll').onclick = terminateConference;

document.querySelector('#conferenceStartScreen').onclick = function()
{
  startConferenceScreenShare()
    .then(updateConferenceUi)
    .catch((error) => setStatus(`会议屏幕共享失败：${error.message || error}`));
};

document.querySelector('#conferenceStopScreen').onclick = function()
{
  stopConferenceScreenShare()
    .then(updateConferenceUi)
    .catch((error) => setStatus(`停止会议屏幕共享失败：${error.message || error}`));
};

updateConferenceUi();

// 主动注册：初始化时会自动注册，该按钮用于主动注销后重新注册。
document.querySelector('#registerUa').onclick = function()
{
  if (!ua)
  {
    setStatus('请先选择点对点或三方模式');

    return;
  }
  if (!ua.isConnected())
  {
    setStatus('信令尚未连接，不能注册');

    return;
  }

  if (ua.isRegistered())
  {
    setStatus('当前账号已经注册');

    return;
  }

  setStatus('正在主动注册');
  appRegistrationState = 'registering';
  updateAppModeUi();
  ua.register();
};

// 主动注销：注销 SIP 注册但保留 WSS 连接，可再次点击“主动注册”。
document.querySelector('#unregisterUa').onclick = function()
{
  if (!ua)
  {
    setStatus('请先选择点对点或三方模式');

    return;
  }
  if (!ua.isRegistered())
  {
    setStatus('当前账号尚未注册');

    return;
  }

  setStatus('正在主动注销');
  ua.unregister();
};

// 发起无音视频呼叫（静默音频 + 黑屏视频）
document.querySelector('#callNull').onclick = function()
{
  call('callnull');
};

// 发起无麦克风呼叫（静默音频 + 真实摄像头）
document.querySelector('#callNullAudio').onclick = function()
{
  call('callnullaudio');
};

// 发起无摄像头呼叫（真实麦克风 + 黑屏视频）
document.querySelector('#callNullVideo').onclick = function()
{
  call('callnullvideo');
};

// 发起标准音频呼叫
document.querySelector('#call').onclick = function()
{
  call();
};

// 发起屏幕分享呼叫
document.querySelector('#callScreen').onclick = function()
{
  call('screen');
};

// 发起标准视频呼叫
document.querySelector('#callVideo').onclick = function()
{
  call('video');
};

// B2B 纯视频呼叫（无音频）
document.querySelector('#b2bCallVideoOnly').onclick = function()
{
  request({
    url    : 'https://pro.vsbc.com:5085/b2b/tapi/v1/getInCallIdStr',
    method : 'POST',
    secret : '1qaz2wsx3edc4rfv5tgb6yhn7ujm8iko1qaz2wsx3edc4rfv5tgb6yhn7ujm8ikp',

    body : { 'caller': document.querySelector('#callee').value }
  })
    .then((callId) =>
    {
      console.warn('cid: ', callId);

      return request({
        url    : 'https://pro.vsbc.com:5085/b2b/tapi/v1/status',
        method : 'POST',
        secret : '1qaz2wsx3edc4rfv5tgb6yhn7ujm8iko1qaz2wsx3edc4rfv5tgb6yhn7ujm8ikp',

        body : { 'callId': callId.data.data, 'cmd': 'query' }
      });
    })
    .then(((callNo) =>
    {
      const stat = callNo.data.data.stat.split('&');

      xdata = stat[1];
      callee = stat[0];
      console.warn('call: ', callee);
      videoOnly = true;
      call('onlyVideo');
    }));
};

// B2B 纯视频单向呼叫（仅发送）
document.querySelector('#b2bCallVideoSendonly').onclick = function()
{
  request({
    url    : 'https://pro.vsbc.com:5085/b2b/tapi/v1/getInCallIdStr',
    method : 'POST',
    secret : '1qaz2wsx3edc4rfv5tgb6yhn7ujm8iko1qaz2wsx3edc4rfv5tgb6yhn7ujm8ikp',

    body : { 'caller': document.querySelector('#callee').value }
  })
    .then((callId) =>
    {
      console.warn('cid: ', callId);

      return request({
        url    : 'https://pro.vsbc.com:5085/b2b/tapi/v1/status',
        method : 'POST',
        secret : '1qaz2wsx3edc4rfv5tgb6yhn7ujm8iko1qaz2wsx3edc4rfv5tgb6yhn7ujm8ikp',

        body : { 'callId': callId.data.data, 'cmd': 'query' }
      });
    })
    .then(((callNo) =>
    {
      const stat = callNo.data.data.stat.split('&');

      xdata = stat[1];
      callee = stat[0];
      console.warn('call: ', callee);
      videoOnly = true;
      call('onlyVideo', 'sendonly');
    }));
};

// 发起纯视频呼叫（无音频、双向）
document.querySelector('#callVideoSendonly').onclick = function()
{
  videoOnly = true;
  call('onlyVideo');
};

// 页面可见性变化：回到前台时关闭来电通知
document.addEventListener('visibilitychange', function()
{
  if (document.hidden)
  {
    console.log('页面进入后台');
  }
  else
  {
    closeIncomingCallNotification();
    console.warn('页面回到前台');
  }
});

/**
 * 摄像头切换（页面级统一绑定）
 *
 * 1. 记录用户选择的设备，下次呼叫时生效
 * 2. 如果当前有活跃会话，则立即切换（触发 cameraChanged 事件）
 * 3. 兼容 MCU 等候室：切换前停止旧的克隆视频轨道
 */
document.querySelector('#cameras').addEventListener('change', function()
{
  const deviceId = this.options[this.selectedIndex].value;

  selectCamera = deviceId;

  // 会话内热切换
  if (rtcSession)
  {
    // 清理旧的克隆视频轨道（MCU 等候室兼容）
    if (typeof cloneStream !== 'undefined' && cloneStream)
    {
      cloneStream.getVideoTracks().forEach((v) =>
      {
        v.stop();
      });
    }
    rtcSession.switchDevice('camera', deviceId);
  }

  setStatus(`${rtcSession ? 'switchDevice' : 'select camera'} ${this.options[this.selectedIndex].innerText}`);
});

/**
 * 麦克风切换（页面级统一绑定）
 *
 * 1. 记录用户选择的设备，下次呼叫时生效
 * 2. 如果当前有活跃会话，则立即切换
 */
document.querySelector('#mics').addEventListener('change', function()
{
  const deviceId = this.options[this.selectedIndex].value;

  selectMic = deviceId;

  // 会话内热切换
  if (rtcSession)
  {
    rtcSession.switchDevice('audio', deviceId);
  }

  setStatus(`${rtcSession ? 'switchDevice' : 'select mic'} ${this.options[this.selectedIndex].innerText}`);
});

// 测试按钮：枚举设备信息
document.querySelector('#testBtn').onclick = function()
{
  navigator.mediaDevices.enumerateDevices()
    .then((devices) =>
    {
      const dev = [];

      devices.forEach((device) =>
      {
        dev.push(device);

        if (typeof device.getCapabilities === 'function')
        {
          dev.push(device.getCapabilities());
          console.warn(device);
        }
      });

      document.body.innerText = JSON.stringify(dev);
    });
};

// 恢复所有视频播放
document.querySelector('.resume').onclick = function()
{
  document.querySelectorAll('video').forEach((video) => video.play().catch());
};

// 控制音视频切换时使用 update 还是 reInvite
document.querySelector('#useupdate').onchange = function()
{
  this.options[this.selectedIndex].value !== 'update' ? useUpdate = false : useUpdate = true;
  console.log(this.options[this.selectedIndex]);
  setStatus(`${this.options[this.selectedIndex].value === 'update' ? 'useUpdate' : 'useReInvite'}`);
};

// 设备变化事件（热插拔摄像头/麦克风时触发）
navigator.mediaDevices.addEventListener('devicechange', () =>
{
  // 当前不自动刷新设备列表，可按需开启
  // updateDevices();
});

// 页面卸载时优雅退出：终止所有会话并注销 UA
window.onbeforeunload = function()
{
  handleStop = true;
  if (ua) ua.stop();
};

// =============================================================================
// 媒体效果 UI 绑定
// =============================================================================

// 虚拟背景下拉框变化时：
// 1. 更新全局状态
// 2. 同步到当前通话
document.querySelector('#virtualBackground').addEventListener('change', function()
{
  handleVirtualBackgroundChange(this).catch((error) =>
  {
    console.warn('virtual background change error', error);
    setStatus(`虚拟背景切换失败：${error && error.message ? error.message : error}`);
  });
});

document.querySelector('#callMediaEffectsComposerOutputMirror').addEventListener('change', function()
{
  applyCurrentOutputMirrorToSession().catch((error) =>
  {
    console.warn('output mirror change error', error);
    setStatus(`输出镜像切换失败：${error && error.message ? error.message : error}`);
  });
});

// AiNS 开关变化时：
// 1. 更新当前模式
// 2. 提示当前状态
document.querySelector('#aiNoiseSuppression').addEventListener('change', function()
{
  // 保存当前下拉框值，供构建呼叫参数复用
  aiNsType = this.value;

  // 先提示当前模式
  if (aiNsType === 'AiNS')
  {
    setStatus(`AI 降噪强度已设为 ${getCurrentAiNsLevel()}，将在下一次呼叫/接听时生效`);
  }
  else
  {
    setStatus('AI 降噪已关闭');
  }
});

// AiNS 强度变化时：
// 1. 先把输入值整理到 0-100
// 2. 如果当前通话已经开了 AiNS，就直接动态生效
document.querySelector('#aiNoiseReductionLevel').addEventListener('change', function()
{
  // 先把输入整理成 SDK 期望的合法范围
  const nextLevel = normalizeAiNsReductionLevel(this.value);

  // 再把规范化后的值回写到输入框
  this.value = nextLevel;

  // 只有 AiNS 开启时，才需要提示和应用这个强度
  if (aiNsType === 'AiNS')
  {
    // 已经在通话里并且拿到了 AiNS 实例，就直接热更新
    if (applyAiNsLevelToCurrentCall(nextLevel))
    {
      setStatus(`AI 降噪强度已设为 ${nextLevel}，已应用到当前通话`);
    }
    else
    {
      // 否则提示它会在下次通话时生效
      setStatus(`AI 降噪强度已设为 ${nextLevel}，将在下一次呼叫/接听时生效`);
    }
  }
});

document.querySelector('#applyCurrentTextWatermark').onclick = async function()
{
  await applyCurrentTextWatermarkToSession();
};

document.querySelector('#clearCurrentTextWatermark').onclick = async function()
{
  await clearCurrentTextWatermarkFromSession();
};

document.querySelector('#applyCurrentImageWatermark').onclick = async function()
{
  await applyCurrentImageWatermarkToSession();
};

document.querySelector('#clearCurrentImageWatermark').onclick = async function()
{
  await clearCurrentImageWatermarkFromSession();
};
