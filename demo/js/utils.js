

let sdkAppId =null;
let userId = null;
let userSig = null;
let roomId= null;

// 获取临时密钥及基本信息
function getTemper(callback)
{
  get('https://pro.vsbc.com/pa/d/init', '', (res) =>
  {
    {
      sdkAppId=res.data['sdkId'];
      userId = res.data['userId'];
      roomId = res.data['roomId'];
      userSig = res.data['userSig'];

      document.querySelector('#user_id').value=userId;
      document.querySelector('#display_name').value = 'web 测试';
      document.querySelector('#roomId').value = roomId;

      callback();
    }
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

// 截视频帧
function captureVideo(video)
{
  const canvas = document.getElementById('captureView');
  const ctx = canvas.getContext('2d');

  canvas.width = video.clientWidth;
  canvas.height = video.clientHeight;

  ctx.drawImage(video, 0, 0, video.clientWidth, video.clientHeight);
}

/* Ajax请求 Get */
function get(url, data, callback)
{
  if (typeof data === 'function')
  {
    callback = data;
  }

  if (typeof data === 'object')
  {
    url = data ? `${url }?${ urlCode(data)}` : url;
  }

  const xhr = new XMLHttpRequest();

  xhr.open('get', url);
  xhr.onload = function()
  {
    callback(JSON.parse(xhr.responseText));
  };
  xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
  xhr.send();
}

/* Ajax请求 编码 */
function urlCode(data)
{
  let str = '';

  if (!data)
  {
    return null;
  }
  for (const key in data)
  {
    if ({}.hasOwnProperty.call(data, key))
    {
      str += `key=${ encodeURIComponent(data[key])}`;
    }
  }

  return str;
}