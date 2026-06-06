/**
 * 将内联 Worklet 源码注册到 AudioWorklet。
 *
 * 为什么做成独立工具：
 * - Core 只关心“如何创建 WorkletNode”，不关心 Blob URL 细节；
 * - 便于后续替换为外链 worklet 文件或更复杂的缓存策略；
 * - 便于集中处理 URL.revokeObjectURL 的资源回收。
 *
 * @param {AudioContext} audioContext
 * @param {string} inlineCode
 * @returns {Promise<void>}
 */
module.exports = async function createWorkletModule(audioContext, inlineCode)
{
  const blob = new Blob([ inlineCode ], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);

  try
  {
    await audioContext.audioWorklet.addModule(blobUrl);
  }
  finally
  {
    URL.revokeObjectURL(blobUrl);
  }
};
