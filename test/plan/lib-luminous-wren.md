# Codebase Cleanup: `lib/` Audit

## Context
全面审计 `lib/` 目录下所有代码，找出未使用的死代码和代码质量问题。项目是一个 WebRTC/SIP 库 (CRTC/JsSIP fork)，包含自定义 mixer 和虚拟背景模块。构建工具链是 Gulp + Browserify + Babel + Terser，入口为 `lib/JsSIP.js`。

---

## Phase 1: Dead Code Removal（可安全删除）

### 1.1 `lib/BFCP/lib/attributes/beneficiaryId.js`
- **原因**: 定义了 `BeneficiaryId` 类（extends Attribute），但全项目无人 require 这个文件。其他文件引用了 `Type.BeneficiaryId`、`Length.BeneficiaryId` 等静态属性，但那是在其它类上的静态 getter，与此文件无关。BFCP 解析器从未处理过这个属性类型。
- **操作**: 删除整个文件
- **连带清理**: 删除构建产物 `lib-es5/BFCP/lib/attributes/beneficiaryId.js`

### 1.2 `lib/VirtualBackground/pipelines/webgl2/loadSegmentationStage.js`
- **原因**: 全项目无人 require 这个文件。`webgl2Pipeline.js` 实际使用 `softmaxStage.js` 的 `buildSoftmaxStage`，只是变量名被错误地叫做 `loadSegmentationStage`。此文件是 ESM 语法（`import/export`），与项目其余 CJS 风格不一致。
- **操作**: 删除整个文件
- **连带清理**: 删除构建产物 `lib-es5/VirtualBackground/pipelines/webgl2/loadSegmentationStage.js`

---

## Phase 2: Code Quality Fixes

### 2.1 统一 ESM → CJS: `backgroundBlurStage.js`
- **文件**: `lib/VirtualBackground/pipelines/webgl2/backgroundBlurStage.js`
- **问题**: 使用 ESM `import/export` 语法，但被 `webgl2Pipeline.js` 通过 `require()` 引用。Babel 编译期会转换所以能工作，但风格不一致。
- **操作**: 将 `import { ... } from '...'` 改为 `const { ... } = require('...')`，将 `export function` 改为 `module.exports = { buildBackgroundBlurStage }`

### 2.2 `console.warn()` → Logger
- **文件及行号**:
  - `lib/BFCP/lib/parser/parser.js:98` — `console.warn('I cant parse this attribute!')`
  - `lib/RTCSession.js:4446` — `console.warn('tin: ', ...)`
  - `lib/Utils.js:715,783,788,847,1084,1140,1156,1927` — 多处 `console.warn()`
- **问题**: 项目使用统一的 `Logger` 模块（基于 `debug` npm 包），但这些文件直接用 `console.warn()`，导致输出不受 `debug` 环境变量控制，也无法在生产构建中被 treeshake。
- **操作**: 
  - `parser.js` — 在其模块顶部引入 Logger，替换为 `logger.warn()`
  - `RTCSession.js` — 已有 Logger 实例，替换即可
  - `Utils.js` — 已有 Logger 实例，替换即可

### 2.3 移除注释掉的 `console.log`
- **文件**: `lib/VirtualBackground/pipelines/webgl2/resizingStage.js:66`
- **内容**: `// console.log('draA: ', gl.RGBA, gl.UNSIGNED_BYTE, outputPixels);`
- **操作**: 删除该行注释

### 2.4 更新 TypeScript 声明
- **文件**: `lib/JsSIP.d.ts`
- **问题**: 缺少对 4 个导出项的声明：`Mixer`、`VirtualBackground`、`getStats`、`BFCPLib`
- **操作**: 补充这些导出项的接口声明

---

## Phase 3: Documented Only（不做修改）

| Issue | 说明 |
|-------|------|
| `lib/Pk.js` 硬编码 RSA 公钥 | 用于 SIP Digest 认证，属于有意为之 |
| `lib/sanityCheck.js` 模块级共享状态 | 单线程 JS 中安全 |
| ~25 处 TODO/FIXME/HACK 注释 | 标记为技术债务，不在此次清理范围内 |
| `lib-es5/` 目录 | 构建产物，由 `gulp babel` 生成 |
| `Logger.debug()` 调用 | 受 `debug` npm 包控制，属于正常用法 |
| BFCP 解析器混用 CJS/ESM 语法 | Babel 编译会处理，功能正常 |

---

## Verification

1. **grep 回归检查**:
   - 确认 `beneficiaryId` 和 `loadSegmentationStage` 不再被任何文件引用
   - 确认 `console.warn` 调用已被替换
   - 确认 `backgroundBlurStage.js` 不再有 `import/export`

2. **运行测试**:
   ```bash
   node npm-scripts.js test
   ```
   忽略 mixer 测试中与 MockAudioContext 相关的已知问题（需要真实浏览器环境的部分）。

3. **构建验证**:
   ```bash
   npx gulp dist
   ```
   确认 `dist/CRTC.js` 和 `dist/CRTC.min.js` 正常生成。

---

## Files to Modify

| File | Action |
|------|--------|
| `lib/BFCP/lib/attributes/beneficiaryId.js` | Delete |
| `lib/VirtualBackground/pipelines/webgl2/loadSegmentationStage.js` | Delete |
| `lib/VirtualBackground/pipelines/webgl2/backgroundBlurStage.js` | Edit: ESM → CJS |
| `lib/BFCP/lib/parser/parser.js` | Edit: console.warn → logger.warn |
| `lib/RTCSession.js` | Edit: console.warn → logger.warn |
| `lib/Utils.js` | Edit: console.warn → logger.warn |
| `lib/VirtualBackground/pipelines/webgl2/resizingStage.js` | Edit: remove dead comment |
| `lib/JsSIP.d.ts` | Edit: add missing type declarations |
| `lib-es5/BFCP/lib/attributes/beneficiaryId.js` | Delete (build artifact) |
| `lib-es5/VirtualBackground/pipelines/webgl2/loadSegmentationStage.js` | Delete (build artifact) |
