/* eslint-disable max-len */
/* eslint-disable no-console */
/* eslint-disable no-undef */

// =============================================================================
// 页面级 UI 事件绑定
// =============================================================================

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

  if (typeof syncMetaHumanMicSelection === 'function')
  {
    syncMetaHumanMicSelection(deviceId);
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
  ua.stop();
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

  if (typeof applyCurrentAiNsToMetaHuman === 'function' && applyCurrentAiNsToMetaHuman())
  {
    setStatus('当前数字人连接的 AI 降噪已同步更新');
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
    const appliedToMetaHuman = typeof applyCurrentAiNsToMetaHuman === 'function' &&
      applyCurrentAiNsToMetaHuman();

    // 已经在通话里并且拿到了 AiNS 实例，就直接热更新
    if (applyAiNsLevelToCurrentCall(nextLevel))
    {
      setStatus(`AI 降噪强度已设为 ${nextLevel}，已应用到当前通话`);
    }
    else if (appliedToMetaHuman)
    {
      setStatus(`AI 降噪强度已设为 ${nextLevel}，已应用到当前数字人连接`);
    }
    else
    {
      // 否则提示它会在下次通话时生效
      setStatus(`AI 降噪强度已设为 ${nextLevel}，将在下一次呼叫/接听时生效`);
    }
  }
});

// 数字人预览区的输出增益变化时，直接调用当前 AiNS 实例热更新。
const aiNoiseOutputGainInput = document.querySelector('#aiNoiseOutputGain');

// 手动输入超过范围时立即钳位，避免输入框暂存无效增益。
aiNoiseOutputGainInput.addEventListener('input', function()
{
  if (this.value === '')
  {
    return;
  }

  const parsedGain = Number(this.value);

  if (Number.isFinite(parsedGain) && (parsedGain < 0 || parsedGain > 4))
  {
    this.value = normalizeAiNsOutputGain(parsedGain);
  }
});

aiNoiseOutputGainInput.addEventListener('change', function()
{
  const nextGain = normalizeAiNsOutputGain(this.value);

  this.value = nextGain;

  const appliedToCall = applyAiNsOutputGainToCurrentCall(nextGain);
  const appliedToMetaHuman = typeof applyAiNsOutputGainToMetaHuman === 'function' &&
    applyAiNsOutputGainToMetaHuman(nextGain);

  if (appliedToCall && appliedToMetaHuman)
  {
    setStatus(`AI 降噪输出增益已设为 ${nextGain}，已应用到当前通话和数字人连接`);
  }
  else if (appliedToCall)
  {
    setStatus(`AI 降噪输出增益已设为 ${nextGain}，已应用到当前通话`);
  }
  else if (appliedToMetaHuman)
  {
    setStatus(`AI 降噪输出增益已设为 ${nextGain}，已应用到当前数字人连接`);
  }
  else
  {
    setStatus(`AI 降噪输出增益已设为 ${nextGain}，将在下次启用时生效`);
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


