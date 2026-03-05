/**
 * 创建一个基于 Web Worker 的 Timer
 * 作用：避免主线程 setTimeout 在页面卡顿时不准的问题
 */
exports.createTimerWorker = () =>
{
  const callbacks = new Map();

  /**
   * Worker 内运行的代码
   * 负责真正执行 setTimeout
   */
  const code = `
    const timeoutIds = new Map();

    self.onmessage = (event) =>
    {
      if (event.data.timeoutMs !== undefined)
      {
        const timeoutId = self.setTimeout(() =>
        {
          self.postMessage({ callbackId: event.data.callbackId });
          timeoutIds.delete(event.data.callbackId);
        }, event.data.timeoutMs);

        timeoutIds.set(event.data.callbackId, timeoutId);
      }
      else
      {
        const timeoutId = timeoutIds.get(event.data.callbackId);

        self.clearTimeout(timeoutId);
        timeoutIds.delete(event.data.callbackId);
      }
    }
  `;
  const blob = new Blob([ code ], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url);

  worker.onmessage = (event) =>
  {
    const callback = callbacks.get(event.data.callbackId);

    if (!callback)
    {
      return;
    }
    callbacks.delete(event.data.callbackId);
    callback();
  };

  let nextCallbackId = 1;

  /**
   * 在 Web Worker 中设置一个延时回调
   * @param {Function} callback - 延时后执行的回调函数
   * @param {number} timeoutMs - 延时时间（毫秒）
   * @returns {number} 回调 ID，可用于取消该延时
   */
  function setTimeout(callback, timeoutMs)
  {
    const callbackId = nextCallbackId++;

    callbacks.set(callbackId, callback);
    worker.postMessage({ callbackId, timeoutMs });

    return callbackId;
  }

  /**
   * 取消通过 setTimeout 设置的延时回调
   * @param {number} callbackId - 要取消的回调 ID
   */
  function clearTimeout(callbackId)
  {
    if (!callbacks.has(callbackId))
    {
      return;
    }
    worker.postMessage({ callbackId });
    callbacks.delete(callbackId);
  }

  /**
   * 终止 Timer Worker 并清理所有资源
   */
  function terminate()
  {
    callbacks.clear();
    worker.terminate();
  }

  return { setTimeout, clearTimeout, terminate };
};
