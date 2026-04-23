// Copyright 2023 The MediaPipe Authors.

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//      http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview MediaPipe Tasks Vision - Image Segmenter 图像分割演示程序
 *
 * 本文件演示了如何使用 MediaPipe Tasks Vision API（新版）中的 ImageSegmenter
 * 实现实时图像语义分割，支持两种模式：
 * - 图片模式（IMAGE）：点击静态图片进行分割
 * - 视频模式（VIDEO）：实时摄像头视频流分割
 *
 * 当前使用 Selfie Segmenter Landscape 模型（人像/背景二分类），
 * 另外还支持 Selfie Segmenter Square 和 DeepLab-V3 模型，详见代码中注释。
 *
 * 与旧版 Solutions API（SelfieSegmentation）的主要区别：
 * - 通过 FilesetResolver 加载 WASM 运行时
 * - 通过 ImageSegmenter.createFromOptions() 创建实例
 * - 输出 categoryMask（类别掩码）而非 segmentationMask（二值蒙版）
 * - 支持多类别分割，而非仅人像/背景二分类
 * - 区分 IMAGE 和 VIDEO 两种运行模式，需动态切换
 */

// ==================== 模块导入 ====================

// 从 CDN 导入 MediaPipe Tasks Vision 的核心模块
// - ImageSegmenter：图像分割器主类，负责模型加载和推理
// - FilesetResolver：文件集解析器，负责定位和加载 WASM 运行时文件
import { ImageSegmenter, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2';

// ==================== DOM 元素获取 ====================

// 视频元素：显示摄像头实时画面
const video = document.getElementById('webcam');

// Canvas 元素及上下文：用于渲染视频流的分割结果
const canvasElement = document.getElementById('canvas');
const canvasCtx = canvasElement.getContext('2d');

// 分割类别预测结果展示区域
const webcamPredictions = document.getElementById('webcamPredictions');

// 演示区域容器：模型加载完成后才显示
const demosSection = document.getElementById('demos');

// 摄像头开关按钮：点击启用/禁用摄像头分割
let enableWebcamButton;

// 摄像头是否正在运行的标志
let webcamRunning = false;

// 视频显示尺寸设置
const videoHeight = '360px';
const videoWidth = '480px';

// 运行模式：当前为 VIDEO（视频流模式），也可切换为 IMAGE（单帧图片模式）
// 注意：运行模式必须与调用方法匹配：
//   - IMAGE 模式 → 调用 segment()
//   - VIDEO 模式 → 调用 segmentForVideo()
// let runningMode: "IMAGE" | "VIDEO" = "IMAGE";
let runningMode = 'LIVE_STREAM';

// 分割结果的输出宽高（模型输入尺寸）
const resultWidthHeigth = 256;

// ==================== 全局状态变量 ====================

// ImageSegmenter 实例：异步初始化后赋值
let imageSegmenter;

// 模型支持的类别标签列表，如 ["background", "aeroplane", "bicycle", ...]
// 从 DeepLab-V3 模型中获取，共 21 个类别（PASCAL VOC 数据集）
let labels;

// ==================== 类别颜色映射表 ====================

// 每个分割类别对应的 RGBA 颜色值
// 颜色方案基于 Maximal Discriminatory Color Set（最大区分度颜色集）
// 每种颜色在视觉上尽可能与其他颜色区分开，便于人眼辨识不同类别区域
// 格式：[R, G, B, A]，A=255 表示完全不透明
const legendColors = [
  [ 255, 197, 0, 255 ], // Vivid Yellow - 鲜艳黄色
  [ 128, 62, 117, 255 ], // Strong Purple - 强紫色
  [ 255, 104, 0, 255 ], // Vivid Orange - 鲜艳橙色
  [ 166, 189, 215, 255 ], // Very Light Blue - 极浅蓝色
  [ 193, 0, 32, 255 ], // Vivid Red - 鲜艳红色
  [ 206, 162, 98, 255 ], // Grayish Yellow - 灰黄色
  [ 129, 112, 102, 255 ], // Medium Gray - 中灰色
  [ 0, 125, 52, 255 ], // Vivid Green - 鲜艳绿色
  [ 246, 118, 142, 255 ], // Strong Purplish Pink - 强紫粉色
  [ 0, 83, 138, 255 ], // Strong Blue - 强蓝色
  [ 255, 112, 92, 255 ], // Strong Yellowish Pink - 强黄粉色
  [ 83, 55, 112, 255 ], // Strong Violet - 强紫罗兰色
  [ 255, 142, 0, 255 ], // Vivid Orange Yellow - 鲜橙黄色
  [ 179, 40, 81, 255 ], // Strong Purplish Red - 强紫红色
  [ 244, 200, 0, 255 ], // Vivid Greenish Yellow - 鲜绿黄色
  [ 127, 24, 13, 255 ], // Strong Reddish Brown - 强红棕色
  [ 147, 170, 0, 255 ], // Vivid Yellowish Green - 鲜黄绿色
  [ 89, 51, 21, 255 ], // Deep Yellowish Brown - 深黄棕色
  [ 241, 58, 19, 255 ], // Vivid Reddish Orange - 鲜红橙色
  [ 35, 44, 22, 255 ], // Dark Olive Green - 暗橄榄绿
  [ 0, 161, 194, 255 ] // Vivid Blue - 鲜艳蓝色
];

// ==================== ImageSegmenter 初始化 ====================

/**
 * 异步创建并初始化 ImageSegmenter 实例
 *
 * 流程：
 * 1. 通过 FilesetResolver 加载 WASM 运行时文件
 * 2. 使用 DeepLab-V3 模型创建分割器
 * 3. 获取模型支持的类别标签
 * 4. 显示演示区域 UI
 */
const createImageSegmenter = async() => 
{
  // 步骤1：加载 Vision Tasks 的 WASM 运行时
  // FilesetResolver 会根据指定的 CDN 路径下载并初始化 WebAssembly 模块
  // 这些 WASM 文件包含了模型推理所需的计算核心
  // 注意：变量名 audio 是原始代码的命名，实际加载的是 vision（视觉）任务的 WASM
  const audio = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2/wasm'
  );

  // 步骤2：创建 ImageSegmenter 实例
  // 使用 createFromOptions 工厂方法而非 new 构造函数
  imageSegmenter = await ImageSegmenter.createFromOptions(audio, {
    baseOptions : {
      // ==================== 可选模型列表 ====================
      //
      // 【模型1 - 当前使用】Selfie Segmenter Landscape（自拍分割-横向版）
      // - 输入尺寸：144×256（横向优化，适合横屏视频/摄像头场景）
      // - 量化精度：float16（体积小、速度快，精度略低于 float32）
      // - 分割类别：2 类（背景 + 人物）
      // - 适用场景：视频会议背景虚化/替换、自拍人像分割
      // - 特点：模型更轻量，帧率更高，专为横向视频流优化
      modelAssetPath :
      'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter_landscape/float16/latest/selfie_segmenter_landscape.tflite',
      //
      // 【模型2 - 备选】Selfie Segmenter Square（自拍分割-方形版）
      // - 输入尺寸：256×256（方形输入，通用场景）
      // - 量化精度：float16
      // - 分割类别：2 类（背景 + 人物）
      // - 适用场景：与模型1相同，但适合需要方形输入的场景
      // - 特点：输入分辨率更高，分割精度略优，但计算量稍大
      // 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
      //
      // 【模型3 - 备选】DeepLab-V3（通用语义分割）
      // - 输入尺寸：257×257
      // - 量化精度：float32（精度最高，但体积最大、速度最慢）
      // - 分割类别：21 类（PASCAL VOC 数据集）
      //   包括：背景、飞机、自行车、鸟、船、瓶子、公交车、汽车、猫、椅子、
      //         牛、餐桌、狗、马、摩托车、人、盆栽植物、羊、沙发、火车、电视
      // - 适用场景：需要识别多种物体类别的通用分割任务
      // - 特点：支持多类别语义分割，但模型较大、推理速度较慢
      // "https://storage.googleapis.com/mediapipe-models/image_segmenter/deeplab_v3/float32/1/deeplab_v3.tflite",
      // 计算委托：使用 GPU 加速推理（可选 "GPU" 或 "CPU"）
      // GPU 通常更快，但并非所有设备都支持；CPU 兼容性更好
      delegate : 'GPU'
    },
    // 运行模式：IMAGE（单帧图片）或 VIDEO（连续视频流）
    // VIDEO 模式使用帧间信息进行时序平滑，分割结果更稳定
    runningMode           : runningMode,
    // 是否输出类别掩码：每个像素标注其所属类别的 ID
    // true → result.categoryMask 可用（Uint8Array/Float32Array）
    outputCategoryMask    : true,
    // 是否输出置信度掩码：每个类别一张图，像素值表示该像素属于该类别的置信度
    // false → result.confidenceMasks 不可用（节省内存和计算）
    outputConfidenceMasks : false
  });

  // 步骤3：获取模型支持的类别标签列表
  // 返回值为字符串数组，内容因模型而异：
  //   - Selfie Segmenter（模型1/2）：["background", "person"]（2类）
  //   - DeepLab-V3（模型3）：["background", "aeroplane", "bicycle", ...]（21类）
  labels = imageSegmenter.getLabels();

  // 步骤4：模型加载完成，显示演示区域
  demosSection.classList.remove('invisible');
};

// 立即调用初始化函数，页面加载时开始加载模型
createImageSegmenter();

// ==================== 图片点击分割功能（Demo 1）====================

// 获取所有标记为"点击分割"的图片容器
const imageContainers = document.getElementsByClassName(
  'segmentOnClick'
);

// 为每个容器内的 img 元素绑定点击事件
for (let i = 0; i < imageContainers.length; i++) 
{
  imageContainers[i]
    .getElementsByTagName('img')[0]
    .addEventListener('click', handleClick);
}

/**
 * Demo 1：点击图片进行分割，并在 Canvas 上显示结果
 *
 * 点击图片后：
 * 1. 将原始图片绘制到对应的 Canvas 上
 * 2. 如果当前是 VIDEO 模式，切换为 IMAGE 模式
 * 3. 调用 segment() 进行分割，结果通过回调处理
 *
 * @param {Event} event - 点击事件对象
 */
let canvasClick;

async function handleClick(event) 
{
  // 如果 ImageSegmenter 尚未加载完成，不执行分割
  if (imageSegmenter === undefined) 
  {
    return;
  }

  // 获取被点击图片对应的 Canvas 元素（与图片同属一个父容器）
  canvasClick = event.target.parentElement.getElementsByTagName('canvas')[0];

  // 显示 Canvas（移除隐藏样式）
  canvasClick.classList.remove('removed');

  // 设置 Canvas 尺寸为图片的原始尺寸
  canvasClick.width = event.target.naturalWidth;
  canvasClick.height = event.target.naturalHeight;

  // 获取 Canvas 2D 上下文
  const cxt = canvasClick.getContext('2d');

  // 清空画布，准备绘制
  cxt.clearRect(0, 0, canvasClick.width, canvasClick.height);

  // 将原始图片绘制到 Canvas 上，作为分割的基础图像
  cxt.drawImage(event.target, 0, 0, canvasClick.width, canvasClick.height);

  // 将原始图片设为半透明，让分割结果更清晰可见
  event.target.style.opacity = 0;

  // 如果当前运行模式为 VIDEO，需要切换为 IMAGE 模式
  // 因为 ImageSegmenter 要求运行模式与调用方法严格匹配：
  //   IMAGE 模式 → segment()
  //   VIDEO 模式 → segmentForVideo()
  if (runningMode === 'VIDEO') 
  {
    runningMode = 'IMAGE';
    await imageSegmenter.setOptions({
      runningMode : runningMode
    });
  }

  // 执行图像分割
  // segment() 是异步方法，分割完成后自动调用 callback 回调函数
  // 参数1：待分割的图像元素（HTMLImageElement）
  // 参数2：分割完成后的回调函数
  imageSegmenter.segment(event.target, callback);
}

/**
 * 图片分割结果回调函数
 *
 * 处理流程：
 * 1. 获取 Canvas 上原始图片的像素数据
 * 2. 将分割掩码（categoryMask）的颜色与原始像素混合
 * 3. 将混合后的图像数据写回 Canvas
 * 4. 显示检测到的类别名称
 *
 * 颜色混合算法：将每个像素的原始颜色与对应类别的图例颜色取平均值
 * 这样可以在保留原始图像信息的同时，用颜色编码标注分割区域
 *
 * @param {Object} result - 分割结果对象
 * @param {Object} result.categoryMask - 类别掩码
 * @param {number} result.categoryMask.width - 掩码宽度
 * @param {number} result.categoryMask.height - 掩码高度
 * @param {Function} result.categoryMask.getAsUint8Array - 获取 Uint8Array 格式的掩码数据
 */
function callback(result) 
{
  const cxt = canvasClick.getContext('2d');

  // 获取类别掩码的尺寸（可能与原始图片尺寸不同，模型会缩放输入）
  const { width, height } = result.categoryMask;

  // 从 Canvas 获取当前图像的像素数据（RGBA 格式，每像素4字节）
  // 注意：此处的像素数据来自之前 drawImage 绘制的原始图片
  const imageData = cxt.getImageData(0, 0, width, height).data;

  // 调整 Canvas 尺寸为掩码尺寸（确保像素对齐）
  canvasClick.width = width;
  canvasClick.height = height;

  // 用于记录检测到的非背景类别名称
  let category = '';

  // 获取类别掩码数据（Uint8Array 格式）
  // 每个元素是一个整数，表示该像素所属类别的 ID
  // 例如：0=背景，15=人，8=猫，12=狗 等（PASCAL VOC 类别索引）
  const mask = result.categoryMask.getAsUint8Array();

  // 遍历每个像素，将类别颜色与原始像素颜色混合
  // eslint-disable-next-line guard-for-in
  for (const i in mask) 
  {
    // 如果该像素属于非背景类别（mask[i] > 0），记录类别名称
    if (mask[i] > 0) 
    {
      category = labels[mask[i]];
    }

    // 根据类别 ID 获取对应的图例颜色
    // 使用取模运算防止数组越界（类别数 > 颜色数时循环使用颜色）
    const legendColor = legendColors[mask[i] % legendColors.length];

    // 颜色混合：原始像素与图例颜色各取 50%
    // imageData[i*4]     → R 通道
    // imageData[i*4+1]   → G 通道
    // imageData[i*4+2]   → B 通道
    // imageData[i*4+3]   → A 通道（透明度）
    imageData[i * 4] = (legendColor[0] + imageData[i * 4]) / 2;
    imageData[i * 4 + 1] = (legendColor[1] + imageData[i * 4 + 1]) / 2;
    imageData[i * 4 + 2] = (legendColor[2] + imageData[i * 4 + 2]) / 2;
    imageData[i * 4 + 3] = (legendColor[3] + imageData[i * 4 + 3]) / 2;
  }

  // 将修改后的像素数据转换为 Uint8ClampedArray
  // Uint8ClampedArray 会自动将值钳制在 0-255 范围内，适合图像数据
  const uint8Array = new Uint8ClampedArray(imageData.buffer);

  // 创建新的 ImageData 对象（Canvas API 要求的数据格式）
  const dataNew = new ImageData(uint8Array, width, height);

  // 将混合后的图像数据绘制到 Canvas 上
  cxt.putImageData(dataNew, 0, 0);

  // 显示检测到的类别名称
  // 获取图片容器内的分类结果显示元素
  const p = event.target.parentNode.getElementsByClassName(
    'classification'
  )[0];

  // 移除隐藏样式，显示文本
  p.classList.remove('removed');

  // 设置文本内容为检测到的类别（取最后一个非背景类别）
  p.innerText = `Category: ${ category}`;
}

// ==================== 视频流分割回调函数 ====================

/**
 * 视频流分割结果回调函数
 *
 * 与 callback() 类似，但有以下区别：
 * - 使用 getAsFloat32Array() 而非 getAsUint8Array() 获取掩码
 *   （Float32 值范围 0.0-1.0，需要乘以 255 并取整来映射到颜色索引）
 * - 处理完成后通过 requestAnimationFrame 继续下一帧处理
 * - 不显示类别文本
 *
 * @param {Object} result - 分割结果对象
 * @param {Object} result.categoryMask - 类别掩码（Float32 格式）
 */
function callbackForVideo(result) 
{
  // 获取 Canvas 上当前视频帧的像素数据
  const imageData = canvasCtx.getImageData(
    0,
    0,
    video.videoWidth,
    video.videoHeight
  ).data;

  // 获取类别掩码数据（Float32Array 格式）
  // 与图片模式的 Uint8Array 不同，Float32 的值是 0.0 到 1.0 的浮点数
  // 每个值表示该像素所属类别的归一化 ID
  const mask = result.categoryMask.getAsFloat32Array();

  // 像素索引计数器（每像素4字节：R、G、B、A）
  let j = 0;

  // 遍历掩码中的每个像素
  for (let i = 0; i < mask.length; ++i) 
  {
    // 将 Float32 掩码值乘以 255 并四舍五入，映射为颜色索引
    // 例如：mask[i] = 0.059 → 15（人），mask[i] = 0.0 → 0（背景）
    const maskVal = Math.round(mask[i] * 255.0);

    // 根据颜色索引获取对应的图例颜色
    const legendColor = legendColors[maskVal % legendColors.length];

    // 颜色混合：原始像素与图例颜色各取 50%
    imageData[j] = (legendColor[0] + imageData[j]) / 2;
    imageData[j + 1] = (legendColor[1] + imageData[j + 1]) / 2;
    imageData[j + 2] = (legendColor[2] + imageData[j + 2]) / 2;
    imageData[j + 3] = (legendColor[3] + imageData[j + 3]) / 2;

    // 移动到下一个像素的 RGBA 起始位置
    j += 4;
  }

  // 将修改后的像素数据转换为 Uint8ClampedArray
  const uint8Array = new Uint8ClampedArray(imageData.buffer);

  // 创建新的 ImageData 对象
  const dataNew = new ImageData(
    uint8Array,
    video.videoWidth,
    video.videoHeight
  );

  // 将分割结果绘制到 Canvas 上
  canvasCtx.putImageData(dataNew, 0, 0);

  // 如果摄像头仍在运行，请求下一帧处理
  // 使用 requestAnimationFrame 实现与屏幕刷新同步的处理节奏
  if (webcamRunning === true) 
  {
    window.requestAnimationFrame(predictWebcam);
  }
}

// ==================== 摄像头实时分割功能（Demo 2）====================

/**
 * 检测浏览器是否支持 getUserMedia（摄像头访问）
 * @returns {boolean} 是否支持摄像头访问
 */
function hasGetUserMedia() 
{
  return Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// 记录上一次处理的视频时间戳，用于跳过重复帧
// 避免对同一帧重复执行分割（节省计算资源）
let lastWebcamTime = -1;

/**
 * 从摄像头视频流中获取帧并进行分割
 *
 * 处理流程：
 * 1. 检查是否有新的视频帧（跳过重复帧）
 * 2. 将视频帧绘制到 Canvas 上
 * 3. 如果当前是 IMAGE 模式，切换为 VIDEO 模式
 * 4. 调用 segmentForVideo() 进行分割
 *
 * 该函数通过 requestAnimationFrame 循环调用，实现持续的视频流分割
 */
async function predictWebcam() 
{
  // 检查当前视频帧是否与上一帧相同
  // currentTime 未变化说明视频还没有新帧，跳过本次处理
  if (video.currentTime === lastWebcamTime) 
  {
    if (webcamRunning === true) 
    {
      window.requestAnimationFrame(predictWebcam);
    }
    
    return;
  }

  // 记录当前帧时间戳
  lastWebcamTime = video.currentTime;

  // 将当前视频帧绘制到 Canvas 上
  // 这一帧图像将作为分割的基础，分割结果会在 callbackForVideo 中与此帧混合
  canvasCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

  // 如果 ImageSegmenter 尚未加载完成，不执行分割
  if (imageSegmenter === undefined) 
  {
    return;
  }

  // 如果当前运行模式为 IMAGE（之前点击了图片分割），需要切换回 VIDEO 模式
  // 因为视频流必须使用 segmentForVideo() 方法
  if (runningMode === 'IMAGE') 
  {
    runningMode = 'VIDEO';
    await imageSegmenter.setOptions({
      runningMode : runningMode
    });
  }

  // 记录当前时间戳，用于视频模式的帧同步
  const startTimeMs = performance.now();

  // 使用 segmentForVideo() 对视频帧进行分割
  // 与 segment() 的区别：
  //   - segment() 用于 IMAGE 模式，处理单帧图片
  //   - segmentForVideo() 用于 VIDEO 模式，支持帧间时序信息，结果更平滑
  // 参数1：视频元素（HTMLVideoElement）
  // 参数2：当前时间戳（毫秒），用于帧同步
  // 参数3：分割完成后的回调函数
  imageSegmenter.segmentForVideo(video, startTimeMs, callbackForVideo);
}

/**
 * 启用/禁用摄像头分割功能
 *
 * 点击按钮时触发：
 * - 如果摄像头未运行 → 启用摄像头并开始分割
 * - 如果摄像头正在运行 → 停止分割
 *
 * @param {Event} event - 按钮点击事件
 */
async function enableCam(event) 
{
  // 如果 ImageSegmenter 尚未加载完成，不执行操作
  if (imageSegmenter === undefined) 
  {
    return;
  }

  // 切换摄像头运行状态
  if (webcamRunning === true) 
  {
    // 当前正在运行 → 停止
    webcamRunning = false;
    enableWebcamButton.innerText = 'ENABLE SEGMENTATION';
  }
  else 
  {
    // 当前未运行 → 启动
    webcamRunning = true;
    enableWebcamButton.innerText = 'DISABLE SEGMENTATION';
  }

  // 摄像头媒体约束配置
  const constraints = {
    video : true // 仅请求视频流，未指定分辨率等参数（使用浏览器默认值）
  };

  // 请求摄像头权限并获取视频流
  // 返回的 MediaStream 对象直接赋给 video 元素的 srcObject
  video.srcObject = await navigator.mediaDevices.getUserMedia(constraints);

  // 当视频数据加载完成后，开始预测循环
  // loadeddata 事件在第一帧数据可用时触发
  video.addEventListener('loadeddata', predictWebcam);
}

// ==================== 初始化摄像头按钮 ====================

// 如果浏览器支持摄像头访问，为按钮绑定事件监听器
if (hasGetUserMedia()) 
{
  enableWebcamButton = document.getElementById(
    'webcamButton'
  );
  enableWebcamButton.addEventListener('click', enableCam);
}
else 
{
  // 浏览器不支持摄像头，输出警告信息
  console.warn('getUserMedia() is not supported by your browser');
}
