/* Demo 页面事件统一绑定入口。
 *
 * 本文件负责将页面 UI 按钮（呼叫、接听、挂断、设备切换、模式选择等）
 * 绑定到 SDK API 调用。事件处理逻辑本身在 app-call.js、app-conference.js
 * 和 app-effects.js 中实现，这里只做桥接。
 *
 * 核心职责：
 * 1. 模式选择：点对点 / 三方
 * 2. 呼叫按钮：标准呼叫、B2B 呼叫、屏幕共享呼叫、无音视频呼叫等
 * 3. 设备切换：摄像头、麦克风热切换
 * 4. 会议控制：添加成员、静默接入、接听、挂断
 * 5. 媒体效果：虚拟背景、镜像、AI 降噪、水印
 * 6. 页面生命周期：可见性变化、卸载时优雅退出
 */
/* eslint-disable max-len */
/* eslint-disable no-console */
/* eslint-disable no-undef */

// =============================================================================
// 页面级 UI 事件绑定
// =============================================================================

// =============================================================================
// 模式选择
//
// 用户点击"点对点"或"三方"按钮后，通过 initMode 创建 UA 并启动。
// 模式一旦选定不可切换（需刷新页面重新选择）。
// =============================================================================

/**
 * 点对点模式：A ↔ B 一对一通话。
 * SDK 的 newRTCSession 事件由 onSession() 处理。
 */
document.querySelector('#initP2p').onclick = function()
{
  initMode('point-to-point');
};

/**
 * 三方会议模式：A 作为桥接端同时与 B、C 建立两路通话。
 * SDK 的 newRTCSession 事件由 onConfSession() 处理。
 */
document.querySelector('#initConf').onclick = function()
{
  initMode('conference');
};

// =============================================================================
// 屏幕共享浮层控制
//
// 点对点与三方模式共用屏幕共享浮层，页面级按钮统一在此绑定。
// - 关闭按钮：调用 minShareBox()（隐藏浮层，保留恢复按钮）
// - 恢复按钮：读取 dialog.dataset.mode 恢复之前的共享状态
// =============================================================================

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
document.querySelector('#confAnswer').onclick = function()
{
  answerLeg().catch((error) => setStatus(`会议接听失败：${error.message || error}`));
};
document.querySelector('#confHangup').onclick = endConf;

document.querySelector('#confShare').onclick = function()
{
  shareConf()
    .catch((error) => setStatus(`会议屏幕共享失败：${error.message || error}`));
};

document.querySelector('#confUnshare').onclick = function()
{
  unshareConf()
    .catch((error) => setStatus(`停止会议屏幕共享失败：${error.message || error}`));
};

// =============================================================================
// 主动注册 / 注销
//
// 初始化时会自动注册，按钮用于主动注销后重新注册。
// - 主动注册：仅当 UA 已连接且未注册时可用
// - 主动注销：注销 SIP 注册但保留 WSS 连接
// =============================================================================

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

// =============================================================================
// 点对点呼叫按钮
//
// 提供多种呼叫模式供演示：
// - callnull / callnullaudio / callnullvideo：无音视频占位呼叫（测试协商兼容性）
// - call：标准音频呼叫
// - callVideo：标准视频呼叫
// - callScreen：屏幕共享呼叫
// - callVideoSend / b2bVideo / b2bVideoSend：纯视频 / B2B 场景
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

/**
 * 页面可见性变化处理。
 *
 * 进入后台时仅打印日志；回到前台时关闭来电系统通知，
 * 避免用户已返回页面但通知仍然悬挂。
 */
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

/**
 * 恢复所有 video 元素的播放。
 *
 * Chrome 等浏览器自动播放策略可能导致视频暂停（尤其在页面不可见时），
 * 点击此按钮可批量恢复所有 video 元素的播放。
 */
// 恢复所有视频播放
document.querySelector('.resume').onclick = function()
{
  document.querySelectorAll('video').forEach((video) => video.play().catch());
};

/**
 * 音视频升级策略选择。
 *
 * 控制 mute/unmute 音视频时使用 SIP UPDATE 还是 re-INVITE：
 * - 'update'：使用 UPDATE 方法，轻量级，不重新协商 SDP
 * - 其他值（默认）：使用 re-INVITE，重新协商 SDP
 *
 * 该选项在通话建立后通过 rtcSession 的配置生效。
 */
// 控制音视频切换时使用 update 还是 reInvite
document.querySelector('#useupdate').onchange = function()
{
  this.options[this.selectedIndex].value !== 'update' ? useUpdate = false : useUpdate = true;
  console.log(this.options[this.selectedIndex]);
  setStatus(`${this.options[this.selectedIndex].value === 'update' ? 'useUpdate' : 'useReInvite'}`);
};

/**
 * 页面卸载前优雅退出。
 *
 * 设置 handleStop 标记（防止误判断网），然后调用 ua.stop() 终止 UA：
 * - 关闭 WebSocket 信令连接
 * - 终止所有活跃的 RTCSession（发送 BYE）
 * - 释放所有设备权限和媒体资源
 *
 * 注意：浏览器限制 beforeunload 中的异步操作，建议使用同步清理。
 */
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
  document.getElementById('textMarkText').value = '';
  document.getElementById('textMarkSize').value = '';
  document.getElementById('textMarkAlpha').value = '';
  await setTextMark();
};

document.querySelector('#imgMarkSet').onclick = async function()
{
  await setImageMark();
};

document.querySelector('#imgMarkClear').onclick = async function()
{
  document.getElementById('imgMarkUrl').value = '';
  document.getElementById('imgMarkW').value = '';
  document.getElementById('imgMarkH').value = '';
  document.getElementById('imgMarkAlpha').value = '';
  await setImageMark();
};
