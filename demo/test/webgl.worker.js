// 全局变量声明
// canvas: HTMLCanvasElement，用于渲染的画布元素
// gl: WebGLRenderingContext/WebGL2RenderingContext，WebGL上下文对象
// ctx: CanvasRenderingContext2D，Canvas2D上下文对象（作为WebGL不可用时的降级方案）
// renderMode: 当前使用的渲染模式 ('WebGL' 或 'Canvas2D')
let canvas, gl, ctx, renderMode;

// 纹理缓存数组，最多支持4个视频源同时渲染
// 每个元素初始为null，在需要时创建对应的WebGL纹理对象
let textureCache = [null, null, null, null];

// 顶点着色器源码 (Vertex Shader)
// 功能：处理顶点位置和纹理坐标
// a_position: 顶点位置属性 (vec4类型)
// a_texCoord: 纹理坐标属性 (vec2类型)
// v_texCoord: 传递给片元着色器的纹理坐标 (varying变量)
const vsSource = `
    attribute vec4 a_position;    // 顶点位置属性
    attribute vec2 a_texCoord;    // 纹理坐标属性
    varying vec2 v_texCoord;      // 传递给片元着色器的纹理坐标
    
    void main() {
        // 将顶点位置设置为裁剪空间坐标
        gl_Position = a_position;
        // 将纹理坐标传递给片元着色器
        v_texCoord = a_texCoord;
    }
`;

// 片元着色器源码 (Fragment Shader)
// 功能：根据纹理坐标从纹理中采样颜色值
// v_texCoord: 从顶点着色器接收的纹理坐标
// u_image: 纹理采样器 (uniform变量)
const fsSource = `
    precision mediump float;           // 设置浮点精度
    varying vec2 v_texCoord;           // 从顶点着色器接收的纹理坐标
    uniform sampler2D u_image;         // 纹理采样器
    
    void main() {
        // 使用texture2D函数根据纹理坐标从纹理中采样颜色
        gl_FragColor = texture2D(u_image, v_texCoord);
    }
`;

/**
 * 初始化 WebGL 环境
 * 编译着色器，设置缓冲区数据（位置和纹理坐标），并配置属性指针。
 * @param {WebGLRenderingContext} gl - WebGL 上下文
 * @returns {boolean} - 初始化成功返回 true，失败返回 false
 */
function initWebGL(gl) {
    try {
        // 1. 定义一个辅助函数用于编译着色器
        // 参数说明：
        // t: shader type (gl.VERTEX_SHADER 或 gl.FRAGMENT_SHADER)
        // s: source code (着色器源码字符串)
        // 返回值：编译后的着色器对象
        const compile = (t, s) => {
            const h = gl.createShader(t);     // 创建着色器对象
            gl.shaderSource(h, s);            // 将源码绑定到着色器对象
            gl.compileShader(h);              // 编译着色器源码

            // 注意：此处代码省略了编译错误检查 (gl.getShaderParameter)
            // 在生产环境中建议添加错误检查以提高调试效率
            return h;
        };

        // 2. 创建并链接 WebGL 程序 (Program)
        // WebGL程序是顶点着色器和片元着色器的组合
        const p = gl.createProgram();                           // 创建程序对象
        // 假设 vsSource (顶点着色器) 和 fsSource (片元着色器) 已经在外部定义
        gl.attachShader(p, compile(gl.VERTEX_SHADER, vsSource));   // 附加顶点着色器
        gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSource)); // 附加片元着色器
        gl.linkProgram(p);                                        // 链接两个着色器成为一个程序
        gl.useProgram(p);                                         // 激活该程序供后续使用

        // 3. 创建并绑定缓冲区 (Buffer)
        // 缓冲区用于存储顶点数据，如位置、颜色、纹理坐标等
        const buf = gl.createBuffer();               // 创建缓冲区对象
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);         // 绑定缓冲区为目标缓冲区

        // 4. 填充顶点数据
        // 这是一个交错数组 (Interleaved Array): 每一行包含 [x, y, u, v]
        // x, y: 顶点位置 (范围 -1 到 1，对应裁剪空间坐标)
        // u, v: 纹理坐标 (范围 0 到 1)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1, 0, 0,  // 左下角: Pos(-1,-1), UV(0,0)
            1, -1, 1, 0,  // 右下角: Pos( 1,-1), UV(1,0)
            -1, 1, 0, 1,  // 左上角: Pos(-1, 1), UV(0,1)
            1, 1, 1, 1   // 右上角: Pos( 1, 1), UV(1,1)
        ]), gl.STATIC_DRAW); // STATIC_DRAW表示数据不会频繁更改

        // 5. 获取着色器中变量的位置 (Location)
        // 这些位置用于后续向着色器传递数据
        const pl = gl.getAttribLocation(p, "a_position"); // 获取顶点位置属性的位置
        const tl = gl.getAttribLocation(p, "a_texCoord"); // 获取纹理坐标属性的位置

        // 6. 配置顶点属性指针 (告诉 GPU 如何解析上面的 bufferData)
        // 每个浮点数占 4 字节。
        // stride (步长) = 4 个数 * 4 字节 = 16 字节

        // 配置 a_position: 读取 2 个浮点数，步长 16，偏移量 0
        // 参数说明：
        // pl: 属性位置
        // 2: 每个顶点的分量数量 (x,y)
        // gl.FLOAT: 数据类型
        // false: 是否规范化
        // 16: 步长 (字节数)
        // 0: 偏移量 (字节数)
        gl.vertexAttribPointer(pl, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(pl); // 启用顶点属性数组

        // 配置 a_texCoord: 读取 2 个浮点数，步长 16，偏移量 8 (跳过前两个浮点数)
        gl.vertexAttribPointer(tl, 2, gl.FLOAT, false, 16, 8);
        gl.enableVertexAttribArray(tl); // 启用纹理坐标属性数组

        // 7. 设置纹理 Uniform
        // 获取uniform变量'u_image'的位置，并设置其值为0
        // 0表示使用纹理单元0 (TEXTURE0)
        gl.uniform1i(gl.getUniformLocation(p, "u_image"), 0);

        return true; // 初始化成功
    } catch (e) {
        // 生产环境中建议打印 console.error(e) 以便调试
        return false; // 初始化失败
    }
}

// Web Workers的消息处理函数
// 接收来自主线程的消息并根据消息类型执行相应操作
self.onmessage = function (e) {
    // 解构消息数据，获取消息类型和载荷
    const { type, payload } = e.data;

    // 处理初始化消息
    if (type === 'INIT') {
        // 保存canvas元素引用
        canvas = payload.canvas;
        // 获取请求的渲染模式
        const requestedMode = payload.requestedMode;
        // 检查是否为Android平台
        const isAndroid = payload.isAndroid;

        // 如果请求的是WebGL渲染模式
        if (requestedMode === 'Worker_WebGL') {
            // 设置WebGL上下文属性
            // alpha: false - 不需要透明度通道
            // desynchronized: true - 提高性能，减少延迟
            // antialias: false - 不启用抗锯齿
            // powerPreference: "high-performance" - 优先使用高性能GPU
            const attr = {
                alpha: false,
                desynchronized: true,
                antialias: false,
                powerPreference: "high-performance"
            };

            // 尝试创建WebGL2上下文，如果失败则回退到WebGL1
            gl = canvas.getContext('webgl2', attr) || canvas.getContext('webgl', attr);

            // 如果成功获取WebGL上下文并且初始化成功
            if (gl && initWebGL(gl)) {
                renderMode = 'WebGL'; // 设置渲染模式为WebGL
                // 向主线程发送准备就绪消息
                self.postMessage({ type: 'READY', mode: 'Tier 1 (Worker WebGL)' });
                return; // 结束处理
            }
        }

        // Worker Canvas2D Fallback or request
        // 如果WebGL不可用或请求Canvas2D，则使用Canvas2D作为降级方案
        // Android 上 Canvas 2D 不开 desynchronized，防止撕裂/Bug
        ctx = canvas.getContext('2d', {
            alpha: false,
            desynchronized: !isAndroid // Android平台禁用desynchronized
        });
        renderMode = 'Canvas2D'; // 设置渲染模式为Canvas2D

        // 向主线程发送准备就绪消息，包含当前使用的渲染模式
        // FIXED LINE: Standard string concatenation
        self.postMessage({ type: 'READY', mode: 'Tier 2 (Worker 2D / ' + requestedMode + ')' });
    }
    // 处理绘制消息
    else if (type === 'DRAW') {
        try {
            // 根据当前渲染模式调用相应的绘制函数
            if (renderMode === 'WebGL')
                drawWebGL(payload.frames, payload.totalSources);
            else
                drawCanvas2D(payload.frames, payload.totalSources);
        } finally {
            // 无论绘制成功与否，都向主线程发送完成消息
            self.postMessage({ type: 'DONE' });
        }
    }
    // 处理销毁消息
    else if (type === 'DESTROY') {
        // 如果使用了WebGL，则清理相关资源
        if (gl) {
            // 删除所有已创建的纹理对象
            textureCache.forEach(t => t && gl.deleteTexture(t));
            // 获取并调用WEBGL_losing_context扩展来主动丢失WebGL上下文
            // 这有助于释放GPU资源
            gl.getExtension('WEBGL_losing_context')?.loseContext();
        }
        // 关闭Web Worker
        self.close();
    }
};

/**
 * 使用WebGL绘制视频帧
 * @param {Array} frames - 要绘制的视频帧数组
 * @param {Number} totalSources - 视频源总数
 */
function drawWebGL(frames, totalSources) {
    // 设置清屏颜色为黑色 (R=0, G=0, B=0, A=1)
    gl.clearColor(0, 0, 0, 1);
    // 清除颜色缓冲区
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 获取画布尺寸
    const w = gl.canvas.width;
    const h = gl.canvas.height;

    // 判断是否需要网格布局显示多个视频源
    const useGrid = totalSources > 1;
    // 计算每个视频源在网格中的宽度和高度
    const gridW = useGrid ? w / 2 : w;
    const gridH = useGrid ? h / 2 : h;

    // 遍历所有要绘制的视频帧
    frames.forEach(item => {
        const i = item.index; // 获取视频源索引

        // 如果该索引位置的纹理尚未创建，则创建新纹理
        if (!textureCache[i]) {
            textureCache[i] = gl.createTexture();                 // 创建纹理对象
            gl.bindTexture(gl.TEXTURE_2D, textureCache[i]);       // 绑定纹理
            // 设置纹理参数
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);  // S轴边缘处理
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);  // T轴边缘处理
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);     // 缩小时使用线性过滤
        } else {
            // 如果纹理已存在，则直接绑定
            gl.bindTexture(gl.TEXTURE_2D, textureCache[i]);
        }

        // 将视频帧数据上传到纹理
        // 参数说明：
        // gl.TEXTURE_2D: 纹理目标
        // 0: mipmap级别
        // gl.RGBA: 内部格式
        // gl.RGBA: 格式
        // gl.UNSIGNED_BYTE: 数据类型
        // item.frame: 视频帧图像数据
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, item.frame);

        // 计算当前视频源在网格中的位置
        let x = useGrid ? (i % 2) * gridW : 0;                    // X坐标
        let y = useGrid ? Math.floor(i / 2) * gridH : 0;          // Y坐标

        // 设置视口，确定绘制区域
        // 参数说明：x, y, width, height
        // 注意Y坐标需要翻转，因为WebGL坐标系与Canvas不同
        gl.viewport(x, h - (y + gridH), gridW, gridH);

        // 绘制图元，使用三角形条带绘制全屏四边形
        // 参数说明：
        // gl.TRIANGLE_STRIP: 图元类型
        // 0: 起始顶点索引
        // 4: 顶点数量
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // 关闭视频帧以释放内存
        item.frame.close();
    });

    // 强制执行所有先前发出的OpenGL命令
    gl.flush();
}

/**
 * 使用Canvas2D绘制视频帧
 * @param {Array} frames - 要绘制的视频帧数组
 * @param {Number} totalSources - 视频源总数
 */
function drawCanvas2D(frames, totalSources) {
    // 获取画布尺寸
    const w = canvas.width;
    const h = canvas.height;

    // 如果视频源少于4个，则先用黑色填充整个画布
    if (totalSources < 4) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
    }

    // 判断是否需要网格布局显示多个视频源
    const useGrid = totalSources > 1;
    // 计算每个视频源在网格中的宽度和高度
    const gridW = useGrid ? w / 2 : w;
    const gridH = useGrid ? h / 2 : h;

    // 遍历所有要绘制的视频帧
    frames.forEach(item => {
        const i = item.index; // 获取视频源索引

        // 计算当前视频源在网格中的位置
        let x = useGrid ? (i % 2) * gridW : 0;           // X坐标
        let y = useGrid ? Math.floor(i / 2) * gridH : 0; // Y坐标

        // 在指定位置绘制视频帧
        // 参数说明：
        // item.frame: 要绘制的图像
        // x, y: 绘制位置
        // gridW, gridH: 绘制尺寸
        ctx.drawImage(item.frame, x, y, gridW, gridH);

        // 关闭视频帧以释放内存
        item.frame.close();
    });
}