# 共享白板发起端比例同步 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `demo/base-js/` 的被共享端按白板发起端打开时的宽高比等比显示标注画布。

**Architecture:** 在 Demo 标注模块中保存本次白板的 `boardAspectRatio`，通过现有 `board:open` 和 `snapshot` payload 同步。`resizeInk()` 只负责把该逻辑比例以 `contain` 方式映射到本端容器，并让背景与 Konva Stage 共用同一矩形；现有 0～1 shape 坐标和 SDK API 不变。

**Tech Stack:** Browser JavaScript、Konva 10.3.0、CSS absolute layout、Node.js `vm`、nodeunit 风格测试。

## Global Constraints

- 本次白板比例取发起端打开时的绘制区域，并在关闭前保持不变。
- 接受的比例范围为 `0.25～4`；缺少或无效字段时回退到当前容器比例。
- 不修改 SDK 导出、`.d.ts`、SIP INFO 事件时序、Promise 行为、错误类型或构建产物。
- 不新增依赖，不修改 `dist/`、`release/` 或第三方 Konva 文件。
- 只修改现有 Demo 标注源码与现有会议测试；不做无关格式化或重构。
- 按仓库规则不自动 stage 或 commit。

## File Structure

- Modify: `demo/base-js/js/app-annotation.js` — 白板比例状态、协议字段校验/同步、等比布局和生命周期清理。
- Modify: `test/test-conference.js` — 协议状态与横竖容器等比布局回归测试。
- Existing design: `docs/superpowers/specs/2026-07-30-whiteboard-aspect-ratio-design.md` — 已确认的行为依据，不再扩展需求。

---

### Task 1: 白板比例协议状态与等比布局

**Files:**
- Modify: `demo/base-js/js/app-annotation.js:27-82, 369-485, 680-770, 894-910, 1267-1316, 1392-1515`
- Test: `test/test-conference.js:275-315, 375-510`

**Interfaces:**
- Produces: `cleanBoardAspectRatio(value): number`，有效时返回 `0.25～4` 内的原值，否则返回 `0`。
- Produces: `getContainedBoardRect(containerWidth, containerHeight, aspectRatio): { left, top, width, height }`，返回容器内居中的等比矩形；比例无效时返回整个容器。
- Produces: `boardAspectRatio: number`，`0` 表示兼容回退到本端容器比例。
- Consumes: 现有 `makeOp()`、`applyOp()`、`openBoard()`、`closeBoard()`、`resetInk()`、`resizeInk()` 和 `sendSnapshot()`。

- [ ] **Step 1: 写协议与布局失败测试**

在 `loadAnnotationDemo()` 的 context 中加入最小的 `openShareBox`、`closeShareBox` 可替换入口，并在现有 annotation 测试后增加两个测试。

第一个测试直接验证纯布局规则：

```js
'annotation whiteboard preserves initiator aspect ratio in different containers' : function(test)
{
  const context = loadAnnotationDemo();
  const result = vm.runInContext(`
    ({
      landscapeInPortrait: getContainedBoardRect(360, 640, 16 / 9),
      portraitInLandscape: getContainedBoardRect(960, 540, 9 / 16),
      fallback: getContainedBoardRect(360, 640, 0)
    });
  `, context);

  test.deepEqual(result.landscapeInPortrait, {
    left: 0, top: 218.75, width: 360, height: 202.5
  });
  test.deepEqual(result.portraitInLandscape, {
    left: 328.125, top: 0, width: 303.75, height: 540
  });
  test.deepEqual(result.fallback, {
    left: 0, top: 0, width: 360, height: 640
  });
  test.done();
},
```

第二个测试验证发起、快照、无效字段和关闭清理：

```js
'annotation whiteboard synchronizes and clears initiator aspect ratio' : function(test)
{
  const context = loadAnnotationDemo();
  const result = vm.runInContext(`
    const sent = [];
    const stageBox = { clientWidth: 360, clientHeight: 640 };
    const target = {
      isEnded: function() { return false; },
      sendInfo: function(type, body) { sent.push(JSON.parse(body)); }
    };
    appMode = 'conference';
    getShareLegs = function() { return [ { session: target } ]; };
    document.querySelector = function(selector) {
      if (selector === '.screen-share-dialog-stage') return stageBox;
      return null;
    };
    openShareBox = function(mode) { setInkMode(mode); };
    closeShareBox = function() { setInkMode(''); };

    openBoard(true);
    const openRatio = sent[0].payload.aspectRatio;
    const snapshotRatio = sent[1].payload.whiteboard.aspectRatio;

    applyOp({
      action: 'snapshot', boardId: 'whiteboard', payload: {
        screen: { shapes: [] },
        whiteboard: { shapes: [], aspectRatio: 16 / 9 }
      }
    });
    const restoredRatio = boardAspectRatio;

    applyOp({
      action: 'snapshot', boardId: 'whiteboard', payload: {
        screen: { shapes: [] },
        whiteboard: { shapes: [], aspectRatio: 99 }
      }
    });
    const ratioAfterInvalidSnapshot = boardAspectRatio;
    closeBoard(false);

    ({ openRatio, snapshotRatio, restoredRatio, ratioAfterInvalidSnapshot,
      ratioAfterClose: boardAspectRatio });
  `, context);

  test.strictEqual(result.openRatio, 360 / 640);
  test.strictEqual(result.snapshotRatio, 360 / 640);
  test.strictEqual(result.restoredRatio, 16 / 9);
  test.strictEqual(result.ratioAfterInvalidSnapshot, 16 / 9);
  test.strictEqual(result.ratioAfterClose, 0);
  test.done();
},
```

- [ ] **Step 2: 运行相关测试并确认按预期失败**

Run:

```bash
node -e "require('./test/include/runner').run('Conference', require('./test/test-conference')).catch(function(error) { console.error(error.message); process.exit(1); })"
```

Expected: FAIL，错误包含 `getContainedBoardRect is not defined`；确认失败来自缺失的新行为，而不是测试语法或环境错误。

- [ ] **Step 3: 实现比例校验、同步与生命周期状态**

在标注常量/状态区加入：

```js
const MIN_BOARD_ASPECT_RATIO = 0.25;
const MAX_BOARD_ASPECT_RATIO = 4;
let boardAspectRatio = 0;
```

在 `isNumber()` 后加入严格校验：

```js
function cleanBoardAspectRatio(value)
{
  return isNumber(value) && value >= MIN_BOARD_ASPECT_RATIO &&
    value <= MAX_BOARD_ASPECT_RATIO ? value : 0;
}
```

修改操作应用逻辑：

- `board:open` 先把 `payload.aspectRatio` 校验结果写入 `boardAspectRatio`，缺少或无效时写入 `0`，再调用 `openBoard(false)`。
- `snapshot` 读取 `payload.whiteboard.aspectRatio`；只有校验结果非 `0` 时更新已有比例，避免异常快照覆盖当前有效状态。
- `sendSnapshot()` 的 `whiteboard` 对象携带当前 `boardAspectRatio`。
- `openBoard(true)` 在 `openShareBox('whiteboard')` 之后读取 `.screen-share-dialog-stage` 的 `clientWidth / clientHeight`，校验后锁定状态，并将其放入 `board:open` payload。
- `closeBoard()` 和 `resetInk()` 清理 `boardAspectRatio = 0`。

发起端比例构造采用：

```js
const box = document.querySelector('.screen-share-dialog-stage');

boardAspectRatio = cleanBoardAspectRatio(
  box && box.clientHeight > 0 ? box.clientWidth / box.clientHeight : 0
);
```

发送操作采用：

```js
const op = makeOp('board:open', 'whiteboard', {
  aspectRatio: boardAspectRatio
});
```

- [ ] **Step 4: 实现白板 `contain` 布局并同步背景矩形**

在 `resizeInk()` 前加入纯布局函数：

```js
function getContainedBoardRect(containerWidth, containerHeight, aspectRatio)
{
  let width = containerWidth;
  let height = containerHeight;
  const ratio = cleanBoardAspectRatio(aspectRatio);

  if (ratio)
  {
    if (width / height > ratio) width = height * ratio;
    else height = width / ratio;
  }

  return {
    left   : (containerWidth - width) / 2,
    top    : (containerHeight - height) / 2,
    width,
    height
  };
}
```

在 `resizeInk()` 的白板分支调用该函数；屏幕标注分支保持原有视频比例代码不变。将计算后的 `left/top/width/height` 同时写到 `#inkStage` 和 `#boardBg`，并为背景设置 `right: auto`、`bottom: auto`，覆盖 CSS 的 `inset: 0`：

```js
if (inkMode === 'whiteboard')
{
  const rect = getContainedBoardRect(
    container.clientWidth, container.clientHeight, boardAspectRatio
  );

  left = rect.left;
  top = rect.top;
  width = rect.width;
  height = rect.height;
}

const background = document.querySelector('#boardBg');

[ stageEl, background ].forEach((element) =>
{
  if (!element || (element === background && inkMode !== 'whiteboard')) return;
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
  element.style.right = 'auto';
  element.style.bottom = 'auto';
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;
});
```

- [ ] **Step 5: 运行相关测试并确认通过**

Run:

```bash
node -e "require('./test/include/runner').run('Conference', require('./test/test-conference')).catch(function(error) { console.error(error.message); process.exit(1); })"
```

Expected: PASS，Conference 汇总为 `0 failed`。

- [ ] **Step 6: 运行 lint 与完整测试**

Run:

```bash
npm run lint
npm run test
```

Expected: 两条命令 exit code 均为 `0`，没有新增 lint 错误或测试失败。

- [ ] **Step 7: 页面级尺寸检查**

使用本地 Demo 在至少以下两组 viewport 检查白板：

- 发起端 `1280 × 720`，被共享端 `390 × 844`：被共享端显示横向白板，上下留白，同一矩形宽高比不变。
- 发起端 `390 × 844`，被共享端 `1280 × 720`：被共享端显示竖向白板，左右留白，同一矩形宽高比不变。
- 在白板打开后改变 viewport：白板等比缩放，但逻辑比例不改变。
- 白板背景网格边界与 Konva 画布边界完全重合，指针位置与图形落点一致。

- [ ] **Step 8: 检查 diff，确认没有无关改动**

Run:

```bash
git diff -- demo/base-js/js/app-annotation.js test/test-conference.js docs/superpowers/specs/2026-07-30-whiteboard-aspect-ratio-design.md docs/superpowers/plans/2026-07-30-whiteboard-aspect-ratio.md
git status --short
```

Expected: 只有本功能相关源码、测试及设计/计划文档；不包含 `dist/`、`release/`、第三方文件或无关格式化。保留未 stage、未 commit 状态交付。
