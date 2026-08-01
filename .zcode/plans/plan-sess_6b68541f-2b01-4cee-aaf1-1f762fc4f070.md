## 目标

1. SDK：`MediaEffectsComposer` 的 `insertable` 参数默认值从 `false` 改为 `true`（能力不足时仍自动回退 captureStream）。
2. Demo 与 samples：删除"显式 `insertable = true`"的冗余赋值；会议场景改为"始终传入 composer 配置对象"（SDK 现有行为：`mediaEffectsComposer` 字段存在且非 null 即创建 composer），让 `insertable` 回归"输出路径偏好"语义。
3. 全部改完后执行 `npm run build` 更新 dist/ 构建产物。

## SDK 改动（lib/）

- `lib/MediaEffectsComposer/ComposerConfig.js:68`：`insertable: options.insertable === true` → `insertable: options.insertable !== false`（默认开启，显式传 false 可关闭）
- `lib/MediaEffectsComposer/ComposerConfig.js:44`：JSDoc "默认关闭" → "默认开启"
- `lib/MediaEffectsComposer/MediaEffectsComposer.js:108-109`：JSDoc `[options.insertable=false]` → `[options.insertable=true]`，补充"不支持时自动回退 captureStream"

## Demo 改动（demo/base-js/）

- `demo/base-js/js/app-effects.js:290`：JSDoc "默认 false" → "默认 true"
- `demo/base-js/js/app-effects.js:351-354`：删除 `if (hasFx) { opts.insertable = true; }`（默认已开启）
- `demo/base-js/js/app-effects.js:443`：JSDoc "需在 call/answer 时传入 insertable: true" → 更新为默认开启表述
- `demo/base-js/js/app-conference.js:206-214` `buildMixOpts()`：删除 `options.insertable = true;`，注释改为说明：会议场景无论是否选特效都必须传入 composer 配置对象（`getFxOpts()` 返回 null 时兜底为 `{}`），SDK 收到非空配置即创建 composer，供三方动态加源

## samples 改动（samples/base-js-mh/，用户明确要求）

- `samples/base-js-mh/js/app-effects.js:348-351`：删除 `if (hasComposerEffects) { composerOptions.insertable = true; }`
- `samples/base-js-mh/js/app-effects.js:396`：JSDoc "需在 call/answer 时传入 insertable: true" → 更新为默认开启表述

## 测试改动（test/）

- `test/test-media-effects-composer-renderer.js:1026-1052`：`testDefaultPrefersCaptureStreamEvenWhenInsertableSupported` 随默认值调整——默认配置下断言改为 `insertableConfigured=true`、`insertableActive=true`、`outputMode='insertable'`，测试名改为"默认优先 insertable"；确认 1130-1250 区间显式 `insertable:false` 与"不支持回退"用例不受影响
- `test/test-conference.js:843`：断言 `/composerOptions\.insertable\s*=\s*true/` 同步改为断言示例中不再出现该显式赋值（验证迁移后示例不依赖显式开启）

## 文档改动（docs/）

- `docs/app-conference-guide.md:276,284,370`：把"强制 insertable = true"的表述改为"会议场景始终传入 mediaEffectsComposer 配置对象（即使无特效），SDK 即创建 composer"
- `docs/MediaEffectsComposer/media-effects-composer-api.md:118`：`insertable` 默认 `false` → `true`，描述补充"不支持时自动回退 captureStream"
- `docs/public-api-naming-migration.md:242`：示例 `insertable: false` → `true`
- `docs/public-api-naming-migration.md:335`：`enableInsertable → insertable` 默认 `false` → `true`
- `CHANGELOG.md`：新增一条公开行为变更——`insertable` 默认开启，不支持的浏览器自动回退 captureStream
- 学习手册 `Q1{"insertable?"}` 是运行时决策点，不涉及默认值文字，不改

## 构建

- 全部改动完成后执行 `npm run build`，重新生成 `dist/` 构建产物（用户明确要求）

## 不做的事

- 不新增 SDK 参数（如 `enabled`/`createComposer`）——YAGNI，`{}` 空配置对象已满足会议需求
- 不改 samples 中的第三方资源

## 验证

- `npm run lint`
- 运行相关测试（`test/test-media-effects-composer-renderer.js`、`test/test-conference.js` 等）
- `npm run build`
- 检查 `git diff`，确认无无关改动

## 风险与未验证项

- 公开默认值变化：现有客户不传 `insertable` 且浏览器支持时，输出从 captureStream 变为 insertable——SDK 有自动探测降级（`OutputStream.js:520`）和连续写帧失败回退（`OutputStream.js:811`），风险低
- `WorkerRenderer._preferDirectFrameSource` 随默认值开启：captureStream 回退路径下 worker bitmap 作为 frameSource 传递后被 `_closeUsedFrame` 正确 close（`OutputStream.js:1167-1173`），无泄漏
- 真实浏览器（Chrome/Edge/Safari/Firefox/移动端）下的 insertable 首帧与低端设备表现未在本机验证，列为未验证项