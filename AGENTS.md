# Browser SDK (kf-browser-sdk)

> RUM browser SDK — wraps Datadog RUM/Logs with Kloudfuse-specific context and rrweb session replay.
> GitHub: https://github.com/kloudfuse/browser-sdk
> npm: `kf-browser-sdk`
> Note: `CLAUDE.md` in this repo is a symlink to this file.

## Quick Start

```bash
npm install           # Install dependencies (no build step — ships as ES6 modules)
npm test              # Placeholder only (no tests configured)
```

There is no build system (Webpack, Rollup, etc.). The package ships `index.js`
and `Rrweb.js` as-is to npm.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser (end-user application)                 │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │  kf-browser-sdk (BrowserSdk singleton)    │  │
│  │                                           │  │
│  │  ┌─────────────────┐  ┌───────────────┐   │  │
│  │  │ @datadog/browser │  │ @datadog/     │   │  │
│  │  │ -rum             │  │ browser-logs  │   │  │
│  │  └────────┬─────┬──┘  └───────┬───────┘   │  │
│  │           │     │              │           │  │
│  │  beforeSend hook │              │           │  │
│  │  (adds kf_*     │              │           │  │
│  │   context)       │              │           │  │
│  │           │     │              │           │  │
│  │  ┌────────┘  ┌──┴───────────┐  │           │  │
│  │  │           │ Rrweb.js     │  │           │  │
│  │  │           │ (rrweb lib)  │  │           │  │
│  │  │           │ DOM replay   │  │           │  │
│  │  │           └──────┬───────┘  │           │  │
│  │  │                  │          │           │  │
│  └──┼──────────────────┼──────────┼───────────┘  │
│     │                  │          │              │
└─────┼──────────────────┼──────────┼──────────────┘
      │                  │          │
      ▼                  ▼          ▼
  DD proxy         /rumrrweb     DD proxy
  (RUM events)   (replay data)  (browser logs)
      │                  │          │
      └────────┬─────────┘          │
               ▼                    ▼
         ingester-service      ingester-service
         (Kloudfuse)           (Kloudfuse)
```

### Data Flow

1. **RUM events** — Datadog RUM SDK collects views, actions, resources, errors,
   long tasks. The `beforeSend` hook enriches each event with Kloudfuse-specific
   context (`rrweb_tab_id`, `rrweb_has_replay`, `kf_session_start_ms`,
   `kf_view_start_ms`). Events are sent via the configured `proxy` URL.

2. **Session replay** — rrweb records DOM mutations, input events, and canvas.
   Events are batched every 5 seconds and POSTed as FormData to `/rumrrweb`
   with a `kf-api-key` query parameter for authentication.

3. **Browser logs** — Optional. When `enableLogCollection: true`, Datadog Logs
   SDK forwards console logs and uncaught errors.

All three paths route through `ingester-service` ingestion endpoints (see
ingress routes: `/ddrumproxy`, `/rumrrweb`).

## File Structure

```
browser-sdk/
  index.js       # BrowserSdk class — main entry point (singleton export)
  Rrweb.js       # Rrweb class — session replay recording and persistence
  package.json   # npm config: kf-browser-sdk@1.0.65
  LICENSE        # Apache-2.0
```

## Key Modules

### index.js — BrowserSdk

Singleton class wrapping `@datadog/browser-rum` and `@datadog/browser-logs`.

**Initialization (`init({ config })`):**
- Generates a unique tab UUID (`rrweb_tab_id`) for multi-tab tracking
- Configures Datadog RUM with a `beforeSend` hook that enriches events
- Optionally initializes rrweb session replay (when `enableSessionRecording`
  is true AND Datadog session cookie `_dd_s` has `rum > 0`)
- Optionally initializes Datadog Logs forwarding

**Public API methods** (all wrapped in try-catch):
- `init({ config })` — Initialize the SDK
- `addAction(property, context)` — Track custom user action
- `addError(error, context)` — Log an error
- `addTiming(...args)` — Record custom timing
- `addDurationVital(...args)` / `startDurationVital` / `stopDurationVital` — Duration metrics
- `setUser(user)` — Set user identity
- `startView(args)` — Manual view tracking
- `clearGlobalContext()` / `getGlobalContext()` / `setGlobalContext(context)` — Global context
- `setGlobalContextProperty(key, value)` / `removeGlobalContextProperty(key)` — Per-key context
- `setViewContext(context)` / `setViewContextProperty(key, value)` — View-level context

### Rrweb.js — Session Replay

Wraps the `rrweb` library for DOM recording with privacy controls.

**Privacy modes** (`defaultPrivacyLevel`):
- `mask-user-input` — Masks form inputs only (default)
- `mask` — Masks all text content (adds `rr-mask` class to body)
- `allow` — Records everything with no masking

**Recording behavior:**
- Checkout interval: 1 minute (controls max segment size)
- Batch interval: 5 seconds (events accumulated, then persisted)
- Canvas recording enabled
- Session boundary detection via 1-second polling of Datadog internal context

**Persistence** (`persistEvents`):
- Sends FormData POST to `{replayIngestUrl}?kf-api-key={clientToken}`
- Payload: `event` (JSON metadata: app/session/view/tab IDs, timestamps) +
  `segment` (JSON array of rrweb events)

## Configuration

```javascript
browserSdk.init({
  config: {
    applicationId: 'app-id',        // Datadog application ID
    clientToken: 'token',           // Datadog client token (also used as kf-api-key)
    env: 'production',              // Environment tag
    version: '1.0.0',               // App version
    service: 'frontend',            // Service name
    proxy: '/ddrumproxy',           // Proxy URL (routed to ingester-service)
    sessionSampleRate: 100,         // % of sessions to track (0-100)
    defaultPrivacyLevel: 'mask-user-input',  // Privacy mode for replay
    enablePrivacyForActionName: false,
    enableSessionRecording: true,   // Enable rrweb replay
    enableLogCollection: true,      // Enable browser log forwarding
    trackViewsManually: false,      // Manual view tracking mode
    site: '',                       // Datadog site (usually empty for proxy mode)
    beforeSend: (event, context) => true,  // Custom event filter/modifier
  }
});
```

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@datadog/browser-rum` | ^5.27.0 | RUM event collection (views, actions, errors, resources) |
| `@datadog/browser-logs` | ^5.29.1 | Browser log forwarding |
| `rrweb` | ^2.0.0-alpha.4 | DOM recording for session replay |
| `uuid` | ^10.0.0 | Tab ID generation |
| `js-cookie` | ^3.0.5 | Datadog session cookie parsing |

## Patterns & Conventions

- **Singleton pattern**: `BrowserSdk` exports a single instance. All methods
  are called on this shared instance.
- **Defensive try-catch**: Every public method wraps Datadog SDK calls in
  try-catch to prevent SDK errors from crashing the host application.
- **Datadog session cookie parsing**: The SDK reads `_dd_s` cookie directly
  to determine session state and replay eligibility. The cookie format is
  `key1=value1&key2=value2` (not standard cookie format).
- **No TypeScript**: Plain ES6 JavaScript with no build step.
- **No tests**: No test framework configured.

## Gotchas & Pitfalls

1. **rrweb alpha dependency**: Uses `rrweb@2.0.0-alpha.4` — API may change.
   Pin carefully on upgrades.
2. **Session cookie coupling**: Direct parsing of Datadog's `_dd_s` cookie
   format. If Datadog changes their cookie schema, replay initialization breaks.
3. **`sessionReplaySampleRate: 0`**: Datadog's built-in replay is disabled
   (set to 0). Kloudfuse uses rrweb instead. Do not enable Datadog's replay.
4. **Replay auth via query param**: The `kf-api-key` is passed as a URL query
   parameter to `/rumrrweb`. This is visible in network logs.
5. **No build step**: Changes to `index.js` or `Rrweb.js` are published
   directly. There is no transpilation or bundling.
6. **View tracker memory**: `KF_VIEW_TRACKER` object grows unbounded over the
   session lifetime (one entry per view ID). Long-lived SPAs may accumulate
   entries.

## Cross-Service Context

- **Upstream**: Imported by [ui](https://github.com/kloudfuse/ui/blob/main/AGENTS.md) (Kloudfuse frontend) and customer applications
- **Downstream**: RUM events and replay data flow to [ingester-service](https://github.com/kloudfuse/ingester-service/blob/main/AGENTS.md) via `/ddrumproxy` and `/rumrrweb` ingress routes
- **Query path**: Stored data is queried via [rum-query-service](https://github.com/kloudfuse/rum-query-service/blob/main/AGENTS.md)
- **Platform architecture**: See [engineering/AGENTS.md](https://github.com/kloudfuse/engineering/blob/main/AGENTS.md)
