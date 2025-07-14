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
    const width = video.videoWidth * 480 / video.videoHeight;

    if (idx === 1)
    {
      y = 480;
    }

    if (idx === 2)
    {
      x = 640;
    }

    if (idx === 3)
    {
      x = 640;
      y = 480;
    }

    if (idx === 4)
    {
      y = 480 * 2;
    }

    if (idx === 5)
    {
      x = 640;
      y = 480 * 2;
    }

    if (width < 640)
    {
      x = x + ((640 - width) / 2);
    }

    this._context.drawImage(video, x, y, width, 480);
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
      return video.srcObject ? video.srcObject.active : false;
    });

    // 根据视频数量生成画布高的倍数
    let height = 1;

    if (renderVideos.length === 2 || renderVideos.length === 3 || renderVideos.length === 4)
    {
      height = 2;
    }
    if (renderVideos.length === 5 || renderVideos.length === 6)
    {
      height = 3;
    }
    if (renderVideos.length === 7 || renderVideos.length === 8)
    {
      height = 4;
    }
    if (renderVideos.length === 9 || renderVideos.length === 10)
    {
      height = 5;
    }

    // 设置画布宽高
    this._canvas.width = renderVideos.length > 2 ? 1280 : 640;
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
  getMixedStream()
  {
    logger.debug('getMixedStream');
    this._isStopDrawingFrames = false;
    const mixedVideoStream = this.getVideoStream();

    const mixedAudioStream = this.getAudioStream();

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
    logger.debug('getVideoStream');

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
    // this._canvas.stream = videoStream;

    return videoStream;
  }

  // 获取混合后的音频流
  getAudioStream()
  {
    logger.debug('getAudioStream');

    this._audioSources = [];
    this._audioContext = new AudioContext();

    // TODO:可以分别混合音频
    // if (this._useGainNode === true)
    // {
    //   this._gainNode = this._audioContext.createGain();
    //   this._gainNode.connect(this._audioContext.destination);
    //   this._gainNode.gain.value = 0; // don't hear this
    // }

    this._videos.forEach((video) =>
    {
      if (!video.srcObject.getAudioTracks())
      {
        return;
      }

      const audioSource = this._audioContext.createMediaStreamSource(video.srcObject);

      this._audioSources.push(audioSource);
    });

    this._audioDestination = this._audioContext.createMediaStreamDestination();
    this._audioSources.forEach((audioSource) =>
    {
      audioSource.connect(this._audioDestination);
    });

    return this._audioDestination.stream;
  }
};