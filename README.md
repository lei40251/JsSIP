# CRTC

CRTC is a browser-side SIP + WebRTC SDK focused on clear call flows, direct API usage, and runnable demo integration. This repository contains the core SDK, demo pages, build pipeline, and media-effects samples used to verify real runtime behavior.

## What This Repository Provides

- SIP signaling over WebSocket via `CRTC.WebSocketInterface`
- Browser call control via `CRTC.UA` and `RTCSession`
- Audio/video calling and session lifecycle events
- Media effects capabilities such as AI noise suppression, virtual background, watermarks, and media composition
- Plain-script demos that show the SDK's real browser integration path

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Build the browser bundle used by demos:

```bash
npm run build:min
```

3. Open the recommended sample entry:

- Main SDK demo: `demo/base-js/index.html`
- Media effects sample: `samples/media-effects-composer/index.html`

Both pages load the built `dist/CRTC.min.js`. If you change SDK source under `lib/`, rebuild before expecting demo behavior to change.

## Minimal Integration Example

```html
<script src="./dist/CRTC.min.js"></script>
<script>
  const socket = new CRTC.WebSocketInterface('wss://sip.example.com');
  const ua = new CRTC.UA({
    sockets: socket,
    uri: 'sip:alice@example.com',
    password: 'superpassword'
  });

  ua.on('newRTCSession', function(data)
  {
    const session = data.session;

    session.on('progress', function()
    {
      console.log('call is in progress');
    });

    session.on('failed', function(event)
    {
      console.log('call failed:', event.cause);
    });

    session.on('ended', function(event)
    {
      console.log('call ended:', event.cause);
    });
  });

  ua.start();
</script>
```

For a fuller flow including dialing, answering, device switching, and media-effects controls, use `demo/base-js` as the primary reference.

## Documentation

- Quick start: [docs/start.md](docs/start.md)
- Build instructions: [BUILDING.md](BUILDING.md)
- API reference: [docs/API.md](docs/API.md)
- Media effects issue messages: [docs/mediaeffectsissue-messages.md](docs/mediaeffectsissue-messages.md)
- Media effects composer API: [docs/media-effects-composer-api.md](docs/media-effects-composer-api.md)

## Sample Entry Points

- `demo/base-js`
  - Recommended first stop for SDK integration.
  - Shows `CRTC.UA`, `newRTCSession`, session event binding, and page-level call controls.
- `samples/media-effects-composer`
  - Focused reference for composer, AiNS, AiVB, mirror, and watermark behavior.
- `samples/base-js-harmony`
  - Variant sample for Harmony/browser-specific validation.

## Build and Test Commands

Recommended commands:

```bash
npm run lint
npm run test
npm run build
npm run build:min
npm run build:standard
npm run release
```

`npm run release` first clears the previous local zip output in `release/`, then builds the distribution artifacts, and finally creates a local SDK zip package there. The zip includes `demo/**`, `dist/CRTC.min.js`, `CHANGELOG.md`, and the user guide HTML documents under `docs/` together with their required assets.

Legacy entrypoints such as `node npm-scripts.js test` and `npm run prepublish` remain available for compatibility, but the commands above are the current recommended interface.

## Upstream Note

This repository evolved from earlier JsSIP-based code and still contains historical artifacts, changelogs, and compatibility context from that lineage. When documentation or naming differs between old JsSIP material and this repository, treat the public API and docs in this CRTC repository as the source of truth.

## License

This repository keeps the upstream MIT licensing model. See [LICENSE](LICENSE).
