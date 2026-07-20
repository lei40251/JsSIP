/* eslint-disable */
/**
 * AiNoiseSuppression AudioWorklet inline source.
 *
 * Keep the worklet body as executable JS so the minifier can compress it
 * before we serialize it back to a string for addModule().
 */
function workletMain()
{
(function() {
  'use strict';

  let cachedFloat32ArrayMemory0 = null;
  let cachedUint8ArrayMemory0 = null;
  let cachedTextDecoder = null;
  let WASM_VECTOR_LEN = 0;
  let wasmModule;
  let wasmInstance;
  let wasm;

  function getTextDecoder()
  {
    if (cachedTextDecoder === null && typeof TextDecoder !== 'undefined')
    {
      cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
      cachedTextDecoder.decode();
    }

    return cachedTextDecoder;
  }

  const MAX_SAFARI_DECODE_BYTES = 2146435072;
  let numBytesDecoded = 0;

  function getFloat32ArrayMemory0()
  {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0)
    {
      cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }

    return cachedFloat32ArrayMemory0;
  }

  function getUint8ArrayMemory0()
  {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0)
    {
      cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }

    return cachedUint8ArrayMemory0;
  }

  function decodeText(ptr, len)
  {
    const decoder = getTextDecoder();

    if (!decoder)
    {
      return '';
    }

    numBytesDecoded += len;

    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES)
    {
      cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
      cachedTextDecoder.decode();
      numBytesDecoded = len;
    }

    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
  }

  function getStringFromWasm0(ptr, len)
  {
    return decodeText(ptr >>> 0, len);
  }

  function addToExternrefTable0(obj)
  {
	    const idx = wasm['__externref_table_alloc']();

	    wasm['__wbindgen_externrefs'].set(idx, obj);

    return idx;
  }

  function handleError(f, args)
  {
    try
    {
      return f.apply(this, args);
    }
    catch (e)
    {
      const idx = addToExternrefTable0(e);

	      wasm['__wbindgen_exn_store'](idx);
    }
  }

  function passArray8ToWasm0(arg, malloc)
  {
    const ptr = malloc(arg.length * 1, 1) >>> 0;

    getUint8ArrayMemory0().set(arg, ptr);
    WASM_VECTOR_LEN = arg.length;

    return ptr;
  }

  function passArrayF32ToWasm0(arg, malloc)
  {
    const ptr = malloc(arg.length * 4, 4) >>> 0;

    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;

    return ptr;
  }

  function ans_create(modelBytes, attenLim)
  {
	    const ptr0 = passArray8ToWasm0(modelBytes, wasm['__wbindgen_malloc']);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ans_create(ptr0, len0, attenLim);

    return ret >>> 0;
  }

  function ans_get_frame_length(st)
  {
    const ret = wasm.ans_get_frame_length(st);

    return ret >>> 0;
  }

  function ans_process_frame(st, input)
  {
	    const ptr0 = passArrayF32ToWasm0(input, wasm['__wbindgen_malloc']);
    const len0 = WASM_VECTOR_LEN;

    return wasm.ans_process_frame(st, ptr0, len0);
  }

  function ans_set_atten_lim(st, limDb)
  {
    wasm.ans_set_atten_lim(st, limDb);
  }

	  function getGlobalScope()
	  {
	    if (typeof globalThis !== 'undefined')
	    {
	      return globalThis;
	    }
	    if (typeof self !== 'undefined')
	    {
	      return self;
	    }
	    if (typeof window !== 'undefined')
	    {
	      return window;
	    }
	    if (typeof global !== 'undefined')
	    {
	      return global;
	    }
	    return {};
	  }
	  function getNodeRequire()
	  {
	    if (typeof module !== 'undefined' && module && typeof module.require === 'function')
	    {
	      return module.require;
	    }
	    return undefined;
	  }
	  function __wbg_get_imports()
	  {
	    const import0 = Object.create(null);
	    import0['__wbg___wbindgen_is_function_754e9f305ff6029e'] = function(arg0)
	    {
	      return typeof arg0 === 'function';
	    };
	    import0['__wbg___wbindgen_is_object_56732c2bc353f41d'] = function(arg0)
	    {
	      return typeof arg0 === 'object' && arg0 !== null;
	    };
	    import0['__wbg___wbindgen_is_string_c236cabd84a4d769'] = function(arg0)
	    {
	      return typeof arg0 === 'string';
	    };
	    import0['__wbg___wbindgen_is_undefined_67b456be8673d3d7'] = function(arg0)
	    {
	      return arg0 === undefined;
	    };
	    import0['__wbg___wbindgen_memory_fbc4c3e30b409f08'] = function()
	    {
	      return wasm.memory;
	    };
	    import0['__wbg___wbindgen_throw_1506f2235d1bdba0'] = function(arg0, arg1)
	    {
	      throw new Error(getStringFromWasm0(arg0, arg1));
	    };
	    import0['__wbg_buffer_dab8cf7849f66ff8'] = function(arg0)
	    {
	      return arg0.buffer;
	    };
	    import0['__wbg_call_4ffe5b44583f9954'] = function()
	    {
	      return handleError(function(arg0, arg1, arg2)
	      {
	        return arg0.call(arg1, arg2);
	      }, arguments);
	    };
	    import0['__wbg_call_aa058b3a50f1c0a1'] = function()
	    {
	      return handleError(function(arg0, arg1)
	      {
	        return arg0.call(arg1);
	      }, arguments);
	    };
	    import0['__wbg_crypto_90efa04a103d6db2'] = function(arg0)
	    {
	      return arg0 ? arg0.crypto : undefined;
	    };
	    import0['__wbg_getRandomValues_b9488c03d6ecdc0d'] = function()
	    {
	      return handleError(function(arg0, arg1)
	      {
	        arg0.getRandomValues(arg1);
	      }, arguments);
	    };
	    import0['__wbg_globalThis_d76c93eb4fcb97ff'] = function()
	    {
	      return getGlobalScope();
	    };
	    import0['__wbg_global_d5571d09e84f338f'] = function()
	    {
	      return typeof global !== 'undefined' ? global : undefined;
	    };
	    import0['__wbg_msCrypto_68b2f4999b2901b0'] = function(arg0)
	    {
	      return arg0 ? arg0.msCrypto : undefined;
	    };
	    import0['__wbg_new_1c499b98736d881b'] = function(arg0)
	    {
	      return new Float32Array(arg0);
	    };
	    import0['__wbg_new_f3375b05b49ca4cb'] = function(arg0)
	    {
	      return new Uint8Array(arg0);
	    };
	    import0['__wbg_new_no_args_4856846a7397439f'] = function(arg0, arg1)
	    {
	      return new Function(getStringFromWasm0(arg0, arg1));
	    };
	    import0['__wbg_new_with_byte_offset_and_length_ae71716dc4a8aa2f'] = function(arg0, arg1, arg2)
	    {
	      return new Float32Array(arg0, arg1 >>> 0, arg2 >>> 0);
	    };
	    import0['__wbg_new_with_byte_offset_and_length_c74776d039a72b10'] = function(arg0, arg1, arg2)
	    {
	      return new Uint8Array(arg0, arg1 >>> 0, arg2 >>> 0);
	    };
	    import0['__wbg_new_with_length_135fb0a3b25f39fc'] = function(arg0)
	    {
	      return new Uint8Array(arg0 >>> 0);
	    };
	    import0['__wbg_node_046e1cb1b8cf3d92'] = function(arg0)
	    {
	      return arg0.node;
	    };
	    import0['__wbg_process_7b13606d1afee88f'] = function(arg0)
	    {
	      return arg0.process;
	    };
	    import0['__wbg_randomFillSync_73a2861b2e659112'] = function()
	    {
	      return handleError(function(arg0, arg1)
	      {
	        arg0.randomFillSync(arg1);
	      }, arguments);
	    };
	    import0['__wbg_require_01ac6430ef887047'] = function()
	    {
	      return getNodeRequire();
	    };
	    import0['__wbg_self_84d02e00450d52f3'] = function()
	    {
	      return typeof self !== 'undefined' ? self : undefined;
	    };
	    import0['__wbg_set_8ab55bbf9f2507cd'] = function(arg0, arg1, arg2)
	    {
	      arg0.set(arg1, arg2 >>> 0);
	    };
	    import0['__wbg_subarray_a1d2eeb856ccb090'] = function(arg0, arg1, arg2)
	    {
	      return arg0.subarray(arg1 >>> 0, arg2 >>> 0);
	    };
	    import0['__wbg_versions_6963303269777792'] = function(arg0)
	    {
	      return arg0.versions;
	    };
	    import0['__wbg_window_58f68528f5b015de'] = function()
	    {
	      return typeof window !== 'undefined' ? window : undefined;
	    };
	    import0['__wbindgen_cast_0000000000000001'] = function(arg0, arg1)
	    {
	      return getStringFromWasm0(arg0, arg1);
	    };
	    import0['__wbindgen_init_externref_table'] = function()
	    {
	      const table = wasm['__wbindgen_externrefs'];
	      const offset = table.grow(4);
	      table.set(0, undefined);
	      table.set(offset + 0, undefined);
	      table.set(offset + 1, null);
	      table.set(offset + 2, true);
	      table.set(offset + 3, false);
	    };
	    return {
	      './ans_bg.js' : import0
	    };
	  }

  function __wbg_finalize_init(instance, module)
  {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedFloat32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
	    wasm['__wbindgen_start']();

    return wasm;
  }

  function initSync(module)
  {
    if (wasm !== undefined)
    {
      return wasm;
    }

    if (module !== undefined && Object.getPrototypeOf(module) === Object.prototype)
    {
      ({ module } = module);
    }

    const imports = __wbg_get_imports();

    if (!(module instanceof WebAssembly.Module))
    {
      module = new WebAssembly.Module(module);
    }

    const instance = new WebAssembly.Instance(module, imports);

    return __wbg_finalize_init(instance, module);
  }

  const WorkletMessageTypes = {
    SET_SUPPRESSION_LEVEL : 'SET_SUPPRESSION_LEVEL',
    SET_BYPASS            : 'SET_BYPASS'
  };
  /**
   * AudioWorklet 线程向主线程发送的事件类型枚举。
   *
   * 由于 AudioWorklet 在独立线程中运行，无法直接调用主线程的日志或回调，
   * 需要通过 port.postMessage() 发送消息。主线程的 AiNSWorkletRuntime 在
   * workletNode.port.onmessage 中监听这些事件并做相应处理。
   *
   * INIT_FAILED:
   *   当 DeepFilter 初始化失败时（WASM 加载失败、模型解析失败等），
   *   Worklet 线程向主线程发送此事件。主线程收到后会通过 _reportIssue
   *   上报问题并标记 fallbackApplied=true、degraded=true，
   *   表明降噪功能已降级（音频将直通、不做降噪处理）。
   */
  const WorkletEventTypes = {
    INIT_FAILED                : 'AINS_WORKLET_INIT_FAILED',
    UNSUPPORTED_CHANNEL_LAYOUT : 'AINS_UNSUPPORTED_CHANNEL_LAYOUT',
    PROCESSING_FAILED          : 'AINS_WORKLET_PROCESSING_FAILED'
  };

  class DeepFilterAudioProcessor extends AudioWorkletProcessor
  {
    constructor(options)
    {
      super();
      this.dfModel = null;
      this.inputWritePos = 0;
      this.inputReadPos = 0;
      this.outputWritePos = 0;
      this.outputReadPos = 0;
      this.bypass = false;
      this.isInitialized = false;
      this.tempFrame = null;
      this.bufferSize = 8192;
      this.inputBuffer = new Float32Array(this.bufferSize);
      this.outputBuffer = new Float32Array(this.bufferSize);
      this.hasReportedUnsupportedChannelLayout = false;
      this.hasReportedProcessingFailure = false;

      try
      {
        initSync(options.processorOptions.wasmBytes);
        const modelBytes = new Uint8Array(options.processorOptions.modelBytes);
        const suppressionLevel = options.processorOptions.suppressionLevel;
        const handle = ans_create(modelBytes, suppressionLevel == null ? 50 : suppressionLevel);
        const frameLength = ans_get_frame_length(handle);

        if (!handle || !Number.isFinite(frameLength) || frameLength <= 0 || frameLength > 4096)
        {
          throw new Error('DeepFilter returned invalid model handle or frame length');
        }

        this.dfModel = { handle, frameLength };
        this.bufferSize = frameLength * 4;
        this.inputBuffer = new Float32Array(this.bufferSize);
        this.outputBuffer = new Float32Array(this.bufferSize);
        this.tempFrame = new Float32Array(frameLength);
        this.isInitialized = true;
        this.port.onmessage = (event) => this.handleMessage(event.data);
      }
      catch (error)
      {
        console.error('Failed to initialize DeepFilter in AudioWorklet:', error);
        this.isInitialized = false;
        // 通过 port.postMessage 向主线程发送 INIT_FAILED 事件，
        // 让主线程获知 Worklet 初始化失败并执行降级处理。
        // hasWasmBytes / hasModelBytes 用于帮助排查是否是资源缺失导致的问题。
        if (this.port && typeof this.port.postMessage === 'function')
        {
          try
          {
            this.port.postMessage({
              type    : WorkletEventTypes.INIT_FAILED,
              message : error && error.message ? error.message : String(error),
              details : {
                hasWasmBytes  : Boolean(options && options.processorOptions && options.processorOptions.wasmBytes),
                hasModelBytes : Boolean(options && options.processorOptions && options.processorOptions.modelBytes)
              }
            });
          }
          catch (postError)
          {
            console.error('Failed to notify main thread about DeepFilter init failure:', postError);
          }
        }
      }
    }

    passthroughInputChannels(inputChannels, outputList, sourceLimit)
    {
      for (let inputNum = 0; inputNum < sourceLimit; inputNum++)
      {
        const output = outputList[inputNum];
        const channelCount = output.length;

        for (let channelNum = 0; channelNum < channelCount; channelNum++)
        {
          const outputChannel = output[channelNum];
          const inputChannel = inputChannels[channelNum] || inputChannels[0];

          if (!inputChannel)
          {
            outputChannel.fill(0);
            continue;
          }

          const copyLength = Math.min(outputChannel.length, inputChannel.length);

          outputChannel.set(inputChannel.subarray(0, copyLength));
          if (copyLength < outputChannel.length)
          {
            outputChannel.fill(0, copyLength);
          }
        }
      }
    }

    reportUnsupportedChannelLayout(inputChannels, outputList)
    {
      if (this.hasReportedUnsupportedChannelLayout)
      {
        return;
      }

      this.hasReportedUnsupportedChannelLayout = true;

      if (this.port && typeof this.port.postMessage === 'function')
      {
        try
        {
          this.port.postMessage({
            type    : WorkletEventTypes.UNSUPPORTED_CHANNEL_LAYOUT,
            message : 'Bypassed AI noise suppression for unsupported multi-channel input',
            details : {
              inputChannelCount  : inputChannels.length,
              outputChannelCount : outputList[0] ? outputList[0].length : 0
            }
          });
        }
        catch (error)
        {
          console.error('Failed to notify main thread about unsupported channel layout:', error);
        }
      }
    }

    handleMessage(data)
    {
      switch (data.type)
      {
        case WorkletMessageTypes.SET_SUPPRESSION_LEVEL:
          if (this.dfModel && typeof data.value === 'number')
          {
            const level = Math.max(0, Math.min(100, Math.floor(data.value)));
            ans_set_atten_lim(this.dfModel.handle, level);
          }
          break;
        case WorkletMessageTypes.SET_BYPASS:
          if (this.bypass !== Boolean(data.value))
          {
            this.bypass = Boolean(data.value);
            this.resetBuffers();
          }
          break;
      }
    }

    resetBuffers()
    {
      this.inputWritePos = 0;
      this.inputReadPos = 0;
      this.outputWritePos = 0;
      this.outputReadPos = 0;
      this.inputBuffer.fill(0);
      this.outputBuffer.fill(0);
      if (this.tempFrame) this.tempFrame.fill(0);
    }

    getInputAvailable()
    {
      return (this.inputWritePos - this.inputReadPos + this.bufferSize) % this.bufferSize;
    }

    getOutputAvailable()
    {
      return (this.outputWritePos - this.outputReadPos + this.bufferSize) % this.bufferSize;
    }

    process(inputList, outputList)
    {
      const sourceLimit = Math.min(inputList.length, outputList.length);
      const inputChannels = inputList[0] || [];
      const input = inputChannels[0];

      if (!input)
      {
        return true;
      }

      if (inputChannels.length !== 1)
      {
        this.reportUnsupportedChannelLayout(inputChannels, outputList);
        this.passthroughInputChannels(inputChannels, outputList, sourceLimit);

        return true;
      }

      if (!this.isInitialized || !this.dfModel || this.bypass || !this.tempFrame)
      {
        this.passthroughInputChannels(inputChannels, outputList, sourceLimit);

        return true;
      }

      try
      {
        for (let i = 0; i < input.length; i++)
        {
          this.inputBuffer[this.inputWritePos] = input[i];
          this.inputWritePos = (this.inputWritePos + 1) % this.bufferSize;
        }

        const frameLength = this.dfModel.frameLength;

        while (this.getInputAvailable() >= frameLength)
        {
          for (let i = 0; i < frameLength; i++)
          {
            this.tempFrame[i] = this.inputBuffer[this.inputReadPos];
            this.inputReadPos = (this.inputReadPos + 1) % this.bufferSize;
          }

          const processed = ans_process_frame(this.dfModel.handle, this.tempFrame);

          if (!processed || !Number.isFinite(processed.length) || processed.length > this.bufferSize)
          {
            throw new Error('DeepFilter returned invalid processed frame');
          }

          for (let i = 0; i < processed.length; i++)
          {
            this.outputBuffer[this.outputWritePos] = processed[i];
            this.outputWritePos = (this.outputWritePos + 1) % this.bufferSize;
          }
        }

        const outputAvailable = this.getOutputAvailable();

        if (outputAvailable >= 128)
        {
          for (let inputNum = 0; inputNum < sourceLimit; inputNum++)
          {
            const output = outputList[inputNum];
            const channelCount = output.length;

            for (let channelNum = 0; channelNum < channelCount; channelNum++)
            {
              const outputChannel = output[channelNum];
              let readPos = this.outputReadPos;

              for (let i = 0; i < 128; i++)
              {
                outputChannel[i] = this.outputBuffer[readPos];
                readPos = (readPos + 1) % this.bufferSize;
              }
            }
          }

          this.outputReadPos = (this.outputReadPos + 128) % this.bufferSize;
        }
        else
        {
          for (let inputNum = 0; inputNum < sourceLimit; inputNum++)
          {
            const output = outputList[inputNum];
            const channelCount = output.length;

            for (let channelNum = 0; channelNum < channelCount; channelNum++)
            {
              output[channelNum].fill(0);
            }
          }
        }
      }
      catch (error)
      {
        this.bypass = true;
        this.isInitialized = false;
        this.resetBuffers();
        this.passthroughInputChannels(inputChannels, outputList, sourceLimit);

        if (!this.hasReportedProcessingFailure && this.port && typeof this.port.postMessage === 'function')
        {
          this.hasReportedProcessingFailure = true;
          try
          {
            this.port.postMessage({
              type    : WorkletEventTypes.PROCESSING_FAILED,
              message : error && error.message ? error.message : String(error)
            });
          }
          catch (postError) {}
        }
      }

      return true;
    }
  }

  registerProcessor('ai-noise-suppression-audio-processor', DeepFilterAudioProcessor);
})();
}

module.exports = function()
{
  const source = workletMain.toString();

  return source.slice(source.indexOf('{') + 1, source.lastIndexOf('}'));
};
