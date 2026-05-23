/**
 * RendererFactory — 渲染器工厂
 *
 * 根据 renderMode 配置选择合适的渲染后端：
 *   - auto: 自动探测最优路径（Worker WebGL2 → 主线程 WebGL2 → Worker Canvas2D → 主线程 Canvas2D）
 *   - worker-webgl2 / worker-2d: Worker 线程渲染
 *   - main-webgl2 / main-2d: 主线程渲染
 *
 * 注意：这是 Mixer 中第一个初始化输出 canvas context 的位置，
 * 不同渲染器需依次尝试，避免 context 抢占（canvas 只能有一个上下文）。
 *
 * @module RendererFactory
 */
const MainCanvas2DRenderer = require('./MainCanvas2DRenderer');
const MainWebGL2Renderer = require('./MainWebGL2Renderer');
const WorkerRenderer = require('./WorkerRenderer');

/**
 * 创建渲染器实例。
 *
 * 自动模式（auto）的尝试顺序：
 *   1. 如果检测到 Safari/WKWebView，优先尝试 main-webgl2（Worker 在这些平台不稳定）
 *   2. 尝试 worker-webgl2（Worker 内 WebGL2）
 *   3. Worker WebGL2 失败 → 尝试 main-webgl2（主线程 WebGL2）
 *   4. Main WebGL2 不可用 → 尝试 worker-2d（Worker Canvas2D）
 *   5. Worker Canvas2D 不可用 → 回退 main-2d（主线程 Canvas2D）
 *
 * @param {HTMLCanvasElement} canvas - 输出 canvas
 * @param {Object} config - 混流配置（含 renderMode）
 * @returns {BaseRenderer} 渲染器实例
 */
exports.createRenderer = function(canvas, config, hooks)
{
  const mode = config.renderMode || 'auto';
  const errors = [];

  hooks = hooks || {};

  if (mode === 'main-2d')
  {
    return createMain2D(canvas, config, false, '');
  }

  // Safari/WKWebView: Worker WebGL2 支持有限，直接走主线程 WebGL2
  if (mode === 'auto' && shouldPreferMainWebGL2())
  {
    try
    {
      const renderer = new MainWebGL2Renderer(config, {
        requestedMode : mode,
        isFallback    : true,
        reason        : 'Safari/WKWebView prefers main-thread WebGL2 because Worker WebGL2 support is limited'
      });

      renderer.init(canvas);

      return renderer;
    }
    catch (error)
    {
      errors.push(error.message || String(error));
    }
  }

  // 尝试 Worker 渲染路径。auto 初始化阶段只尝试 worker-webgl2；
  // 如果异步失败，RenderLoop 会继续按 main-webgl2 -> worker-2d -> main-2d 降级。
  if (mode === 'worker-webgl2' || mode === 'worker-2d' || mode === 'auto')
  {
    try
    {
      const workerMode = mode === 'auto' ? 'worker-webgl2' : mode;
      const workerConfig = Object.assign({}, config, { renderMode: workerMode });
      const renderer = new WorkerRenderer(workerConfig, {
        requestedMode : mode,
        isFallback    : false,
        reason        : '',
        onFatalError  : hooks.onWorkerFatalError
      });

      renderer.init(canvas);

      return renderer;
    }
    catch (error)
    {
      errors.push(error.message || String(error));

      // 用户明确要求 Worker 但失败了 → 直接降级到主线程
      if (mode === 'worker-webgl2' || mode === 'worker-2d')
      {
        return createMainFallback(canvas, config, mode, errors.join('; '));
      }
    }
  }

  // 尝试主线程 WebGL2
  if (mode === 'main-webgl2' || mode === 'auto')
  {
    try
    {
      const renderer = new MainWebGL2Renderer(config, {
        requestedMode : mode,
        isFallback    : errors.length > 0,
        reason        : errors.join('; ')
      });

      renderer.init(canvas);

      return renderer;
    }
    catch (error)
    {
      errors.push(error.message || String(error));
    }
  }

  // 最终兜底：主线程 Canvas2D
  return createMain2D(canvas, config, errors.length > 0, errors.join('; '));
};

/**
 * Worker 失败后的主线程降级路径。
 * 先尝试 main-webgl2，再回退到 main-2d。
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Object} config
 * @param {string} requestedMode - 用户请求的模式
 * @param {string} reason - 降级原因
 * @returns {BaseRenderer}
 */
function createMainFallback(canvas, config, requestedMode, reason)
{
  if (requestedMode !== 'worker-2d')
  {
    try
    {
      const renderer = new MainWebGL2Renderer(config, {
        requestedMode : requestedMode,
        isFallback    : true,
        reason        : reason
      });

      renderer.init(canvas);

      return renderer;
    }
    catch (error)
    {}
  }

  return createMain2D(canvas, config, true, reason);
}

/**
 * 创建主线程 Canvas2D 渲染器（最终兜底）。
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Object} config
 * @param {boolean} isFallback - 是否为降级路径
 * @param {string} reason - 降级原因
 * @returns {MainCanvas2DRenderer}
 */
function createMain2D(canvas, config, isFallback, reason)
{
  const renderer = new MainCanvas2DRenderer(config, {
    requestedMode : config.renderMode || 'auto',
    isFallback    : Boolean(isFallback),
    reason        : reason || ''
  });

  renderer.init(canvas);

  return renderer;
}

/**
 * 检测是否应优先使用主线程 WebGL2。
 *
 * Safari 和 WKWebView 的 Worker + WebGL2 支持不稳定，
 * 在这些浏览器上直接走 main-webgl2 避免 Worker 初始化的开销和风险。
 *
 * @returns {boolean} true=应优先使用主线程 WebGL2
 */
function shouldPreferMainWebGL2()
{
  if (typeof navigator === 'undefined')
  {
    return false;
  }

  const ua = navigator.userAgent || '';
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/i.test(ua);
  const isIOSWebView = /iPhone|iPad|iPod/i.test(ua) && !/Safari/i.test(ua);

  return isSafari || isIOSWebView;
}
