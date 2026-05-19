function pathnameOf(url) {
  if (!url) return "";
  try {
    return new URL(url, "http://placeholder.invalid").pathname;
  } catch {
    return url;
  }
}

function buildAdjacency(navGraph) {
  const adj = new Map();
  for (const edge of navGraph?.edges ?? []) {
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    adj.get(edge.from).push(edge);
  }
  return adj;
}

function findRoots(screens, adj) {
  const hasIncoming = new Set();
  for (const edges of adj.values()) {
    for (const e of edges) hasIncoming.add(e.to);
  }
  const roots = [];
  for (const s of screens) {
    if (!hasIncoming.has(s.id)) roots.push(s.id);
  }
  if (roots.length === 0 && screens.length > 0) roots.push(screens[0].id);
  return roots;
}

function dfsChains(start, adj, maxDepth = 8) {
  const chains = [];
  function walk(node, path, visited) {
    if (path.length > maxDepth) {
      chains.push([...path]);
      return;
    }
    const edges = adj.get(node) ?? [];
    if (edges.length === 0) {
      chains.push([...path]);
      return;
    }
    let extended = false;
    for (const e of edges) {
      if (visited.has(e.to)) continue;
      visited.add(e.to);
      path.push({ to: e.to, action: `${e.action}: ${e.label}` });
      walk(e.to, path, visited);
      path.pop();
      visited.delete(e.to);
      extended = true;
    }
    if (!extended) chains.push([...path]);
  }
  walk(start, [{ to: start, action: "start" }], new Set([start]));
  return chains;
}

function chainName(chain, screensById) {
  if (chain.length === 0) return "(empty flow)";
  const head = screensById.get(chain[0].to)?.name ?? chain[0].to;
  const tail = screensById.get(chain[chain.length - 1].to)?.name ?? chain[chain.length - 1].to;
  if (chain.length === 1) return `Visit ${head}`;
  return `${head} -> ${tail}`;
}

export function reconstructFlows({ screens, navGraph }) {
  const adj = buildAdjacency(navGraph);
  const screensById = new Map(screens.map((s) => [s.id, s]));
  const roots = findRoots(screens, adj);

  const allChains = [];
  for (const root of roots) {
    for (const chain of dfsChains(root, adj)) {
      if (chain.length === 1) continue;
      allChains.push(chain);
    }
  }

  const seen = new Set();
  const flows = [];
  for (const chain of allChains) {
    const key = chain.map((c) => c.to).join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    flows.push({
      name: chainName(chain, screensById),
      steps: chain.map((c) => ({ screen: c.to, action: c.action })),
    });
  }
  return flows;
}

function endpointForUrl(method, url, endpointMap) {
  const path = pathnameOf(url);
  if (!endpointMap?.endpoints) return `${method} ${path}`;
  for (const ep of endpointMap.endpoints) {
    if (ep.method !== method) continue;
    const re = new RegExp(
      "^" + ep.path_template.replace(/\{[^}]+\}/g, "[^/]+") + "$"
    );
    if (re.test(path)) return `${ep.method} ${ep.path_template}`;
  }
  return `${method} ${path}`;
}

function findToScreenAfter(fromId, afterTs, navGraph) {
  const edges = navGraph?.edges ?? [];
  for (const e of edges) {
    if (e.from === fromId) return e.to;
  }
  return null;
}

export function buildStateMachine({ submittedActions, navGraph, endpointMap }) {
  const transitions = [];
  for (const action of submittedActions ?? []) {
    const status = action.response?.status ?? 0;
    if (status < 200 || status >= 300) continue;
    const fromScreen = action.page_ref;
    if (!fromScreen) continue;
    transitions.push({
      name: action.trigger_text
        ? `action.${action.trigger_text.toLowerCase().replace(/\s+/g, "-")}`
        : "action.unnamed",
      from_screen: fromScreen,
      to_screen: findToScreenAfter(fromScreen, action.timestamp, navGraph),
      trigger: action.trigger_text ? `button:${action.trigger_text}` : "unknown",
      endpoint: action.request
        ? endpointForUrl(action.request.method, action.request.url, endpointMap)
        : null,
    });
  }
  return transitions;
}
