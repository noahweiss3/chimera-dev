function entityBlock(entity) {
  const lines = [`    ${entity.name} {`];
  for (const f of entity.fields) {
    const flags = [];
    if (f.primary_key) flags.push("PK");
    if (f.foreign_key) flags.push("FK");
    const suffix = flags.length > 0 ? ` ${flags.join(",")}` : "";
    lines.push(`        ${f.type} ${f.name}${suffix}`);
  }
  lines.push(`    }`);
  return lines.join("\n");
}

function relationshipLines(entities) {
  const out = [];
  const seen = new Set();
  for (const entity of entities) {
    for (const rel of entity.relationships ?? []) {
      // emit one line per pair (skip reverse-side has_many to avoid duplicates)
      if (rel.type !== "has_many") continue;
      const key = `${entity.name}->${rel.entity}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(`    ${entity.name} ||--o{ ${rel.entity} : has`);
    }
  }
  return out;
}

export function buildErd(entities) {
  const lines = ["```mermaid", "erDiagram"];
  for (const e of entities) lines.push(entityBlock(e));
  for (const line of relationshipLines(entities)) lines.push(line);
  lines.push("```");
  return lines.join("\n") + "\n";
}
