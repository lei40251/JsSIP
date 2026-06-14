/* eslint-disable no-unused-vars */
/* eslint-disable max-len */
/* eslint-disable no-console */
/* eslint-disable no-undef */

/**
 * @fileoverview 媒体效果演示模块
 *
 * 这里放 base-js demo 页专用的交互流程：
 * 1. AI 降噪本地验证
 * 2. 虚拟背景本地演示
 * 3. 演示控件初始化时的状态同步
 *
 * 它依赖 app-media-effects.js 里提供的能力层函数，
 * 但自己不承担页面事件绑定，事件绑定仍放在 app.ui-bindings.js。
 */

// =============================================================================
// AiNS 本地验证状态
// =============================================================================

// 本地试听时采集到的原始麦克风流
let aiNsMonitorStream = null;

// 本地试听时创建出来的降噪处理器
let aiNsMonitorProcessor = null;

// 当前是否正在本地试听降噪
let aiNsMonitorActive = false;

/**
 * 把新的降噪强度应用到当前通话。
 * 这是演示页上的即时调节逻辑，不属于 SDK 配置构建能力本身。
 */
function applyAiNsLevelToCurrentCall(level)
{
  // 只有当前模块处于 AiNS 模式时，才需要把强度下发到当前会话
  if (aiNsType !== 'AiNS' || !rtcSession)
  {
    return false;
  }

  // 当前会话可能还没创建 AiNS 实例，没有的话就留给下一次呼叫时生效
  const aiNsEngine = rtcSession.getAiNoiseSuppression();

  if (!aiNsEngine)
  {
    return false;
  }

  // 直接更新当前通话里的降噪强度
  aiNsEngine.setSuppressionLevel(level);

  return true;
}

/**
 * 停止本地试听：
 * 1. 先更新状态和按钮
 * 2. 再停掉 audio 标签播放
 * 3. 再释放处理器和采集流
 */
async function stopAiNsMonitor()
{
  // 演示页里固定使用这个 audio 元素来回放试听结果
  const monitorAudio = document.querySelector('#aiNoiseMonitorAudio');

  // 先改状态，按钮能第一时间切回“开始验证”
  aiNsMonitorActive = false;
  updateAiNsMonitorButton();

  // 停止页面上的音频播放
  monitorAudio.pause();
  monitorAudio.srcObject = null;

  // 如果已经创建过 AiNS 处理器，这里销毁它
  if (aiNsMonitorProcessor)
  {
    try
    {
      await aiNsMonitorProcessor.destroy();
    }
    catch (error)
    {
      console.warn('stopAiNsMonitor destroy error', error);
    }
  }

  // 关闭本地采集到的麦克风轨道
  if (aiNsMonitorStream)
  {
    aiNsMonitorStream.getTracks().forEach((track) => track.stop());
  }

  // 最后把状态清空，方便下一次重新开始
  aiNsMonitorStream = null;
  aiNsMonitorProcessor = null;
}

/**
 * 根据当前下拉框状态，把试听链路切到：
 * 1. 原声
 * 2. AiNS 处理后音频
 */
async function applyAiNsMonitorState(forceStatus = false)
{
  // 没有开始试听时，不需要做任何事
  if (!aiNsMonitorActive || !aiNsMonitorStream)
  {
    return;
  }

  // 演示页的试听回放目标
  const monitorAudio = document.querySelector('#aiNoiseMonitorAudio');

  // 当前 UI 上的降噪强度
  const level = getCurrentAiNsLevel();

  // 选中了 AiNS，就走处理后的音频
  if (aiNsType === 'AiNS')
  {
    // 第一次切到 AiNS 时，先创建处理器并生成处理后流
    if (!aiNsMonitorProcessor)
    {
      aiNsMonitorProcessor = new CRTC.AiNSEngine({
        enabled             : true,
        preserveOtherTracks : true,
        noiseReductionLevel : level,
        assetConfig         : { cdnUrl: AI_NOISE_ASSET_ROOT }
      });

      const processedStream = await aiNsMonitorProcessor.process(aiNsMonitorStream);

      monitorAudio.srcObject = processedStream;
    }
    else
    {
      // 已经有处理器时，只需要更新开关和强度即可
      await aiNsMonitorProcessor.setEnabled(true);
      aiNsMonitorProcessor.setSuppressionLevel(level);
    }

    // 每次都重新 play，确保试听能正常出声
    await monitorAudio.play();
    setStatus(`本地降噪验证中，当前强度 ${level}`);

    return;
  }

  // 这里说明用户把 AiNS 关掉了，试听要退回原声
  if (aiNsMonitorProcessor)
  {
    await aiNsMonitorProcessor.destroy();
    aiNsMonitorProcessor = null;
  }

  // 回放原始麦克风流，方便对比效果
  monitorAudio.srcObject = aiNsMonitorStream;
  await monitorAudio.play();

  // 只有在需要时才提示状态，避免每次都刷屏
  if (forceStatus)
  {
    setStatus('本地麦克风原声验证中（未开启 AI 降噪）');
  }
}

// =============================================================================
// 虚拟背景本地演示状态
// =============================================================================

// 本地预览专用的 MediaEffectsComposer，和通话中的 composer 分开
let virtualBackgroundPreviewEngine = null;

// 本地预览专用的摄像头输入流
let virtualBackgroundPreviewInputStream = null;

// 当前是否已经在做本地虚拟背景演示
let virtualBackgroundPreviewActive = false;

// 当前是否正在启动本地虚拟背景演示，避免重复点击
let virtualBackgroundPreviewPending = false;

/**
 * 停止本地虚拟背景演示。
 */
async function stopVirtualBackgroundPreview(options = {})
{
  // 默认停止后恢复成当前通话预览；如果没有通话，就清空本地 video
  const { restoreSessionPreview = true } = options;

  // 先把界面状态切回“未演示”
  virtualBackgroundPreviewPending = false;
  virtualBackgroundPreviewActive = false;
  updateVirtualBackgroundPreviewButton();

  // 停掉本地演示 composer
  if (virtualBackgroundPreviewEngine)
  {
    try
    {
      virtualBackgroundPreviewEngine.stop();
    }
    catch (error)
    {
      console.warn('stopVirtualBackgroundPreview stop error', error);
    }
  }

  // 释放为了演示额外采集到的摄像头流
  if (virtualBackgroundPreviewInputStream)
  {
    virtualBackgroundPreviewInputStream.getTracks().forEach((track) => track.stop());
  }

  // 把状态清空，避免下次复用旧实例
  virtualBackgroundPreviewEngine = null;
  virtualBackgroundPreviewInputStream = null;

  // 结束演示后，恢复页面上的本地预览
  if (restoreSessionPreview)
  {
    if (rtcSession && rtcSession.connection)
    {
      getStreams(rtcSession.connection);
    }
    else
    {
      localVideo.srcObject = null;
    }
  }
}

/**
 * 启动本地虚拟背景演示。
 * 这里会额外采一条摄像头流，只给本地看效果，不影响当前通话链路。
 */
async function startVirtualBackgroundPreview()
{
  // 演示必须先选中一个虚拟背景类型
  if (!virtualBackgroundType)
  {
    throw new Error('请先选择虚拟背景效果');
  }

  // 先从摄像头采一条本地输入流
  virtualBackgroundPreviewInputStream = await navigator.mediaDevices.getUserMedia({
    audio : false,
    video : videoConstraints
  });

  // 再基于这条流创建一个独立的本地 composer
  virtualBackgroundPreviewEngine = new CRTC.MediaEffectsComposer(virtualBackgroundPreviewInputStream, {
    width   : videoConstraints.width,
    height  : videoConstraints.height,
    fps     : videoConstraints.frameRate,
    sources : [
      {
        // 本地演示和通话里的配置保持一致，方便对照最终效果
        aiVirtualBackground : buildCurrentAiVirtualBackgroundOptions()
      }
    ]
  });

  // 把本地演示输出挂到页面上的 localVideo
  localVideo.srcObject = await virtualBackgroundPreviewEngine.getOutput({ type: 'video' });
  localVideo.play().catch(() => {});

  // 更新本地状态和按钮文案
  virtualBackgroundPreviewPending = false;
  virtualBackgroundPreviewActive = true;
  updateVirtualBackgroundPreviewButton();
}

/**
 * 处理虚拟背景下拉框变化：
 * 1. 更新当前选择状态
 * 2. 同步到当前通话
 * 3. 同步到本地演示
 */
async function handleVirtualBackgroundChange(selectEl)
{
  // 当前下拉框选中的 option
  const selectedOption = selectEl.options[selectEl.selectedIndex];

  // 保存当前选择，后续构建配置时统一从这里取
  virtualBackgroundType = selectedOption.value;

  // 先更新状态栏，方便用户知道自己选中了什么
  if (!virtualBackgroundType)
  {
    setStatus('虚拟背景已关闭');
  }
  else if (virtualBackgroundType === 'none')
  {
    setStatus('虚拟背景已切换为保留人物，不替换背景');
  }
  else
  {
    setStatus(`虚拟背景已切换为 ${selectedOption.innerText}`);
  }

  // 当前通话里的 composer（旧接口拿法）
  const sessionComposer = rtcSession && rtcSession.getMediaEffectsComposer ?
    rtcSession.getMediaEffectsComposer() :
    null;
  const canUpdateSessionComposer = Boolean(rtcSession && rtcSession.updateMediaEffectsComposer);

  // 页面上既没有通话中的 composer / 会话更新能力，也没有本地预览，就不用再往下做了
  if (!sessionComposer && !canUpdateSessionComposer && !virtualBackgroundPreviewEngine)
  {
    return;
  }

  // 用户把虚拟背景关掉时，分别清掉通话和本地预览中的效果
  if (!virtualBackgroundType)
  {
    if (sessionComposer || canUpdateSessionComposer)
    {
      await applyCurrentVirtualBackgroundToSession();
    }

    if (virtualBackgroundPreviewEngine)
    {
      virtualBackgroundPreviewEngine.clearSourceAiVirtualBackground(0);
    }

    return;
  }

  // 如果当前正在通话，就把新选择同步到当前会话
  if (sessionComposer || canUpdateSessionComposer)
  {
    await applyCurrentVirtualBackgroundToSession();
  }

  // 如果本地演示已经开着，也同步更新本地演示画面
  if (virtualBackgroundPreviewEngine)
  {
    // 本地演示中的 composer 也同步到当前选择
    const aiVirtualBackground = buildCurrentAiVirtualBackgroundOptions();

    if (!aiVirtualBackground)
    {
      virtualBackgroundPreviewEngine.clearSourceAiVirtualBackground(0);
    }
    else
    {
      virtualBackgroundPreviewEngine.setSourceAiVirtualBackground(0, aiVirtualBackground);
    }
  }
}

// =============================================================================
// 初始化
// =============================================================================

/**
 * 初始化媒体效果演示模块。
 * 这里只做页面控件和共享状态的首次同步，不负责事件绑定。
 */
function initMediaEffects()
{
  // 把下拉框初始值同步到共享状态，避免第一次呼叫时读到旧值
  virtualBackgroundType = document.querySelector('#virtualBackground').value;
  aiNsType = document.querySelector('#aiNoiseSuppression').value;

  // 初始化时把默认强度归一化为 0-100 的合法值，防止页面初始值越界
  const levelInput = document.querySelector('#aiNoiseReductionLevel');

  levelInput.value = normalizeAiNsReductionLevel(levelInput.value);
}
