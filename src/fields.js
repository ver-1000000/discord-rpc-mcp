// Project dotted paths without changing the RPC's object and array structure.
export function selectFields(value, fields) {
  const root = { whole: false, children: new Map() };
  for (const path of fields) {
    let node = root;
    for (const key of path.split('.')) {
      if (node.whole) break;
      if (!node.children.has(key)) node.children.set(key, { whole: false, children: new Map() });
      node = node.children.get(key);
    }
    node.whole = true;
  }
  function select(value, node) {
    if (node.whole || value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(item => select(item, node));
    return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
      const child = node.children.get(key);
      if (!child || (!child.whole && item !== null && typeof item !== 'object')) return [];
      return [[key, select(item, child)]];
    }));
  }
  return select(value, root);
}
