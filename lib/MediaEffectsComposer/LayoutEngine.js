/**
 * LayoutEngine — 混流器布局引擎
 *
 * 根据输入源的数量和 slot 分配，计算每路视频在固定输出画布上的绘制位置和尺寸，
 * 生成渲染 payload。画布尺寸由配置指定（默认 1280x720），不随源数量动态变化。
 *
 * @module LayoutEngine
 */
class LayoutEngine
{
  /**
   * @param {Object} options
   * @param {Object} options.sourceRegistry - Sources 实例
   * @param {HTMLCanvasElement} options.canvas - 输出 canvas 元素
   * @param {Object} options.config - 混流配置对象
   * @param {Function} options.prepareCanvas - 设置 canvas 尺寸的方法
   * @param {Function} options.resizeRenderer - 调整渲染器尺寸的方法
   * @param {Function} options.createWatermarkItems - 创建水印绘制项的方法
   * @param {Function} [options.resolveMirrorX] - 解析 source 是否水平镜像的方法
   */
  constructor(options)
  {
    options = options || {};

    this._sourceRegistry = options.sourceRegistry;
    this._canvas = options.canvas;
    this._config = options.config;
    this._prepareCanvas = options.prepareCanvas;
    this._resizeRenderer = options.resizeRenderer;
    this._createWatermarkItems = options.createWatermarkItems;
    this._resolveMirrorX = options.resolveMirrorX;
    this._logger = options.logger || null;

    /** @type {Object<string,HTMLCanvasElement>} 纯音频源的占位图画布缓存 */
    this._audioPlaceholders = {};

    /** @type {number|null} 上次布局的行列数缓存，用于抑制不变时的重复日志 */
    this._lastLayoutCols = null;
    this._lastLayoutRows = null;

    /** @type {number|null} 上次 payload 的条目数/尺寸缓存 */
    this._lastPayloadStats = null;

    if (this._logger)
    {
      this._logger.debug('LayoutEngine constructed');
    }
  }

  /**
   * 生成一帧的渲染 payload。
   *
   * 按 slot 将源排列到自动计算的网格中，画板尺寸固定。
   * 每个源按 slot 计算所在行列位置，支持动态增减源。
   *
   * @returns {Object} 渲染 payload { width, height, backgroundColor, items }
   */
  createRenderPayload()
  {
    this._prepareCanvas();
    this._resizeRenderer(this._canvas.width, this._canvas.height);

    const layout = this._calcLayout();
    const cellWidth = this._canvas.width / layout.cols;
    const cellHeight = this._canvas.height / layout.rows;
    const items = [];

    this._sourceRegistry.sources.forEach((source) =>
    {
      const hasVideo = this._sourceRegistry.hasVideoTrack(source);
      const hasAudio = this._sourceRegistry.hasLiveAudioTrack(source);

      // 无视频也无音频的源完全跳过
      if (!hasVideo && !hasAudio)
      {
        return;
      }

      const slot = typeof source.slot === 'number' ? source.slot : 0;
      const col = slot % layout.cols;
      const row = Math.floor(slot / layout.cols);
      const targetX = col * cellWidth;
      const targetY = row * cellHeight;

      if (hasVideo)
      {
        // 有视频轨 → 按原有逻辑等比缩放后绘制
        const draw = this._calcDrawRect(source.video, targetX, targetY, cellWidth, cellHeight);
        const mirrorX = this._resolveMirror(source, slot);

        if (draw)
        {
          items.push({
            id                  : source.id,
            streamId            : this._getSourceStreamId(source),
            slot                : slot,
            video               : source.video,
            source              : source,
            mirrorX             : mirrorX,
            aiVirtualBackground : source.aiVirtualBackground || null,
            draw                : draw
          });
        }
      }
      else
      {
        // 纯音频源 → 生成占位图画布，填满整个格子
        const placeholder = this._createPlaceholderCanvas(slot, cellWidth, cellHeight);

        if (placeholder)
        {
          const mirrorX = this._resolveMirror(source, slot);

          items.push({
            id                  : source.id,
            streamId            : this._getSourceStreamId(source),
            slot                : slot,
            video               : placeholder,
            source              : source,
            mirrorX             : mirrorX,
            aiVirtualBackground : source.aiVirtualBackground || null,
            draw                : {
              x      : targetX,
              y      : targetY,
              width  : cellWidth,
              height : cellHeight
            }
          });
        }
      }
    });

    const payload = {
      width                      : this._canvas.width,
      height                     : this._canvas.height,
      backgroundColor            : this._config.backgroundColor,
      outputMirrorX              : Boolean(this._config.outputMirrorX),
      mirrorWatermarksWithOutput : this._config.mirrorWatermarksWithOutput !== false,
      items                      : items,
      sourceWatermarks           : [],
      outputWatermarks           : []
    };
    const watermarks = this._createWatermarkItems ? this._createWatermarkItems(payload) : null;

    if (watermarks)
    {
      payload.sourceWatermarks = watermarks.sourceWatermarks || [];
      payload.outputWatermarks = watermarks.outputWatermarks || [];
    }

    if (this._logger)
    {
      const stats = `size=${payload.width}x${payload.height} items=${items.length} sourceWatermarks=${payload.sourceWatermarks.length} outputWatermarks=${payload.outputWatermarks.length}`;

      if (stats !== this._lastPayloadStats)
      {
        this._logger.debug(`Render payload created: ${stats}`);
        this._lastPayloadStats = stats;
      }
    }

    return payload;
  }

  _resolveMirror(source, slot)
  {
    if (typeof this._resolveMirrorX === 'function')
    {
      return Boolean(this._resolveMirrorX(source, slot));
    }

    return false;
  }

  clearAudioPlaceholderCache()
  {
    this._audioPlaceholders = {};
  }

  /**
   * 获取 source 关联的 stream id，用于 source watermark 匹配。
   *
   * @param {Object} source - 内部 source 对象
   * @returns {string|null} stream id
   */
  _getSourceStreamId(source)
  {
    const stream = this._sourceRegistry.getStream(source);

    return stream ? stream.id : null;
  }

  /**
   * 计算网格的行列数。
   *
   * 根据最大 slot 编号和总源数确定网格大小：
   *   1 路 → 1x1         2 路 → 按画布比例 1x2 或 2x1
   *   3~4 路 → 2x2      5~6 路 → 按比例 2x3 或 3x2
   *   7~9 路 → 3x3      10+ 路 → 尽可能接近正方形
   *
   * @returns {Object} { cols: number, rows: number }
   */
  _calcLayout()
  {
    let maxSlot = -1;

    this._sourceRegistry.sources.forEach((source) =>
    {
      if (typeof source.slot === 'number' && source.slot > maxSlot)
      {
        maxSlot = source.slot;
      }
    });

    const count = Math.max(maxSlot + 1, this._sourceRegistry.sources.length, 1);
    const isPortrait = this._canvas.height > this._canvas.width;
    let cols = 1;
    let rows = 1;

    if (count <= 1)
    {
      cols = 1;
      rows = 1;
    }
    else if (count <= 2)
    {
      if (isPortrait)
      {
        cols = 1;
        rows = 2;
      }
      else
      {
        cols = 2;
        rows = 1;
      }
    }
    else if (count <= 4)
    {
      cols = 2;
      rows = 2;
    }
    else if (count <= 6)
    {
      if (isPortrait)
      {
        cols = 2;
        rows = 3;
      }
      else
      {
        cols = 3;
        rows = 2;
      }
    }
    else if (count <= 9)
    {
      cols = 3;
      rows = 3;
    }
    else
    {
      cols = Math.ceil(Math.sqrt(count));
      rows = Math.ceil(count / cols);
    }

    const layout = { cols, rows };

    if (this._logger && (cols !== this._lastLayoutCols || rows !== this._lastLayoutRows))
    {
      this._logger.debug(`Layout calculated: count=${count} cols=${cols} rows=${rows} portrait=${isPortrait}`);
      this._lastLayoutCols = cols;
      this._lastLayoutRows = rows;
    }

    return layout;
  }

  /**
   * 计算一路视频在画布上的实际绘制矩形。
   * 保持视频原始宽高比，在目标区域内居中显示。
   *
   * @param {HTMLVideoElement} video - video 元素
   * @param {number} targetX - 目标区域左上角 X
   * @param {number} targetY - 目标区域左上角 Y
   * @param {number} targetWidth - 目标区域宽度
   * @param {number} targetHeight - 目标区域高度
   * @returns {Object|null} 绘制矩形 { x, y, width, height }，无法计算时返回 null
   */
  _calcDrawRect(video, targetX, targetY, targetWidth, targetHeight)
  {
    const newVideo = this._scaleVideo(video.videoWidth, video.videoHeight, targetWidth, targetHeight);

    if (!newVideo || !newVideo.width || !newVideo.height)
    {
      return null;
    }

    return {
      x      : targetX + newVideo.offsetX,
      y      : targetY + newVideo.offsetY,
      width  : newVideo.width,
      height : newVideo.height
    };
  }

  /**
   * 等比缩放视频，使其完整显示在目标区域内（contain）。
   * 缩放后剩余空间居中留边，视频不会被裁剪。
   *
   * @param {number} width - 视频原始宽度（videoWidth）
   * @param {number} height - 视频原始高度（videoHeight）
   * @param {number} targetWidth - 目标区域宽度
   * @param {number} targetHeight - 目标区域高度
   * @returns {Object|null} { width, height, offsetX, offsetY }，无效尺寸返回 null
   */
  _scaleVideo(width, height, targetWidth, targetHeight)
  {
    let newWidth;
    let newHeight;
    let scale;

    if (!width || !height)
    {
      return null;
    }

    if (width / height >= targetWidth / targetHeight)
    {
      // 视频更宽（相对目标）：按目标宽度缩放，上下留边
      scale = targetWidth / width;
      newHeight = height * scale;
      newWidth = targetWidth;
    }
    else
    {
      // 视频更高（相对目标）：按目标高度缩放，左右留边
      scale = targetHeight / height;
      newWidth = width * scale;
      newHeight = targetHeight;
    }

    return {
      width   : newWidth,
      height  : newHeight,
      offsetX : Math.max(0, (targetWidth - newWidth) / 2),
      offsetY : Math.max(0, (targetHeight - newHeight) / 2)
    };
  }

  /**
   * 为纯音频源创建占位图画布。
   *
   * 占位符显示一个深色背景 + 居中圆形（内含 slot 编号）+ "Audio" 文字，
   * 让用户在视频混流输出中能直观感知到该路纯音频源的存在。
   *
   * 结果按 slot 缓存，仅当格子尺寸变化时重建。
   *
   * @param {number} slot - 源所在 slot 编号
   * @param {number} cellWidth - 格子宽度
   * @param {number} cellHeight - 格子高度
   * @returns {HTMLCanvasElement|null} 占位图画布，参数无效时返回 null
   */
  _createPlaceholderCanvas(slot, cellWidth, cellHeight)
  {
    if (!cellWidth || !cellHeight)
    {
      return null;
    }

    const key = `audio-${slot}`;
    const cached = this._audioPlaceholders[key];

    // 缓存命中且尺寸匹配 → 复用
    if (cached && cached.width === Math.ceil(cellWidth) && cached.height === Math.ceil(cellHeight))
    {
      return cached;
    }

    const w = Math.ceil(cellWidth);
    const h = Math.ceil(cellHeight);
    const canvas = document.createElement('canvas');

    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');

    if (!ctx)
    {
      return null;
    }

    // 深色背景
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, w, h);

    // 居中绘制麦克风图标
    const cx = w / 2;
    const cy = h / 2;

    this._drawMicrophone(ctx, cx, cy, Math.min(w, h) * 0.19);

    this._audioPlaceholders[key] = canvas;

    return canvas;
  }

  /**
   * 在 canvas 上下文中绘制麦克风图标。
   *
   * 基于 Feather 麦克风图标设计，在 24x24 的虚拟坐标空间中绘制：
   *   - 圆角矩形 pill 作为麦克风头部
   *   - 圆弧作为麦克风网罩
   *   - 底部直线为支架
   *
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   * @param {number} cx - 中心 X 坐标
   * @param {number} cy - 中心 Y 坐标
   * @param {number} size - 图标尺寸（直径）
   */
  _drawMicrophone(ctx, cx, cy, size)
  {
    // SVG path 数据，来自 1024x1024 视图的麦克风图标
    const pathData = 'M566.215111 899.811556v118.158222h-85.333333v-114.915556C294.4 888.718222 147.342222 735.573333 147.342222 562.688a42.666667 42.666667 0 0 1 85.333334 0c0 134.257778 123.790222 256.113778 276.764444 256.113778s276.707556-121.912889 276.707556-256.113778a42.666667 42.666667 0 1 1 85.333333 0c0 164.067556-132.380444 310.385778-305.265778 337.123556zM510.976 33.336889a170.666667 170.666667 0 0 1 170.666667 170.666667v341.333333a170.666667 170.666667 0 1 1-341.333334 0v-341.333333a170.666667 170.666667 0 0 1 170.666667-170.666667z';

    let path;

    try
    {
      path = new Path2D(pathData);
    }
    catch (_error)
    {
      return;
    }

    ctx.save();
    ctx.translate(cx - (size / 2), cy - (size / 2));
    ctx.scale(size / 1024, size / 1024);
    ctx.fillStyle = '#888888';
    ctx.fill(path);
    ctx.restore();
  }
}

module.exports = LayoutEngine;
