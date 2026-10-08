/* eslint-disable max-len */
/* eslint-disable no-console */
/* eslint-disable no-undef */

// =============================================================================
// 数字人（MetaHuman）Demo — UI 桥接层
//
// 本文件依赖 app-call.js 中声明的以下全局变量：
//   metaflag, spk, metaavatar, selectMic, setStatus, call,
//   rtcSession, pcConfig, extraFeatures, ua
//
// 核心 WebRTC 逻辑由 CRTC.MetaHumanClient 提供。
// =============================================================================

const mhEnv = handleGetQuery('env_mh');
const { mhServer, mhICEServer } = mhEnv ? mh_envs[`env_${mhEnv}`] : mh_envs['env_dev'];

console.warn(mhEnv);
console.warn(mhServer, mhICEServer);
// 当前 MetaHumanClient 实例
let mh = null;
// 这里有两条独立的连接：
// ① mh：浏览器 ↔ 数字人服务；发送通话对端的声音，接收数字人的音视频。
// ② rtcSession：浏览器 ↔ 通话对端；发送数字人的音视频，接收对端的声音。
// mhCallAudio 保存“通话对端声音 → 数字人服务”这一路的 Web Audio 节点。
// 数字人接听、启用 AI 的数字人外呼使用它；预览和普通数字人外呼保持 null。
let mhCallAudio = null;

/**
 * 释放当前数字人连接，并清理预览画面。
 */
function releaseMetaHuman()
{
  if (mh)
  {
    mh.close();
    mh = null;
  }

  if (mhCallAudio)
  {
    // 接通后才有 source；如果外呼未接通就取消，这里还没有远端音源。
    // disconnect() 只断开送往数字人的音频线路，不停止 SIP 的原始接收轨道。
    mhCallAudio.source && mhCallAudio.source.disconnect();
    // 静音发生器、输出音轨和 AudioContext 都由本 Demo 创建，在这里一起释放。
    // mh.close() 已释放 SDK 持有的克隆轨道，这里释放 Demo 自己的原始输出轨道。
    mhCallAudio.silence.stop();
    mhCallAudio.silence.disconnect();
    mhCallAudio.destination.stream.getTracks().forEach((track) => track.stop());
    mhCallAudio.context.close();
    mhCallAudio = null;
  }

  const screenVideo = document.getElementById('screen');

  if (screenVideo)
  {
    screenVideo.classList.add('hide');
    screenVideo.srcObject = null;
    screenVideo.muted = true;
  }
}

/**
 * 从页面 UI 控件同步 metaflag / spk / metaavatar 到全局变量。
 */
function syncMetaHumanConfigFromUI()
{
  const metaFlagSelect = document.querySelector('#metaflag');
  const spkSelect = document.querySelector('#spk');

  metaFlagSelect && (metaflag = normalizeMetaHumanFlag(metaFlagSelect.value));
  spkSelect && (spk = spkSelect.value);
  syncMetaHumanAvatarFromUI();

  if (mh)
  {
    mh.updateConfig({
      avatar             : metaavatar,
      flag               : metaflag,
      spk                : spk,
      micDeviceId        : selectMic || null,
      aiNoiseSuppression : buildCallAiNsOptions()
    });
  }
}

/**
 * 读取数字头像下拉框；选择“自定义”时读取自定义输入框。
 */
function syncMetaHumanAvatarFromUI()
{
  const metaAvatarSelect = document.querySelector('#metaavatar');
  const metaAvatarCustomInput = document.querySelector('#metaavatarCustom');

  if (!metaAvatarSelect)
  {
    return;
  }

  const avatarValue = metaAvatarSelect.value === 'custom' && metaAvatarCustomInput
    ? metaAvatarCustomInput.value.trim()
    : metaAvatarSelect.value;

  metaavatar = avatarValue || 'default';
}

/**
 * 当前流是否来自数字人链路。
 *
 * @param {MediaStream} stream
 * @returns {boolean}
 */
function isMetaHumanMediaStream(stream)
{
  return Boolean(stream && stream.__crtcMetaHumanStream);
}

/**
 * 标记数字人输出流，避免 Demo 在外呼链路上重复套 AiNS。
 *
 * @param {MediaStream} stream
 * @returns {MediaStream}
 */
function markMetaHumanMediaStream(stream)
{
  if (stream && !stream.__crtcMetaHumanStream)
  {
    Object.defineProperty(stream, '__crtcMetaHumanStream', {
      configurable : true,
      enumerable   : false,
      value        : true,
      writable     : true
    });
  }

  return stream;
}

/**
 * 把当前页面里的 MetaHuman 配置组装成 SDK 参数。
 *
 * @returns {object}
 */
function buildMetaHumanOptions()
{
  syncMetaHumanConfigFromUI();
  
  // 从当前环境配置读取 metaHumanServer（定义在 config.js）
  return {
    server             : mhServer,
    iceServers         : mhICEServer,
    avatar             : metaavatar,
    flag               : metaflag,
    spk                : spk,
    micDeviceId        : selectMic || undefined,
    aiNoiseSuppression : buildCallAiNsOptions()
  };
}

/**
 * 启动数字人连接。
 *
 * @param {object} options
 * @param {boolean} [options.answerCurrentSession=false] - 为 true 时用数字人流接听当前来电
 * @param {boolean} [options.previewOnly=false] - 为 true 时仅本地预览，不发起 SIP 通话
 */
async function startMetaHumanFlow(options = {})
{
  const answerCurrentSession = Boolean(options.answerCurrentSession);
  const previewOnly = Boolean(options.previewOnly);

  if (answerCurrentSession && !rtcSession)
  {
    setStatus('当前没有可接听的会话');

    return;
  }

  if (!previewOnly && !answerCurrentSession && !ua.isRegistered())
  {
    setStatus('请注册成功后再使用数字人外呼');

    return;
  }

  const clientOptions = buildMetaHumanOptions();
  // flag === 2 对应页面的“启用 AI”，保留 AI 外呼已有的降噪配置。
  const aiOutbound = !previewOnly && !answerCurrentSession && clientOptions.flag === 2;
  // 数字人接听始终使用来电方声音；外呼则在启用 AI 时使用被叫方声音。
  const useRemoteAudio = !previewOnly && (answerCurrentSession || aiOutbound);

  releaseMetaHuman();

  // 当前示例在这一路强制关闭 AiNS：即“被叫声音 → 数字人”的额外降噪。
  // 这是独立的降噪配置选择，不是静音切换所必需的逻辑；
  // null 表示禁用 AiNS，不表示静音，也不会关闭数字人 AI（flag === 2）。
  if (aiOutbound)
  {
    clientOptions.aiNoiseSuppression = null;
  }

  mh = new CRTC.MetaHumanClient(clientOptions);

  let handled = false;

  mh.on('track', function(evt)
  {
    // 此处的 remoteStream 来自数字人服务，是数字人生成的音视频。
    // 注意：它不是 app-call.js 的 confirmed 事件中“通话对端”的远端流。
    const remoteStream = evt.stream;

    if (handled || !remoteStream || remoteStream.getVideoTracks().length === 0)
    {
      return;
    }

    handled = true;

    if (previewOnly)
    {
      const screenVideo = document.getElementById('screen');

      screenVideo.srcObject = remoteStream;
      screenVideo.classList.remove('hide');
      screenVideo.muted = false;

      return;
    }

    if (answerCurrentSession)
    {
      try
      {
        // 将数字人的音视频发送给来电方；接听确认后，confirmed 中会把来电方声音
        // 接回数字人输入，形成“来电方说话 → 数字人处理 → 音视频返回来电方”。
        rtcSession.answer({
          mediaConstraints    : { audio: true, video: true },
          pcConfig            : Object.assign(pcConfig, { 'rtcpMuxPolicy': 'negotiate' }),
          rtcOfferConstraints : { offerToReceiveAudio: true, offerToReceiveVideo: true },
          extraFeatures       : extraFeatures,
          mediaStream         : remoteStream
        });
      }
      catch (error)
      {
        setStatus(`数字人接听失败: ${error && error.message ? error.message : error}`);
      }

      return;
    }

    // 先获得数字人的画面，再把数字人音视频作为 SIP 外呼的发送流。
    // 第三个参数 mediaStream 交给 ua.call()，因此被叫看到/听到的是数字人。
    // markMetaHumanMediaStream() 只加标记，让 call() 不再给该发送流套 SIP 侧 AiNS；
    // 它本身不修改音轨，也不负责把被叫声音送回数字人。
    call(null, null, aiOutbound ? markMetaHumanMediaStream(remoteStream) : remoteStream);
  });

  mh.on('error', function(evt)
  {
    setStatus(`数字人错误: ${evt.cause}`);
  });

  mh.on('stateChanged', function(evt)
  {
    setStatus(`数字人: ${evt.state}`);
  });

  mh.on('mediaEffectsIssue', function(evt)
  {
    setStatus(`数字人音频处理降级: ${evt.message}`);
  });

  let inputStream;

  if (useRemoteAudio)
  {
    // 外呼或接听前，先给数字人提供静音音轨，等通话确认接通后再接入对端声音。
    // 这里生成静音，不申请麦克风；空的 new MediaStream() 没有音轨，不能替代它。
    // 初始线路：silence（值为 0）→ destination.stream → mh.connect()。
    const context = new AudioContext();
    // destination 是“输出到 MediaStream”的节点，不是播放到本地扬声器。
    // 后面只改变接到它的音源，destination.stream 的音轨保持不变。
    const destination = context.createMediaStreamDestination();
    const silence = context.createConstantSource();

    // ConstantSource 默认输出常量；设为 0 才是静音，start() 开始输出。
    silence.offset.value = 0;
    silence.connect(destination);
    silence.start();
    // source 先留空，等 app-call.js 的 confirmed 事件中再创建对端音源。
    // 保存这些节点，让接通处理和挂断清理能使用同一条音频线路。
    mhCallAudio = { context, destination, silence, source: null };
    inputStream = destination.stream;
    // 在用户点击外呼或数字人接听按钮时启动音频处理，等待后再连接数字人。
    await context.resume();
  }

  // 数字人接听和 AI 外呼传入静音输出流；预览和普通外呼仍使用麦克风。
  // 接通后不用再次调用 connect()：同一输出流里的内容会随输入音源变化。
  mh.connect(inputStream)
    .catch((error) =>
    {
      setStatus(`数字人连接失败: ${error && error.message ? error.message : error}`);
    });
}

/**
 * 把当前页面里的 AiNS 配置同步到活跃的数字人连接。
 *
 * @returns {boolean}
 */
function applyCurrentAiNsToMetaHuman()
{
  if (!mh || typeof mh.getAiNoiseSuppression !== 'function')
  {
    return false;
  }

  const aiNsEngine = mh.getAiNoiseSuppression();

  if (!aiNsEngine)
  {
    return false;
  }

  const enabled = aiNsType === 'AiNS';

  aiNsEngine.setEnabled(enabled);

  if (enabled)
  {
    aiNsEngine.setLevel(getCurrentAiNsLevel());
    aiNsEngine.setOutputGain(getCurrentAiNsOutputGain());
  }

  return true;
}

/**
 * 通话中动态调整数字人 AiNS 输出增益。
 *
 * @param {number} value - 输出增益，范围 0-4
 * @returns {boolean} 当前数字人连接存在 AiNS 实例时返回 true
 */
function applyAiNsOutputGainToMetaHuman(value)
{
  if (!mh || typeof mh.getAiNoiseSuppression !== 'function')
  {
    return false;
  }

  const aiNsEngine = mh.getAiNoiseSuppression();

  if (!aiNsEngine)
  {
    return false;
  }

  aiNsEngine.setOutputGain(value);

  return true;
}

/**
 * 同步当前选择的麦克风到数字人配置。
 *
 * @param {string} deviceId
 */
function syncMetaHumanMicSelection(deviceId)
{
  if (mh)
  {
    mh.updateConfig({ micDeviceId: deviceId || null });
  }
}

/**
 * 从数字人服务查询可用音色，刷新页面上的“音色”下拉框 #spk。
 *
 * 接口：GET {server}/voice/map
 * 响应：{ code: 0, message: 'success', data: [{ code: 'male_young', name: '职业男声' }] }
 * 其中 data[].code 作为 MetaHumanClient 的 spk 参数。
 *
 * 查询失败时保留 index.html 中内置的音色选项，保证 Demo 仍可正常发起数字人通话。
 */
async function loadMetaHumanVoiceOptions()
{
  const spkSelect = document.querySelector('#spk');

  if (!spkSelect)
  {
    return;
  }

  try
  {
    const response = await fetch(`${mhServer}/voice/map`, {
      headers : { 'Content-Type': 'application/json' },
      method  : 'GET'
    });

    if (!response.ok)
    {
      throw new Error(`服务器返回错误: ${response.status}`);
    }

    const result = await response.json();

    if (!result || Number(result.code) !== 0 || !Array.isArray(result.data) || result.data.length === 0)
    {
      throw new Error(`音色列表为空: ${result && result.message ? result.message : 'empty data'}`);
    }

    spkSelect.innerHTML = '';

    result.data.forEach((voice) =>
    {
      const option = document.createElement('option');

      option.value = voice.code;
      option.textContent = voice.name;
      spkSelect.appendChild(option);
    });

    // 服务端音色列表可能不含原默认值，下拉框会回落到第一项，这里同步回全局变量。
    spk = spkSelect.value;
  }
  catch (error)
  {
    console.warn('[MetaHuman] 获取音色列表失败，继续使用内置音色', error);
  }
}

// =============================================================================
// UI 事件绑定
// =============================================================================

document.querySelector('#callMetaHuman').onclick = function()
{
  startMetaHumanFlow();
};

document.querySelector('#metaHuman').onclick = function()
{
  startMetaHumanFlow({ previewOnly: true });
};

document.querySelector('#metaavatar').onchange = function()
{
  const metaAvatarCustomInput = document.querySelector('#metaavatarCustom');
  const metaAvatarGrid = this.closest('.call-config-grid-meta');
  const useCustomAvatar = this.value === 'custom';

  metaAvatarCustomInput.classList.toggle('hide', !useCustomAvatar);
  metaAvatarGrid.classList.toggle('metaavatar-custom-active', useCustomAvatar);

  if (useCustomAvatar)
  {
    metaAvatarCustomInput.focus();
    setStatus('请输入自定义数字头像标识');

    return;
  }

  syncMetaHumanAvatarFromUI();

  if (mh)
  {
    mh.updateConfig({ avatar: metaavatar });
  }

  setStatus(`数字人: ${metaavatar}`);
};

document.querySelector('#metaavatarCustom').onchange = function()
{
  this.value = this.value.trim();

  if (!this.value)
  {
    setStatus('自定义数字头像标识不能为空');

    return;
  }

  syncMetaHumanAvatarFromUI();

  if (mh)
  {
    mh.updateConfig({ avatar: metaavatar });
  }

  setStatus(`数字人: ${metaavatar}`);
};

document.querySelector('#metaflag').onchange = function()
{
  metaflag = normalizeMetaHumanFlag(this.options[this.selectedIndex].value);

  if (mh)
  {
    mh.updateConfig({ flag: metaflag });
  }

  setStatus(`asr/tts: ${metaflag}`);
};

document.querySelector('#spk').onchange = function()
{
  spk = this.options[this.selectedIndex].value;

  if (mh)
  {
    mh.updateConfig({ spk: spk });
  }

  setStatus(`音色: ${spk}`);
};

document.querySelector('#closeMetaHuman').onclick = function()
{
  releaseMetaHuman();
};

document.querySelector('#videoMetaHuman').onclick = function()
{
  startMetaHumanFlow({ answerCurrentSession: true });

  setStatus('meta human answer');
};

syncMetaHumanConfigFromUI();
loadMetaHumanVoiceOptions();

window.addEventListener('beforeunload', function()
{
  releaseMetaHuman();
});

function normalizeMetaHumanFlag(value)
{
  return Number(value) === 1 ? 1 : Number(value) === 2 ? 2 : 0;
}
