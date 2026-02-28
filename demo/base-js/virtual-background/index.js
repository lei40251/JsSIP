window.addEventListener('VirtualBackgroundEngineReady', async() => 
{
  const engine = new window.VirtualBackgroundEngine();

  const inputStream = await navigator.mediaDevices.getUserMedia({
    video : { width: 1280, height: 720 }
  });

  await engine.init({
    inputStream,
    modelPath : './models/segm_lite_v681.tflite'
  });

  engine.start();

  engine.setBackgroundImage('./backgrounds/porch-691330_1280.jpg');

  const processedStream = engine.getOutputStream();

  console.warn(processedStream);
  document.getElementById('video').srcObject = processedStream;
});
