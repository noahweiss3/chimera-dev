const VOWELS = new Set(["a", "e", "i", "o", "u"]);

export function singularize(s) {
  if (!s) return s;
  if (s.endsWith("ies") && s.length > 3) {
    return s.slice(0, -3) + "y";
  }
  if (s.endsWith("ses") || s.endsWith("xes") || s.endsWith("zes") || s.endsWith("ches") || s.endsWith("shes")) {
    return s.slice(0, -2);
  }
  if (s.endsWith("s") && !s.endsWith("ss") && s.length > 1) {
    return s.slice(0, -1);
  }
  return s;
}

export function pluralize(s) {
  if (!s) return s;
  if (s.endsWith("y") && s.length > 1 && !VOWELS.has(s[s.length - 2])) {
    return s.slice(0, -1) + "ies";
  }
  if (
    s.endsWith("s") ||
    s.endsWith("x") ||
    s.endsWith("z") ||
    s.endsWith("ch") ||
    s.endsWith("sh")
  ) {
    return s + "es";
  }
  return s + "s";
}

export function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : "";
}
