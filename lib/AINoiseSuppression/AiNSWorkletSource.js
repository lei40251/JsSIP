/* eslint-disable */
/**
 * AINoiseSuppression AudioWorklet inline source.
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
    const idx = wasm.__externref_table_alloc();

    wasm.__wbindgen_externrefs.set(idx, obj);

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

      wasm.__wbindgen_exn_store(idx);
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
    const ptr0 = passArray8ToWasm0(modelBytes, wasm.__wbindgen_malloc);
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
    const ptr0 = passArrayF32ToWasm0(input, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;

    return wasm.ans_process_frame(st, ptr0, len0);
  }

  function ans_set_atten_lim(st, limDb)
  {
    wasm.ans_set_atten_lim(st, limDb);
  }

  function __wbg_get_imports()
  {
    const import0 = {
      __proto__ : null,
      __wbg___wbindgen_is_function_754e9f305ff6029e(arg0)
      {
        return typeof arg0 === 'function';
      },
      __wbg___wbindgen_is_object_56732c2bc353f41d(arg0)
      {
        return typeof arg0 === 'object' && arg0 !== null;
      },
      __wbg___wbindgen_is_string_c236cabd84a4d769(arg0)
      {
        return typeof arg0 === 'string';
      },
      __wbg___wbindgen_is_undefined_67b456be8673d3d7(arg0)
      {
        return arg0 === undefined;
      },
      __wbg___wbindgen_memory_fbc4c3e30b409f08()
      {
        return wasm.memory;
      },
      __wbg___wbindgen_throw_1506f2235d1bdba0(arg0, arg1)
      {
        throw new Error(getStringFromWasm0(arg0, arg1));
      },
      __wbg_buffer_dab8cf7849f66ff8(arg0)
      {
        return arg0.buffer;
      },
      __wbg_call_4ffe5b44583f9954()
      {
        return handleError(function(arg0, arg1, arg2)
        {
          return arg0.call(arg1, arg2);
        }, arguments);
      },
      __wbg_call_aa058b3a50f1c0a1()
      {
        return handleError(function(arg0, arg1)
        {
          return arg0.call(arg1);
        }, arguments);
      },
      __wbg_crypto_90efa04a103d6db2(arg0)
      {
        return arg0.crypto;
      },
      __wbg_getRandomValues_b9488c03d6ecdc0d()
      {
        return handleError(function(arg0, arg1)
        {
          arg0.getRandomValues(arg1);
        }, arguments);
      },
      __wbg_globalThis_d76c93eb4fcb97ff()
      {
        return handleError(function()
        {
          return globalThis.globalThis;
        }, arguments);
      },
      __wbg_global_d5571d09e84f338f()
      {
        return handleError(function()
        {
          return global.global;
        }, arguments);
      },
      __wbg_msCrypto_68b2f4999b2901b0(arg0)
      {
        return arg0.msCrypto;
      },
      __wbg_new_1c499b98736d881b(arg0)
      {
        return new Float32Array(arg0);
      },
      __wbg_new_f3375b05b49ca4cb(arg0)
      {
        return new Uint8Array(arg0);
      },
      __wbg_new_no_args_4856846a7397439f(arg0, arg1)
      {
        return new Function(getStringFromWasm0(arg0, arg1));
      },
      __wbg_new_with_byte_offset_and_length_ae71716dc4a8aa2f(arg0, arg1, arg2)
      {
        return new Float32Array(arg0, arg1 >>> 0, arg2 >>> 0);
      },
      __wbg_new_with_byte_offset_and_length_c74776d039a72b10(arg0, arg1, arg2)
      {
        return new Uint8Array(arg0, arg1 >>> 0, arg2 >>> 0);
      },
      __wbg_new_with_length_135fb0a3b25f39fc(arg0)
      {
        return new Uint8Array(arg0 >>> 0);
      },
      __wbg_node_046e1cb1b8cf3d92(arg0)
      {
        return arg0.node;
      },
      __wbg_process_7b13606d1afee88f(arg0)
      {
        return arg0.process;
      },
      __wbg_randomFillSync_73a2861b2e659112()
      {
        return handleError(function(arg0, arg1)
        {
          arg0.randomFillSync(arg1);
        }, arguments);
      },
      __wbg_require_01ac6430ef887047()
      {
        return handleError(function()
        {
          return module.require;
        }, arguments);
      },
      __wbg_self_84d02e00450d52f3()
      {
        return handleError(function()
        {
          return self.self;
        }, arguments);
      },
      __wbg_set_8ab55bbf9f2507cd(arg0, arg1, arg2)
      {
        arg0.set(arg1, arg2 >>> 0);
      },
      __wbg_subarray_a1d2eeb856ccb090(arg0, arg1, arg2)
      {
        return arg0.subarray(arg1 >>> 0, arg2 >>> 0);
      },
      __wbg_versions_6963303269777792(arg0)
      {
        return arg0.versions;
      },
      __wbg_window_58f68528f5b015de()
      {
        return handleError(function()
        {
          return window.window;
        }, arguments);
      },
      __wbindgen_cast_0000000000000001(arg0, arg1)
      {
        return getStringFromWasm0(arg0, arg1);
      },
      __wbindgen_init_externref_table()
      {
        const table = wasm.__wbindgen_externrefs;
        const offset = table.grow(4);

        table.set(0, undefined);
        table.set(offset + 0, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
      }
    };

    return {
      __proto__      : null,
      './ans_bg.js'  : import0
    };
  }

  function __wbg_finalize_init(instance, module)
  {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedFloat32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();

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

      try
      {
        initSync(options.processorOptions.wasmBytes);
        const modelBytes = new Uint8Array(options.processorOptions.modelBytes);
        const suppressionLevel = options.processorOptions.suppressionLevel;
        const handle = ans_create(modelBytes, suppressionLevel == null ? 50 : suppressionLevel);
        const frameLength = ans_get_frame_length(handle);

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
          this.bypass = Boolean(data.value);
          break;
      }
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
      const input = inputList[0] && inputList[0][0];

      if (!input)
      {
        return true;
      }

      if (!this.isInitialized || !this.dfModel || this.bypass || !this.tempFrame)
      {
        for (let inputNum = 0; inputNum < sourceLimit; inputNum++)
        {
          const output = outputList[inputNum];
          const channelCount = output.length;

          for (let channelNum = 0; channelNum < channelCount; channelNum++)
          {
            output[channelNum].set(input);
          }
        }

        return true;
      }

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
