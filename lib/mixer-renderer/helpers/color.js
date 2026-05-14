/**
 * color — CSS 颜色解析工具
 *
 * 将常见 CSS 颜色字符串解析为 WebGL clearColor 可用的 RGBA 数组。
 * 只做渲染兜底需要的轻量解析，不处理复杂 CSS 颜色值（如 hsl、named colors）。
 *
 * 支持格式：
 *   - #rgb（如 #fff → [1, 1, 1, 1]）
 *   - #rrggbb（如 #ff0000 → [1, 0, 0, 1]）
 *   - rgb(r, g, b)（如 rgb(255, 0, 0) → [1, 0, 0, 1]）
 *   - rgba(r, g, b, a)（如 rgba(0, 0, 0, 0.5) → [0, 0, 0, 0.5]）
 *
 * 不支持的格式回退到纯黑 [0, 0, 0, 1]。
 * Canvas2D 路径无需此工具（原生支持 CSS 颜色），仅 WebGL 路径使用。
 *
 * @module colorHelper
 */

/**
 * 将 CSS 颜色字符串解析为归一化的 RGBA 数组。
 *
 * @param {string} color - CSS 颜色字符串
 * @returns {Array<number>} [r, g, b, a]，每个通道范围 0-1
 */
exports.parseColor = function(color)
{
  if (!color || typeof color !== 'string')
  {
    return [ 0, 0, 0, 1 ];
  }

  const value = color.trim();

  if (value[0] === '#')
  {
    return parseHexColor(value);
  }

  if (value.indexOf('rgb') === 0)
  {
    return parseRgbColor(value);
  }

  return [ 0, 0, 0, 1 ];
};

/**
 * 解析十六进制颜色。
 *
 * @param {string} value - #rgb 或 #rrggbb 格式
 * @returns {Array<number>} [r, g, b, a]
 */
function parseHexColor(value)
{
  let hex = value.slice(1);

  // 展开简写 #RGB → #RRGGBB
  if (hex.length === 3)
  {
    hex = hex.split('')
      .map((item) => item + item)
      .join('');
  }

  if (hex.length !== 6)
  {
    return [ 0, 0, 0, 1 ];
  }

  const numberValue = parseInt(hex, 16);

  if (!Number.isFinite(numberValue))
  {
    return [ 0, 0, 0, 1 ];
  }

  return [
    ((numberValue >> 16) & 255) / 255,
    ((numberValue >> 8) & 255) / 255,
    (numberValue & 255) / 255,
    1
  ];
}

/**
 * 解析 rgb/rgba 颜色。
 *
 * @param {string} value - rgb(r,g,b) 或 rgba(r,g,b,a) 格式
 * @returns {Array<number>} [r, g, b, a]
 */
function parseRgbColor(value)
{
  const matches = value.match(/rgba?\(([^)]+)\)/i);

  if (!matches)
  {
    return [ 0, 0, 0, 1 ];
  }

  const parts = matches[1].split(',')
    .map((item) => Number(item.trim()));

  if (parts.length < 3 || parts.some((item) => !Number.isFinite(item)))
  {
    return [ 0, 0, 0, 1 ];
  }

  return [
    clamp(parts[0] / 255, 0, 1),
    clamp(parts[1] / 255, 0, 1),
    clamp(parts[2] / 255, 0, 1),
    clamp(parts.length > 3 ? parts[3] : 1, 0, 1)
  ];
}

/**
 * 将数值限制在指定范围内。
 *
 * @param {number} value - 待限制的值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 限制后的值
 */
function clamp(value, min, max)
{
  return Math.min(max, Math.max(min, value));
}
