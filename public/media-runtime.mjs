// Media identity is independent of the original Inbox and of storage filenames.
export function createMediaResolver(registry, base = new URL('./',import.meta.url)) {
  const records = new Map(registry.map(item => [item.id,item]));
  const urlFor = id => {
    const item = records.get(id);
    if (!item || !/^\/media-library\/[a-z0-9-]+\.[a-z0-9]+$/.test(item.url)) throw Error(`Invalid media ID: ${id}`);
    return new URL(item.url.slice(1),base).href;
  };
  const hydrate = value => {
    if (typeof value === 'string') return value.startsWith('media:') ? urlFor(value.slice(6)) : value;
    if (Array.isArray(value)) return value.map(hydrate);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,hydrate(item)]));
    return value;
  };
  return {hydrate,urlFor};
}
