const { buildJointBilateralFilterStage } = require('./jointBilateralFilterStage.js');
const { buildResizingStage } = require('./resizingStage.js');
const { buildSoftmaxStage } = require('./softmaxStage.js');
const { buildBackgroundImageStage } = require('./backgroundImageStage.js');

const { buildBackgroundBlurStage } =require('./backgroundBlurStage.js');
const { compileShader, createTexture, glsl } = require('../helpers/webglHelper.js');


/**
 * 构建 WebGL2 虚拟背景处理管道
 *
 * 这是虚拟背景引擎的核心模块，负责创建完整的 WebGL2 渲染管道。
 * 管道包含以下处理阶段：
 *
 * 1. 尺寸调整阶段 (ResizingStage)
 *    - 将输入视频帧缩放至分割模型所需尺寸 (160x96)
 *    - 使用双线性插值保持图像质量
 *
 * 2. Softmax 阶段 (SoftmaxStage)
 *    - 将 TFLite 模型的原始输出转换为概率分布
 *    - 生成人物分割遮罩 (person mask)
 *
 * 3. 联合双边滤波阶段 (JointBilateralFilterStage)
 *    - 对分割遮罩进行边缘平滑处理
 *    - 同时考虑颜色信息和空间距离，消除锯齿和噪声
 *
 * 4. 背景合成阶段 (BackgroundImageStage)
 *    - 将人物与虚拟背景进行合成
 *    - 支持多种混合模式和光晕效果
 *
 * @param {Object} sourcePlayback - 源视频播放配置
 * @param {number} sourcePlayback.width - 源视频宽度
 * @param {number} sourcePlayback.height - 源视频高度
 * @param {HTMLVideoElement} sourcePlayback.htmlElement - HTML 视频元素
 *
 * @param {HTMLImageElement} backgroundImage - 背景图片元素
 *
 * @param {Object} backgroundConfig - 背景配置
 * @param {string} backgroundConfig.type - 背景类型：
 *   - 'image': 使用自定义图片作为背景
 *   - 'blur': 使用模糊后的视频作为背景
 *   - 其他值: 无背景（仅显示人物）
 *
 * @param {Object} segmentationConfig - 分割配置
 * @param {string} segmentationConfig.backend - 后端类型 (如 'wasmSimd')
 * @param {string} segmentationConfig.inputResolution - 输入分辨率 (如 '160x96')
 * @param {string} segmentationConfig.model - 模型名称 (如 'meet')
 * @param {string} segmentationConfig.pipeline - 管道类型 (如 'webgl2')
 * @param {number} segmentationConfig.targetFps - 目标帧率
 *
 * @param {HTMLCanvasElement} canvas - 输出画布元素
 * @param {Object} tflite - TensorFlow Lite SIMD 模块实例
 *
 * @returns {Object} 管道对象，包含以下方法：
 *   - render(): 执行一帧渲染，返回 Promise
 *   - updatePostProcessingConfig(config): 更新后处理配置
 *   - cleanUp(): 释放所有 WebGL 资源
 *
 * @example
 * const pipeline = buildWebGL2Pipeline(
 *   { width: 1280, height: 720, htmlElement: videoEl },
 *   backgroundImgEl,
 *   { type: 'image' },
 *   { backend: 'wasmSimd', inputResolution: '160x96', model: 'meet', pipeline: 'webgl2', targetFps: 15 },
 *   canvas,
 *   tflite
 * );
 *
 * await pipeline.render(); // 渲染一帧
 * pipeline.updatePostProcessingConfig({ jointBilateralFilter: { sigmaSpace: 1, sigmaColor: 0.1 } });
 * pipeline.cleanUp(); // 清理资源
 */
exports.buildWebGL2Pipeline = (sourcePlayback, backgroundImage, backgroundConfig, segmentationConfig, canvas, tflite) =>
{
  const vertexShaderSource = glsl`#version 300 es

    in vec2 a_position;
    in vec2 a_texCoord;

    out vec2 v_texCoord;

    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_texCoord = a_texCoord;
    }
  `;

  const { width: frameWidth, height: frameHeight }= sourcePlayback;
  const [ segmentationWidth, segmentationHeight ] =[ 160, 96 ];

  const gl = canvas.getContext('webgl2');

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);

  const vertexArray = gl.createVertexArray();

  gl.bindVertexArray(vertexArray);

  const positionBuffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([ -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0 ]),
    gl.STATIC_DRAW
  );

  const texCoordBuffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([ 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0 ]),
    gl.STATIC_DRAW
  );

  // We don't use texStorage2D here because texImage2D seems faster
  // to upload video texture than texSubImage2D even though the latter
  // is supposed to be the recommended way:
  // https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#use_texstorage_to_create_textures
  const inputFrameTexture = gl.createTexture();

  gl.bindTexture(gl.TEXTURE_2D, inputFrameTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  // TODO Rename segmentation and person mask to be more specific
  const segmentationTexture = createTexture(
    gl,
    gl.RGBA8,
    segmentationWidth,
    segmentationHeight
  );
  const personMaskTexture = createTexture(
    gl,
    gl.RGBA8,
    frameWidth,
    frameHeight
  );

  const resizingStage = buildResizingStage(
    gl,
    vertexShader,
    positionBuffer,
    texCoordBuffer,
    segmentationConfig,
    tflite
  );
  const loadSegmentationStage = buildSoftmaxStage(
    gl,
    vertexShader,
    positionBuffer,
    texCoordBuffer,
    segmentationConfig,
    tflite,
    segmentationTexture
  );
  const jointBilateralFilterStage = buildJointBilateralFilterStage(
    gl,
    vertexShader,
    positionBuffer,
    texCoordBuffer,
    segmentationTexture,
    segmentationConfig,
    personMaskTexture,
    canvas
  );
  const backgroundStage =
    backgroundConfig.type === 'blur'
      ? buildBackgroundBlurStage(
        gl,
        vertexShader,
        positionBuffer,
        texCoordBuffer,
        personMaskTexture,
        canvas
      )
      : buildBackgroundImageStage(
        gl,
        positionBuffer,
        texCoordBuffer,
        personMaskTexture,
        backgroundImage,
        canvas
      );

  /**
   * 执行一帧的渲染处理
   *
   * 这是 WebGL2 虚拟背景管道的核心渲染方法，负责处理视频帧的完整流程：
   * 1. 上传视频帧到 GPU 纹理
   * 2. 调整帧大小以适配分割模型输入
   * 3. 运行 AI 分割模型进行人物识别
   * 4. 加载分割结果（人物遮罩）
   * 5. 应用联合双边滤波器进行边缘平滑
   * 6. 渲染最终合成结果（背景+人物）
   *
   * 渲染流程：
   * ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
   * │  视频帧      │───▶│  调整大小    │───▶│  AI 分割    │
   * │ (WebGL纹理) │    │ (160x96)    │    │ (TFLite)    │
   * └─────────────┘    └─────────────┘    └─────────────┘
   *                                                │
   *                                                ▼
   * ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
   * │  最终输出   │◀───│  背景合成   │◀───│  边缘平滑   │
   * │  (Canvas)   │    │  (Blend)    │    │ (双边滤波)  │
   * └─────────────┘    └─────────────┘    └─────────────┘
   *
   * @returns {Promise<void>} 渲染完成后 resolve
   */
  async function render()
  {
    // 1. 激活纹理单元 0 并绑定输入帧纹理
    // WebGL 支持多个纹理单元（TEXTURE0, TEXTURE1 等）
    // 着色器可以从不同纹理单元采样，本例使用单元 0
    gl.activeTexture(gl.TEXTURE0);
    // 绑定输入帧纹理，这是存放当前视频帧的纹理对象
    gl.bindTexture(gl.TEXTURE_2D, inputFrameTexture);

    // 2. 上传视频帧数据到 GPU 纹理
    // texImage2D 比 texSubImage2D 上传视频帧更快
    // 参数说明：
    //   - TEXTURE_2D: 目标纹理类型
    //   - 0: Mipmap 级别（0 表示基础级别）
    //   - RGBA: 内部格式（GPU 存储格式）
    //   - RGBA: 源格式（视频数据格式）
    //   - UNSIGNED_BYTE: 源数据类型（8位无符号）
    //   - sourcePlayback.htmlElement: HTML 视频/图像元素
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      sourcePlayback.htmlElement
    );
    // 3. 绑定顶点数组对象（VAO）
    // VAO 存储顶点属性配置（位置、纹理坐标等）
    // 绑定 VAO 后，后续的 draw 调用会使用这个配置
    gl.bindVertexArray(vertexArray);
    // 4. 渲染调整大小阶段
    // 将视频帧从原始尺寸调整到分割模型输入尺寸 (160x96)
    // 使用 await 确保此阶段完成后再进行下一步
    await resizingStage.render();
    // 5. 运行 TFLite 推理
    // 调用 TensorFlow Lite SIMD 模型进行人物分割
    // 分割结果输出到 segmentationTexture
    tflite._runInference();
    // 6. 渲染分割结果加载阶段
    // 将 TFLite 的分割结果（原始遮罩数据）加载到纹理
    loadSegmentationStage.render();
    // 7. 渲染联合双边滤波阶段
    // 对分割遮罩进行边缘平滑处理，消除锯齿和噪声
    // 联合双边滤波会考虑颜色信息和空间距离
    jointBilateralFilterStage.render();
    // 8. 渲染背景合成阶段
    // 将平滑后的分割遮罩与背景图像合成
    // 人物区域显示原始视频，背景区域显示虚拟背景
    backgroundStage.render();
  }

  /**
   * 更新后处理配置
   *
   * 用于动态调整虚拟背景的后处理效果，包括分割边缘平滑参数和背景合成参数。
   * 可以在渲染过程中调用以实时更改效果。
   *
   * 后处理配置包含两个主要部分：
   * 1. 联合双边滤波器 (Joint Bilateral Filter) - 用于平滑分割边缘
   * 2. 背景合成参数 - 用于控制背景与人物的合成方式
   *
   * @param {Object} postProcessingConfig - 后处理配置对象
   * @param {Object} postProcessingConfig.jointBilateralFilter - 联合双边滤波配置
   * @param {number} postProcessingConfig.jointBilateralFilter.sigmaSpace - 空间 sigma，控制滤波的空间影响范围
   * @param {number} postProcessingConfig.jointBilateralFilter.sigmaColor - 颜色 sigma，控制颜色相似性的权重
   * @param {number[]} postProcessingConfig.coverage - 人物遮罩覆盖率 [min, max]
   * @param {number} postProcessingConfig.lightWrapping - 光晕强度 (0-1)，使人物边缘产生光晕效果
   * @param {string} postProcessingConfig.blendMode - 混合模式，如 'screen', 'multiply' 等
   */
  function updatePostProcessingConfig(
    postProcessingConfig
  )
  {
    // 1. 更新联合双边滤波器的空间 sigma 参数
    // sigmaSpace 控制滤波器在空间域的影响范围，值越大表示考虑更远的像素
    // 较大的值会产生更平滑的边缘，但可能损失细节
    jointBilateralFilterStage.updateSigmaSpace(
      postProcessingConfig.jointBilateralFilter.sigmaSpace
    );
    // 2. 更新联合双边滤波器的颜色 sigma 参数
    // sigmaColor 控制颜色相似性在滤波中的权重，值越大表示颜色差异影响越小
    // 较大的值会使滤波器对颜色差异更不敏感，产生更均匀的遮罩
    jointBilateralFilterStage.updateSigmaColor(
      postProcessingConfig.jointBilateralFilter.sigmaColor
    );
    // 3. 根据背景类型进行不同的配置
    if (backgroundConfig.type === 'image')
    {
      // === 背景图片模式 ===
      // 使用自定义图片作为虚拟背景
      const backgroundImageStage = backgroundStage;

      // 更新人物遮罩覆盖率
      // coverage 是一个 [min, max] 数组，控制遮罩的强度范围
      // 值通常在 0-1 之间，min 控制最小覆盖率，max 控制最大覆盖率
      backgroundImageStage.updateCoverage(postProcessingConfig.coverage);
      // 更新光晕效果强度
      // lightWrapping 使人物边缘产生发光效果，营造与背景融合的感觉
      // 值为 0 时关闭光晕，值越大光晕越强
      backgroundImageStage.updateLightWrapping(
        postProcessingConfig.lightWrapping
      );
      // 更新混合模式
      // 决定如何将人物与背景合成：
      // - 'screen': 滤色模式，产生较亮的结果
      // - 'multiply': 正片叠底模式，产生较暗的结果
      // - 其他模式可产生不同的艺术效果
      backgroundImageStage.updateBlendMode(postProcessingConfig.blendMode);
    }
    else if (backgroundConfig.type === 'blur')
    {
      // === 背景模糊模式 ===
      // 使用模糊后的原视频作为背景（模拟景深效果）
      const backgroundBlurStage = backgroundStage;

      // 更新遮罩覆盖率
      // 在模糊模式下，控制模糊背景的可见程度
      backgroundBlurStage.updateCoverage(postProcessingConfig.coverage);
    }
    else
    {
      // === 无背景/纯视频模式 ===
      // TODO: 应该使用单独的管道处理无背景情况
      // 当前实现：将覆盖率设为最大，关闭光晕效果
      const backgroundImageStage = backgroundStage;

      // 设置覆盖率接近 100%，使视频完整显示
      // [0, 0.9999] 而不是 [0, 1]，避免除零错误
      backgroundImageStage.updateCoverage([ 0, 0.9999 ]);
      // 关闭光晕效果
      backgroundImageStage.updateLightWrapping(0);
    }
  }

  /**
   * 清理 WebGL 管道资源
   *
   * 当不再需要 WebGL2 虚拟背景管道时，调用此函数释放所有 GPU 资源。
   * 正确清理资源对于避免 GPU 内存泄漏至关重要，特别是在单页面应用中。
   *
   * 清理顺序说明：
   * 1. 先清理各管道阶段（包含着色器程序和帧缓冲区）
   * 2. 再清理独立的 GPU 对象（纹理、缓冲区、着色器）
   *
   * 清理内容：
   * - 管道阶段：背景合成、双边滤波、分割加载、尺寸调整
   * - GPU 资源：纹理对象、缓冲区对象、顶点数组对象、着色器对象
   */
  function cleanUp()
  { // 1. 清理各管道阶段
    // 每个阶段可能包含自己的着色器程序、帧缓冲区等资源
    // cleanUp 方法会负责释放这些内部资源

    // 清理背景合成阶段
    // 包含背景图片/模糊的着色器程序和渲染目标
    backgroundStage.cleanUp();
    // 清理联合双边滤波阶段
    // 包含边缘平滑处理的着色器程序和中间渲染目标
    jointBilateralFilterStage.cleanUp();
    // 清理分割结果加载阶段
    // 包含将 TFLite 输出加载到纹理的着色器程序
    loadSegmentationStage.cleanUp();
    // 清理尺寸调整阶段
    // 包含视频帧缩放的着色器程序和渲染目标
    resizingStage.cleanUp();

    // 2. 清理独立的 GPU 对象
    // 按照依赖关系顺序清理：先清理依赖它们的资源，再清理被依赖的资源

    // 删除人物遮罩纹理
    // 存储分割后的人物遮罩数据，用于背景合成
    gl.deleteTexture(personMaskTexture);
    // 删除分割纹理
    // 存储 TFLite 模型的分割结果（原始概率数据）
    gl.deleteTexture(segmentationTexture);
    // 删除输入帧纹理
    // 存储当前视频帧的 RGBA 数据
    gl.deleteTexture(inputFrameTexture);
    // 删除纹理坐标缓冲区
    // 存储顶点的 UV 坐标，用于纹理映射
    gl.deleteBuffer(texCoordBuffer);
    // 删除顶点位置缓冲区
    // 存储顶点的 x, y 坐标
    gl.deleteBuffer(positionBuffer);
    // 删除顶点数组对象（VAO）
    // VAO 存储顶点属性的配置状态
    gl.deleteVertexArray(vertexArray);
    // 删除顶点着色器
    // 注意：片元着色器在各自阶段内部清理
    gl.deleteShader(vertexShader);
  }

  return { render, updatePostProcessingConfig, cleanUp };
};
