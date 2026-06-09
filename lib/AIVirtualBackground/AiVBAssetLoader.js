/**
 * AiVBAssetLoader —— 通过向 document 注入 <script type="module"> 标签，
 * 动态加载 MediaPipe Tasks Vision 运行时。
 *
 * 核心行为：
 *   - 每个唯一的 moduleUrl 只对应一个 script 标签。如果标签已存在（由其他
 *     AIVirtualBackground 实例或之前的加载创建），则等待它完成，而不是注入重复标签。
 *   - 运行时全局变量（FilesetResolver、ImageSegmenter）暴露在
 *     `window.CRTCAiVBVisionTasks` 上。
 *   - 加载 Promise 按 moduleUrl 全局去重，因此并发的 AIVirtualBackground 实例不会触发重复请求。
 *
 * @module AiVBAssetLoader
 */

const Logger = require('../Logger');
const Config = require('./AiVBConfig');

const logger = new Logger('AiVBAssetLoader');

/** window 上存储 MediaPipe Tasks 全局变量的键名 */
const TASKS_GLOBAL = 'CRTCAiVBVisionTasks';

/** 注入的 script 加载完成后设置的 data 属性，值为 'true' */
const SCRIPT_READY_ATTR = 'data-aivb-ready';

/** 注入的 script 加载失败后设置的 data 属性，值为 'true' */
const SCRIPT_ERROR_ATTR = 'data-aivb-error';

/** 等待已存在的 script 标签完成加载的最大时间（毫秒） */
const SCRIPT_WAIT_TIMEOUT_MS = 15000;

/** 轮询模块脚本执行结果的间隔（毫秒） */
const SCRIPT_POLL_INTERVAL_MS = 50;

/**
 * 全局去重表：moduleUrl → Promise<void>。
 *
 * 每个 moduleUrl 同一时间只有一个加载在进行；后续调用方等待同一个 Promise。
 *
 * @type {Object.<string, Promise<void>>}
 */
const TASKS_LOAD_PROMISES = {};

module.exports = class AiVBAssetLoader
{
  /**
   * @param {Object} [assetConfig] — 原始资源配置（参见 AiVBConfig.normalizeAssetConfig）
   */
  constructor(assetConfig)
  {
    /** @type {Object} 归一化后的资源配置，包含解析完成的 URL */
    this.assetConfig = Config.normalizeAssetConfig(assetConfig);
  }

  /**
   * 返回 MediaPipe FilesetResolver 和 ImageSegmenter 工厂所需的运行时选项。
   *
   * @param {string} [modelPath] — 可选的按实例覆盖的模型 URL
   * @returns {{ moduleUrl: string, wasmBaseUrl: string, modelUrl: string }}
   */
  getRuntimeOptions(modelPath)
  {
    return {
      moduleUrl   : this.assetConfig.moduleUrl,
      wasmBaseUrl : this.assetConfig.wasmBaseUrl,
      modelUrl    : this.resolveModelUrl(modelPath)
    };
  }

  /**
   * 解析模型 URL：显式传入的 modelPath 优先，否则使用配置的默认值。
   *
   * @private
   * @param {string} [modelPath]
   * @returns {string}
   */
  resolveModelUrl(modelPath)
  {
    if (typeof modelPath === 'string' && modelPath.trim())
    {
      return modelPath.trim();
    }

    return this.assetConfig.modelUrl;
  }

  /**
   * 确保 MediaPipe Tasks Vision 运行时已加载并在 `window[TASKS_GLOBAL]` 上可用。
   *
   * 若已加载则立即返回。否则注入 <script type="module"> 标签（或等待已有的标签完成）。
   *
   * @returns {Promise<{ FilesetResolver: Object, ImageSegmenter: Object }>}
   *   Tasks 全局命名空间
   * @throws {Error} 如果不在浏览器环境中运行
   */
  async ensureTasksLoaded()
  {
    if (typeof window === 'undefined' || typeof document === 'undefined')
    {
      throw new Error('AIVirtualBackground requires browser environment');
    }

    // 已加载 —— 立即返回
    if (window[TASKS_GLOBAL])
    {
      return window[TASKS_GLOBAL];
    }

    const moduleUrl = this.assetConfig.moduleUrl;

    // 其他调用方正在加载此 moduleUrl —— 等待它完成
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

  /**
   * 注入 <script type="module"> 标签，从给定 moduleUrl 导入 FilesetResolver
   * 和 ImageSegmenter，并将其暴露在 `window[TASKS_GLOBAL]` 上。
   *
   * 如果 DOM 中已存在此 moduleUrl 的 script 标签，则委托给 `waitForExistingScript`
   * 而不是注入重复标签。
   *
   * @private
   * @param {string} moduleUrl — MediaPipe Tasks Vision ESM 包的 URL
   * @returns {Promise<void>}
   */
  async loadTasksRuntime(moduleUrl)
  {
    const selector = `script[data-aivb-module="${moduleUrl}"]`;
    const existingScript = document.querySelector(selector);

    if (existingScript)
    {
      await this.waitForExistingScript(existingScript, moduleUrl);

      return window[TASKS_GLOBAL];
    }

    await new Promise((resolve, reject) =>
    {
      const script = document.createElement('script');
      let timeoutId = null;
      let intervalId = null;

      function cleanup()
      {
        if (timeoutId)
        {
          window.clearTimeout(timeoutId);
        }
        if (intervalId)
        {
          window.clearInterval(intervalId);
        }
        script.onerror = null;
      }

      script.type = 'module';
      script.async = true;
      script.setAttribute('data-aivb-module', moduleUrl);

      // 内联 ESM import —— 无需单独的 JS 文件
      script.textContent = `import { FilesetResolver, ImageSegmenter } from '${moduleUrl}';
        window.${TASKS_GLOBAL} = { FilesetResolver, ImageSegmenter };`;

      script.onerror = () =>
      {
        cleanup();
        script.setAttribute(SCRIPT_ERROR_ATTR, 'true');
        reject(new Error(`Failed to load MediaPipe Tasks runtime: ${moduleUrl}`));
      };

      document.head.appendChild(script);

      intervalId = window.setInterval(() =>
      {
        if (window[TASKS_GLOBAL])
        {
          cleanup();
          script.setAttribute(SCRIPT_READY_ATTR, 'true');
          script.removeAttribute(SCRIPT_ERROR_ATTR);
          resolve();
        }
      }, SCRIPT_POLL_INTERVAL_MS);

      timeoutId = window.setTimeout(() =>
      {
        cleanup();
        reject(new Error(`Timed out waiting for MediaPipe Tasks runtime: ${moduleUrl}`));
      }, SCRIPT_WAIT_TIMEOUT_MS);
    });
  }

  /**
   * 等待由其他 AIVirtualBackground 实例（或之前的页面加载）注入的 script 标签完成加载。
   *
   * 处理三种情况：
   *   1. 全局变量已设置 → 立即返回
   *   2. script 之前加载失败 → 立即抛出
   *   3. script 仍在加载中 → 绑定 load/error 事件监听并等待（带超时）
   *
   * @private
   * @param {HTMLScriptElement} script — DOM 中已存在的 script 元素
   * @param {string} moduleUrl — 模块 URL（用于错误消息）
   * @returns {Promise<void>}
   * @throws {Error} 如果 script 加载失败或超时
   */
  async waitForExistingScript(script, moduleUrl)
  {
    // 情况 1：全局变量已可用
    if (window[TASKS_GLOBAL])
    {
      return;
    }

    // 情况 2：已有的 script 已加载失败
    if (script.getAttribute(SCRIPT_ERROR_ATTR) === 'true')
    {
      throw new Error(`Failed to load MediaPipe Tasks runtime: ${moduleUrl}`);
    }

    // 边缘情况：script 标记为就绪但全局变量缺失
    if (script.getAttribute(SCRIPT_READY_ATTR) === 'true')
    {
      if (window[TASKS_GLOBAL])
      {
        return;
      }

      throw new Error(`MediaPipe Tasks runtime loaded but global not found: ${moduleUrl}`);
    }

    // 情况 3：script 仍在加载中 —— 轮询全局变量 / 状态属性
    await new Promise((resolve, reject) =>
    {
      let timeoutId = null;
      let intervalId = null;

      function cleanup()
      {
        if (timeoutId)
        {
          window.clearTimeout(timeoutId);
        }
        if (intervalId)
        {
          window.clearInterval(intervalId);
        }
      }

      intervalId = window.setInterval(() =>
      {
        if (window[TASKS_GLOBAL] || script.getAttribute(SCRIPT_READY_ATTR) === 'true')
        {
          cleanup();
          resolve();

          return;
        }

        if (script.getAttribute(SCRIPT_ERROR_ATTR) === 'true')
        {
          cleanup();
          reject(new Error(`Failed to load MediaPipe Tasks runtime: ${moduleUrl}`));
        }
      }, SCRIPT_POLL_INTERVAL_MS);

      timeoutId = window.setTimeout(() =>
      {
        cleanup();
        reject(new Error(`Timed out waiting for MediaPipe Tasks runtime: ${moduleUrl}`));
      }, SCRIPT_WAIT_TIMEOUT_MS);
    });
  }
};
