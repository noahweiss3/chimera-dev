const SAFE_BARE_RE = /^[A-Za-z_/][A-Za-z0-9_\-./]*$/;
const RESERVED_BARE = new Set([
  "true", "false", "null", "yes", "no", "on", "off",
  "True", "False", "Null", "Yes", "No", "TRUE", "FALSE", "NULL",
  "~", "",
]);

function quoteString(s) {
  const escaped = s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return `"${escaped}"`;
}

function formatKey(k) {
  if (SAFE_BARE_RE.test(k) && !RESERVED_BARE.has(k) && !/^-?\d/.test(k)) {
    return k;
  }
  return quoteString(k);
}

function formatScalar(v) {
  if (v === null) return "null";
  if (typeof v === "boolean") return String(v);
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return quoteString(v);
  return quoteString(String(v));
}

function isContainer(v) {
  return v !== null && typeof v === "object";
}

function serialize(value, indent) {
  const pad = " ".repeat(indent);

  if (!isContainer(value)) {
    return formatScalar(value) + "\n";
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]\n";
    let out = "";
    for (const item of value) {
      if (!isContainer(item)) {
        out += `${pad}- ${formatScalar(item)}\n`;
      } else if (Array.isArray(item)) {
        out += `${pad}-\n${serialize(item, indent + 2)}`;
      } else {
        const entries = Object.entries(item);
        if (entries.length === 0) {
          out += `${pad}- {}\n`;
          continue;
        }
        const [firstKey, firstVal] = entries[0];
        if (isContainer(firstVal)) {
          out += `${pad}- ${formatKey(firstKey)}:\n${serialize(firstVal, indent + 4)}`;
        } else {
          out += `${pad}- ${formatKey(firstKey)}: ${formatScalar(firstVal)}\n`;
        }
        for (let i = 1; i < entries.length; i++) {
          const [k, v] = entries[i];
          if (isContainer(v)) {
            out += `${pad}  ${formatKey(k)}:\n${serialize(v, indent + 4)}`;
          } else {
            out += `${pad}  ${formatKey(k)}: ${formatScalar(v)}\n`;
          }
        }
      }
    }
    return out;
  }

  const entries = Object.entries(value);
  if (entries.length === 0) return "{}\n";
  let out = "";
  for (const [k, v] of entries) {
    if (isContainer(v)) {
      if (Array.isArray(v) && v.length === 0) {
        out += `${pad}${formatKey(k)}: []\n`;
      } else if (!Array.isArray(v) && Object.keys(v).length === 0) {
        out += `${pad}${formatKey(k)}: {}\n`;
      } else {
        out += `${pad}${formatKey(k)}:\n${serialize(v, indent + 2)}`;
      }
    } else {
      out += `${pad}${formatKey(k)}: ${formatScalar(v)}\n`;
    }
  }
  return out;
}

export function toYaml(value) {
  return serialize(value, 0);
}
