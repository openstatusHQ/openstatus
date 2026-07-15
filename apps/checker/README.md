# OpenStatus Checker

The checker service to ping external service.

It pings the service and save thedata to the tinybird

## How to run

```bash
go run cmd/main.go
```

you can also set the env variable

```fish
set CRON_SECRET YOLO
set CLOUD_PROVIDER local
set TINYBIRD_TOKEN random
```

## How to build

```bash
go build -o checker *.go
```

## How to run in docker

```bash
docker build -t checker .
docker run -p 8080:8080 checker
```

## How to deploy

```bash
fly deploy
```

## Deploy to all region

```bash
fly scale count 35 --region   ams,arn,atl,bog,bom,bos,cdg,den,dfw,ewr,eze,fra,gdl,gig,gru,hkg,iad,jnb,lax,lhr,mad,mia,nrt,ord,otp,phx,qro,scl,sjc,sea,sin,syd,waw,yul,yyz
```

## Deploy to your own infra

Use our docker image

<https://github.com/openstatusHQ/openstatus/pkgs/container/checker>

## Proxy mode (bring your own vantage point)

HTTP monitors can be checked *through* a user-provided proxy instead of directly from the checker. The proxy performs the actual request against the target from its own location and reports the measured result back, so the recorded latency and status reflect the proxy's vantage point.

This is useful for regions where no probe is available (e.g. mainland China, Middle East) — a tiny serverless function deployed there is enough, no server required.

To enable it, configure the proxy in the monitor settings (dashboard → monitor → Check Proxy) or add the following fields to the HTTP checker request:

```jsonc
{
  "url": "https://your-service.com", // the target to monitor
  "proxyUrl": "https://my-function.cn-hangzhou.fcapp.run/check",
  "proxyRegion": "cn-hangzhou", // optional: pin the region stored with the result
  "proxyHeaders": [{ "key": "X-Proxy-Token", "value": "secret" }] // optional: auth for the proxy itself
}
```

If `proxyRegion` is empty, the region is auto-detected from the `region` field of the proxy response, falling back to the checker's own region.

### Contract

The checker sends a `POST` request to `proxyUrl` with `Content-Type: application/json` (plus any `proxyHeaders`):

```jsonc
{
  "url": "https://your-service.com", // target to check
  "method": "GET",
  "headers": { "X-Api-Key": "..." }, // monitor headers, to send to the target
  "body": "", // request body for the target
  "bodyEncoding": "", // "base64" when body carries binary data — decode it before sending to the target
  "timeout": 30000, // ms — the proxy should enforce this on the target
  "followRedirects": true
}
```

For POST monitors, `headers` includes the same default `Content-Type: application/json` the direct checker applies when none is configured. Binary monitors (`Content-Type: application/octet-stream`) get their body shipped as plain base64 with `"bodyEncoding": "base64"`.

The proxy must answer `200 OK` with `Content-Type: application/json`:

```jsonc
{
  // required on a completed check:
  "status": 200, // HTTP status code returned by the target
  "latency": 123, // ms, measured by the proxy

  // set this instead when the target could not be reached:
  "error": "Timeout after 30000 ms",

  // optional:
  "region": "cn-hangzhou", // where the proxy runs, used when proxyRegion is not set
  "timestamp": 1700000000000, // ms since epoch, when the check started
  "headers": { "Server": "nginx" }, // response headers from the target
  "body": "...", // response body from the target, used by assertions
  "timing": { // same shape as the checker's own timing data
    "dnsStart": 0, "dnsDone": 0,
    "connectStart": 0, "connectDone": 0,
    "tlsHandshakeStart": 0, "tlsHandshakeDone": 0,
    "firstByteStart": 0, "firstByteDone": 0,
    "transferStart": 0, "transferDone": 0
  }
}
```

Any non-200 answer from the proxy is treated as a proxy failure (retried like a regular check failure). A reachability problem with the *target* should be reported with `error` in a 200 response, so it is recorded as a monitor failure, not a proxy failure.

### Minimal serverless proxy example

Any runtime that can run a fetch-style handler works (Alibaba Function Compute, AWS Lambda, Cloudflare Workers, Deno Deploy, ...):

```js
export default {
  async fetch(request, env) {
    if (request.headers.get("X-Proxy-Token") !== env.PROXY_TOKEN) {
      return new Response("unauthorized", { status: 401 });
    }
    const check = await request.json();
    const start = Date.now();
    try {
      const res = await fetch(check.url, {
        method: check.method,
        headers: check.headers,
        body: ["GET", "HEAD"].includes(check.method)
          ? undefined
          : check.bodyEncoding === "base64"
            ? Uint8Array.from(atob(check.body), (c) => c.charCodeAt(0))
            : check.body,
        redirect: check.followRedirects ? "follow" : "manual",
        signal: AbortSignal.timeout(check.timeout),
      });
      });
      const body = await res.text();
      return Response.json({
        status: res.status,
        latency: Date.now() - start,
        timestamp: start,
        region: "cn-hangzhou",
        headers: Object.fromEntries(res.headers),
        body,
      });
    } catch (e) {
      return Response.json({
        error: String(e),
        latency: Date.now() - start,
        timestamp: start,
        region: "cn-hangzhou",
      });
    }
  },
};
```
