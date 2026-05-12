/**
 * 将常见 CSS 颜色转换为 WebGL clearColor 可用的 RGBA 数组。
 *
 * 这里只做渲染兜底需要的轻量解析：
 *   - #rgb / #rrggbb
 *   - rgb(r,g,b) / rgba(r,g,b,a)
 * 其它复杂 CSS 颜色交给 Canvas2D 路径原生处理，WebGL 路径回退黑色。
 *
 * @param {string} color - 用户传入的背景色
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

function parseHexColor(value)
{
  let hex = value.slice(1);

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

function clamp(value, min, max)
{
  return Math.min(max, Math.max(min, value));
}
