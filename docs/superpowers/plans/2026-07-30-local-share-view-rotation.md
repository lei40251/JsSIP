# 共享桌面与白板本端旋转 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `demo/base-js/` 的共享桌面与共享白板增加仅本端生效的“旋转90° / 恢复”两态视图，并保证旋转后标注落点准确。

**Architecture:** `app-helper.js` 维护本端旋转状态和共享浮层生命周期，`app-annotation.js` 保持协议坐标不变，只在渲染与指针输入边界执行 90° 正向/逆向映射。共享视频使用显式尺寸和 CSS transform，Konva Stage 使用旋转后的最终可见矩形，不依赖浏览器对旋转 DOM 的指针反推。

**Tech Stack:** Browser JavaScript、Konva 10.3.0、CSS transforms、Node.js `vm`、nodeunit 风格测试。

## Global Constraints

- 旋转只允许本端 `0°` 和顺时针 `90°` 两态，不同步给其他端。
- 按钮文本固定为“旋转90°”和“恢复”。
- 旋转后画笔、橡皮、箭头、矩形和椭圆必须保持准确绘制。
- 同步和存储继续使用未旋转的 0～1 规范化坐标，不新增 SIP INFO 字段。
- 最小化/恢复保留旋转；关闭共享或切换 `local`、`remote`、`whiteboard` 来源时恢复 0°。
- 点击旋转时取消当前未提交 draft，不发送半笔标注。
- 不修改 SDK API、`.d.ts`、SIP/WebRTC 时序、`dist/`、`release/` 或第三方文件。
- 不新增依赖，不做无关格式化，保留当前工作树全部已有改动。
- 按仓库规则不自动 stage 或 commit。

## File Structure

- Modify: `demo/base-js/index.html` — 标题栏旋转按钮。
- Modify: `demo/base-js/js/app-helper.js` — 本端旋转状态、按钮更新和浮层生命周期。
- Modify: `demo/base-js/js/app-events.js` — 旋转按钮直接绑定。
- Modify: `demo/base-js/js/app-annotation.js` — 坐标正反映射、视频/Stage 布局和 draft 取消。
- Modify: `demo/base-js/style/style.css` — 视频 transform origin；现有移动端按钮换行规则继续复用。
- Modify: `test/test-conference.js` — helper 状态、坐标、布局和绘制回归测试。

---

### Task 1: 本端旋转按钮与共享浮层生命周期

**Files:**
- Modify: `demo/base-js/index.html:79-88`
- Modify: `demo/base-js/js/app-helper.js:1-12, 453-550`
- Modify: `demo/base-js/js/app-events.js:48-62`
- Modify: `test/test-conference.js:150-320, 600-630`

**Interfaces:**
- Produces: `isShareViewRotated(): boolean`。
- Produces: `setShareViewRotated(rotated: boolean): void`。
- Produces: `toggleShareRotation(): void`。
- Produces: `updateShareRotationUi(): void`。
- Optional callback consumed: `onShareRotationChanged(): void`，Task 2 在 `app-annotation.js` 中实现。

- [ ] **Step 1: 写 helper 生命周期失败测试**

在 `test/test-conference.js` 增加一个只加载 `app-helper.js` 的 VM 夹具。元素的 `classList` 必须真实记录 `add/remove/toggle`，按钮记录 `aria-pressed`：

```js
function createTrackedElement(classes)
{
  const names = new Set(classes || []);

  return {
    dataset: {},
    textContent: '',
    className: '',
    attributes: {},
    classList: {
      add: function(name) { names.add(name); },
      remove: function(name) { names.delete(name); },
      contains: function(name) { return names.has(name); },
      toggle: function(name, force)
      {
        const enabled = force === undefined ? !names.has(name) : Boolean(force);

        if (enabled) names.add(name);
        else names.delete(name);

        return enabled;
      }
    },
    setAttribute: function(name, value) { this.attributes[name] = String(value); }
  };
}

function loadShareHelperDemo()
{
  const elements = new Map();
  const selectors = [
    '#crtcMediaDialog', '#shareRestore', '#screen', '#shareVid', '#shareTitle',
    '#shareSub', '#shareIcon i', '#shareRotate', '#shareRotateText'
  ];

  selectors.forEach(function(selector)
  {
    elements.set(selector, createTrackedElement(
      selector === '#crtcMediaDialog' || selector === '#shareRotate' ? [ 'hide' ] : []
    ));
  });

  const context = {
    console,
    Map,
    Set,
    String,
    Boolean,
    document: { querySelector: function(selector) { return elements.get(selector) || null; } },
    setInkMode: function() {},
    rotationChanges: 0,
    onShareRotationChanged: function() { this.rotationChanges++; }
  };

  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '../demo/base-js/js/app-helper.js'), 'utf8'),
    context,
    { filename: 'app-helper.js' }
  );
  context.elements = elements;

  return context;
}
```

新增行为测试：

```js
'share view rotation is local and follows dialog lifecycle' : function(test)
{
  const context = loadShareHelperDemo();
  const result = vm.runInContext(`
    openShareBox('local');
    toggleShareRotation();
    const rotatedBeforeMinimize = isShareViewRotated();
    minShareBox();
    restoreShareBox();
    const rotatedAfterRestore = isShareViewRotated();
    openShareBox('whiteboard');
    const rotatedAfterModeChange = isShareViewRotated();
    toggleShareRotation();
    closeShareBox('whiteboard');
    ({
      rotatedBeforeMinimize,
      rotatedAfterRestore,
      rotatedAfterModeChange,
      rotatedAfterClose: isShareViewRotated()
    });
  `, context);
  const button = context.elements.get('#shareRotate');
  const label = context.elements.get('#shareRotateText');

  test.strictEqual(result.rotatedBeforeMinimize, true);
  test.strictEqual(result.rotatedAfterRestore, true);
  test.strictEqual(result.rotatedAfterModeChange, false);
  test.strictEqual(result.rotatedAfterClose, false);
  test.strictEqual(button.classList.contains('hide'), true);
  test.strictEqual(button.attributes['aria-pressed'], 'false');
  test.strictEqual(label.textContent, '旋转90°');
  test.done();
},
```

- [ ] **Step 2: 运行专项测试并确认 RED**

Run:

```bash
'/mnt/c/Users/Lei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' -e "require('./test/include/runner').run('Conference', require('./test/test-conference')).catch(function(error) { console.error(error.message); process.exit(1); })"
```

Expected: FAIL，错误包含 `toggleShareRotation is not defined`，确认失败来自旋转功能缺失。

- [ ] **Step 3: 增加按钮和页面事件绑定**

在 `#screen-share-dialog-actions` 中、最小化按钮前增加：

```html
<button class="btn btn-sm btn-outline-secondary hide" id="shareRotate" type="button"
  aria-pressed="false">
  <i class="bi bi-arrow-clockwise" aria-hidden="true"></i>
  <span id="shareRotateText">旋转90°</span>
</button>
```

在 `app-events.js` 的共享浮层绑定区增加：

```js
document.querySelector('#shareRotate').onclick = toggleShareRotation;
```

- [ ] **Step 4: 实现本端状态与生命周期**

在 `app-helper.js` 的共享浮层区加入：

```js
let shareViewRotated = false;

function isShareViewRotated()
{
  return shareViewRotated;
}

function updateShareRotationUi()
{
  const dialog = document.querySelector('#crtcMediaDialog');
  const button = document.querySelector('#shareRotate');
  const label = document.querySelector('#shareRotateText');
  const visible = Boolean(dialog && dialog.dataset.mode);

  if (button)
  {
    button.classList.toggle('hide', !visible);
    button.setAttribute('aria-pressed', String(shareViewRotated));
  }
  if (label) label.textContent = shareViewRotated ? '恢复' : '旋转90°';
}

function setShareViewRotated(rotated)
{
  const next = Boolean(rotated);

  if (shareViewRotated === next)
  {
    updateShareRotationUi();

    return;
  }

  shareViewRotated = next;
  updateShareRotationUi();
  if (typeof onShareRotationChanged === 'function') onShareRotationChanged();
}

function toggleShareRotation()
{
  setShareViewRotated(!shareViewRotated);
}
```

在 `openShareBox(mode)` 写入新 mode 前保存旧 mode；旧 mode 非空且不同则调用
`setShareViewRotated(false)`。完成标题、视频显隐和 `setInkMode(mode)` 后调用
`updateShareRotationUi()`。`restoreShareBox()` 继续调用同 mode，因此保留状态。

在 `closeShareBox()` 清空 `dialog.dataset.mode` 后调用：

```js
setShareViewRotated(false);
updateShareRotationUi();
```

- [ ] **Step 5: 运行专项测试并确认 Task 1 GREEN**

Run Task 1 的 Conference 命令。

Expected: PASS，新增生命周期测试通过，原有 Conference 测试仍为 `0 failed`。

---

### Task 2: 旋转后的坐标映射、共享视频与白板布局

**Files:**
- Modify: `demo/base-js/js/app-annotation.js:480-640, 930-1040, 1260-1380, 1600-1680`
- Modify: `demo/base-js/style/style.css:485-530, 600-635`
- Test: `test/test-conference.js:275-315, 450-600`

**Interfaces:**
- Consumes: `isShareViewRotated(): boolean`（Task 1）。
- Produces: `toViewPoint(point: number[]): number[]`。
- Produces: `toSourcePoint(point: number[]): number[]`。
- Produces: `getBoardViewAspectRatio(aspectRatio: number): number`。
- Produces: `getShareVideoLayout(containerWidth, containerHeight, videoWidth, videoHeight, rotated): { stage, video, rotation }`。
- Produces: `onShareRotationChanged(): void`，由 Task 1 的状态 setter 调用。

- [ ] **Step 1: 写坐标与布局失败测试**

给 `loadAnnotationDemo()` context 增加默认函数：

```js
isShareViewRotated : function() { return false; }
```

新增纯转换和视频布局测试：

```js
'annotation maps local rotation without changing protocol coordinates' : function(test)
{
  const context = loadAnnotationDemo();
  const result = JSON.parse(JSON.stringify(vm.runInContext(`
    isShareViewRotated = function() { return true; };
    const source = [ 0.2, 0.3 ];
    const view = toViewPoint(source);
    ({
      view,
      restored: toSourcePoint(view),
      boardRatio: getBoardViewAspectRatio(16 / 9),
      layout: getShareVideoLayout(1000, 600, 1920, 1080, true)
    });
  `, context)));

  test.deepEqual(result.view, [ 0.7, 0.2 ]);
  test.deepEqual(result.restored, [ 0.2, 0.3 ]);
  test.strictEqual(result.boardRatio, 9 / 16);
  test.deepEqual(result.layout.stage, {
    left: 331.25, top: 0, width: 337.5, height: 600
  });
  test.deepEqual(result.layout.video, {
    left: 200, top: 131.25, width: 600, height: 337.5
  });
  test.strictEqual(result.layout.rotation, 90);
  test.done();
},
```

新增指针逆映射测试：

```js
'annotation pointer uses inverse rotation mapping' : function(test)
{
  const context = loadAnnotationDemo();
  const result = vm.runInContext(`
    isShareViewRotated = function() { return true; };
    inkStage = {
      width: function() { return 200; },
      height: function() { return 100; },
      getPointerPosition: function() { return { x: 50, y: 20 }; }
    };
    getPointer();
  `, context);

  test.deepEqual(Array.from(result), [ 0.2, 0.75 ]);
  test.done();
},
```

- [ ] **Step 2: 运行专项测试并确认 Task 2 RED**

Run Conference 命令。

Expected: FAIL，错误包含 `toViewPoint is not defined` 或 `getShareVideoLayout is not defined`。

- [ ] **Step 3: 实现本端坐标正反映射**

在 Konva 节点创建区前加入：

```js
function isInkViewRotated()
{
  return typeof isShareViewRotated === 'function' && isShareViewRotated();
}

function toViewPoint(point)
{
  if (!isInkViewRotated()) return [ point[0], point[1] ];

  return [ clamp(1 - point[1], 0, 1), clamp(point[0], 0, 1) ];
}

function toSourcePoint(point)
{
  if (!isInkViewRotated()) return [ point[0], point[1] ];

  return [ clamp(point[1], 0, 1), clamp(1 - point[0], 0, 1) ];
}

function getBoardViewAspectRatio(aspectRatio)
{
  const ratio = cleanBoardAspectRatio(aspectRatio);

  return ratio && isInkViewRotated() ? 1 / ratio : ratio;
}
```

修改 `makeNode()`：画笔/橡皮的每个 point 先经过 `toViewPoint()`；其他 shape 的
`start/end` 先转换后再乘 Stage 宽高。修改 `getPointer()`：先得到视图归一化点，再返回
`toSourcePoint(viewPoint)`。draft、boards 和 SIP payload 中的数据结构不变。

- [ ] **Step 4: 实现共享视频纯布局函数**

在 `resizeInk()` 前加入：

```js
function getShareVideoLayout(containerWidth, containerHeight, videoWidth, videoHeight, rotated)
{
  const viewWidth = rotated ? videoHeight : videoWidth;
  const viewHeight = rotated ? videoWidth : videoHeight;
  const scale = Math.min(containerWidth / viewWidth, containerHeight / viewHeight);
  const stageWidth = viewWidth * scale;
  const stageHeight = viewHeight * scale;
  const videoBoxWidth = rotated ? stageHeight : stageWidth;
  const videoBoxHeight = rotated ? stageWidth : stageHeight;

  return {
    stage: {
      left: (containerWidth - stageWidth) / 2,
      top: (containerHeight - stageHeight) / 2,
      width: stageWidth,
      height: stageHeight
    },
    video: {
      left: (containerWidth - videoBoxWidth) / 2,
      top: (containerHeight - videoBoxHeight) / 2,
      width: videoBoxWidth,
      height: videoBoxHeight
    },
    rotation: rotated ? 90 : 0
  };
}
```

- [ ] **Step 5: 接入白板、视频和 Stage 布局**

在 `resizeInk()` 中读取 `const rotated = isInkViewRotated()`：

- 白板：调用 `getBoardViewAspectRatio(boardAspectRatio)`；有效比例在 rotated 时使用倒数，
  无效值保持 `0` 回退；调用现有
  `getContainedBoardRect()`，Stage/背景继续使用相同 rect。
- local/remote：调用 `getShareVideoLayout()`，Stage 使用 `layout.stage`；当前 video 使用
  `layout.video` 和 `transform: rotate(${layout.rotation}deg)`。
- 给 video 写入 `left/top/right/bottom/width/height/transform`，不使用动画。
- 0° 同样通过该函数布局，数学结果与现有 contain 一致。

在 `style.css` 的 `.screen-share-dialog-video` 增加：

```css
transform-origin: center center;
```

保留 `object-fit: contain`，不增加 transition。

- [ ] **Step 6: 旋转时取消 draft 并强制重绘**

在 `app-annotation.js` 增加：

```js
function onShareRotationChanged()
{
  drawing = false;
  if (draftNode) draftNode.destroy();
  draftNode = null;
  draftShape = null;
  resizeInk();
  renderBoard();
}
```

该函数不调用 `runOp()`、`applyOp()` 或 `sendOp()`，确保半笔不发送。`resizeInk()` 即使
Stage 宽高未变化也由随后的 `renderBoard()` 应用新的坐标方向。

- [ ] **Step 7: 增加旋转渲染测试并运行 GREEN**

扩展 annotation Konva mock 测试：旋转状态下创建 rect，规范坐标
`start=[0.1,0.2]`、`end=[0.4,0.6]`，Stage `300×500`，断言节点配置为：

```js
{
  x: 120,
  y: 50,
  width: 120,
  height: 150
}
```

同时创建未提交 draft mock，调用 `onShareRotationChanged()`，断言 draft 被 destroy、
`drawing === false`、`draftNode === null`、`draftShape === null`，且没有调用发送桩。

Run Conference 命令。

Expected: PASS，全部 Conference 测试 `0 failed`。

- [ ] **Step 8: 运行 lint、完整测试与 diff 检查**

Run:

```bash
'/mnt/c/Users/Lei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' node_modules/gulp/bin/gulp.js lint
'/mnt/c/Users/Lei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' node_modules/gulp/bin/gulp.js test
git diff --check -- demo/base-js/index.html demo/base-js/style/style.css demo/base-js/js/app-helper.js demo/base-js/js/app-events.js demo/base-js/js/app-annotation.js test/test-conference.js
git diff --stat -- demo/base-js/index.html demo/base-js/style/style.css demo/base-js/js/app-helper.js demo/base-js/js/app-events.js demo/base-js/js/app-annotation.js test/test-conference.js
```

Expected: lint exit `0`；所有测试 suite `0 failed`；diff check 无输出；不出现 `dist/`、SDK
源码、第三方文件或无关格式化。

- [ ] **Step 9: 页面级验证**

在可用浏览器环境中检查：

- 横向共享桌面在竖屏 viewport 中点击旋转后完整变为竖向、无裁剪；恢复后回到原方向。
- 白板旋转后背景与 Stage 重合，画笔、矩形和橡皮的触摸位置与落点一致。
- 旋转端绘制后，未旋转端看到规范方向的同一标注。
- 最小化/恢复保留状态；关闭或桌面/白板切换恢复 0°。
- 旋转时正在绘制的半笔被取消，不产生远端操作。

若 Browser runtime 仍不支持当前 WSL workspace URI，记录自动测试证据并把真实鼠标/触摸、
Android WebView、微信 WebView、Safari 和鸿蒙浏览器列为未验证项。
