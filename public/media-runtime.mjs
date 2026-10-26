// Stable identity and local fallback are independent of storage.
export function mediaURL(item,base){
 if(item.remoteUrl){const u=new URL(item.remoteUrl);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('Invalid remote media URL');return u.href;}
 if(!/^\/media-library\/[a-z0-9-]+\.[a-z0-9]+$/.test(item.url))throw Error('Invalid local media URL');
 return new URL(item.url.slice(1),base).href;
}
export function createMediaResolver(registry, base = new URL('./',import.meta.url)) {
 const records=new Map(registry.map(item=>[item.id,item]));
 const urlFor=(id,variant)=>{const item=records.get(id);if(!item)throw Error(`Invalid media ID: ${id}`);const selected=variant?item.variants?.find(v=>'w'+v.width===variant):item;if(!selected)throw Error(`Missing media variant: ${id}/${variant}`);return mediaURL(selected,base);};
 const hydrate=value=>{if(typeof value==='string')return value.startsWith('media:')?urlFor(value.slice(6)):value;if(Array.isArray(value))return value.map(hydrate);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,hydrate(v)]));return value;};
 return {hydrate,urlFor};
}
