exports.glsl = String.raw;

/**
 * 创建 WebGL 程序对象
 * @param {WebGLRenderingContext} gl - WebGL 渲染上下文
 * @param {WebGLShader} vertexShader - 顶点着色器
 * @param {WebGLShader} fragmentShader - 片元着色器
 * @returns {WebGLProgram} 创建的 WebGL 程序对象
 */
function createProgram(gl, vertexShader, fragmentShader) 
{
  const program = gl.createProgram();

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
  {
    throw new Error(
      `Could not link WebGL program: ${gl.getProgramInfoLog(program)}`
    );
  }

  return program;
}

/**
 * 异步获取 WebGL 缓冲区数据
 * 通过 GPU 同步机制确保数据在读取前已完全写入
 * @param {WebGL2RenderingContext} gl - WebGL2 渲染上下文
 * @param {number} target - 缓冲区目标（如 gl.ARRAY_BUFFER）
 * @param {WebGLBuffer} buffer - WebGL 缓冲区对象
 * @param {number} srcByteOffset - 源数据的字节偏移量
 * @param {ArrayBufferView} dstBuffer - 目标缓冲区（用于存储读取的数据）
 * @param {number} dstOffset - 目标缓冲区的写入偏移量
 * @param {number} length - 要读取的数据长度
 * @returns {Promise<void>}
 */
async function getBufferSubDataAsync(gl, target, buffer, srcByteOffset, dstBuffer, dstOffset, length)
{
  // 创建 GPU 同步对象，用于确保 GPU 命令执行完成
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);

  // 刷新 GPU 命令队列，确保所有待执行的命令已发送到 GPU
  gl.flush();
  // 异步等待 GPU 完成所有命令
  const res = await clientWaitAsync(gl, sync);
  
  // 删除同步对象，释放资源
  gl.deleteSync(sync);

  // 如果等待未失败，则读取缓冲区数据
  if (res !== gl.WAIT_FAILED)
  {
    // 绑定目标缓冲区
    gl.bindBuffer(target, buffer);
    // 从缓冲区读取数据到目标数组
    gl.getBufferSubData(target, srcByteOffset, dstBuffer, dstOffset, length);
    // 解除缓冲区绑定
    gl.bindBuffer(target, null);
  }
}

/**
 * 异步等待 GPU 同步对象完成
 * 使用 requestAnimationFrame 轮询 GPU 命令完成状态
 * @param {WebGL2RenderingContext} gl - WebGL2 渲染上下文
 * @param {WebGLSync} sync - GPU 同步对象
 * @returns {Promise<number>} 返回 Promise，解析为 GPU 等待结果状态
 */
function clientWaitAsync(gl, sync)
{
  return new Promise((resolve) =>
  {
    function test()
    {
      // 查询同步对象的状态
      // 参数：sync 对象, flags=0, timeout=0（立即返回，不阻塞）
      const res = gl.clientWaitSync(sync, 0, 0);

      // 如果等待失败（如 sync 对象无效），直接 resolve
      if (res === gl.WAIT_FAILED)
      {
        resolve(res);

        return;
      }
      // 如果超时（GPU 尚未完成），使用 requestAnimationFrame 延迟后重试
      if (res === gl.TIMEOUT_EXPIRED)
      {
        requestAnimationFrame(test);

        return;
      }
      // GPU 已完成工作，resolve 结果
      resolve(res);
    }
    // 立即开始第一次检查
    requestAnimationFrame(test);
  });
}

/**
 * 创建并配置管道阶段的 WebGL 程序
 * 包含顶点着色器、片元着色器，并设置顶点属性和坐标缓冲区
 * @param {WebGL2RenderingContext} gl - WebGL2 渲染上下文
 * @param {WebGLShader} vertexShader - 顶点着色器
 * @param {WebGLShader} fragmentShader - 片元着色器
 * @param {WebGLBuffer} positionBuffer - 顶点位置缓冲区
 * @param {WebGLBuffer} texCoordBuffer - 纹理坐标缓冲区
 * @returns {WebGLProgram} 配置完成的 WebGL 程序对象
 */
exports.createPiplelineStageProgram = (gl, vertexShader, fragmentShader, positionBuffer, texCoordBuffer) =>
{
  // 创建 WebGL 程序并附加着色器进行链接
  const program = createProgram(gl, vertexShader, fragmentShader);
  // 获取顶点着色器中属性位置（a_position：顶点坐标）
  const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');

  // 启用顶点属性数组，以便 GPU 可以访问属性数据
  gl.enableVertexAttribArray(positionAttributeLocation);
  // 绑定顶点位置缓冲区
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  // 设置顶点属性指针：2个分量（x, y），FLOAT类型，不归一化，步长为0，偏移为0
  gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

  // 获取顶点着色器中属性位置（a_texCoord：纹理坐标）
  const texCoordAttributeLocation = gl.getAttribLocation(program, 'a_texCoord');

  // 启用纹理坐标属性数组
  gl.enableVertexAttribArray(texCoordAttributeLocation);
  // 绑定纹理坐标缓冲区
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  // 设置纹理坐标属性指针：2个分量（u, v），FLOAT类型
  gl.vertexAttribPointer(texCoordAttributeLocation, 2, gl.FLOAT, false, 0, 0);

  // 返回配置完成的程序对象
  return program;
};

/**
 * 编译 WebGL 着色器
 * @param {WebGL2RenderingContext} gl - WebGL2 渲染上下文
 * @param {number} shaderType - 着色器类型（如 gl.VERTEX_SHADER 或 gl.FRAGMENT_SHADER）
 * @param {string} shaderSource - 着色器源代码
 * @returns {WebGLShader} 编译完成的着色器对象
 */
exports.compileShader = (gl, shaderType, shaderSource) => 
{
  const shader = gl.createShader(shaderType);

  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
  {
    throw new Error(`Could not compile shader: ${gl.getShaderInfoLog(shader)}`);
  }

  return shader;
};

/**
 * 创建 WebGL 2D 纹理
 * 配置纹理参数并分配 GPU 内存
 * @param {WebGL2RenderingContext} gl - WebGL2 渲染上下文
 * @param {number} internalformat - 纹理内部格式（如 gl.R8, gl.RGBA8 等）
 * @param {number} width - 纹理宽度
 * @param {number} height - 纹理高度
 * @param {number} [minFilter=gl.NEAREST] - 缩小过滤模式
 * @param {number} [magFilter=gl.NEAREST] - 放大过滤模式
 * @returns {WebGLTexture} 创建的纹理对象
 */
exports.createTexture = (gl, internalformat, width, height, minFilter = gl.NEAREST, magFilter = gl.NEAREST) =>
{
  const texture = gl.createTexture();

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
  gl.texStorage2D(gl.TEXTURE_2D, 1, internalformat, width, height);

  return texture;
};

/**
 * 异步读取像素数据
 * 使用 PIXEL_PACK_BUFFER 和 GPU 同步机制确保读取完成
 * @param {WebGL2RenderingContext} gl - WebGL2 渲染上下文
 * @param {number} x - 读取区域的起始 x 坐标
 * @param {number} y - 读取区域的起始 y 坐标
 * @param {number} width - 读取区域的宽度
 * @param {number} height - 读取区域的高度
 * @param {number} format - 像素数据格式（如 gl.RED, gl.RGBA 等）
 * @param {number} type - 像素数据类型（如 gl.UNSIGNED_BYTE, gl.FLOAT 等）
 * @param {ArrayBufferView} dest - 目标缓冲区，用于存储读取的像素数据
 * @returns {Promise<ArrayBufferView>} 返回包含像素数据的缓冲区
 */
exports.readPixelsAsync = async(gl, x, y, width, height, format, type, dest) =>
{
  const buf = gl.createBuffer();

  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buf);
  gl.bufferData(gl.PIXEL_PACK_BUFFER, dest.byteLength, gl.STREAM_READ);
  gl.readPixels(x, y, width, height, format, type, 0);
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);

  await getBufferSubDataAsync(gl, gl.PIXEL_PACK_BUFFER, buf, 0, dest);

  gl.deleteBuffer(buf);

  return dest;
};