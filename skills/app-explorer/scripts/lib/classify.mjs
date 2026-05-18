const SAFE_PATTERNS = [
  /\b(create|add|new|save|update|edit|submit|enable|disable|toggle|activate|deactivate|send|invite|share|publish|upload|import|export|copy|duplicate|rename|move|assign|approve|confirm|accept|join|subscribe|follow|pin|bookmark|star|like|mark)\b/i,
];

const DESTRUCTIVE_PATTERNS = [
  /\b(delete|remove|archive|destroy|revoke|disconnect|unlink|purge|wipe|erase|drop|terminate|cancel|deauthorize|ban|block|reject|decline|leave|unsubscribe)\b/i,
];

export function classifyAction(text) {
  const trimmed = text.trim();
  if (!trimmed) return "unknown";

  for (const pat of DESTRUCTIVE_PATTERNS) {
    if (pat.test(trimmed)) return "destructive";
  }
  for (const pat of SAFE_PATTERNS) {
    if (pat.test(trimmed)) return "safe";
  }
  return "unknown";
}
