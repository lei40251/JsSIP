const http = require('http');
const fs = require('fs');
const path = require('path');

http.createServer((req, res) => 
{
  // 获取清除了 URL 参数后的路径
  const safeUrl = req.url.split('?')[0];
  // 如果直接访问根目录，默认打开你的这个 HTML 文件
  const fileName = safeUrl === '/' ? '/gemini-code-1780625789859.html' : safeUrl;
  const filePath = path.join(__dirname, fileName);

  fs.readFile(filePath, (err, content) => 
  {
    if (err) 
    {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('找不到文件！请确保 server.js 和你的 HTML 在同一个文件夹下。');
      
      return;
    }
        
    // 【核心】在这里强制注入浏览器开启 SharedArrayBuffer 所需的安全响应头
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        
    // 识别基础的文件类型
    if (filePath.endsWith('.html')) res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
        
    res.writeHead(200);
    res.end(content);
  });
}).listen(8000, () => 
{
  console.warn('====================================================');
  console.warn('🚀 专属音视频安全服务器已成功启动！');
  console.warn('👉 请在浏览器中手动输入并访问：http://localhost:8000');
  console.warn('====================================================');
});