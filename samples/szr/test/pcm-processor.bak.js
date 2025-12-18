// pcm-processor.js
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    // 目标：320个采样点 * 2字节(Int16) = 640 字节
    this.targetSize = 320
    this.cacheBuffer = new Int16Array(this.targetSize)
    this.cacheIndex = 0
    this.processCallCount = 0
  }

  process(inputs, outputs, parameters) {
    // 每隔一定次数记录一次日志，避免日志过多
    this.processCallCount++
    if (this.processCallCount % 100 === 0) {
      this.port.postMessage({ type: 'debug', message: `process调用次数: ${this.processCallCount}` })
    }

    const input = inputs[0]

    if (input.length > 0 && input[0].length > 0) {
      const inputChannel0 = input[0] // Float32Array

      // 记录第一次处理时的输入信息
      if (this.processCallCount === 1) {
        this.port.postMessage({ type: 'debug', message: `输入通道数: ${input.length}, 第一通道长度: ${inputChannel0.length}` })
      }

      for (let i = 0; i < inputChannel0.length; i++) {
        // 转换并存入缓存
        const s = Math.max(-1, Math.min(1, inputChannel0[i]))

        this.cacheBuffer[this.cacheIndex++] = s < 0 ? s * 0x8000 : s * 0x7FFF

        // 缓存满 640 字节 (320 采样点) 时发送
        if (this.cacheIndex >= this.targetSize) {
          // 使用 slice 拷贝数据，避免主线程修改影响此处
          const sendBuffer = this.cacheBuffer.slice().buffer
          // 使用可转移对象 (Transferables) 零拷贝发送

          this.port.postMessage(sendBuffer, [sendBuffer])
          // 可选：添加计数器来跟踪发送的数据包数量
          if (!this.packetCount) this.packetCount = 0
          this.packetCount++
          // 发送调试信息
          if (this.packetCount % 10 === 1) {
            this.port.postMessage({ type: 'debug', message: `已发送数据包: ${this.packetCount}` })
          }
          this.cacheIndex = 0
        }
      }
    }

    return true
  }
}

registerProcessor('pcm-processor', PCMProcessor)