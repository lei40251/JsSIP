const Logger = require('../Logger');
const Config = require('./AiVBEConfig');

const logger = new Logger('AiVBEAssetLoader');
const TASKS_GLOBAL = 'CRTCAiVBEVisionTasks';
const SCRIPT_READY_ATTR = 'data-aivbe-ready';
const SCRIPT_ERROR_ATTR = 'data-aivbe-error';
const SCRIPT_WAIT_TIMEOUT_MS = 15000;
const TASKS_LOAD_PROMISES = {};

module.exports = class AiVBEAssetLoader
{
  constructor(assetConfig)
  {
    this.assetConfig = Config.normalizeAssetConfig(assetConfig);
  }

  getRuntimeOptions(modelPath)
  {
    return {
      moduleUrl   : this.assetConfig.moduleUrl,
      wasmBaseUrl : this.assetConfig.wasmBaseUrl,
      modelUrl    : this.resolveModelUrl(modelPath)
    };
  }

  resolveModelUrl(modelPath)
  {
    if (typeof modelPath === 'string' && modelPath.trim())
    {
      return modelPath.trim();
    }

    return this.assetConfig.modelUrl;
  }

  async ensureTasksLoaded()
  {
    if (typeof window === 'undefined' || typeof document === 'undefined')
    {
      throw new Error('AiVBE requires browser environment');
    }

    if (window[TASKS_GLOBAL])
    {
      return window[TASKS_GLOBAL];
    }

    const moduleUrl = this.assetConfig.moduleUrl;

    if (TASKS_LOAD_PROMISES[moduleUrl])
    {
      await TASKS_LOAD_PROMISES[moduleUrl];

      return window[TASKS_GLOBAL];
    }

    TASKS_LOAD_PROMISES[moduleUrl] = this.loadTasksRuntime(moduleUrl);

    try
    {
      await TASKS_LOAD_PROMISES[moduleUrl];
    }
    finally
    {
      delete TASKS_LOAD_PROMISES[moduleUrl];
    }

    logger.debug(`Loaded MediaPipe Tasks runtime: ${moduleUrl}`);

    return window[TASKS_GLOBAL];
  }

  async loadTasksRuntime(moduleUrl)
  {
    const selector = `script[data-aivbe-module="${moduleUrl}"]`;
    const existingScript = document.querySelector(selector);

    if (existingScript)
    {
      await this.waitForExistingScript(existingScript, moduleUrl);

      return window[TASKS_GLOBAL];
    }

    await new Promise((resolve, reject) =>
    {
      const script = document.createElement('script');

      script.type = 'module';
      script.async = true;
      script.setAttribute('data-aivbe-module', moduleUrl);
      script.textContent = `import { FilesetResolver, ImageSegmenter } from '${moduleUrl}';
        window.${TASKS_GLOBAL} = { FilesetResolver, ImageSegmenter };`;
      script.onload = () =>
      {
        script.setAttribute(SCRIPT_READY_ATTR, 'true');
        script.removeAttribute(SCRIPT_ERROR_ATTR);
        resolve();
      };
      script.onerror = () =>
      {
        script.setAttribute(SCRIPT_ERROR_ATTR, 'true');
        reject(new Error(`Failed to load MediaPipe Tasks runtime: ${moduleUrl}`));
      };
      document.head.appendChild(script);
    });
  }

  async waitForExistingScript(script, moduleUrl)
  {
    if (window[TASKS_GLOBAL])
    {
      return;
    }

    if (script.getAttribute(SCRIPT_ERROR_ATTR) === 'true')
    {
      throw new Error(`Failed to load MediaPipe Tasks runtime: ${moduleUrl}`);
    }

    if (script.getAttribute(SCRIPT_READY_ATTR) === 'true')
    {
      if (window[TASKS_GLOBAL])
      {
        return;
      }

      throw new Error(`MediaPipe Tasks runtime loaded but global not found: ${moduleUrl}`);
    }

    await new Promise((resolve, reject) =>
    {
      let timeoutId = null;

      function cleanup()
      {
        if (timeoutId)
        {
          window.clearTimeout(timeoutId);
        }
        script.removeEventListener('load', handleLoad);
        script.removeEventListener('error', handleError);
      }
      function handleLoad()
      {
        cleanup();
        script.setAttribute(SCRIPT_READY_ATTR, 'true');
        script.removeAttribute(SCRIPT_ERROR_ATTR);
        resolve();
      }
      function handleError()
      {
        cleanup();
        script.setAttribute(SCRIPT_ERROR_ATTR, 'true');
        reject(new Error(`Failed to load MediaPipe Tasks runtime: ${moduleUrl}`));
      }

      timeoutId = window.setTimeout(() =>
      {
        cleanup();
        reject(new Error(`Timed out waiting for MediaPipe Tasks runtime: ${moduleUrl}`));
      }, SCRIPT_WAIT_TIMEOUT_MS);

      script.addEventListener('load', handleLoad);
      script.addEventListener('error', handleError);
    });
  }
};
