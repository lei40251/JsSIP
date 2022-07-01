/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/**
 * 获取url参数
 */
function handleGetQuery(name)
{
  const reg = new RegExp(`(^|&)${name}=([^&]*)(&|$)`, 'i');
  const r = window.location.search.substr(1).match(reg);
 
  if (r != null) return unescape(r[2]);
 
  return null;
}
 
/**
  * 输出显示状态
  */
function setStatus(text)
{
  const statusDom = document.querySelector('#status');
  
  statusDom.innerText = `${statusDom.innerText}${ text}\r\n`;
}
 
/**
  * 更新摄像头下拉列表
  */
function updateDevices() 
{
  CRTC.Utils.getCameras()
    .then((cameras) => 
    {
      let option = '<option selected value="">请选择切换摄像头</option>';
 
      cameras.forEach((device) => 
      {
        option += `<option value="${device.deviceId}">${device.label}</option>`;
      });
 
      document.querySelector('#cameras').innerHTML = option;
    });
}