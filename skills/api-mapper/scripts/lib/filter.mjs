const NOISE_MIME_PREFIXES = [
  "image/",
  "font/",
  "video/",
  "audio/",
  "text/css",
  "text/html",
];

const NOISE_MIME_EXACT = new Set([
  "application/javascript",
  "application/x-javascript",
  "text/javascript",
  "application/wasm",
]);

const NOISE_EXTENSIONS = [
  ".css",
  ".js",
  ".mjs",
  ".map",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".mp4",
  ".webm",
  ".mp3",
];

const ANALYTICS_HOST_FRAGMENTS = [
  "google-analytics",
  "googletagmanager",
  "doubleclick",
  "segment.io",
  "segment.com",
  "mixpanel",
  "amplitude",
  "sentry.io",
  "datadoghq",
  "datadog",
  "intercom",
  "hotjar",
  "fullstory",
  "posthog",
  "bugsnag",
  "rollbar",
  "logrocket",
  "newrelic",
];

const ALLOWED_METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
]);

function getPathname(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}

function getHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

function getOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

export function isNoise(exchange) {
  if (exchange.source === "action") return false;

  const mime = (exchange.mime_type ?? "").toLowerCase();
  if (NOISE_MIME_EXACT.has(mime)) return true;
  for (const prefix of NOISE_MIME_PREFIXES) {
    if (mime.startsWith(prefix)) return true;
  }

  const path = getPathname(exchange.url).toLowerCase();
  for (const ext of NOISE_EXTENSIONS) {
    if (path.endsWith(ext)) return true;
  }
  if (path.endsWith(".js.map") || path.endsWith(".css.map")) return true;

  const host = getHost(exchange.url).toLowerCase();
  for (const frag of ANALYTICS_HOST_FRAGMENTS) {
    if (host.includes(frag)) return true;
  }

  if (!ALLOWED_METHODS.has((exchange.method ?? "").toUpperCase())) return true;

  return false;
}

export function filterExchanges(exchanges, { appOrigins }) {
  const originSet = new Set(appOrigins.map((o) => o.replace(/\/$/, "")));
  return exchanges.filter((ex) => {
    if (ex.source === "action") return true;
    if (isNoise(ex)) return false;
    const origin = getOrigin(ex.url);
    return originSet.has(origin);
  });
}
