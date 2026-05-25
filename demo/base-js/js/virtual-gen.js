// ============================================================
// VirtualGen — 创建测试用的虚拟 MediaStream
//    通过 canvas.captureStream + OscillatorNode 生成音视频流，
//    供 demo 在没有摄像头/屏幕共享时模拟多路输入源。
// ============================================================
const VirtualGen = {
  audioCtx        : null,
  noteNames       : [ 'C4', 'E4', 'G4', 'B4', 'D5', 'F5', 'A5' ],
  noteFrequencies : [ 261.63, 329.63, 392.00, 493.88, 587.33, 698.46, 880.00 ],

  create(width, height, fps, label, id, options)
  {
    options = Object.assign({ video: true, audio: true }, options || {});
    if (options.audio) this.ensureAudioContext();

    const hue = (id * 137) % 360;
    const videoStream = options.video ? this.createVideoStream(width, height, fps, label, id, hue, options.videoText || '') : null;
    const audioData = options.audio ? this.createNoteAudio(id) : null;
    const mixed = new MediaStream([
      ...(videoStream ? videoStream.getVideoTracks() : []),
      ...(audioData ? audioData.stream.getAudioTracks() : [])
    ]);

    mixed.id = `virtual-${id}-${Date.now()}`;
    mixed.demoMeta = {
      hasVideo : Boolean(options.video),
      hasAudio : Boolean(options.audio),
      note     : audioData ? audioData.note : '',
      hue      : hue
    };

    mixed.stopInternal = () =>
    {
      if (audioData) audioData.stop();
    };

    return mixed;
  },

  ensureAudioContext()
  {
    if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

    return this.audioCtx;
  },

  createVideoStream(width, height, fps, label, id, hue, extraText)
  {
    const canvas = document.createElement('canvas');

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    let x = 0;

    const draw = () =>
    {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = `hsl(${hue}, 70%, 50%)`;
      ctx.lineWidth = Math.max(5, width * 0.02);
      ctx.strokeRect(0, 0, width, height);

      x = (x + width * 0.015) % width;
      ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
      const boxSize = height * 0.2;

      ctx.fillRect(x, height / 2 - boxSize / 2, boxSize, boxSize);

      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.font = `bold ${height / 6}px sans-serif`;
      ctx.fillText(label, width / 2, height / 2 - height / 8);

      ctx.font = `${height / 10}px monospace`;
      ctx.fillText(`${width}x${height} @ ${fps}fps`, width / 2, height / 2 + height / 6);
      if (extraText)
      {
        ctx.font = `bold ${height / 11}px sans-serif`;
        ctx.fillText(extraText, width / 2, height / 2 + height / 3);
      }

      requestAnimationFrame(draw);
    };

    draw();

    return canvas.captureStream(fps);
  },

  createNoteAudio(id)
  {
    const ac = this.ensureAudioContext();
    const noteIndex = (id - 1) % this.noteFrequencies.length;
    const note = this.noteNames[noteIndex];
    const baseFrequency = this.noteFrequencies[noteIndex];
    const dest = ac.createMediaStreamDestination();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    let beatTimer = null;

    osc.type = id % 2 ? 'sine' : 'triangle';
    osc.frequency.value = baseFrequency;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(dest);
    osc.start();

    const pulse = () =>
    {
      const now = ac.currentTime;

      osc.frequency.setValueAtTime(baseFrequency, now);
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    };

    pulse();
    beatTimer = window.setInterval(pulse, 520 + (noteIndex * 130));

    return {
      stream : dest.stream,
      note,
      stop   : () =>
      {
        if (beatTimer) window.clearInterval(beatTimer);
        try { osc.stop(); }
        catch (e) { }
        try { osc.disconnect(); }
        catch (e) { }
        try { gain.disconnect(); }
        catch (e) { }
      }
    };
  }
};
