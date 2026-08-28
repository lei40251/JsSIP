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
function startMetaHumanFlow(options = {})
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

  releaseMetaHuman();

  mh = new CRTC.MetaHumanClient(buildMetaHumanOptions());

  let handled = false;

  mh.on('track', function(evt)
  {
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

    call(null, null, remoteStream);
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

  mh.connect()
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

window.addEventListener('beforeunload', function()
{
  releaseMetaHuman();
});

function normalizeMetaHumanFlag(value)
{
  return Number(value) === 1 ? 1 : 0;
}
