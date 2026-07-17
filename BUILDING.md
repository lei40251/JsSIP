## What you need to build CRTC

You need a local Node.js environment and the repository dependencies installed.

### Install dependencies

```bash
npm install
```

The repository uses gulp under the hood, but the recommended entrypoints are the npm scripts exposed in `package.json`.

## Recommended Commands

### Daily validation

```bash
npm run lint
npm run test
```

### Build outputs

```bash
npm run build
npm run build:min
npm run build:standard
npm run release
```

Command meaning:

- `npm run build`
  - Full distribution build with lint, babel, tests, browserify, standard minification, private-property minification, and ESM output.
- `npm run build:min`
  - Builds the minified browser bundle used by most demos.
- `npm run build:standard`
  - Builds the standard minified variant without the aggressive private-property mangle pass.
- `npm run release`
  - Clears the previous local zip output in `release/`, runs the full distribution build, and then creates the local SDK zip package there.

## Which task produces `dist/CRTC.min.js`

The primary browser demo bundle is produced by the minified build path:

```bash
npm run build:min
```

This ultimately runs the gulp task chain that emits `dist/CRTC.min.js`.

## Why demo pages may not reflect source edits immediately

Many pages in this repository, including `demo/base-js` and `samples/media-effects-composer`, load `dist/CRTC.min.js` or other built artifacts rather than reading `lib/` source files directly.

That means:

1. You change code in `lib/`
2. The demo still loads the old `dist/CRTC.min.js`
3. The page appears unchanged until you rebuild

When runtime behavior matters, rebuild first:

```bash
npm run build:min
```

## Test layout

Recommended top-level test command:

```bash
npm run test
```

This keeps the existing gulp-based test organization and runs:

- SDK general tests
- Media-effects related tests
- BFCP tests

If you want the media-effects subset only, use gulp directly:

```bash
gulp media-effects-composer-test
```

## Release zip contents

`npm run release` creates a local zip package in `release/`.

The zip currently contains only these release files:

- `demo/**`
- `dist/CRTC.min.js`
- `CHANGELOG.md`
- `docs/*.html` and `docs/assets/**`, sourced from `docs/user-guide/html/`

Release documentation should describe only the files that are actually included in the zip.

## Legacy entrypoints

Older commands are still kept for compatibility, including:

```bash
node npm-scripts.js lint
node npm-scripts.js test
npm run prepublish
```

They remain usable, but the npm script commands documented above are the current recommended interface.

## Grammar development

If you modify `lib/Grammar.pegjs`, regenerate the derived grammar output before rebuilding:

```bash
gulp devel
npm run build
```

`gulp devel` updates `lib/Grammar.js`, so only run it when you intentionally changed the grammar source.
