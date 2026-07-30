# Mobile Share UI and Ink Width Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 压缩小屏共享界面顶部区域，并统一不同端发起标注时的默认相对线宽。

**Architecture:** 使用现有 `max-width: 767px` 媒体查询调整标题栏和工具栏，不增加交互状态。标注层新增固定参考短边的线宽归一化函数，继续沿用现有归一化协议与渲染流程。

**Tech Stack:** HTML、CSS、原生 JavaScript、Nodeunit。

## Global Constraints

- 小屏工具栏必须两行完整展示，不使用横向滚动。
- 桌面端布局和公开标注协议保持不变。
- 不修改 `dist/` 构建产物。

---

### Task 1: 固定参考尺寸的标注线宽

**Files:**
- Modify: `demo/base-js/js/app-annotation.js`
- Test: `test/test-conference.js`

**Interfaces:**
- Produces: `getInkWidthNorm(value)`，返回限制在现有范围内的归一化线宽。

- [ ] **Step 1: 写入失败测试**

断言画布短边分别为手机和 PC 尺寸时，默认滑块值 `4` 都得到 `0.00625`，不再依赖 `inkStage` 尺寸。

- [ ] **Step 2: 运行 Conference 测试并确认因函数不存在而失败**

Run: `node node_modules/gulp/bin/gulp.js test:conference`

- [ ] **Step 3: 最小实现并接入 startDraw**

新增 `INK_WIDTH_REFERENCE_SIZE = 640` 与 `getInkWidthNorm(value)`，将 `startDraw()` 的 `widthNorm` 改为调用该函数。

- [ ] **Step 4: 再次运行 Conference 测试并确认通过**

Run: `node node_modules/gulp/bin/gulp.js test:conference`

### Task 2: 小屏两行紧凑工具栏

**Files:**
- Modify: `demo/base-js/style/style.css`

**Interfaces:**
- Consumes: 现有 `.screen-share-dialog-*`、`.annotation-toolbar-*` DOM 类名。

- [ ] **Step 1: 在现有媒体查询中实现紧凑布局**

标题栏单行排列并隐藏图标、副标题及按钮文字视觉显示；工具栏改为两行 grid，第一行五个工具，第二行样式与历史操作，不启用横向滚动。

- [ ] **Step 2: 验证**

运行 `lint`、完整测试和 `git diff --check`，检查没有修改桌面端基础规则及无关文件。

### Task 3: 小屏操作图标语义与居中

**Files:**
- Modify: `demo/base-js/index.html`
- Modify: `demo/base-js/style/style.css`

**Interfaces:**
- Consumes: Bootstrap Icons 中的 `bi-arrow-90deg-right` 与 `bi-window-dash`。

- [ ] **Step 1: 替换图标**

旋转按钮替换为 `bi-arrow-90deg-right`，最小化按钮替换为 `bi-window-dash`，保留现有按钮文字和无障碍语义。

- [ ] **Step 2: 修正小屏图标对齐**

为操作按钮增加 `justify-content: center`，图标使用 inline-flex 居中，并将 `::before` 的 `vertical-align` 重置为 `0`。

旋转和最小化按钮恢复可见文字并使用自适应宽度，其他小屏操作按钮继续保持纯图标。

- [ ] **Step 3: 验证**

运行 `lint` 和 `git diff --check`，并确认两个图标类在本地 Bootstrap Icons 字体中存在。
