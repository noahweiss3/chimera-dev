import { singularize, capitalize } from "./pluralize.mjs";

const USER_ROLE_ALIASES = new Set([
  "owner", "author", "creator", "assignee", "user", "member",
  "actor", "reporter", "requester", "approver", "reviewer",
]);

function resolveTarget(root, byName) {
  // 1. Direct match: column "user_id" -> User entity
  const direct = byName.get(capitalize(singularize(root)));
  if (direct) return direct;
  // 2. Role alias: column "owner_id"/"author_id" etc. -> User entity (if it exists)
  if (USER_ROLE_ALIASES.has(root.toLowerCase()) && byName.has("User")) {
    return byName.get("User");
  }
  return null;
}

function fkColumnRoots(fieldName) {
  if (!fieldName.endsWith("_id")) return null;
  const root = fieldName.slice(0, -3);
  if (!root) return null;
  return { root };
}

function addBelongsTo(entity, targetEntity, foreignKey) {
  if (entity.relationships.some(
    (r) => r.type === "belongs_to" && r.entity === targetEntity.name && r.foreign_key === foreignKey
  )) return;
  entity.relationships.push({ type: "belongs_to", entity: targetEntity.name, foreign_key: foreignKey });
}

function addHasMany(entity, sourceEntity, foreignKey) {
  if (entity.relationships.some(
    (r) => r.type === "has_many" && r.entity === sourceEntity.name && r.foreign_key === foreignKey
  )) return;
  entity.relationships.push({ type: "has_many", entity: sourceEntity.name, foreign_key: foreignKey });
}

function setFieldFk(field, targetEntity) {
  field.foreign_key = `${targetEntity.table}.id`;
}

function inferFromFKFields(entity, byName) {
  for (const field of entity.fields) {
    const roots = fkColumnRoots(field.name);
    if (!roots) continue;
    const target = resolveTarget(roots.root, byName);
    if (!target) continue;
    setFieldFk(field, target);
    addBelongsTo(entity, target, field.name);
    addHasMany(target, entity, field.name);
  }
}

function inferFromNestedObjects(entity, byName) {
  for (const nested of entity.nestedObjects ?? []) {
    const target = resolveTarget(nested.name, byName);
    if (!target) continue;
    const fkName = `${nested.name}_id`;
    let field = entity.fields.find((f) => f.name === fkName);
    if (!field) {
      field = { name: fkName, type: "uuid", required: false, foreign_key: `${target.table}.id` };
      entity.fields.push(field);
    } else if (!field.foreign_key) {
      field.foreign_key = `${target.table}.id`;
    }
    addBelongsTo(entity, target, fkName);
    addHasMany(target, entity, fkName);
  }
}

function inferFromUrlNesting(entities, byName, openapi) {
  const paths = openapi?.paths ?? {};
  for (const path of Object.keys(paths)) {
    const segments = path.split("/").filter(Boolean);
    let parentEntityName = null;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.startsWith("{")) continue;
      if (i + 1 < segments.length && segments[i + 1].startsWith("{")) {
        parentEntityName = capitalize(singularize(seg));
      } else if (parentEntityName) {
        const childName = capitalize(singularize(seg));
        const child = byName.get(childName);
        const parent = byName.get(parentEntityName);
        if (child && parent) {
          const fkName = `${parent.name.toLowerCase()}_id`;
          let field = child.fields.find((f) => f.name === fkName);
          if (!field) {
            field = { name: fkName, type: "uuid", required: false, foreign_key: `${parent.table}.id` };
            child.fields.push(field);
          } else if (!field.foreign_key) {
            field.foreign_key = `${parent.table}.id`;
          }
          addBelongsTo(child, parent, fkName);
          addHasMany(parent, child, fkName);
        }
        parentEntityName = null;
      }
    }
  }
}

export function inferRelationships({ entities, openapi }) {
  const byName = new Map(entities.map((e) => [e.name, e]));
  for (const entity of entities) {
    inferFromFKFields(entity, byName);
    inferFromNestedObjects(entity, byName);
  }
  inferFromUrlNesting(entities, byName, openapi);
  return entities;
}
