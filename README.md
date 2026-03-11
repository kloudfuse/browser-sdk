# kf-browser-sdk

Kloudfuse Browser SDK for RUM (Real User Monitoring), session replay, and log collection.

## Installation

### ES Module (npm)

```bash
npm install kf-browser-sdk
```

```javascript
import browserSdk from "kf-browser-sdk";

browserSdk.init({
  config: {
    applicationId: "your-application-id",
    clientToken: "your-client-token",
    env: "production",
    version: "1.0.0",
    service: "my-app",
    proxy: "https://rum.example.com",
    sessionSampleRate: 100,
    enableSessionRecording: true,
    enableLogCollection: true,
  },
});
```

### Script Tag (CDN)

Load the bundled file via a `<script>` tag. The SDK is exposed as `window.KfBrowserSdk`.

```html
<!-- pinned version -->
<script src="https://your-cdn.example.com/browser-sdk/kf-browser-sdk-v1.0.65.min.js"></script>

<!-- or always latest -->
<script src="https://your-cdn.example.com/browser-sdk/kf-browser-sdk.min.js"></script>

<script>
  KfBrowserSdk.init({
    config: {
      applicationId: "your-application-id",
      clientToken: "your-client-token",
      env: "production",
      version: "1.0.0",
      service: "my-app",
      proxy: "https://rum.example.com",
      sessionSampleRate: 100,
      enableSessionRecording: true,
      enableLogCollection: true,
    },
  });
</script>
```

## Configuration

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `applicationId` | `string` | yes | | RUM application ID |
| `clientToken` | `string` | yes | | Client token for authentication |
| `env` | `string` | yes | | Environment name (e.g. `production`, `staging`) |
| `version` | `string` | no | | Application version |
| `service` | `string` | no | | Service name |
| `proxy` | `string` | no | | Proxy URL for RUM data ingestion |
| `sessionSampleRate` | `number` | no | | Percentage of sessions to track (0-100) |
| `defaultPrivacyLevel` | `string` | no | `mask-user-input` | Privacy level: `mask-user-input`, `mask`, or `allow` |
| `enablePrivacyForActionName` | `boolean` | no | `false` | Mask action names for privacy |
| `trackViewsManually` | `boolean` | no | `false` | Disable automatic view tracking |
| `enableSessionRecording` | `boolean` | no | `false` | Enable rrweb session replay |
| `enableLogCollection` | `boolean` | no | `false` | Forward browser logs and console output |
| `beforeSend` | `function` | no | | Callback to modify or discard events before they are sent |

## API

### Actions and Errors

```javascript
// Track a custom action
browserSdk.addAction("button_clicked", { buttonId: "checkout" });

// Report an error
browserSdk.addError(new Error("Payment failed"), { orderId: "123" });
```

### Timing and Vitals

```javascript
// Add a custom timing mark
browserSdk.addTiming("hero_image_loaded");

// Duration vitals
browserSdk.addDurationVital("checkout_flow", { startTime, duration });

// Or use start/stop
browserSdk.startDurationVital("api_call");
// ... later
browserSdk.stopDurationVital("api_call");
```

### User

```javascript
browserSdk.setUser({ id: "user-123", name: "Jane", email: "jane@example.com" });
```

### Views

```javascript
// Manual view tracking (requires trackViewsManually: true)
browserSdk.startView({ name: "checkout" });
```

### Global Context

```javascript
browserSdk.setGlobalContext({ team: "payments" });
browserSdk.setGlobalContextProperty("feature_flag", "new_checkout");
browserSdk.removeGlobalContextProperty("feature_flag");
browserSdk.getGlobalContext();
browserSdk.clearGlobalContext();
```

### View Context

```javascript
browserSdk.setViewContext({ page: "product_detail" });
browserSdk.setViewContextProperty("product_id", "abc-123");
```

## Development

### Build

```bash
npm run build
```

Outputs versioned and latest bundles to `dist/`:
- `dist/kf-browser-sdk-v<version>.min.js`
- `dist/kf-browser-sdk.min.js`

### Deploy to CloudFront

1. Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

2. Deploy:

```bash
npm run deploy
```

This builds the bundle, uploads both the versioned and latest files to S3, and invalidates the CloudFront cache. If no `CLOUDFRONT_DISTRIBUTION_ID` is set, a new distribution will be created.

You can also run the steps individually:

```bash
npm run build   # build only
npm run push    # upload to S3 only
npm run deploy  # build + push + CloudFront invalidation
```

## License

Apache-2.0
