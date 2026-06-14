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

/**
 * 根据当前 AiNS 试听状态，更新按钮文案和样式。
 * 这里只负责 UI，不处理真正的降噪逻辑。
 */
function updateAiNsMonitorButton()
{
  // 演示页里固定使用这个按钮控制本地降噪试听
  const button = document.querySelector('#toggleAiNsMonitor');

  // 正在试听时显示“结束验证”
  if (aiNsMonitorActive)
  {
    button.innerHTML = '<i class="bi-stop-circle me-1"></i>结束验证';
    button.className = 'btn btn-warning';

    return;
  }

  // 未试听时显示“开始验证”
  button.innerHTML = '<i class="bi-soundwave me-1"></i>开始验证';
  button.className = 'btn btn-outline-warning';
}

/**
 * 根据当前虚拟背景演示状态，更新按钮文案和样式。
 * 这里只负责 UI，不处理真正的预览逻辑。
 */
function updateVirtualBackgroundPreviewButton()
{
  // 演示页里固定使用这个按钮控制本地虚拟背景演示
  const button = document.querySelector('#toggleVirtualBackgroundPreview');

  // 启动中的时候禁止重复点击
  if (virtualBackgroundPreviewPending)
  {
    button.innerHTML = '<i class="bi-arrow-repeat me-1"></i>启动中...';
    button.className = 'btn btn-outline-secondary';
    button.disabled = true;

    return;
  }

  // 演示开启后显示“结束演示”
  if (virtualBackgroundPreviewActive)
  {
    button.innerHTML = '<i class="bi-stop-circle me-1"></i>结束演示';
    button.className = 'btn btn-outline-danger';
    button.disabled = false;

    return;
  }

  // 默认状态显示“开始演示”
  button.innerHTML = '<i class="bi-person-bounding-box me-1"></i>开始演示';
  button.className = 'btn btn-outline-primary';
  button.disabled = false;
}

// 页面首次加载时，先把两个按钮状态和当前全局状态同步一次
updateAiNsMonitorButton();
updateVirtualBackgroundPreviewButton();

// 虚拟背景下拉框变化时：
// 1. 更新全局状态
// 2. 同步到当前通话
// 3. 同步到本地演示
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
// 3. 如果本地试听开着，同步切到原声或降噪声
document.querySelector('#aiNoiseSuppression').addEventListener('change', function()
{
  // 保存当前下拉框值，供构建呼叫参数和试听链路复用
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

  // 如果本地试听已经开着，这里同步切换试听链路
  applyAiNsMonitorState(true);
});

// AiNS 强度变化时：
// 1. 先把输入值整理到 0-100
// 2. 如果当前通话已经开了 AiNS，就直接动态生效
// 3. 如果本地试听开着，也同步更新试听效果
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

  // 如果试听已经开着，同时把试听链路也切到新的强度
  applyAiNsMonitorState(false);
});

// 本地降噪试听按钮：
// 1. 第一次点击时采集原始麦克风
// 2. 然后按当前 AiNS 开关决定播放原声还是降噪后音频
// 3. 再次点击时停止试听并释放资源
document.querySelector('#toggleAiNsMonitor').onclick = async function()
{
  // 已经在试听时，这次点击就是“结束验证”
  if (aiNsMonitorActive)
  {
    await stopAiNsMonitor();
    setStatus('已停止本地降噪验证');

    return;
  }

  try
  {
    // 采一条不带浏览器降噪/回声消除的原始麦克风流
    aiNsMonitorStream = await navigator.mediaDevices.getUserMedia({
      audio : {
        echoCancellation : false,
        autoGainControl  : false,
        noiseSuppression : false
      },
      video : false
    });

    // 标记试听已开启，先更新按钮状态
    aiNsMonitorActive = true;
    updateAiNsMonitorButton();

    // 再根据当前 AiNS 开关，把试听切到原声或处理后音频
    await applyAiNsMonitorState(true);
  }
  catch (error)
  {
    // 启动失败时把状态还原，避免按钮卡住
    aiNsMonitorActive = false;
    updateAiNsMonitorButton();
    console.warn('toggleAiNsMonitor error', error);
    setStatus(`降噪验证启动失败：${error && error.message ? error.message : error}`);
  }
};

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

// 本地虚拟背景演示按钮：
// 1. 点击开始时，额外采集一条摄像头流做本地演示
// 2. 点击结束时，释放演示流并恢复页面上的本地预览
document.querySelector('#toggleVirtualBackgroundPreview').onclick = async function()
{
  // 启动过程中不允许再次点击，避免重复创建 composer
  if (virtualBackgroundPreviewPending)
  {
    return;
  }

  // 已经在演示时，这次点击就是“结束演示”
  if (virtualBackgroundPreviewActive)
  {
    await stopVirtualBackgroundPreview();
    setStatus('已结束本端虚拟背景演示');

    return;
  }

  try
  {
    // 先切到“启动中”状态，给用户明确反馈
    virtualBackgroundPreviewPending = true;
    updateVirtualBackgroundPreviewButton();
    setStatus('正在启动本端虚拟背景演示...');

    // 真正开始本地演示
    await startVirtualBackgroundPreview();
    setStatus('本端虚拟背景演示已开启');
  }
  catch (error)
  {
    // 演示启动失败时，把临时流和本地预览都清理干净
    await stopVirtualBackgroundPreview({ restoreSessionPreview: true });
    console.warn('startVirtualBackgroundPreview error', error);
    setStatus(`本端虚拟背景演示启动失败：${error && error.message ? error.message : error}`);
  }
};
