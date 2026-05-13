# CRTC `lib/` Cleanup Plan

## Overview

This plan covers dead code removal and code quality fixes in the CRTC project's `lib/` directory. It is a cleanup audit, not a refactor. Each item includes risk assessment and verification steps.

---

## Phase 1: Safe Deletions (Dead Code)

These files can be confidently deleted. They are never imported anywhere in the project and contribute nothing to the runtime.

### Item 1.1: Delete `lib/BFCP/lib/attributes/beneficiaryId.js`

**What it is**: A class `BeneficiaryId` extending `Attribute`. Constructor passes `Type.BeneficiaryId`, `Length.BeneficiaryId`, `Format.Unsigned16` to the parent class.

**Why it is dead**: Zero `require()` references across the entire project (`require.*beneficiaryId` returns no matches). The `BeneficiaryId` static getters in `type.js`, `length.js`, `name.js`, and `supportedAttributes.js` are lookup-table entries used by other attributes, NOT references to this file.

**Risk assessment**: VERY LOW. This class is never instantiated. Deleting it removes an unreachable code path. The BFCP parser's `_parseAttributes` method uses a `switch/case` on `AttributeType.*` values; it does NOT have a `case AttributeType.BeneficiaryId`, confirming the parser never expects to parse this type either.

**Verification**: Build succeeds (`gulp dist`). BFCP tests pass if any exist.

### Item 1.2: Delete `lib/VirtualBackground/pipelines/webgl2/loadSegmentationStage.js`

**What it is**: Exports `buildLoadSegmentationStage` using ESM `export` syntax. Contains a fragment shader that loads TFLite segmentation output into a WebGL texture.

**Why it is dead**: Zero `import` or `require` references to this file anywhere in the project. The file `webgl2Pipeline.js` uses `buildSoftmaxStage` from `softmaxStage.js` (a different function with the same signature pattern). The variable in `webgl2Pipeline.js` is confusingly named `loadSegmentationStage`, but it gets its value from `buildSoftmaxStage()`.

**Risk assessment**: VERY LOW. This is a duplicate of `softmaxStage.js` that was apparently abandoned mid-creation. The actual code path uses `softmaxStage.js`.

**Verification**: Build succeeds. VirtualBackground functionality works (the pipeline still uses `softmaxStage.js`).

---

## Phase 2: Code Quality Fixes

### Item 2.1: Convert ESM to CJS in `backgroundBlurStage.js`

**File**: `lib/VirtualBackground/pipelines/webgl2/backgroundBlurStage.js`

**Issue**: Uses `import { ... } from '...'` and `export function` (ESM syntax) while the entire rest of the project uses `require()` and `module.exports` (CJS). This file is `require()`'d from `webgl2Pipeline.js`. It works only because Babel transpiles it during the build, but it is inconsistent.

**Current imports**:
```
import { compileShader, createPiplelineStageProgram, createTexture, glsl } from '../helpers/webglHelper.js';
export function buildBackgroundBlurStage(...)
```

**Fix**: Convert to:
```
const { compileShader, createPiplelineStageProgram, createTexture, glsl } = require('../helpers/webglHelper.js');
module.exports = { buildBackgroundBlurStage };
```
Keep the function body as `function buildBackgroundBlurStage(...) { ... }` but remove the `export` keyword.

**Risk assessment**: LOW. Mechanical transformation. The function structure, return values, and all internal logic stay identical. Babel was doing this same transformation during build.

**Verification**: Build succeeds. E2E test of virtual background with blur mode.

### Item 2.2: Fix `console.warn()` calls to use Logger

| File | Line(s) | Issue |
|------|---------|-------|
| `lib/BFCP/lib/parser/parser.js` | 98 | `console.warn('I cant parse this attribute!')` |
| `lib/RTCSession.js` | 4446 | `console.warn('tin: ', this._inviteMediaConstraints)` |
| `lib/Utils.js` | 715, 783, 788, 847, 1084, 1140, 1156, 1927 | Multiple `console.warn()` calls |

**Fix details by file**:

- **parser.js**: Add `const Logger = require('../../../Logger'); const logger = new Logger('BFCP Parser');` at the top (adjust path relative to file location), replace `console.warn(...)` with `logger.warn(...)`.

- **RTCSession.js**: Already has a Logger instance at line 21 (`const logger = new Logger('RTCSession');`). Just replace the single `console.warn('tin: ', ...)` with `logger.debug(...)` or `logger.warn(...)` on line 4446.

- **Utils.js**: Add `const Logger = require('./Logger'); const logger = new Logger('Utils');` at top, replace all `console.warn()` calls with `logger.warn()`.

**Risk assessment**: LOW. Pure substitution of logging mechanism. No behavior change.

**Verification**: Build succeeds. Log output appears in the expected format. Grep confirms zero `console.warn` calls remain in `lib/` (excluding node_modules).

### Item 2.3: Remove commented-out code

**File**: `lib/VirtualBackground/pipelines/webgl2/resizingStage.js` line 66

**Content**: `// console.log('draA: ', gl.RGBA, gl.UNSIGNED_BYTE, outputPixels);`

**Fix**: Delete the line.

**Risk assessment**: VERY LOW. Dead comment.

### Item 2.4: Update TypeScript declarations for exported modules

**File**: `lib/JsSIP.d.ts`

**Issue**: The file currently exports `C`, `Exceptions`, `Grammar`, `Utils`, `UA`, `URI`, `NameAddrHeader`, `WebSocketInterface`, `debug`, `name`, `version`. It is missing four exports from `JsSIP.js`:
- `Mixer` (line 49)
- `VirtualBackground` (line 50)
- `getStats` (line 52)
- `BFCPLib` (line 41)

**Fix**: Add declarations. Since these modules have no existing `.d.ts` files, the pragmatic approach is to add minimal declarations to `JsSIP.d.ts`:
```typescript
export const Mixer: any;
export const VirtualBackground: any;
export const getStats: any;
export const BFCPLib: any;
```

For better developer experience, create separate `.d.ts` files:
- `lib/Mixer.d.ts`
- `lib/VirtualBackground/index.d.ts`
- `lib/BFCP/index.d.ts`
- `lib/Stats.d.ts`

These can be populated incrementally from the actual module APIs.

**Risk assessment**: LOW. Declarations are additive and do not affect runtime.

**Verification**: TypeScript compilation against the library succeeds without errors.

---

## Phase 3: Low-Priority Issues (Document Only)

These are noted for awareness but no immediate action recommended.

### Item 3.1: Module-level shared state in `sanityCheck.js`

**Issue**: Module-level variables (`let message; let ua; let transport;`) are overwritten on each call. Inner functions read from these shared variables rather than receiving parameters.

**Why no fix recommended**: JavaScript is single-threaded; reentrancy is not a practical concern. The exported function is called synchronously from UA.js's message processing pipeline. Converting to parameter passing would be a stylistic change with no runtime benefit. This pattern exists in the upstream JsSIP codebase.

### Item 3.2: `Pk.js` hardcoded RSA public key

**Issue**: Contains a numeric array (`const pk=[...]`) that decodes to a PEM-encoded RSA public key used by `jsencrypt` in `UA.js` (line 18: `const pk = require('./Pk');`).

**Why no fix recommended**: This is an intentionally stored public key for SIP authentication -- not a credential or secret. The commented-out alternative on line 4 includes the full `-----BEGIN PUBLIC KEY-----` and `-----END PUBLIC KEY-----` markers, confirming deliberate storage. Not actionable.

### Item 3.3: TODO/FIXME/HACK comments

| File | Lines | Note |
|------|-------|------|
| `lib/sanityCheck.js` | 145, 175 | "TODO: we should reply the last response" |
| `lib/RTCSession.js` | ~20 locations | Various TODOs, one HACK comment |
| `lib/VirtualBackground/pipelines/*` | Multiple | Renaming TODOs, background loading TODOs |

**Why no fix recommended**: These represent feature gaps and known limitations. Each would require individual design decisions to resolve. Listing for awareness only.

---

## Items That Are NOT Issues (Corrections to the Preliminary Analysis)

1. **`Options.js` and `Message.js`**: Both are `require()`'d by `UA.js` (lines 6-7). They are active SIP stack modules, not orphaned.

2. **`Logger.debug()` statements throughout**: Intentional. The `debug` npm module controls output via environment variables (`DEBUG=CRTC:*`). This is standard practice for debug logging.

3. **`beneficiaryId.js` and BFCP protocol completeness**: The BFCP parser's `_parseAttributes` switch statement (parser.js lines 67-100) does NOT handle `AttributeType.BeneficiaryId` (value 1). Even if a BFCP message containing this attribute arrived from the network, the parser would hit the `default: console.warn(...)` case and skip it. The class was never wired into the parser. Deleting it changes nothing about runtime behavior.

4. **`requestStatusValue.js`**: It IS required by both `index.js` and `user.js`. Not dead code.

5. **`primitive.js`**: It IS required by `index.js`, `user.js`, and `parser.js`. Not dead code.

---

## Verification Strategy

### Before/After: Full build
```bash
gulp dist
```
This runs lint, babel, test, browserify, and uglify. The build must succeed before and after changes.

### Before/After: Functional checks
- **BFCP**: Any existing BFCP send/receive test should work identically.
- **VirtualBackground image mode**: Uses `backgroundImageStage.js` (unchanged).
- **VirtualBackground blur mode**: Uses `backgroundBlurStage.js` (changed to CJS).
- **SIP stack**: `sanityCheck.js`, message parsing, `UA.js` functionality should be unchanged.
- **Logging**: Console output should match previous behavior (same messages, same Logger format).

### Post-cleanup grep verification
```bash
# Confirm zero remaining console.warn in lib/ (excluding node_modules)
grep -rn "console\.\(warn\|log\|error\)" lib/ --include="*.js"

# Confirm zero remaining ESM import/export in lib/ (excluding node_modules)
grep -rn "^\s*import\s" lib/ --include="*.js"
grep -rn "^\s*export\s" lib/ --include="*.js"
```

---

## Execution Order

| Step | Description | Risk | Depends On |
|------|-------------|------|------------|
| 1 | Delete `lib/BFCP/lib/attributes/beneficiaryId.js` | VERY LOW | None |
| 2 | Delete `lib/VirtualBackground/pipelines/webgl2/loadSegmentationStage.js` | VERY LOW | None |
| 3 | Convert ESM to CJS in `backgroundBlurStage.js` | LOW | None |
| 4 | Fix `console.warn` in `lib/BFCP/lib/parser/parser.js` | LOW | None |
| 5 | Fix `console.warn` in `lib/RTCSession.js` (line 4446) | LOW | None |
| 6 | Fix `console.warn` in `lib/Utils.js` (add Logger import) | LOW | None |
| 7 | Remove commented-out code in `resizingStage.js` | VERY LOW | None |
| 8 | Update `lib/JsSIP.d.ts` with missing exports | LOW | None |
| 9 | Run `gulp dist` for build verification | - | Steps 1-8 |
| 10 | Run functional verification | - | Step 9 |
