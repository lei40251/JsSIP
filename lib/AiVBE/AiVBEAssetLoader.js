const Logger = require('../Logger');
const Config = require('./AiVBEConfig');
const AssetManifest = require('./AiVBEAssetManifest');

const logger = new Logger('AiVBEAssetLoader');
const SCRIPT_READY_ATTR = 'data-aivbe-ready';
const SCRIPT_ERROR_ATTR = 'data-aivbe-error';
const SCRIPT_WAIT_TIMEOUT_MS = 15000;

module.exports = class AiVBEAssetLoader
{
  constructor(assetConfig)
  {
    this.assetConfig = Config.normalizeAssetConfig(assetConfig);
  }

  getAssetUrls(modelPath)
  {
    return {
      visionScriptUrl : this.assetConfig.visionScriptUrl,
      visionBaseUrl   : this.assetConfig.visionBaseUrl,
      modelUrl        : this.resolveModelUrl(modelPath),
      runtimeGlobal   : AssetManifest.RUNTIME_GLOBAL
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

  async ensureScriptLoaded()
  {
    if (typeof window === 'undefined' || typeof document === 'undefined')
    {
      throw new Error('AiVBE requires browser environment');
    }

    if (window[AssetManifest.RUNTIME_GLOBAL])
    {
      return window[AssetManifest.RUNTIME_GLOBAL];
    }

    const scriptUrl = this.assetConfig.visionScriptUrl;
    const selector = `script[data-aivbe-script="${scriptUrl}"]`;
    const existingScript = document.querySelector(selector);

    if (existingScript)
    {
      await this.waitForExistingScript(existingScript, scriptUrl);

      return window[AssetManifest.RUNTIME_GLOBAL];
    }

    await new Promise((resolve, reject) =>
    {
      const script = document.createElement('script');

      script.src = scriptUrl;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.setAttribute('data-aivbe-script', scriptUrl);
      script.onload = () =>
      {
        script.setAttribute(SCRIPT_READY_ATTR, 'true');
        script.removeAttribute(SCRIPT_ERROR_ATTR);
        resolve();
      };
      script.onerror = () =>
      {
        script.setAttribute(SCRIPT_ERROR_ATTR, 'true');
        reject(new Error(`Failed to load MediaPipe runtime script: ${scriptUrl}`));
      };
      document.head.appendChild(script);
    });

    logger.debug(`Loaded MediaPipe runtime script: ${scriptUrl}`);

    return window[AssetManifest.RUNTIME_GLOBAL];
  }

  async waitForExistingScript(script, scriptUrl)
  {
    if (window[AssetManifest.RUNTIME_GLOBAL])
    {
      return;
    }

    if (script.getAttribute(SCRIPT_ERROR_ATTR) === 'true')
    {
      throw new Error(`Failed to load MediaPipe runtime script: ${scriptUrl}`);
    }

    if (script.getAttribute(SCRIPT_READY_ATTR) === 'true')
    {
      if (window[AssetManifest.RUNTIME_GLOBAL])
      {
        return;
      }

      throw new Error(`MediaPipe runtime script loaded but global not found: ${scriptUrl}`);
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
        reject(new Error(`Failed to load MediaPipe runtime script: ${scriptUrl}`));
      }

      timeoutId = window.setTimeout(() =>
      {
        cleanup();
        reject(new Error(`Timed out waiting for MediaPipe runtime script: ${scriptUrl}`));
      }, SCRIPT_WAIT_TIMEOUT_MS);

      script.addEventListener('load', handleLoad);
      script.addEventListener('error', handleError);
    });
  }
};
