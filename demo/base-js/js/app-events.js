/* Demo 页面事件统一绑定入口。
 *
 * 本文件负责静态页面控件的集中绑定，便于接入方快速查找
 * UI 操作对应的功能入口。具体处理由 app-call.js、app-b2b.js、
 * app-conference.js、app-effects.js 和 app-helper.js 中的具名函数实现。
 *
 * 依赖当前 RTCSession 或会议成员的动态控件，仍由 app-call.js 和
 * app-conference.js 在会话建立或成员切换时绑定。
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
document.querySelector('#shareRotate').onclick = toggleShareRotation;
document.querySelector('#shareRestore').onclick = restoreShareBox;

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
document.querySelector('#regUa').onclick = registerUa;

// 主动注销：注销 SIP 注册但保留 WSS 连接，可再次点击“主动注册”。
document.querySelector('#unregUa').onclick = unregisterUa;

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
  callB2bVideo();
};

// B2B 纯视频单向呼叫（仅发送）
document.querySelector('#b2bVideoSend').onclick = function()
{
  callB2bVideo('sendonly');
};

// 发起纯视频呼叫（无音频、双向）
document.querySelector('#callVideoSend').onclick = function()
{
  callVideoOnly();
};

// =============================================================================
// 设备、通话选项与页面生命周期
// =============================================================================

// 页面可见性变化：回到前台时关闭来电通知。
document.addEventListener('visibilitychange', handleVisibilityChange);

/**
 * 摄像头选择交给通话模块处理：未通话时保存选择，通话中热切换设备。
 */
document.querySelector('#cameras').addEventListener('change', function()
{
  changeCamera(this);
});

/**
 * 麦克风选择交给通话模块处理：未通话时保存选择，通话中热切换设备。
 */
document.querySelector('#mics').addEventListener('change', function()
{
  changeMic(this);
});

// 恢复所有视频播放。
document.querySelector('.resume').onclick = resumeVideos;

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
  changeUpdateMode(this);
};

// 页面卸载时停止 UA；beforeunload 中只执行同步清理。
window.onbeforeunload = stopUaBeforeUnload;

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

// AI 降噪模式和强度由媒体效果模块保存并按当前通话状态生效。
document.querySelector('#nsMode').addEventListener('change', function()
{
  changeNsMode(this);
});

document.querySelector('#nsLevel').addEventListener('change', function()
{
  changeNsLevel(this);
});

document.querySelector('#textMarkSet').onclick = async function()
{
  await setTextMark();
};

document.querySelector('#textMarkClear').onclick = clearTextMark;

document.querySelector('#imgMarkSet').onclick = async function()
{
  await setImageMark();
};

document.querySelector('#imgMarkClear').onclick = clearImageMark;
