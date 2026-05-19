import { inferSchema, mergeSchemas } from "./infer.mjs";

const PARAM_RE = /\{([^}]+)\}/g;

function extractParamNames(template) {
  const names = [];
  let m;
  PARAM_RE.lastIndex = 0;
  while ((m = PARAM_RE.exec(template)) !== null) {
    names.push(m[1]);
  }
  return names;
}

function inferFromSamples(samples) {
  const valid = samples.filter((s) => s !== null && s !== undefined);
  if (valid.length === 0) return null;
  const schemas = valid.map(inferSchema);
  return mergeSchemas(schemas);
}

function securityFor(auth) {
  if (auth.type === "bearer") {
    return {
      schemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          ...(auth.token_pattern === "jwt" ? { bearerFormat: "JWT" } : {}),
        },
      },
      security: [{ bearerAuth: [] }],
    };
  }
  if (auth.type === "cookie") {
    return {
      schemes: {
        sessionCookie: {
          type: "apiKey",
          in: "cookie",
          name: auth.cookie_name,
        },
      },
      security: [{ sessionCookie: [] }],
    };
  }
  if (auth.type === "api-key") {
    return {
      schemes: {
        apiKey: {
          type: "apiKey",
          in: "header",
          name: auth.header,
        },
      },
      security: [{ apiKey: [] }],
    };
  }
  return null;
}

export function buildOpenApi({ endpoints, auth, targetUrl, info = {} }) {
  const paths = {};

  for (const ep of endpoints) {
    if (ep.method === "OPTIONS") continue;

    const path = ep.path_template;
    if (!paths[path]) paths[path] = {};

    const op = {};
    const paramNames = extractParamNames(path);
    if (paramNames.length > 0) {
      op.parameters = paramNames.map((name) => ({
        name,
        in: "path",
        required: true,
        schema: { type: "string" },
      }));
    }

    const requestSchema = inferFromSamples(
      ep.exchanges.map((e) => e.request_body)
    );
    if (requestSchema) {
      op.requestBody = {
        required: true,
        content: { "application/json": { schema: requestSchema } },
      };
    }

    const responsesByStatus = new Map();
    for (const ex of ep.exchanges) {
      const status = ex.status ?? "default";
      if (!responsesByStatus.has(status)) responsesByStatus.set(status, []);
      responsesByStatus.get(status).push(ex.response_body);
    }

    const responses = {};
    for (const [status, samples] of responsesByStatus) {
      const key = String(status);
      const schema = inferFromSamples(samples);
      const entry = { description: `${status} response` };
      if (schema) {
        entry.content = { "application/json": { schema } };
      }
      responses[key] = entry;
    }
    op.responses = responses;

    paths[path][ep.method.toLowerCase()] = op;
  }

  const doc = {
    openapi: "3.1.0",
    info: {
      title: info.title ?? "Reconstructed API",
      version: info.version ?? "0.1.0",
      description:
        info.description ??
        "OpenAPI spec inferred from observed network traffic by chimera-dev/api-mapper.",
    },
    servers: targetUrl ? [{ url: targetUrl }] : [],
    paths,
  };

  const sec = securityFor(auth ?? { type: "none" });
  if (sec) {
    doc.components = { securitySchemes: sec.schemes };
    doc.security = sec.security;
  } else {
    doc.components = { securitySchemes: {} };
  }

  return doc;
}
