/* eslint-disable max-len */
/* eslint-disable no-console */
/* eslint-disable no-undef */

// =============================================================================
// 页面级 UI 事件绑定
// =============================================================================

// ---- 模式选择 ----
// 用户点击"点对点"或"三方"按钮后，通过 initMode 创建 UA 并启动。
// 模式一旦选定不可切换（需刷新页面重新选择）。

document.querySelector('#initP2p').onclick = function()
{
  initMode('point-to-point');
};

document.querySelector('#initConf').onclick = function()
{
  initMode('conference');
};

// 白板和屏幕标注按钮、Konva Stage 由独立模块初始化。屏幕共享开始后不会自动
// 抢占鼠标，用户需在共享浮层中点击“开启标注”。
initInk();

// ---- 屏幕共享浮层控制 ----
// 点对点与三方模式共用屏幕共享浮层，页面级按钮统一在此绑定。
// 关闭按钮调用 minShareBox（隐藏浮层，保留恢复按钮）。
// 恢复按钮读取 dialog.dataset.mode 恢复之前的状态。

document.querySelector('#shareClose').onclick = minShareBox;
document.querySelector('#shareRestore').onclick = function()
{
  const dialog = document.querySelector('#crtcMediaDialog');

  if (dialog && dialog.dataset.mode)
  {
    openShareBox(dialog.dataset.mode);
  }
};

// ---- 三方会议控制按钮 ----
// 三方会议静态按钮只负责调用会议模块公开给 Demo 的操作函数。
// 按钮的禁用/启用状态由 updateConfUi() 统一管理。

// "添加成员"：根据当前会议状态自动分配 B 或 C 角色
document.querySelector('#confCall').onclick = function()
{
  const role = getNextRole();

  callConf({ role }).catch((error) => setStatus(`会议呼叫失败：${error.message || error}`));
};

// "静默呼叫 A"：点对点模式下以静默 C 身份接入
document.querySelector('#confSilent').onclick = function()
{
  callSilentC().catch((error) => setStatus(`静默接入呼叫失败：${error.message || error}`));
};

// "接听来电"：仅在有待接听的会议来电时可用
document.querySelector('#confAnswer').onclick = answerConf;
document.querySelector('#confHangup').onclick = endConf;

document.querySelector('#confShare').onclick = function()
{
  shareConf()
    .then(updateConfUi)
    .catch((error) => setStatus(`会议屏幕共享失败：${error.message || error}`));
};

document.querySelector('#confUnshare').onclick = function()
{
  unshareConf()
    .then(updateConfUi)
    .catch((error) => setStatus(`停止会议屏幕共享失败：${error.message || error}`));
};

updateConfUi();

// 主动注册：初始化时会自动注册，该按钮用于主动注销后重新注册。
document.querySelector('#regUa').onclick = function()
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
  regState = 'registering';
  updateMode();
  ua.register();
};

// 主动注销：注销 SIP 注册但保留 WSS 连接，可再次点击“主动注册”。
document.querySelector('#unregUa').onclick = function()
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
document.querySelector('#b2bVideo').onclick = function()
{
  b2bReq({
    url    : 'https://pro.vsbc.com:5085/b2b/tapi/v1/getInCallIdStr',
    method : 'POST',
    secret : '1qaz2wsx3edc4rfv5tgb6yhn7ujm8iko1qaz2wsx3edc4rfv5tgb6yhn7ujm8ikp',

    body : { 'caller': document.querySelector('#callee').value }
  })
    .then((callId) =>
    {
      console.warn('cid: ', callId);

      return b2bReq({
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
document.querySelector('#b2bVideoSend').onclick = function()
{
  b2bReq({
    url    : 'https://pro.vsbc.com:5085/b2b/tapi/v1/getInCallIdStr',
    method : 'POST',
    secret : '1qaz2wsx3edc4rfv5tgb6yhn7ujm8iko1qaz2wsx3edc4rfv5tgb6yhn7ujm8ikp',

    body : { 'caller': document.querySelector('#callee').value }
  })
    .then((callId) =>
    {
      console.warn('cid: ', callId);

      return b2bReq({
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
document.querySelector('#callVideoSend').onclick = function()
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
    closeNotice();
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

  cameraId = deviceId;

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

  micId = deviceId;

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
  // loadDevices();
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
document.querySelector('#vbMode').addEventListener('change', function()
{
  changeVb(this).catch((error) =>
  {
    console.warn('virtual background change error', error);
    setStatus(`虚拟背景切换失败：${error && error.message ? error.message : error}`);
  });
});

document.querySelector('#fxMirror').addEventListener('change', function()
{
  setMirror().catch((error) =>
  {
    console.warn('output mirror change error', error);
    setStatus(`输出镜像切换失败：${error && error.message ? error.message : error}`);
  });
});

// AiNS 开关变化时：
// 1. 更新当前模式
// 2. 提示当前状态
document.querySelector('#nsMode').addEventListener('change', function()
{
  // 保存当前下拉框值，供构建呼叫参数复用
  aiNsType = this.value;

  // 先提示当前模式
  if (aiNsType === 'AiNS')
  {
    setStatus(`AI 降噪强度已设为 ${getNsLevel()}，将在下一次呼叫/接听时生效`);
  }
  else
  {
    setStatus('AI 降噪已关闭');
  }
});

// AiNS 强度变化时：
// 1. 先把输入值整理到 0-100
// 2. 如果当前通话已经开了 AiNS，就直接动态生效
document.querySelector('#nsLevel').addEventListener('change', function()
{
  // 先把输入整理成 SDK 期望的合法范围
  const nextLevel = normNsLevel(this.value);

  // 再把规范化后的值回写到输入框
  this.value = nextLevel;

  // 只有 AiNS 开启时，才需要提示和应用这个强度
  if (aiNsType === 'AiNS')
  {
    // 已经在通话里并且拿到了 AiNS 实例，就直接热更新
    if (setNsLevel(nextLevel))
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

document.querySelector('#textMarkSet').onclick = async function()
{
  await setTextMark();
};

document.querySelector('#textMarkClear').onclick = async function()
{
  await clearTextMark();
};

document.querySelector('#imgMarkSet').onclick = async function()
{
  await setImageMark();
};

document.querySelector('#imgMarkClear').onclick = async function()
{
  await clearImgMark();
};
