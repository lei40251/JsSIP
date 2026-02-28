import { buildWebGL2Pipeline } from './pipelines/webgl2/webgl2Pipeline.js'
import { createTimerWorker } from './helpers/timerHelper.js'

const DEFAULT_CONFIG = {
  video: { width: 1280, height: 720, targetFps: 15 },
  segmentation: {
    backend: 'wasmSimd',
    inputResolution: '160x96',
    model: 'meet',
    pipeline: 'webgl2',
    targetFps: 15
  },
  postProcessing: {
    smoothSegmentationMask: true,
    coverage: [0.5, 0.75],
    lightWrapping: 0.3,
    blendMode: 'screen',
    jointBilateralFilter: {
      sigmaSpace: 1,
      sigmaColor: 0.1
    },
  }
}

export class VirtualBackgroundEngine {
  constructor(options = {}) {
    this.config = this.mergeConfig(options)
    this.pipeline = null
    this.tfs = null
    this.timerWorker = createTimerWorker()

    this.inputStream = null
    this.outputStream = null

    this.canvas = null
    this.videoEl = null
    this.backgroundEl = null

    this.isRunning = false
    this.renderTimeoutId = null
    this.animationFrameId = null
    this.solidColorCanvas = null
  }

  mergeConfig(options) {
    return {
      ...DEFAULT_CONFIG,
      ...options,
      video: { ...DEFAULT_CONFIG.video, ...(options.video || {}) },
      segmentation: { ...DEFAULT_CONFIG.segmentation, ...(options.segmentation || {}) },
      postProcessing: { ...DEFAULT_CONFIG.postProcessing, ...(options.postProcessing || {}) }
    }
  }

  /* ===============================
   * 初始化
   * =============================== */

  async init({ inputStream, modelPath, canvas }) {
    if (!inputStream) throw new Error('inputStream required')
    if (!modelPath) throw new Error('modelPath required')

    this.inputStream = inputStream
    this.canvas = canvas || document.createElement('canvas')
    this.canvas.width = this.config.video.width
    this.canvas.height = this.config.video.height

    await this.loadModel(modelPath)
    await this.createVideoElement()
    this.setupPipeline()
    this.createOutputStream()
  }

  async loadModel(modelPath) {
    if (typeof createTFLiteSIMDModule === 'undefined') {
      throw new Error('TFLite SIMD not loaded')
    }

    this.tfs = await createTFLiteSIMDModule()

    let modelResponse
    try {
      modelResponse = await fetch(modelPath)
      if (!modelResponse.ok) {
        throw new Error(`HTTP ${modelResponse.status}: ${modelResponse.statusText}`)
      }
    } catch (err) {
      throw new Error(`Failed to fetch model: ${err.message}`)
    }

    const model = await modelResponse.arrayBuffer()

    const bufferOffset = await this.tfs._getModelBufferMemoryOffset()
    this.tfs.HEAPU8.set(new Uint8Array(model), bufferOffset)
    this.tfs._loadModel(model.byteLength)
  }

  async createVideoElement() {
    this.videoEl = document.createElement('video')
    this.videoEl.autoplay = true
    this.videoEl.playsInline = true
    this.videoEl.srcObject = this.inputStream

    try {
      await this.videoEl.play()
    } catch (err) {
      throw new Error(`Video play failed: ${err.message}`)
    }
  }

  setupPipeline() {
    this.backgroundEl = document.createElement('img')
    this.backgroundEl.src =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='

    const sourcePlayback = {
      width: this.config.video.width,
      height: this.config.video.height,
      htmlElement: this.videoEl
    }

    this.pipeline = buildWebGL2Pipeline(
      sourcePlayback,
      this.backgroundEl,
      { type: 'image' },
      this.config.segmentation,
      this.canvas,
      this.tfs,
      () => { }
    )

    this.pipeline.updatePostProcessingConfig(this.config.postProcessing)
  }

  createOutputStream() {
    const stream = this.canvas.captureStream(this.config.video.targetFps)
    this.outputStream = stream
  }

  getOutputStream() {
    return this.outputStream
  }

  /* ===============================
   * 控制
   * =============================== */

  start() {
    if (this.isRunning) return
    this.isRunning = true
    this.lastFrameTime = 0
    this.loop = this.loop.bind(this)
    this.animationFrameId = requestAnimationFrame(this.loop)
  }

  stop() {
    this.isRunning = false
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
    if (this.renderTimeoutId) {
      this.timerWorker.clearTimeout(this.renderTimeoutId)
      this.renderTimeoutId = null
    }
  }

  async loop(now) {
    if (!this.isRunning) return

    const interval = 1000 / this.config.video.targetFps

    if (now - this.lastFrameTime >= interval) {
      this.lastFrameTime = now
      if (this.isRendering) return

      this.isRendering = true
      await this.pipeline.render()
      this.isRendering = false
    }

    this.animationFrameId = requestAnimationFrame(this.loop)
  }

  /* ===============================
   * 动态修改背景
   * =============================== */

  async setBackgroundImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = () => {
        this.backgroundEl.src = img.src
        resolve()
      }
      img.onerror = reject
      img.src = url
    })
  }

  setBlurBackground(radius = 20) {
    this.pipeline.updatePostProcessingConfig({
      ...this.config.postProcessing,
      blurRadius: radius
    })
  }

  setSolidColor(color = '#00ff00') {
    if (!this.solidColorCanvas) {
      this.solidColorCanvas = document.createElement('canvas')
      this.solidColorCanvas.width = 16
      this.solidColorCanvas.height = 16
    }
    const ctx = this.solidColorCanvas.getContext('2d')
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 16, 16)
    this.backgroundEl.src = this.solidColorCanvas.toDataURL()
  }

  /* ===============================
   * 清理
   * =============================== */

  destroy() {
    this.stop()

    if (this.pipeline?.cleanUp) {
      this.pipeline.cleanUp()
    }

    if (this.tfs?._freeModelBuffer) {
      this.tfs._freeModelBuffer()
    }

    this.timerWorker?.terminate()

    this.inputStream?.getTracks().forEach(t => t.stop())

    this.pipeline = null
    this.tfs = null
    this.inputStream = null
    this.outputStream = null
  }
}


window.VirtualBackgroundEngine = VirtualBackgroundEngine
window.dispatchEvent(new Event('VirtualBackgroundEngineReady'))