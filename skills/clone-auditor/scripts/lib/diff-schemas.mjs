function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
}

function join(prefix, segment) {
  if (!prefix) return segment;
  if (segment.startsWith("[")) return prefix + segment;
  return prefix + "." + segment;
}

function walk(a, b, path, acc) {
  const tA = typeOf(a);
  const tB = typeOf(b);

  if (tA !== tB) {
    if ((tA === "integer" && tB === "number") || (tA === "number" && tB === "integer")) {
      return; // numeric variation is not a mismatch
    }
    acc.type_mismatches.push({ path: path || "", a_type: tA, b_type: tB });
    return;
  }

  if (tA === "object") {
    const aKeys = new Set(Object.keys(a));
    const bKeys = new Set(Object.keys(b));
    for (const k of aKeys) {
      if (!bKeys.has(k)) acc.missing_in_b.push(join(path, k));
    }
    for (const k of bKeys) {
      if (!aKeys.has(k)) acc.missing_in_a.push(join(path, k));
    }
    for (const k of aKeys) {
      if (!bKeys.has(k)) continue;
      walk(a[k], b[k], join(path, k), acc);
    }
    return;
  }

  if (tA === "array") {
    const minLen = Math.min(a.length, b.length);
    for (let i = 0; i < minLen; i++) {
      walk(a[i], b[i], join(path, "[]"), acc);
    }
    return;
  }
  // scalars match; no further structure to diff
}

export function diffSchemas(a, b) {
  const acc = { missing_in_b: [], missing_in_a: [], type_mismatches: [] };
  walk(a, b, "", acc);
  // Deduplicate
  acc.missing_in_b = [...new Set(acc.missing_in_b)];
  acc.missing_in_a = [...new Set(acc.missing_in_a)];
  return acc;
}
