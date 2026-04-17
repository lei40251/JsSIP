/**
 * @fileoverview MediaPipe 自拍分割演示程序
 *
 * 本文件演示了如何使用 MediaPipe SelfieSegmentation API 实现实时人像分割。
 * 主要功能包括：
 * - 从摄像头或视频源获取输入帧
 * - 使用机器学习模型进行人像分割
 * - 在 Canvas 上渲染分割效果（前景/背景着色）
 * - 提供交互式控制面板调整参数
 */

// 从全局 window 对象获取控制面板工具类
// 这些工具由 MediaPipe 提供的 CDN 脚本注入
const controls = window;

// 示例媒体配置（当前为空数组，可添加预设的图片/视频源）
// 格式示例：{name: '示例名称', src: 'https://url.com/video.mp4'}
const examples = {
  images : [],
  videos : []
};

// ==================== DOM 元素获取 ====================

// 视频输入元素：用于显示原始摄像头/视频流
const videoElement = document.getElementsByClassName('input_video')[0];

// Canvas 输出元素：用于渲染分割后的结果图像
const canvasElement = document.getElementsByClassName('output_canvas')[0];

// 控制面板容器：包含各种交互控件
const controlsElement = document.getElementsByClassName('control-panel')[0];

// 获取 Canvas 2D 渲染上下文，用于绑定绘图操作
const canvasCtx = canvasElement.getContext('2d');

// ==================== 性能监控 ====================

// FPS（帧率）控制器，用于实时显示处理帧率
const fpsControl = new controls.FPS();

// ==================== 加载动画处理 ====================

// 获取加载动画元素
const spinner = document.querySelector('.loading');

// 当加载动画的隐藏过渡效果结束时，彻底移除元素
// 避免动画结束后仍占用布局空间
spinner.ontransitionend = () =>
{
  spinner.style.display = 'none';
};

// ==================== 效果状态管理 ====================

// 当前激活的视觉效果模式
// 可选值：'mask'（前景着色）、'background'（背景着色）、'both'
let activeEffect = 'mask';

// ==================== 分割结果处理函数 ====================

/**
 * 处理 SelfieSegmentation 模型返回的分割结果
 *
 * @param {Object} results - MediaPipe 返回的结果对象
 * @param {ImageBitmap} results.segmentationMask - 分割蒙版（黑白图像，白色=人物区域）
 * @param {ImageBitmap} results.image - 原始输入图像
 */
function onResults(results)
{
  // 标记页面已加载完成，触发 CSS 隐藏加载动画
  document.body.classList.add('loaded');

  // 更新 FPS 计数器
  fpsControl.tick();

  // 保存当前 Canvas 状态，以便后续恢复
  canvasCtx.save();

  // 清空整个 Canvas 画布
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // 第一步：绘制分割蒙版到 Canvas
  // 蒙版是灰度图：人物区域为白色(255)，背景区域为黑色(0)
  canvasCtx.drawImage(
    results.segmentationMask, 0, 0, canvasElement.width,
    canvasElement.height);

  // 第二步：根据效果模式对蒙版进行着色
  if (activeEffect === 'mask' || activeEffect === 'both')
  {
    // 'source-in' 模式：只在蒙版的非透明区域（人物区域）绘制
    // 效果：人物区域被填充为半透明绿色
    canvasCtx.globalCompositeOperation = 'source-in';
    canvasCtx.fillStyle = '#00FF007F'; // 绿色，50% 透明度
    canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
  }
  else
  {
    // 'source-out' 模式：只在蒙版的透明区域（背景区域）绘制
    // 效果：背景区域被填充为半透明蓝色
    canvasCtx.globalCompositeOperation = 'source-out';
    canvasCtx.fillStyle = '#0000FF7F'; // 蓝色，50% 透明度
    canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
  }

  // 第三步：绘制原始图像
  // 'destination-atop' 模式：只在 Canvas 已有内容的区域绘制
  // 这样原始图像只会显示在蒙版覆盖的区域，实现人物与背景的合成
  canvasCtx.globalCompositeOperation = 'destination-atop';
  canvasCtx.drawImage(
    results.image, 0, 0, canvasElement.width, canvasElement.height);

  // 恢复 Canvas 状态（重置合成模式等设置）
  canvasCtx.restore();
}

// ==================== SelfieSegmentation 模型初始化 ====================

// 创建 SelfieSegmentation 实例
// locateFile: 指定模型文件的 CDN 加载路径
const selfieSegmentation = new SelfieSegmentation({ locateFile : (file) =>
{
  return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/${file}`;
} });

// 注册结果回调函数，每次模型处理完一帧后自动调用
selfieSegmentation.onResults(onResults);

// ==================== 控制面板配置 ====================

// 创建交互式控制面板
new controls
  .ControlPanel(controlsElement, {
    // 默认配置
    selfieMode     : true, // 自拍模式：前置摄像头镜像
    modelSelection : 1, // 模型选择：1=通用模型，0=横屏模型
    effect         : 'mask' // 默认效果：前景着色
  })
  .add([
    // 面板标题
    new controls.StaticText({ title: 'MediaPipe Selfie Segmentation' }),

    // FPS 显示控件
    fpsControl,

    // 自拍模式开关：控制是否镜像前置摄像头
    new controls.Toggle({ title: 'Selfie Mode', field: 'selfieMode' }),

    // 媒体源选择器：允许用户选择摄像头或视频文件
    new controls.SourcePicker({
      // 当媒体源改变时重置分割器状态
      onSourceChanged : () =>
      {
        selfieSegmentation.reset();
      },

      // 每帧处理回调：接收输入帧并发送到分割模型
      onFrame : async(input, size) =>
      {
        // 计算输入源的宽高比
        const aspect = size.height / size.width;
        let width, height;

        // 根据窗口方向自适应调整 Canvas 尺寸
        if (window.innerWidth > window.innerHeight)
        {
          // 横屏模式：以窗口高度为基准
          height = window.innerHeight;
          width = height / aspect;
        }
        else
        {
          // 竖屏模式：以窗口宽度为基准
          width = window.innerWidth;
          height = width * aspect;
        }

        // 更新 Canvas 尺寸以匹配视频源
        canvasElement.width = width;
        canvasElement.height = height;

        // 将当前帧发送到分割模型进行异步处理
        // 处理完成后会自动调用 onResults 回调
        await selfieSegmentation.send({ image: input });
      },

      // 预设的示例媒体列表
      examples : examples
    }),

    // 模型选择滑块
    // General(1): 通用模型，适合大多数场景
    // Landscape(0): 横屏优化模型，速度更快但精度略低
    new controls.Slider({
      title    : 'Model Selection',
      field    : 'modelSelection',
      discrete : [ 'General', 'Landscape' ]
    }),

    // 效果选择滑块
    // Background: 背景着色（蓝色）
    // Foreground(mask): 前景着色（绿色）
    new controls.Slider({
      title    : 'Effect',
      field    : 'effect',
      discrete : { 'background': 'Background', 'mask': 'Foreground' }
    })
  ])

  // 控制面板值变化回调
  .on((x) =>
  {
    const options = x;

    // 根据自拍模式设置切换视频元素的镜像 CSS 类
    videoElement.classList.toggle('selfie', options.selfieMode);

    // 更新当前效果模式
    activeEffect = x['effect'];

    // 将新配置应用到分割模型
    selfieSegmentation.setOptions(options);
  });
