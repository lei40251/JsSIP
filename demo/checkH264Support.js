/**
 * 检测视频编码器和解码器是否支持H264编解码
 * @returns {Promise<Object>} 返回一个Promise，包含编码器和解码器的H264支持状态及能力详情
 */
// 辅助方法：统一的 H264 判断
function isH264Codec(codec) {
  if (!codec) return false;
  const mime = (codec.mimeType || '').toLowerCase(); // e.g. 'video/h264', 'video/H264'
  if (mime.includes('h264')) return true;
  // 某些实现可能在 sdpFmtpLine 中暴露 avc1 相关参数
  const fmtp = codec.sdpFmtpLine || '';
  if (/avc1/i.test(fmtp)) return true;
  return false;
}

function extractSupportFromCaps(caps) {
  return !!(caps && Array.isArray(caps.codecs) && caps.codecs.some(isH264Codec));
}

/**
 * 检测视频编码器和解码器是否支持H264编解码
 * @returns {Promise<Object>}
 */
async function checkH264Support() {
  const result = {
    encoderSupportsH264: false,
    decoderSupportsH264: false,
    encoderCapabilities: null,
    decoderCapabilities: null,
    error: null
  };

  try {
    // WebRTC 基础能力
    if (typeof window === 'undefined' || typeof window.RTCPeerConnection === 'undefined') {
      result.error = 'WebRTC不被支持';
      return result;
    }

    // 1) 优先使用静态 getCapabilities
    try {
      if (typeof RTCRtpSender !== 'undefined' && typeof RTCRtpSender.getCapabilities === 'function') {
        const caps = RTCRtpSender.getCapabilities('video');
        result.encoderCapabilities = caps || null;
        result.encoderSupportsH264 = extractSupportFromCaps(caps);
      }
    } catch (e) {
      console.warn('编码器静态能力检测失败:', e);
    }

    try {
      if (typeof RTCRtpReceiver !== 'undefined' && typeof RTCRtpReceiver.getCapabilities === 'function') {
        const caps = RTCRtpReceiver.getCapabilities('video');
        result.decoderCapabilities = caps || null;
        result.decoderSupportsH264 = extractSupportFromCaps(caps);
      }
    } catch (e) {
      console.warn('解码器静态能力检测失败:', e);
    }

    // 2) 静态能力缺失时，使用 RTCPeerConnection 降级探测（一次性复用 PC）
    let pc = null;
    try {
      if (!result.encoderCapabilities || !result.decoderCapabilities) {
        pc = new RTCPeerConnection();

        if (!result.encoderCapabilities) {
          try {
            const txSend = pc.addTransceiver('video', { direction: 'sendonly' });
            const getCaps = txSend?.sender && typeof txSend.sender.getCapabilities === 'function'
              ? txSend.sender.getCapabilities.bind(txSend.sender)
              : null;
            if (getCaps) {
              const caps = getCaps('video');
              result.encoderCapabilities = caps || null;
              result.encoderSupportsH264 = result.encoderSupportsH264 || extractSupportFromCaps(caps);
            }
          } catch (e) {
            console.warn('编码器降级探测失败:', e);
          }
        }

        if (!result.decoderCapabilities) {
          try {
            const txRecv = pc.addTransceiver('video', { direction: 'recvonly' });
            const getCaps = txRecv?.receiver && typeof txRecv.receiver.getCapabilities === 'function'
              ? txRecv.receiver.getCapabilities.bind(txRecv.receiver)
              : null;
            if (getCaps) {
              const caps = getCaps('video');
              result.decoderCapabilities = caps || null;
              result.decoderSupportsH264 = result.decoderSupportsH264 || extractSupportFromCaps(caps);
            }
          } catch (e) {
            console.warn('解码器降级探测失败:', e);
          }
        }
      }
    } finally {
      if (pc) {
        try { pc.close(); } catch {}
      }
    }

    // 3) MediaRecorder 作为编码兜底（注意其并不等价于 WebRTC 编码器）
    if (!result.encoderSupportsH264 && typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
      try {
        const h264Mp4Types = [
          'video/mp4; codecs="avc1.42E01E"',
          'video/mp4; codecs="avc1.4D401E"',
          'video/mp4; codecs="avc1.640028"',
          'video/mp4; codecs="avc1"'
        ];
        result.encoderSupportsH264 = h264Mp4Types.some(t => MediaRecorder.isTypeSupported(t));
      } catch (e) {
        console.warn('MediaRecorder检测失败:', e);
      }
    }
  } catch (error) {
    console.error('检测H264支持时出错:', error);
    result.error = error?.message || String(error);
  }

  return result;
}

/**
 * 同步版本（仅做静态能力与 MediaRecorder 的快速检测，不创建 RTCPeerConnection）
 * @returns {Object}
 */
function checkH264SupportSync() {
  const result = {
    encoderSupportsH264: false,
    decoderSupportsH264: false,
    encoderCapabilities: null,
    decoderCapabilities: null,
    error: null
  };

  try {
    if (typeof window === 'undefined' || typeof window.RTCPeerConnection === 'undefined') {
      result.error = 'WebRTC不被支持';
      return result;
    }

    try {
      if (typeof RTCRtpSender !== 'undefined' && typeof RTCRtpSender.getCapabilities === 'function') {
        const caps = RTCRtpSender.getCapabilities('video');
        result.encoderCapabilities = caps || null;
        result.encoderSupportsH264 = extractSupportFromCaps(caps);
      }
    } catch (e) {
      console.warn('编码器静态能力检测失败:', e);
    }

    try {
      if (typeof RTCRtpReceiver !== 'undefined' && typeof RTCRtpReceiver.getCapabilities === 'function') {
        const caps = RTCRtpReceiver.getCapabilities('video');
        result.decoderCapabilities = caps || null;
        result.decoderSupportsH264 = extractSupportFromCaps(caps);
      }
    } catch (e) {
      console.warn('解码器静态能力检测失败:', e);
    }

    if (!result.encoderSupportsH264 && typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
      try {
        const h264Mp4Types = [
          'video/mp4; codecs="avc1.42E01E"',
          'video/mp4; codecs="avc1.4D401E"',
          'video/mp4; codecs="avc1"'
        ];
        result.encoderSupportsH264 = h264Mp4Types.some(t => MediaRecorder.isTypeSupported(t));
      } catch (e) {
        console.warn('MediaRecorder检测失败:', e);
      }
    }
  } catch (error) {
    console.error('检测H264支持时出错:', error);
    result.error = error?.message || String(error);
  }

  return result;
}

// 同步版本
const syncResult = checkH264SupportSync();
console.log('同步检测结果:', syncResult);
console.log('编码器支持H264:', syncResult.encoderSupportsH264);
console.log('解码器支持H264:', syncResult.decoderSupportsH264);


// 使用示例
(async function example() {
  // 异步版本
  try {
    const h264Support = await checkH264Support();
    console.log('编码器支持H264:', h264Support.encoderSupportsH264);
    console.log('解码器支持H264:', h264Support.decoderSupportsH264);
    console.log('编码器能力:', h264Support.encoderCapabilities);
    console.log('解码器能力:', h264Support.decoderCapabilities);
    if (h264Support.error) {
      console.error('检测错误:', h264Support.error);
    }
  } catch (error) {
    console.error('异步检测失败:', error);
  }
})();