/**
 * 生成 Mixer Worker 的源码字符串。
 *
 * Browserify 会把这个模块打进 SDK 主包，默认用 Blob Worker 运行，避免额外部署文件。
 * 如果业务侧 CSP 禁止 Blob Worker，可通过 options.workerUrl 指定外部 worker 脚本；外部脚本内容
 * 可以直接使用 createWorkerScript() 的返回值生成。
 *
 * @returns {string} Worker 源码
 */
exports.createWorkerScript = function()
{
  return `
var canvas = null;
var ctx = null;
var gl = null;
var program = null;
var positionBuffer = null;
var texCoordBuffer = null;
var textures = {};
var actualMode = 'unknown';
var requestedMode = 'auto';
var width = 0;
var height = 0;
var backgroundColor = '#000';

var VERTEX_SHADER = '#version 300 es\\n' +
  'in vec2 a_position;\\n' +
  'in vec2 a_texCoord;\\n' +
  'out vec2 v_texCoord;\\n' +
  'void main() {\\n' +
  '  gl_Position = vec4(a_position, 0.0, 1.0);\\n' +
  '  v_texCoord = a_texCoord;\\n' +
  '}\\n';

var FRAGMENT_SHADER = '#version 300 es\\n' +
  'precision highp float;\\n' +
  'in vec2 v_texCoord;\\n' +
  'uniform sampler2D u_texture;\\n' +
  'out vec4 outColor;\\n' +
  'void main() {\\n' +
  '  outColor = texture(u_texture, v_texCoord);\\n' +
  '}\\n';

self.onmessage = function(event)
{
  var data = event.data || {};

  if (data.type === 'init')
  {
    init(data);
  }
  else if (data.type === 'render')
  {
    render(data.payload || {});
  }
  else if (data.type === 'removeSource')
  {
    removeSource(data.id);
  }
  else if (data.type === 'destroy')
  {
    destroy();
  }
};

function init(data)
{
  canvas = data.canvas;
  requestedMode = data.requestedMode || 'auto';
  width = data.width || canvas.width || 1;
  height = data.height || canvas.height || 1;
  backgroundColor = data.backgroundColor || '#000';
  canvas.width = width;
  canvas.height = height;

  try
  {
    if (requestedMode === 'worker-webgl2' || requestedMode === 'auto')
    {
      initWebGL2();
      actualMode = 'worker-webgl2';
      postMessage({ type: 'ready', actualMode: actualMode, isWebGL2: true, reason: '' });

      return;
    }
  }
  catch (error)
  {
    destroyWebGL2();

    backgroundColor = data.backgroundColor || backgroundColor;
  }

  try
  {
    initCanvas2D();
    actualMode = 'worker-2d';
    postMessage({ type: 'ready', actualMode: actualMode, isWebGL2: false, reason: 'Worker WebGL2 unavailable, fallback to Worker Canvas2D' });
  }
  catch (error)
  {
    postMessage({ type: 'failed', reason: error.message || String(error) });
  }
}

function initWebGL2()
{
  gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance'
  });

  if (!gl)
  {
    throw new Error('Worker WebGL2 context is not available');
  }

  var vertexShader = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
  var fragmentShader = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

  program = createProgram(vertexShader, fragmentShader);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,
    1, -1,
    -1, 1,
    1, 1
  ]), gl.STATIC_DRAW);

  texCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0, 0,
    1, 0,
    0, 1,
    1, 1
  ]), gl.STATIC_DRAW);

  gl.useProgram(program);
  enableAttribute('a_position', positionBuffer);
  enableAttribute('a_texCoord', texCoordBuffer);
  gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0);
}

function initCanvas2D()
{
  ctx = canvas.getContext('2d', { alpha: false }) || canvas.getContext('2d');

  if (!ctx)
  {
    throw new Error('Worker Canvas2D context is not available');
  }
}

function render(payload)
{
  var outputBitmap = null;
  var items = payload.items || [];

  try
  {
    if (!items.length)
    {
      postMessage({ type: 'rendered' });

      return;
    }

    width = payload.width || width;
    height = payload.height || height;
    backgroundColor = payload.backgroundColor || backgroundColor;

    if (canvas.width !== width)
    {
      canvas.width = width;
    }

    if (canvas.height !== height)
    {
      canvas.height = height;
    }

    if (actualMode === 'worker-webgl2')
    {
      renderWebGL2(payload);
    }
    else if (actualMode === 'worker-2d')
    {
      renderCanvas2D(payload);
    }

    if (canvas.transferToImageBitmap)
    {
      outputBitmap = canvas.transferToImageBitmap();
      postMessage({ type: 'rendered', bitmap: outputBitmap }, [ outputBitmap ]);
      outputBitmap = null;
    }
    else
    {
      postMessage({ type: 'renderError', reason: 'OffscreenCanvas.transferToImageBitmap is not available' });
    }
  }
  catch (error)
  {
    if (outputBitmap && outputBitmap.close)
    {
      outputBitmap.close();
    }

    postMessage({ type: 'renderError', reason: error.message || String(error) });
  }
  finally
  {
    closeFrames(payload.items || []);
  }
}

function renderWebGL2(payload)
{
  var clearColor = parseColor(payload.backgroundColor || '#000');
  var items = payload.items || [];

  gl.useProgram(program);
  gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.activeTexture(gl.TEXTURE0);

  items.forEach(function(item)
  {
    if (!item.frame || !item.draw)
    {
      return;
    }

    var texture = getTexture(item.id);

    gl.bindTexture(gl.TEXTURE_2D, texture);
    // ImageBitmap 的方向已在 createImageBitmap(..., { imageOrientation: 'flipY' }) 阶段处理；
    // VideoFrame fallback 仍依赖 UNPACK_FLIP_Y_WEBGL。Chromium 对 ImageBitmap 会忽略此开关，
    // 因此这里打开它不会造成 ImageBitmap 二次翻转。
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, item.frame);

    var draw = item.draw;
    var viewportX = Math.round(draw.x);
    var viewportY = Math.round(height - draw.y - draw.height);
    var viewportWidth = Math.round(draw.width);
    var viewportHeight = Math.round(draw.height);

    if (viewportWidth <= 0 || viewportHeight <= 0)
    {
      return;
    }

    gl.viewport(viewportX, viewportY, viewportWidth, viewportHeight);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  });

  gl.flush();
}

function renderCanvas2D(payload)
{
  var items = payload.items || [];

  ctx.fillStyle = payload.backgroundColor || '#000';
  ctx.fillRect(0, 0, width, height);

  items.forEach(function(item)
  {
    if (!item.frame || !item.draw)
    {
      return;
    }

    ctx.drawImage(
      item.frame,
      item.draw.x,
      item.draw.y,
      item.draw.width,
      item.draw.height
    );
  });
}

function compileShader(shaderType, shaderSource)
{
  var shader = gl.createShader(shaderType);

  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
  {
    var message = gl.getShaderInfoLog(shader);

    gl.deleteShader(shader);
    throw new Error('Could not compile shader: ' + message);
  }

  return shader;
}

function createProgram(vertexShader, fragmentShader)
{
  var shaderProgram = gl.createProgram();

  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS))
  {
    var message = gl.getProgramInfoLog(shaderProgram);

    gl.deleteProgram(shaderProgram);
    throw new Error('Could not link WebGL program: ' + message);
  }

  return shaderProgram;
}

function enableAttribute(name, buffer)
{
  var location = gl.getAttribLocation(program, name);

  gl.enableVertexAttribArray(location);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
}

function getTexture(id)
{
  if (!textures[id])
  {
    textures[id] = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, textures[id]);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  return textures[id];
}

function removeSource(id)
{
  if (gl && textures[id])
  {
    gl.deleteTexture(textures[id]);
  }

  delete textures[id];
}

function closeFrames(items)
{
  items.forEach(function(item)
  {
    if (item.frame && item.frame.close)
    {
      item.frame.close();
    }
  });
}

function destroy()
{
  destroyWebGL2();
  ctx = null;
  canvas = null;
}

function destroyWebGL2()
{
  if (!gl)
  {
    return;
  }

  Object.keys(textures).forEach(function(id)
  {
    gl.deleteTexture(textures[id]);
  });
  textures = {};

  if (positionBuffer)
  {
    gl.deleteBuffer(positionBuffer);
  }

  if (texCoordBuffer)
  {
    gl.deleteBuffer(texCoordBuffer);
  }

  if (program)
  {
    gl.deleteProgram(program);
  }

  var loseContext = gl.getExtension('WEBGL_lose_context');

  if (loseContext)
  {
    loseContext.loseContext();
  }

  gl = null;
  program = null;
  positionBuffer = null;
  texCoordBuffer = null;
}

function parseColor(color)
{
  if (!color || typeof color !== 'string')
  {
    return [ 0, 0, 0, 1 ];
  }

  var value = color.trim();

  if (value[0] === '#')
  {
    return parseHexColor(value);
  }

  if (value.indexOf('rgb') === 0)
  {
    return parseRgbColor(value);
  }

  return [ 0, 0, 0, 1 ];
}

function parseHexColor(value)
{
  var hex = value.slice(1);

  if (hex.length === 3)
  {
    hex = hex.split('').map(function(item)
    {
      return item + item;
    }).join('');
  }

  if (hex.length !== 6)
  {
    return [ 0, 0, 0, 1 ];
  }

  var numberValue = parseInt(hex, 16);

  if (!isFinite(numberValue))
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
  var matches = value.match(/rgba?\\(([^)]+)\\)/i);

  if (!matches)
  {
    return [ 0, 0, 0, 1 ];
  }

  var parts = matches[1].split(',').map(function(item)
  {
    return Number(item.trim());
  });

  if (parts.length < 3 || parts.some(function(item)
  {
    return !isFinite(item);
  }))
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
`;
};
