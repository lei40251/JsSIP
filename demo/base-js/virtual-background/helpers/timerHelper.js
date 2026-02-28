export function createTimerWorker()
{
  const callbacks = new Map();

  const worker = new Worker(new URL('./timerWorker.js', import.meta.url));

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

  function setTimeout(callback, timeoutMs)
  {
    const callbackId = nextCallbackId++;

    callbacks.set(callbackId, callback);
    worker.postMessage({ callbackId, timeoutMs });

    return callbackId;
  }

  function clearTimeout(callbackId)
  {
    if (!callbacks.has(callbackId))
    {
      return;
    }
    worker.postMessage({ callbackId });
    callbacks.delete(callbackId);
  }

  function terminate()
  {
    callbacks.clear();
    worker.terminate();
  }

  return { setTimeout, clearTimeout, terminate };
}
