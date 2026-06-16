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

// 会话外的摄像头切换仅记录选择，实际切换在新呼叫发起时生效
document.querySelector('#cameras').addEventListener('change', function()
{
  selectCamera = this.options[this.selectedIndex].value;
  setStatus(`select camera ${this.options[this.selectedIndex].innerText}`);
});

// 会话外的麦克风切换仅记录选择，实际切换在新呼叫发起时生效
document.querySelector('#mics').addEventListener('change', function()
{
  selectMic = this.options[this.selectedIndex].value;
  setStatus(`select mic ${this.options[this.selectedIndex].innerText}`);
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
