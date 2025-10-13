const Logger = require('./Logger');
const logger = new Logger('MediaStreamMixer');

module.exports = class MediaStreamMixer
{
  constructor(videos)
  {
    logger.debug(`constructor: ${videos.length}`);

    // 根据传参是 video 元素还是 mediastream 分别处理后存储到 _videos
    const tmpVideos=[];

    videos.forEach((video) =>
    {
      if (video instanceof HTMLMediaElement)
      {
        tmpVideos.push(video);
      }
      else
      {
        tmpVideos.push(this._mediaStreamToVideoElement(video));
      }
    });
    // 需要混屏的全部 HTMLMediaElement 数组
    this._videos = tmpVideos;
    // 是否停止绘制视频帧
    this._isStopDrawingFrames = false;

    // 停止时使用
    this._audioSources;
    this._audioDestination;
    this._audioContext;

    // 初始化混屏用的画布
    this._canvas = document.createElement('canvas');
    this._context = this._canvas.getContext('2d');
    this._canvas.setAttribute('style', 'display:none');
  }

  // 计算缩放后的视频分辨率
  _scaleVideo(width, height, targetWidth = 640, targetHeight = 480)
  {
    let newWidth, newHeight, scale;

    // 始终按比例缩放（无论原始尺寸是否小于目标尺寸）
    if (width / height >= targetWidth / targetHeight)
    {
      scale = targetWidth / width; // 以宽度为基准缩放
      newHeight = height * scale;
      newWidth = targetWidth;
    }
    else
    {
      scale = targetHeight / height; // 以高度为基准缩放
      newWidth = width * scale;
      newHeight = targetHeight;
    }

    // 计算居中偏移量（若缩放后尺寸仍小于目标尺寸）
    const offsetX = Math.max(0, (targetWidth - newWidth) / 2);
    const offsetY = Math.max(0, (targetHeight - newHeight) / 2);

    return {
      width   : newWidth,
      height  : newHeight,
      offsetX : offsetX,
      offsetY : offsetY
    };
  }

  /**
   * 视频绘制到画布
   */
  _drawImage(video, idx)
  {
    // 是否已经停止
    if (this._isStopDrawingFrames)
    {
      return;
    }

    let x = 0;
    let y = 0;

    if (idx === 1)
    {
      x = 640;
    }

    if (idx === 2)
    {
      y = 480;
    }

    if (idx === 3)
    {
      x = 640;
      y = 480;
    }

    const newVideo = this._scaleVideo(video.videoWidth, video.videoHeight);

    this._context.drawImage(video, x+newVideo.offsetX, y+newVideo.offsetY, newVideo.width, newVideo.height);
  }

  /**
   * 将视频流渲染到画布
   */
  _drawVideosToCanvas()
  {
    // 是否已经停止
    if (this._isStopDrawingFrames)
    {
      return;
    }

    const renderVideos = this._videos.filter((video) =>
    {
      if (!video.srcObject) return false;

      // 检查流是否活跃且包含视频轨道
      return video.srcObject.active &&
         video.srcObject.getVideoTracks().length > 0;
    });

    // 根据视频数量生成画布高的倍数
    let height = 1;

    if (renderVideos.length >= 3)
    {
      height = 2;
    }

    // 设置画布宽高
    this._canvas.width = renderVideos.length >= 2 ? 1280 : 640;
    this._canvas.height = 480 * height;

    renderVideos.forEach((video, idx) =>
    {
      // 开始绘制当前视频帧
      this._drawImage(video, idx);
    });

    // 开始帧动画开始混流
    window.requestAnimationFrame(this._drawVideosToCanvas.bind(this));
  }

  // 将MediaStream转换为 HTMLVideoElement
  _mediaStreamToVideoElement(mediaStream)
  {
    const video = document.createElement('video');

    video.setAttribute('style', 'display:none');

    video.muted= true;
    video.autoplay = true;
    video.setAttribute('playsinline', '');
    video.srcObject = mediaStream.mediaStream || mediaStream;
    video.play().catch(() => { logger.error('video play error'); });

    return video;
  }

  // 停止合流
  stop()
  {
    logger.debug('stop');

    this._videos = [];
    this._isStopDrawingFrames = true;

    if (this._audioSources.length)
    {
      this._audioSources.forEach(function(source)
      {
        source.disconnect();
      });
      this._audioSources = [];
    }

    if (this._audioDestination)
    {
      this._audioDestination.disconnect();
      this._audioDestination = null;
    }

    if (this._audioContext)
    {
      this._audioContext.close();
    }

    this._audioContext = null;

    // 清理画布
    this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);

    // 停止画布导出的视频流
    if (this._canvas.stream)
    {
      this._canvas.stream.getTracks().forEach((track) =>
      {
        track.stop();
      });

      this._canvas.stream = null;
    }
  }

  // 添加媒体
  appendStream(videos)
  {
    logger.debug('appendStream');
    if (!videos)
    {
      // eslint-disable-next-line no-throw-literal
      throw 'First parameter is required.';
    }

    if (!(videos instanceof Array))
    {
      videos = [ videos ];
    }

    videos.forEach((video) =>
    {
      if (video instanceof HTMLMediaElement)
      {
        this._videos.push(video);
      }
      else
      {
        this._videos.push(this._mediaStreamToVideoElement(video));
      }
    });
  }

  // 获取音视频混合的媒体流
  async getMixedStream()
  {
    logger.debug('getMixedStream()');
    this._isStopDrawingFrames = false;

    const mixedVideoStream = this.getVideoStream();
    const mixedAudioStream = await this.getAudioStream();

    if (mixedAudioStream)
    {
      mixedAudioStream.getAudioTracks().forEach((track) =>
      {
        mixedVideoStream.addTrack(track);
      });
    }

    return mixedVideoStream;
  }

  // 获取混合后的视频流
  getVideoStream()
  {
    logger.debug('getVideoStream()');

    // 开始帧动画开始混流
    this._drawVideosToCanvas();

    const videoStream = new MediaStream();
    const capturedStream = this._canvas.captureStream();

    capturedStream.getVideoTracks().forEach((track) =>
    {
      videoStream.addTrack(track);
    });

    // 用于停止混合时
    this._canvas.stream = capturedStream;

    return videoStream;
  }

  // 获取混合后的音频流
  async getAudioStream()
  {
    logger.debug('getAudioStream()');

    // TODO:可以分别混合音频
    // if (this._useGainNode === true)
    // {
    //   this._gainNode = this._audioContext.createGain();
    //   this._gainNode.connect(this._audioContext.destination);
    //   this._gainNode.gain.value = 0; // don't hear this
    // }

    if (!this._audioContext)
    {
      this._audioContext = new AudioContext();
    }

    if (this._audioContext.state === 'suspended')
    {
      await this._audioContext.resume();
    }

    this._audioSources = [];
    this._audioDestination = this._audioContext.createMediaStreamDestination();

    const seenStreams = new WeakSet();

    this._videos.forEach((video) =>
    {
      const stream = video.srcObject;

      if (
        stream &&
      !seenStreams.has(stream) &&
      stream.getAudioTracks().length > 0 &&
      stream.getAudioTracks()[0].readyState === 'live'
      )
      {
        const source = this._audioContext.createMediaStreamSource(stream);

        source.connect(this._audioDestination);
        this._audioSources.push(source);
        seenStreams.add(stream);
      }
    });


    if (this._audioSources.length === 0)
    {
      logger.warn('No valid audio sources, skip audio stream creation');

      return null;
    }

    return this._audioDestination.stream;
  }
};