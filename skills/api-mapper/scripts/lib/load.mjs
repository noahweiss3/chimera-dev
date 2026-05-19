import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

function parseJsonl(path, warnings) {
  if (!existsSync(path)) {
    warnings.push(`missing file: ${path}`);
    return [];
  }
  const text = readFileSync(path, "utf-8");
  const events = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      events.push(JSON.parse(line));
    } catch (err) {
      warnings.push(`${path}:${i + 1}: invalid JSON: ${err.message}`);
    }
  }
  return events;
}

function lowercaseKeys(obj) {
  if (!obj || typeof obj !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k.toLowerCase()] = v;
  }
  return out;
}

function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

export function loadExchanges({
  tracesDir,
  actionsDir,
  bodiesDir,
  manifestPath,
}) {
  const warnings = [];
  const exchanges = [];

  const requestsPath = resolve(tracesDir, "requests.jsonl");
  const responsesPath = resolve(tracesDir, "responses.jsonl");

  const requestEvents = parseJsonl(requestsPath, warnings);
  const responseEvents = parseJsonl(responsesPath, warnings);

  const responseById = new Map();
  for (const ev of responseEvents) {
    responseById.set(ev.requestId, ev);
  }

  for (const reqEv of requestEvents) {
    const resEv = responseById.get(reqEv.requestId);
    const req = reqEv.request ?? {};
    const res = resEv?.response ?? {};

    const requestBody = readJsonIfExists(
      resolve(bodiesDir, `${reqEv.requestId}.req.json`)
    );
    const responseBody = readJsonIfExists(
      resolve(bodiesDir, `${reqEv.requestId}.res.json`)
    );

    exchanges.push({
      source: "trace",
      request_id: reqEv.requestId,
      method: req.method ?? "",
      url: req.url ?? "",
      request_headers: lowercaseKeys(req.headers),
      request_body: requestBody,
      status: res.status,
      response_headers: lowercaseKeys(res.headers),
      response_body: responseBody,
      mime_type: res.mimeType ?? "",
      timestamp: reqEv.timestamp,
    });
  }

  if (existsSync(actionsDir)) {
    const submittedDir = resolve(actionsDir, "submitted");
    if (existsSync(submittedDir)) {
      const files = readdirSync(submittedDir).filter((f) => f.endsWith(".json"));
      for (const file of files) {
        const action = readJsonIfExists(resolve(submittedDir, file));
        if (!action || !action.request) continue;
        exchanges.push({
          source: "action",
          request_id: `action:${file.replace(/\.json$/, "")}`,
          method: action.request.method ?? "",
          url: action.request.url ?? "",
          request_headers: lowercaseKeys(action.request.headers),
          request_body: action.request.body ?? null,
          status: action.response?.status,
          response_headers: lowercaseKeys(action.response?.headers),
          response_body: action.response?.body ?? null,
          mime_type: "application/json",
          timestamp: action.timestamp ?? null,
        });
      }
    } else {
      warnings.push(`missing dir: ${submittedDir}`);
    }
  } else {
    warnings.push(`missing dir: ${actionsDir}`);
  }

  const manifest = readJsonIfExists(manifestPath);
  if (!manifest) {
    warnings.push(`missing or invalid manifest: ${manifestPath}`);
  }

  return { exchanges, warnings, manifest };
}
