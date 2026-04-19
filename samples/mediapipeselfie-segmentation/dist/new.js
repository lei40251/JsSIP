/**
 * @fileoverview MediaPipe 自拍分割演示程序
 *
 * 本文件演示了如何使用 MediaPipe SelfieSegmentation API 实现实时人像分割。
 * 主要功能包括：
 * - 通过 getUserMedia 直接获取摄像头视频流
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
  images: [],
  videos: []
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
spinner.ontransitionend = () => {
  spinner.style.display = 'none';
};

// ==================== 效果状态管理 ====================

// 当前激活的视觉效果模式
// 可选值：'mask'（前景着色）、'background'（背景着色）、'blur'（背景模糊）、
//         'image'（虚拟背景图片）、'color'（背景纯色）
let activeEffect = 'mask';

// 背景纯色设置
let backgroundColor = '#00FF00';

// 背景模糊程度 (1-20)
let blurLevel = 10;

// 虚拟背景图片
let backgroundImage = null;
let backgroundImageSrc = '';

// ==================== 分割结果处理函数 ====================

/**
 * 处理 SelfieSegmentation 模型返回的分割结果
 *
 * @param {Object} results - MediaPipe 返回的结果对象
 * @param {ImageBitmap} results.segmentationMask - 分割蒙版（黑白图像，白色=人物区域）
 * @param {ImageBitmap} results.image - 原始输入图像
 */
function onResults(results) {
  // 标记页面已加载完成，用于移除加载动画
  document.body.classList.add('loaded');
  // 更新 FPS 计数
  fpsControl.tick();

  // 保存当前 Canvas 上下文状态，以便后续恢复
  canvasCtx.save();
  // 清空画布，准备绘制新帧
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // 第一步：先绘制分割蒙版到画布上
  // 蒙版中白色区域代表人物（前景），黑色区域代表背景
  // 后续所有合成操作都基于此蒙版进行
  canvasCtx.drawImage(
    results.segmentationMask, 0, 0, canvasElement.width,
    canvasElement.height);

  // 第二步：根据当前激活的效果模式，在蒙版基础上进行合成绘制
  if (activeEffect === 'mask') {
    // 前景着色效果：仅在人物区域（蒙版白色部分）填充半透明绿色
    // source-in：只保留新绘制内容与已有蒙版重叠的部分
    canvasCtx.globalCompositeOperation = 'source-in';
    canvasCtx.fillStyle = '#00FF007F';
    canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
  }
  else if (activeEffect === 'background') {
    // 背景着色效果：仅在背景区域（蒙版黑色部分）填充半透明蓝色
    // source-out：只保留新绘制内容与已有蒙版不重叠的部分（即背景区域）
    canvasCtx.globalCompositeOperation = 'source-out';
    canvasCtx.fillStyle = '#0000FF7F';
    canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
  }
  else if (activeEffect === 'blur') {
    // 背景模糊效果：将原始图像以模糊方式绘制到背景区域
    // source-out：确保模糊图像只出现在背景区域
    canvasCtx.globalCompositeOperation = 'source-out';
    canvasCtx.filter = `blur(${blurLevel}px)`;
    canvasCtx.drawImage(
      results.image, 0, 0, canvasElement.width, canvasElement.height);
    // 重置滤镜，避免影响后续绘制
    canvasCtx.filter = 'none';
  }
  else if (activeEffect === 'color') {
    // 背景纯色效果：用用户选择的纯色填充背景区域
    canvasCtx.globalCompositeOperation = 'source-out';
    canvasCtx.fillStyle = backgroundColor;
    canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
  }
  else if (activeEffect === 'image') {
    // 虚拟背景图片效果：用预设图片替换背景区域
    canvasCtx.globalCompositeOperation = 'source-out';
    if (backgroundImage) {
      // 背景图片已加载，绘制到背景区域
      canvasCtx.drawImage(
        backgroundImage, 0, 0, canvasElement.width, canvasElement.height);
    }
    else {
      // 背景图片尚未加载完成，使用深灰色作为占位
      canvasCtx.fillStyle = '#333333';
      canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    }
  }

  // 第三步：将原始人物图像绘制到画布上
  // destination-atop：在已有内容的上方绘制，但只保留与已有内容重叠的区域
  // 这样人物图像只会出现在蒙版定义的前景区域，与背景效果自然合成
  canvasCtx.globalCompositeOperation = 'destination-atop';
  canvasCtx.drawImage(
    results.image, 0, 0, canvasElement.width, canvasElement.height);

  // 恢复 Canvas 上下文到保存前的状态（重置合成模式等）
  canvasCtx.restore();
}

// ==================== SelfieSegmentation 模型初始化 ====================

// 创建 SelfieSegmentation 实例
// locateFile: 指定模型文件的本地加载路径
const selfieSegmentation = new SelfieSegmentation({
  locateFile: (file) => {
    return `./assets/selfie_segmentation/${file}`;
  }
});

// 注册结果回调函数，每次模型处理完一帧后自动调用
selfieSegmentation.onResults(onResults);

// ==================== 使用 getUserMedia 获取摄像头流 ====================

/**
 * 通过 getUserMedia 获取摄像头视频流
 * 替代 SourcePicker，直接使用浏览器原生 API 获取摄像头
 */
async function startCamera() {
  try {
    // 请求摄像头权限，获取视频流
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'  // 优先使用前置摄像头
      }
    });

    // 将视频流绑定到 video 元素
    videoElement.srcObject = stream;
    // 等待视频元数据加载完成
    await new Promise((resolve) => {
      videoElement.onloadedmetadata = resolve;
    });
    // 开始播放视频
    await videoElement.play();

    // 根据视频宽高比和窗口尺寸，自适应计算 Canvas 画布大小
    const aspect = videoElement.videoHeight / videoElement.videoWidth;
    let width, height;

    if (window.innerWidth > window.innerHeight) {
      height = window.innerHeight;
      width = height / aspect;
    }
    else {
      width = window.innerWidth;
      height = width * aspect;
    }

    canvasElement.width = width;
    canvasElement.height = height;

    // 启动帧处理循环
    processFrame();
  }
  catch (err) {
    console.error('获取摄像头失败：', err);
    alert('无法访问摄像头，请检查权限设置。');
  }
}

/**
 * 帧处理循环：持续将视频帧发送给 SelfieSegmentation 模型
 * 使用 requestAnimationFrame 实现与屏幕刷新同步的处理节奏
 */
async function processFrame() {
  if (videoElement.readyState >= 2) {
    // 视频已就绪（HAVE_CURRENT_DATA 或更高），发送当前帧到模型
    try {
      await selfieSegmentation.send({ image: videoElement });
    }
    catch (err) {
      console.warn('发送帧到模型失败：', err);
    }
  }
  // 请求下一帧处理
  requestAnimationFrame(processFrame);
}

// ==================== 控制面板配置 ====================

// 创建交互式控制面板，绑定到页面上的控制面板容器
// 初始配置对象定义了各控件的默认值
new controls
  .ControlPanel(controlsElement, {
    selfieMode: true,        // 自拍模式：默认开启（镜像翻转）
    modelSelection: 1,       // 模型选择：0=通用模型，1=风景模型
    effect: 'mask',          // 效果模式：默认前景着色
    backgroundColor: 'green',// 背景颜色：默认绿色
    blurLevel: 10,           // 模糊级别：默认10
    backgroundImage: 'none'  // 背景图片：默认无
  })
  .add([
    // 标题文本
    new controls.StaticText({ title: 'MediaPipe Selfie Segmentation' }),

    // FPS 实时帧率显示
    fpsControl,

    // 自拍模式开关：控制视频是否镜像翻转
    new controls.Toggle({ title: 'Selfie Mode', field: 'selfieMode' }),

    // 模型选择滑块：在通用模型和风景模型之间切换
    new controls.Slider({
      title: 'Model Selection',
      field: 'modelSelection',
      discrete: ['General', 'Landscape']
    }),

    // 效果选择滑块：在五种视觉效果之间切换
    new controls.Slider({
      title: 'Effect',
      field: 'effect',
      discrete: {
        'mask': 'Foreground (Green)',       // 前景着色（绿色）
        'background': 'Background (Blue)',  // 背景着色（蓝色）
        'blur': 'Background Blur',          // 背景模糊
        'color': 'Solid Color',             // 背景纯色
        'image': 'Virtual Background'       // 虚拟背景图片
      }
    }),

    // 背景模糊程度滑块：控制模糊的像素半径
    new controls.Slider({
      title: 'Blur Level',
      field: 'blurLevel',
      range: [1, 20],
      step: 1
    }),

    // 背景颜色选择滑块：在预设颜色之间切换
    new controls.Slider({
      title: 'Background Color',
      field: 'backgroundColor',
      discrete: {
        'green': 'Green',
        'blue': 'Blue',
        'red': 'Red',
        'white': 'White',
        'black': 'Black',
        'gray': 'Gray'
      }
    }),

    // 虚拟背景图片选择滑块：在预设图片之间切换
    new controls.Slider({
      title: 'Background Image',
      field: 'backgroundImage',
      discrete: {
        'none': 'None',     // 无虚拟背景
        'beach': 'Beach',   // 海滩
        'office': 'Office', // 办公室
        'nature': 'Nature'  // 自然风景
      }
    })
  ])
  // 控制面板值变更回调：当用户调整任何控件时触发
  .on((x) => {
    const options = x;

    // 切换视频元素的自拍模式 CSS 类（控制镜像翻转）
    videoElement.classList.toggle('selfie', options.selfieMode);

    // 更新当前激活的效果模式
    activeEffect = x['effect'];
    // 更新模糊级别，默认10
    blurLevel = x['blurLevel'] || 10;

    // 颜色名称到十六进制颜色值的映射表
    const colorMap = {
      'green': '#00FF00',
      'blue': '#0000FF',
      'red': '#FF0000',
      'white': '#FFFFFF',
      'black': '#000000',
      'gray': '#808080'
    };
    // 根据用户选择更新背景颜色
    backgroundColor = colorMap[x['backgroundColor']] || '#00FF00';

    // 背景图片名称到图片 URL 的映射表（使用 Unsplash 图片源）
    const imageMap = {
      'none': '',
      'beach': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1280',
      'office': 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1280',
      'nature': 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1280'
    };
    // 获取新选择的背景图片 URL
    const newImageSrc = imageMap[x['backgroundImage']] || '';
    // 仅当背景图片 URL 发生变化时才重新加载图片，避免重复请求
    if (newImageSrc !== backgroundImageSrc) {
      backgroundImageSrc = newImageSrc;
      if (newImageSrc) {
        // 创建 Image 对象异步加载背景图片
        const img = new Image();
        // 设置跨域属性，允许 Canvas 读取图片像素数据
        img.crossOrigin = 'anonymous';
        // 图片加载完成后保存引用，下一帧绘制时即可使用
        img.onload = () => {
          backgroundImage = img;
        };
        img.src = newImageSrc;
      }
      else {
        // 选择"无背景图片"时，清除背景图片引用
        backgroundImage = null;
      }
    }

    // 将更新后的选项应用到 SelfieSegmentation 模型
    selfieSegmentation.setOptions(options);
  });

// 启动摄像头（在控制面板初始化后，确保 setOptions 已被调用）
startCamera();
