/**
 * WatermarkManager — Composer 水印配置、加载和布局模块
 *
 * 负责将外部水印配置归一化为 renderer 可直接绘制的图片面，并按输出画布
 * 或每路 source 的 draw 区域计算最终绘制矩形。
 *
 * @module WatermarkManager
 */

const DEFAULT_TEXT_COLOR = '#fff';
const DEFAULT_TEXT_BACKGROUND = 'rgba(0,0,0,0.45)';
const DEFAULT_FONT_SIZE = 28;
const DEFAULT_PADDING = 3;
const DEFAULT_BACKGROUND_RADIUS = 3;
const DEFAULT_MARGIN = 16;

class WatermarkManager
{
  /**
   * @param {Object} options
   * @param {Object} options.logger - 日志记录器
   */
  constructor(options)
  {
    options = options || {};

    this._logger = options.logger;
    this._onIssue = typeof options.onIssue === 'function' ? options.onIssue : null;
    this._watermarks = [];
    this._seq = 0;

    if (this._logger)
    {
      this._logger.debug('WatermarkManager constructed');
    }
  }

  /**
   * 内部异常报告方法。
   *
   * 上报水印管理过程中的各类问题，包括：
   * - watermark-image-missing: 水印配置中缺少图片 URL
   * - watermark-image-load: 水印图片加载失败
   *
   * 设计要点：
   * - 水印加载失败不中断混流流程，混流器会跳过该水印继续处理
   * - 因此默认 fallbackApplied=true, degraded=true
   * - details 中包含 watermarkId、target、imageUrl 等信息，方便的排查具体是哪个水印出了什么问题
   *
   * @param {Object} [issue] - 问题描述对象
   */
  _reportIssue(issue)
  {
    if (!this._onIssue) return;
    try { this._onIssue(Object.assign({ component: 'WatermarkManager' }, issue)); }
    catch (e) { if (this._logger) this._logger.warn('WatermarkManager issue callback failed: ' + (e.message || String(e))); }
  }

  /**
   * 替换全部水印。图片 URL 会异步加载，加载失败只更新状态，不中断混流。
   *
   * @param {Array<Object>|Object|null} watermarks - 水印配置
   * @returns {Promise<Array<Object>>} 当前水印快照
   */
  setWatermarks(watermarks)
  {
    const list = this._normalizeWatermarkList(watermarks);

    if (this._logger)
    {
      this._logger.debug(`Setting watermarks: count=${list.length}`);
    }

    this._watermarks = list.map((watermark) => this._normalizeWatermark(watermark));

    const loads = this._watermarks.map((watermark) => this._prepareWatermark(watermark));

    return Promise.all(loads)
      .then(() => this.getWatermarks());
  }

  /**
   * 按条件清除水印。不传 filter 时清空全部。
   *
   * @param {Object} [filter] - { id, target, slot, sourceId, streamId }
   */
  clearWatermarks(filter)
  {
    if (this._logger)
    {
      this._logger.debug(`Clearing watermarks: filter=${JSON.stringify(filter || null)}`);
    }

    if (!filter)
    {
      this._watermarks = [];

      return;
    }

    this._watermarks = this._watermarks.filter((watermark) => !this._matchesFilter(watermark, filter));
  }

  /**
   * 返回当前水印只读快照。
   *
   * @returns {Array<Object>} 水印状态列表
   */
  getWatermarks()
  {
    return this._watermarks.map((watermark) => ({
      id               : watermark.id,
      target           : watermark.target,
      type             : watermark.type,
      text             : watermark.text,
      slot             : watermark.slot,
      sourceId         : watermark.sourceId,
      streamId         : watermark.streamId,
      position         : clonePosition(watermark.position),
      opacity          : watermark.opacity,
      width            : watermark.width,
      height           : watermark.height,
      fontSize         : watermark.fontSize,
      color            : watermark.color,
      backgroundColor  : watermark.backgroundColor,
      padding          : watermark.padding,
      backgroundRadius : watermark.backgroundRadius,
      margin           : watermark.margin,
      status           : watermark.status,
      reason           : watermark.reason
    }));
  }

  /**
   * 根据当前渲染 payload 计算 output/source 两类水印绘制项。
   *
   * @param {Object} payload - { width, height, items }
   * @returns {Object} { sourceWatermarks, outputWatermarks }
   */
  createRenderItems(payload)
  {
    payload = payload || {};

    const outputArea = {
      x      : 0,
      y      : 0,
      width  : payload.width || 1,
      height : payload.height || 1
    };
    const sourceWatermarks = [];
    const outputWatermarks = [];

    this._watermarks.forEach((watermark) =>
    {
      if (watermark.status !== 'ready' || !watermark.image)
      {
        return;
      }

      if (watermark.target === 'source')
      {
        (payload.items || []).forEach((item) =>
        {
          if (!this._matchesSource(watermark, item))
          {
            return;
          }

          sourceWatermarks.push(this._createDrawItem(watermark, item.draw, item));
        });

        return;
      }

      outputWatermarks.push(this._createDrawItem(watermark, outputArea, null));
    });

    return {
      sourceWatermarks : sourceWatermarks.filter(Boolean),
      outputWatermarks : outputWatermarks.filter(Boolean)
    };
  }

  _normalizeWatermarkList(watermarks)
  {
    if (!watermarks)
    {
      return [];
    }

    if (watermarks instanceof Array)
    {
      return watermarks;
    }

    return [ watermarks ];
  }

  _normalizeWatermark(input)
  {
    input = input || {};

    const type = input.type === 'image' || input.image ? 'image' : 'text';
    const target = input.target === 'source' ? 'source' : 'output';
    const id = typeof input.id === 'string' && input.id ? input.id : `watermark-${++this._seq}`;
    const fontSize = normalizePositiveInteger(input.fontSize, DEFAULT_FONT_SIZE);
    const backgroundRadiusInput = input.backgroundRadius !== undefined ? input.backgroundRadius : input.borderRadius;

    return {
      id               : id,
      target           : target,
      type             : type,
      text             : typeof input.text === 'string' ? input.text : '',
      imageInput       : input.image || null,
      image            : null,
      slot             : normalizeSlot(input.slot),
      sourceId         : typeof input.sourceId === 'string' ? input.sourceId : null,
      streamId         : typeof input.streamId === 'string' ? input.streamId : null,
      position         : normalizePosition(input.position),
      width            : normalizePositiveInteger(input.width, null),
      height           : normalizePositiveInteger(input.height, null),
      font             : typeof input.font === 'string' && input.font ? input.font : null,
      fontSize         : fontSize,
      color            : typeof input.color === 'string' ? input.color : DEFAULT_TEXT_COLOR,
      backgroundColor  : typeof input.backgroundColor === 'string' ? input.backgroundColor : DEFAULT_TEXT_BACKGROUND,
      opacity          : normalizeOpacity(input.opacity),
      padding          : normalizeNonNegativeInteger(input.padding, DEFAULT_PADDING),
      backgroundRadius : normalizeNonNegativeInteger(backgroundRadiusInput, DEFAULT_BACKGROUND_RADIUS),
      margin           : normalizeNonNegativeInteger(input.margin, DEFAULT_MARGIN),
      status           : 'pending',
      reason           : ''
    };
  }

  _prepareWatermark(watermark)
  {
    if (this._logger)
    {
      this._logger.debug(`Preparing watermark: id=${watermark.id} type=${watermark.type} target=${watermark.target}`);
    }

    if (watermark.type === 'image')
    {
      return this._prepareImageWatermark(watermark);
    }

    watermark.image = this._createTextSurface(watermark);
    watermark.status = watermark.image ? 'ready' : 'error';
    watermark.reason = watermark.image ? '' : 'Canvas is unavailable';

    return Promise.resolve(watermark);
  }

  _prepareImageWatermark(watermark)
  {
    const image = watermark.imageInput;

    if (!image)
    {
      watermark.status = 'error';
      watermark.reason = 'Missing image';
      this._reportIssue({
        stage   : 'watermark-image-missing',
        message : watermark.reason,
        details : {
          watermarkId : watermark.id,
          target      : watermark.target
        }
      });

      return Promise.resolve(watermark);
    }

    if (typeof image === 'string')
    {
      if (this._logger)
      {
        this._logger.debug(`Loading watermark image: id=${watermark.id} url=${image}`);
      }

      return this._loadImage(image)
        .then((loadedImage) =>
        {
          watermark.image = loadedImage;
          watermark.status = 'ready';
          watermark.reason = '';

          return watermark;
        })
        .catch((error) =>
        {
          watermark.status = 'error';
          watermark.reason = error.message || String(error);

          if (this._logger)
          {
            this._logger.warn(`Watermark image failed to load: id=${watermark.id} target=${watermark.target} reason=${watermark.reason} url=${image}`);
          }
          this._reportIssue({
            stage   : 'watermark-image-load',
            message : watermark.reason,
            details : {
              watermarkId : watermark.id,
              target      : watermark.target,
              imageUrl    : image
            }
          });

          return watermark;
        });
    }

    watermark.image = image;
    watermark.status = 'ready';
    watermark.reason = '';

    if (this._logger)
    {
      this._logger.debug(`Watermark image prepared from element: id=${watermark.id}`);
    }

    return Promise.resolve(watermark);
  }

  _loadImage(url)
  {
    return new Promise((resolve, reject) =>
    {
      if (typeof Image === 'undefined')
      {
        reject(new Error('Image constructor is unavailable'));

        return;
      }

      const image = new Image();

      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      image.src = url;
    });
  }

  _createTextSurface(watermark)
  {
    if (typeof document === 'undefined' || !document.createElement)
    {
      return null;
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext && canvas.getContext('2d');

    if (!context)
    {
      return null;
    }

    const text = watermark.text || '';
    const font = watermark.font || `bold ${watermark.fontSize}px sans-serif`;

    context.font = font;

    const metrics = context.measureText ? context.measureText(text) : null;
    const measured = metrics ? metrics.width : (text.length * watermark.fontSize * 0.6);
    const ascent = metrics && Number.isFinite(metrics.actualBoundingBoxAscent) ?
      metrics.actualBoundingBoxAscent :
      watermark.fontSize * 0.8;
    const descent = metrics && Number.isFinite(metrics.actualBoundingBoxDescent) ?
      metrics.actualBoundingBoxDescent :
      watermark.fontSize * 0.25;
    const width = Math.max(1, Math.ceil(measured + (watermark.padding * 2)));
    const height = Math.max(1, Math.ceil(ascent + descent + (watermark.padding * 2)));

    canvas.width = width;
    canvas.height = height;

    context.font = font;
    context.textBaseline = 'alphabetic';
    context.textAlign = 'left';

    if (watermark.backgroundColor)
    {
      context.fillStyle = watermark.backgroundColor;
      fillRoundedRect(context, 0, 0, width, height, watermark.backgroundRadius);
    }

    context.fillStyle = watermark.color;
    if (context.fillText)
    {
      context.fillText(text, watermark.padding, watermark.padding + ascent);
    }

    return canvas;
  }

  _createDrawItem(watermark, area, sourceItem)
  {
    if (!area || !watermark.image)
    {
      return null;
    }

    const imageWidth = watermark.image.width || watermark.image.videoWidth || 1;
    const imageHeight = watermark.image.height || watermark.image.videoHeight || 1;
    const size = this._resolveSize(watermark, imageWidth, imageHeight);
    const draw = this._resolveDrawRect(watermark, area, size.width, size.height);

    if (!draw || draw.width <= 0 || draw.height <= 0)
    {
      return null;
    }

    return {
      id       : watermark.id,
      target   : watermark.target,
      type     : watermark.type,
      image    : watermark.image,
      opacity  : watermark.opacity,
      draw     : draw,
      sourceId : sourceItem ? sourceItem.id : null,
      slot     : sourceItem ? sourceItem.slot : null,
      streamId : sourceItem ? sourceItem.streamId : null
    };
  }

  _resolveSize(watermark, imageWidth, imageHeight)
  {
    let width = watermark.width;
    let height = watermark.height;

    if (width && !height)
    {
      height = width * imageHeight / imageWidth;
    }
    else if (!width && height)
    {
      width = height * imageWidth / imageHeight;
    }
    else if (!width && !height)
    {
      width = imageWidth;
      height = imageHeight;
    }

    return {
      width  : Math.max(1, width),
      height : Math.max(1, height)
    };
  }

  _resolveDrawRect(watermark, area, width, height)
  {
    const position = watermark.position;
    let x;
    let y;

    if (position && typeof position === 'object')
    {
      x = area.x + position.x;
      y = area.y + position.y;
    }
    else
    {
      const margin = watermark.margin;

      switch (position)
      {
        case 'top-left':
          x = area.x + margin;
          y = area.y + margin;
          break;
        case 'top-center':
          x = area.x + ((area.width - width) / 2);
          y = area.y + margin;
          break;
        case 'top-right':
          x = area.x + area.width - width - margin;
          y = area.y + margin;
          break;
        case 'bottom-left':
          x = area.x + margin;
          y = area.y + area.height - height - margin;
          break;
        case 'bottom-center':
          x = area.x + ((area.width - width) / 2);
          y = area.y + area.height - height - margin;
          break;
        case 'center':
          x = area.x + ((area.width - width) / 2);
          y = area.y + ((area.height - height) / 2);
          break;
        case 'bottom-right':
        default:
          x = area.x + area.width - width - margin;
          y = area.y + area.height - height - margin;
          break;
      }
    }

    return {
      x      : Math.round(x),
      y      : Math.round(y),
      width  : Math.round(width),
      height : Math.round(height)
    };
  }

  _matchesSource(watermark, item)
  {
    if (!item)
    {
      return false;
    }

    if (watermark.sourceId)
    {
      return watermark.sourceId === item.id;
    }

    if (watermark.streamId)
    {
      return watermark.streamId === item.streamId;
    }

    if (typeof watermark.slot === 'number')
    {
      return watermark.slot === item.slot;
    }

    return true;
  }

  _matchesFilter(watermark, filter)
  {
    if (filter.id !== undefined && watermark.id !== filter.id)
    {
      return false;
    }

    if (filter.target !== undefined && watermark.target !== filter.target)
    {
      return false;
    }

    if (filter.slot !== undefined && watermark.slot !== filter.slot)
    {
      return false;
    }

    if (filter.sourceId !== undefined && watermark.sourceId !== filter.sourceId)
    {
      return false;
    }

    if (filter.streamId !== undefined && watermark.streamId !== filter.streamId)
    {
      return false;
    }

    return true;
  }
}

function normalizePositiveInteger(value, fallback)
{
  const numberValue = Number(value);

  if (Number.isFinite(numberValue) && numberValue > 0)
  {
    return Math.floor(numberValue);
  }

  return fallback;
}

function normalizeNonNegativeInteger(value, fallback)
{
  const numberValue = Number(value);

  if (Number.isFinite(numberValue) && numberValue >= 0)
  {
    return Math.floor(numberValue);
  }

  return fallback;
}

function normalizeOpacity(value)
{
  const numberValue = Number(value);

  if (Number.isFinite(numberValue))
  {
    return Math.min(1, Math.max(0, numberValue));
  }

  return 1;
}

function normalizeSlot(value)
{
  const numberValue = Number(value);

  if (Number.isFinite(numberValue) && numberValue >= 0)
  {
    return Math.floor(numberValue);
  }

  return null;
}

function normalizePosition(value)
{
  if (typeof value === 'string')
  {
    return value;
  }

  if (value && typeof value === 'object')
  {
    const x = Number(value.x);
    const y = Number(value.y);

    if (Number.isFinite(x) && Number.isFinite(y))
    {
      return { x, y };
    }
  }

  return 'bottom-right';
}

function clonePosition(position)
{
  if (position && typeof position === 'object')
  {
    return { x: position.x, y: position.y };
  }

  return position;
}

function fillRoundedRect(context, x, y, width, height, radius)
{
  const safeRadius = Math.max(0, Math.min(radius || 0, width / 2, height / 2));

  if (!safeRadius || typeof context.beginPath !== 'function')
  {
    context.fillRect(x, y, width, height);

    return;
  }

  if (typeof context.roundRect === 'function')
  {
    context.beginPath();
    context.roundRect(x, y, width, height, safeRadius);
    context.fill();

    return;
  }

  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
  context.fill();
}

module.exports = WatermarkManager;
