/**
 * AudioStreamer 类用于通过 WebSocket 连接服务器，并实时传输麦克风音频流。
 * * * 注意：此版本是针对传统浏览器引入（非ES Module）设计的，
 * * 通过将类挂载到 window 对象来实现外部访问。
 */
(function() 
{
    
  class AudioStreamer 
  {
    /**
         * @param {string} serverUri - WebSocket 服务器地址.
         * @param {number} sessionId - 会话ID.
         * @param {number} [sampleRate=16000] - 期望的音频采样率.
         */
    constructor(serverUri, sessionId, sampleRate = 16000) 
    {
      if (!window.WebSocket || !navigator.mediaDevices || !window.AudioContext) 
      {
        // 不抛出错误，而是使用 onError 报告，以确保代码继续运行
        this.onError('当前浏览器环境不支持 WebSocket 或 Web Audio API.');
        throw new Error('环境不支持');
      }

      this.serverUri = serverUri;
      this.sessionId = sessionId;
      this.expectedSampleRate = sampleRate;

      this.websocket = null;
      this.audioContext = null;
      this.mediaStream = null;
      this.scriptProcessor = null;
      this.isStreaming = false;

      this.flag = false;

      // 外部可设置的回调函数
      this.onLog = console.log;
      this.onError = console.error;
      this.onClose = () => {};
    }

    /**
         * 将 Float32 (-1.0 到 1.0) 转换为 Int16 PCM 数据 (小端序).
         */
    floatTo16BitPCM(input) 
    {
      const output = new DataView(new ArrayBuffer(input.length * 2));

      for (let i = 0; i < input.length; i++) 
      {
        let s = Math.max(-1, Math.min(1, input[i]));

        s = s < 0 ? s * 0x8000 : s * 0x7FFF;
        output.setInt16(i * 2, s, true); // true 表示小端序 (Little Endian)
      }
      
      return output.buffer;
    }

    /**
         * 启动音频流传输.
         * @returns {Promise<void>}
         */
    async start(flag) 
    {
      if (this.isStreaming) 
      {
        this.onLog('流已在运行中.');
        
        return;
      }

      try 
      {
        this.flag = flag;
        this.isStreaming = true;
        this.onLog('开始初始化 AudioStreamer...');

        // 1. 获取麦克风权限
        const constraints = { 
          audio : { 
            sampleRate       : this.expectedSampleRate,
            channelCount     : 1,
            echoCancellation : true,
            noiseSuppression : flag?false:true,
            latency          : { ideal: 0.01 }
          } 
        };

        if (mic)
        {
          constraints.audio['deviceId'] = { exact: mic };
        }
        console.warn('micC: ', mic, constraints);
        this.onLog('请求麦克风权限...');
        this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
                
        // 2. 连接 WebSocket
        this.onLog(`连接 WebSocket: ${this.serverUri}`);
        this.websocket = new WebSocket(this.serverUri);
        this.websocket.binaryType = 'arraybuffer'; 

        this.websocket.onopen = this.handleWsOpen.bind(this);
        this.websocket.onmessage = this.handleWsMessage.bind(this);
        this.websocket.onerror = this.handleWsError.bind(this);
        this.websocket.onclose = this.handleWsClose.bind(this);

      }
      catch (e) 
      {
        this.onError(`启动失败: ${e.message}. 请确保在 HTTPS 或 localhost 环境下运行。`);
        this.stop();
        throw e; 
      }
    }

    handleWsOpen() 
    {
      this.onLog('WebSocket 已连接');
      // 3. 发送登录命令 (Login)
      const loginCmd = {
        'cmd'       : 'login',
        'sessionid' : parseInt(this.sessionId)
      };

      this.websocket.send(JSON.stringify(loginCmd));
      this.onLog(`发送登录命令: ${JSON.stringify(loginCmd)}`);
    }

    handleWsMessage(event) 
    {
      this.onLog(`收到服务器消息: ${event.data}`);
            
      const responseText = event.data;
            
      // 收到登录成功的响应，执行下一步：发送 setpcm
      if (responseText.includes('login success') && !this.audioContext) 
      { 
        this.onLog('登录成功，发送 PCM 设置命令...');
        this.sendSetPcm();
                 
      } 
      // 如果服务器对 setpcm 也有回复，在这里启动音频采集
      else if (responseText.includes('setpcm success') && this.websocket.readyState === WebSocket.OPEN) 
      {
        this.onLog('PCM 设置成功，启动音频采集...');
        this.startAudioProcessing();
      }
    }

    sendSetPcm() 
    {
      // 4. 发送设置 PCM 格式命令 (SetPcm)
      const setPcmCmd = {
        'cmd'        : 'setpcm',
        'samplerate' : this.expectedSampleRate
      };

      this.websocket.send(JSON.stringify(setPcmCmd));
      this.onLog(`发送 PCM 设置命令: ${JSON.stringify(setPcmCmd)}`);

      // 如果您的服务器在 setpcm 后没有回复，请取消注释下一行，直接启动音频：
      // this.startAudioProcessing();
      // this.onLog("（假设服务器不回复 setpcm 消息，立即启动音频采集）");
    }

    async startAudioProcessing() 
    {
      if (this.audioContext) 
      {
        this.onLog('音频已在处理中...');
        
        return;
      }

      const AudioContext = window.AudioContext || window.webkitAudioContext;

      this.audioContext = new AudioContext({ sampleRate: this.expectedSampleRate }); 
      
      this.onLog(`AudioContext 实际采样率: ${this.audioContext.sampleRate}Hz`);
      
      const workletCode = document.getElementById('worklet-code').textContent;
      const blob = new Blob([ workletCode ], { type: 'application/javascript' });

      await this.audioContext.audioWorklet.addModule(URL.createObjectURL(blob));

      // 加载 RNNoise AudioWorklet
      await this.audioContext.audioWorklet.addModule('./js/rnnoise-wasm/dist/NoiseSuppressorWorklet.js');

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      const workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');
      const rnnoiseNode = new AudioWorkletNode(
        this.audioContext,
        'NoiseSuppressorWorklet'
      );
      
      let count = 0;

      // 3. 接收并发送
      workletNode.port.onmessage = (event) => 
      {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) 
        {
          if (count>20)
          {
            this.websocket.send(event.data);
          }
          count++;
        }
      };

      console.warn('flag: ', this.flag);
      if (this.flag)
      {
        source.connect(rnnoiseNode).connect(workletNode);
      }
      else
      {        
        source.connect(workletNode);
      }
      workletNode.connect(this.audioContext.destination);

      // 静音输出以防反馈
      const gain = this.audioContext.createGain();

      gain.gain.value = 0;
      workletNode.connect(gain).connect(this.audioContext.destination);
        
      this.onLog('音频采集启动，开始流式传输数据...');
    }

    handleWsError(e) 
    {
      this.onError(`WebSocket 错误: ${e.message}`);
      this.stop();
    }

    handleWsClose() 
    {
      this.onLog('WebSocket 连接已关闭');
      this.stop(false); 
      this.onClose(); 
    }

    /**
         * 停止音频流传输，并关闭所有连接和资源.
         * @param {boolean} [shouldCloseWs=true] - 是否应该主动关闭 WebSocket 连接.
         */
    stop(shouldCloseWs = true) 
    {
      if (!this.isStreaming) return;
            
      this.onLog('正在停止 AudioStreamer...');

      // 停止音频处理和 AudioContext
      if (this.scriptProcessor) 
      {
        this.scriptProcessor.disconnect();
        this.scriptProcessor = null;
      }

      if (this.audioContext) 
      {
        this.audioContext.close();
        this.audioContext = null;
      }

      // 停止麦克风流
      if (this.mediaStream) 
      {
        this.mediaStream.getTracks().forEach((track) => track.stop());
        this.mediaStream = null;
      }
            
      // 关闭 WebSocket 
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN && shouldCloseWs) 
      {
        this.websocket.close(1000, 'User requested close');
      }
            
      this.websocket = null;
      this.isStreaming = false;
      this.onLog('AudioStreamer 已停止。');
    }
  }
    
  // **核心修改：将类挂载到全局 window 对象上**
  window.AudioStreamer = AudioStreamer;

})();