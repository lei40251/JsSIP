
// 摄像头列表
function listCameras(session)
{
  let options = '<option value="">请选择摄像头</option>';

  navigator.mediaDevices.enumerateDevices().then((s) => {
    let k = 1;

    for (let i = 0; i < s.length; ++i)
    {
      if (s[i].kind === 'videoinput')
      {
        const label= s[i].label ? s[i].label : `Camera${k}`;

        options += `<option value="${s[i].deviceId}">${label}</option>`;
        k++;
      }
    }

    // 添加到下拉列表
    document.querySelector('#camSelect').innerHTML=options;

    // 绑定下拉列表change事件
    document.querySelector('#camSelect').onchange = function()
    {
      if ($(this).val() === '')
      {
        return;
      }

      session.switchCam(
        {
          deviceId : { exact: $(this).val() }
        })
        .then((stream) =>
        {
          const tracks = stream.getTracks();
          const localStream = new MediaStream();

          tracks.forEach((track) => {
            if (track.kind == 'video' && track.readyState == 'live') {
              localStream.addTrack(track);
            }
          });
          document.querySelector('#localVideo').srcObject = localStream;
        });
    };
  });
}

/**
 * 输出显示状态
 * @param {String} text
 */
function setStatus(text)
{
  const statusDom = document.querySelector('#status');

  statusDom.innerText = text;
}

// 渲染消息队列消息
function renderMq(message)
{
  const li = document.createElement('li');
  const ele = document.querySelector('#mq');

  li.innerHTML = message;
  ele.appendChild(li);
  ele.scrollTop = ele.scrollHeight;
}

// 截视频帧
function captureVideo(video)
{
  const canvas = document.getElementById('captureView');
  const ctx = canvas.getContext('2d');

  canvas.width = video.clientWidth;
  canvas.height = video.clientHeight;

  ctx.drawImage(video, 0, 0, video.clientWidth, video.clientHeight);
}

// 创建会议 or 加会
function joinConf(room, noMq)
{
  if (noMq)
  {
    client.join(room)

    return;
  }

  // 获取临时密钥
  $.ajax({
    url     : 'https://pro.vsbc.com/cu/d/p9sdfjddpoesdf9dkjdfjd',
    success : (res) =>
    {
      if (res.code != 1000)
      {
        renderMq(res.msg);

        return;
      }
      xRights = res.data['X-Rights'];
      xSid = res.data['X-SID'];
      xUid = res.data['X-UID'];
      temper = res.data['temper'];

      if (room)
      {
        // 加入会议
        $.ajax({
          type        : 'POST',
          url         : 'https://pro.vsbc.com/cu/iapi/conf/join',
          contentType : 'application/json',
          data        : JSON.stringify({ roomId: room }),
          beforeSend  : (request) =>
          {
            const xTimestamp = parseInt(new Date().getTime() / 1000);

            request.setRequestHeader(
              'Authorization',
              createToken({ roomId: room }, xTimestamp)
            );
            request.setRequestHeader('X-Timestamp', xTimestamp);
            request.setRequestHeader('X-SID', xSid);
            request.setRequestHeader('X-UID', xUid);
            request.setRequestHeader('X-Rights', xRights);
            request.setRequestHeader('X-Version', version);
          },
          success : (result) =>
          {
            if (result.code === 1000)
            {
              roomid = result.data.roomId;
              confid = result.data.confId;

              // 建立消息队列
              initMq(result.data.mqUrl);
            }
            else
            {
              renderMq(result.msg);
            }
          }
        });
      }
      else
      {
        // 发起会议
        $.ajax({
          type        : 'POST',
          url         : 'https://pro.vsbc.com/cu/iapi/conf/new',
          contentType : 'application/json',
          data        : JSON.stringify({}),
          beforeSend  : (request) =>
          {
            const xTimestamp = parseInt(new Date().getTime() / 1000);

            request.setRequestHeader(
              'Authorization',
              createToken({}, xTimestamp)
            );
            request.setRequestHeader('X-Timestamp', xTimestamp);
            request.setRequestHeader('X-SID', xSid);
            request.setRequestHeader('X-UID', xUid);
            request.setRequestHeader('X-Rights', xRights);
            request.setRequestHeader('X-Version', version);
          },
          success : (result) =>
          {
            if (result.code === 1000) {
              roomid = result.data.roomId;
              confid = result.data.confId;

              // 建立消息队列
              initMq(result.data.mqUrl);
            }
            else
            {
              renderMq(result.msg);
            }
          }
        });
      }
    }
  });
}

// 生成加会请求Token
function createToken(obj, timestamp)
{
  const headersSign = CryptoJS.HmacSHA256(
    `content-type:application/json\r\nhost:${host}\r\nx-rights:${xRights}\r\nx-sid:${xSid}\r\nx-timestamp:${timestamp}\r\nx-uid:${xUid}\r\nx-version:${version}`,
    temper
  ).toString();

  return CryptoJS.HmacSHA256(JSON.stringify(obj), headersSign);
}