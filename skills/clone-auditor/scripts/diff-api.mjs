#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { diffSchemas } from "./lib/diff-schemas.mjs";

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : null;
  };
  return {
    chimeraDir: resolve(process.cwd(), get("--chimera") ?? ".chimera"),
    originalBase: get("--original"),
    cloneBase: get("--clone") ?? "http://localhost:4000",
    cookie: get("--cookie") ?? null,
  };
}

async function fetchOrNull(url, headers) {
  try {
    const res = await fetch(url, { headers });
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return { status: res.status, body: null };
    return { status: res.status, body: await res.json() };
  } catch (err) {
    return { status: 0, error: err.message };
  }
}

function safeGetEndpoints(openapi) {
  const out = [];
  for (const [path, methods] of Object.entries(openapi?.paths ?? {})) {
    for (const [method, op] of Object.entries(methods)) {
      if (method.toUpperCase() !== "GET") continue;
      if (path.includes("{")) continue; // skip parameterized for now
      out.push({ method: method.toUpperCase(), path });
    }
  }
  return out;
}

export async function diffApi({ chimeraDir, originalBase, cloneBase, cookie }) {
  const openapiPath = resolve(chimeraDir, "api-spec/openapi.json");
  if (!existsSync(openapiPath)) {
    return { status: "failed", error: "api-spec/openapi.json missing" };
  }
  const openapi = JSON.parse(readFileSync(openapiPath, "utf-8"));
  const endpoints = safeGetEndpoints(openapi);
  const headers = cookie ? { Cookie: cookie } : {};

  const results = [];
  for (const ep of endpoints) {
    const originalRes = originalBase
      ? await fetchOrNull(originalBase + ep.path, headers)
      : null;
    const cloneRes = await fetchOrNull(cloneBase + ep.path, headers);

    const diffEntry = {
      method: ep.method,
      path: ep.path,
      original_status: originalRes?.status ?? null,
      clone_status: cloneRes.status,
    };
    if (originalRes?.body !== undefined && cloneRes.body !== undefined) {
      diffEntry.schema_diff = diffSchemas(originalRes.body, cloneRes.body);
    }
    results.push(diffEntry);
  }

  const outDir = resolve(chimeraDir, "audit");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    resolve(outDir, "api-diffs.json"),
    JSON.stringify({ endpoints_compared: results.length, results }, null, 2) + "\n"
  );

  return { status: "done", endpoints_compared: results.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs();
  console.log(JSON.stringify(await diffApi(args), null, 2));
}
