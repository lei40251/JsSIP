const MainCanvas2DRenderer = require('./MainCanvas2DRenderer');
const MainWebGL2Renderer = require('./MainWebGL2Renderer');
const WorkerRenderer = require('./WorkerRenderer');

/**
 * 根据 renderMode 创建实际渲染器。
 *
 * auto 模式优先尝试：
 *   worker-webgl2（Worker 内失败会自动降到 worker-2d）
 *   -> main-webgl2
 *   -> main-2d
 *
 * 注意：这里是 Mixer 第一个初始化输出 canvas context 的位置，避免不同 renderer 抢占 context。
 */
exports.createRenderer = function(canvas, config)
{
  const mode = config.renderMode || 'auto';
  const errors = [];

  if (mode === 'main-2d')
  {
    return createMain2D(canvas, config, false, '');
  }

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

  if (mode === 'worker-webgl2' || mode === 'worker-2d' || mode === 'auto')
  {
    try
    {
      const renderer = new WorkerRenderer(config, {
        requestedMode : mode,
        isFallback    : false,
        reason        : ''
      });

      renderer.init(canvas);

      return renderer;
    }
    catch (error)
    {
      errors.push(error.message || String(error));

      if (mode === 'worker-webgl2' || mode === 'worker-2d')
      {
        return createMainFallback(canvas, config, mode, errors.join('; '));
      }
    }
  }

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

  return createMain2D(canvas, config, errors.length > 0, errors.join('; '));
};

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
