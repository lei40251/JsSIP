let canvas, gl, ctx, renderMode;
let textureCache = [null, null, null, null];

const vsSource = `attribute vec4 a_position; attribute vec2 a_texCoord; varying vec2 v_texCoord; void main() { gl_Position = a_position; v_texCoord = a_texCoord; }`;
const fsSource = `precision mediump float; varying vec2 v_texCoord; uniform sampler2D u_image; void main() { gl_FragColor = texture2D(u_image, v_texCoord); }`;

function initWebGL(gl) {
    try {
        const compile = (t, s) => { const h = gl.createShader(t); gl.shaderSource(h, s); gl.compileShader(h); return h; };
        const p = gl.createProgram();
        gl.attachShader(p, compile(gl.VERTEX_SHADER, vsSource));
        gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSource));
        gl.linkProgram(p);
        gl.useProgram(p);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, 1, 1, 1]), gl.STATIC_DRAW);
        const pl = gl.getAttribLocation(p, "a_position");
        const tl = gl.getAttribLocation(p, "a_texCoord");
        gl.vertexAttribPointer(pl, 2, gl.FLOAT, false, 16, 0); gl.enableVertexAttribArray(pl);
        gl.vertexAttribPointer(tl, 2, gl.FLOAT, false, 16, 8); gl.enableVertexAttribArray(tl);
        gl.uniform1i(gl.getUniformLocation(p, "u_image"), 0);
        return true;
    } catch(e) { return false; }
}

self.onmessage = function(e) {
    const { type, payload } = e.data;
    
    if (type === 'INIT') {
        canvas = payload.canvas;
        const requestedMode = payload.requestedMode; 
        const isAndroid = payload.isAndroid;

        if (requestedMode === 'Worker_WebGL') {
            const attr = { alpha: false, desynchronized: true, antialias: false, powerPreference: "high-performance" };
            gl = canvas.getContext('webgl2', attr) || canvas.getContext('webgl', attr);
            
            if (gl && initWebGL(gl)) {
                renderMode = 'WebGL';
                self.postMessage({ type: 'READY', mode: 'Tier 1 (Worker WebGL)' });
                return;
            }
        }

        // Worker Canvas2D Fallback or request
        // Android 上 Canvas 2D 不开 desynchronized，防止撕裂/Bug
        ctx = canvas.getContext('2d', { alpha: false, desynchronized: !isAndroid });
        renderMode = 'Canvas2D';
        // FIXED LINE: Standard string concatenation
        self.postMessage({ type: 'READY', mode: 'Tier 2 (Worker 2D / ' + requestedMode + ')' });
    } 
    else if (type === 'DRAW') {
        try {
            if (renderMode === 'WebGL') drawWebGL(payload.frames, payload.totalSources);
            else drawCanvas2D(payload.frames, payload.totalSources);
        } finally {
            self.postMessage({ type: 'DONE' });
        }
    }
    else if (type === 'DESTROY') {
        if (gl) {
             textureCache.forEach(t => t && gl.deleteTexture(t));
             gl.getExtension('WEBGL_losing_context')?.loseContext();
        }
        self.close();
    }
};

function drawWebGL(frames, totalSources) {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const w = gl.canvas.width; const h = gl.canvas.height;
    const useGrid = totalSources > 1;
    const gridW = useGrid ? w / 2 : w;
    const gridH = useGrid ? h / 2 : h;

    frames.forEach(item => {
        const i = item.index;
        if (!textureCache[i]) {
            textureCache[i] = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, textureCache[i]);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        } else {
            gl.bindTexture(gl.TEXTURE_2D, textureCache[i]);
        }
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, item.frame);
        let x = useGrid ? (i % 2) * gridW : 0;
        let y = useGrid ? Math.floor(i / 2) * gridH : 0;
        gl.viewport(x, h - (y + gridH), gridW, gridH);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        item.frame.close();
    });
    gl.flush();
}

function drawCanvas2D(frames, totalSources) {
    const w = canvas.width; const h = canvas.height;
    if (totalSources < 4) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); }
    const gridW = totalSources > 1 ? w / 2 : w;
    const gridH = totalSources > 1 ? h / 2 : h;
    frames.forEach(item => {
        const i = item.index;
        let x = totalSources > 1 ? (i % 2) * gridW : 0;
        let y = totalSources > 1 ? Math.floor(i / 2) * gridH : 0;
        ctx.drawImage(item.frame, x, y, gridW, gridH);
        item.frame.close();
    });
}