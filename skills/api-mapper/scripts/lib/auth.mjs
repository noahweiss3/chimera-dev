const SESSION_COOKIE_NAMES = [
  /^connect\.sid$/i,
  /^session$/i,
  /^sid$/i,
  /^auth_token$/i,
  /^auth$/i,
  /^_session$/i,
  /^.+_sess$/i,
  /^.+_session$/i,
  /^laravel_session$/i,
  /^jsessionid$/i,
];

const API_KEY_HEADERS = {
  "x-api-key": "X-API-Key",
  "api-key": "Api-Key",
  "apikey": "ApiKey",
  "x-auth-token": "X-Auth-Token",
};

function isJwt(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  return parts.every((p) => /^[A-Za-z0-9_-]+$/.test(p) && p.length > 0);
}

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  const out = {};
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name) out[name] = value;
  }
  return out;
}

function isSessionCookieName(name) {
  return SESSION_COOKIE_NAMES.some((re) => re.test(name));
}

export function detectAuth(exchanges) {
  let jwtCount = 0;
  let opaqueBearerCount = 0;
  let schemeWord = "Bearer";
  const cookieNameCounts = new Map();
  let apiKeyHeader = null;

  for (const ex of exchanges) {
    const headers = ex.request_headers ?? {};
    const auth = headers.authorization;
    if (auth) {
      // Standard `Bearer` and the `Token` prefix (used by RealWorld, DRF,
      // legacy GitHub) are both token-in-Authorization-header schemes.
      const lower = auth.toLowerCase();
      const prefix = lower.startsWith("bearer ")
        ? "Bearer"
        : lower.startsWith("token ")
          ? "Token"
          : null;
      if (prefix) {
        const token = auth.slice(prefix.length + 1).trim();
        if (isJwt(token)) jwtCount++;
        else opaqueBearerCount++;
        schemeWord = prefix;
        continue;
      }
    }

    const cookieHeader = headers.cookie;
    if (cookieHeader) {
      const cookies = parseCookies(cookieHeader);
      for (const name of Object.keys(cookies)) {
        if (isSessionCookieName(name)) {
          cookieNameCounts.set(name, (cookieNameCounts.get(name) ?? 0) + 1);
        }
      }
    }

    for (const [h, canonical] of Object.entries(API_KEY_HEADERS)) {
      if (headers[h]) {
        apiKeyHeader = canonical;
      }
    }
  }

  if (jwtCount > 0 || opaqueBearerCount > 0) {
    return {
      type: "bearer",
      header: "Authorization",
      scheme: schemeWord,
      token_pattern: jwtCount >= opaqueBearerCount ? "jwt" : "opaque",
    };
  }

  if (cookieNameCounts.size > 0) {
    const [topCookie] = [...cookieNameCounts.entries()].sort((a, b) => b[1] - a[1]);
    return {
      type: "cookie",
      cookie_name: topCookie[0],
    };
  }

  if (apiKeyHeader) {
    return { type: "api-key", header: apiKeyHeader };
  }

  return { type: "none" };
}
