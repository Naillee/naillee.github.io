import {readdir,readFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {assertPublicMediaURL} from './public-delivery-policy.mjs';
const registry=JSON.parse(await readFile('dist/media-registry.json'));
assert(registry.every(m=>m.publicApproved===true));
const content=JSON.parse(await readFile('dist/content.preview.json'));
const ids=new Set();function refs(v){if(typeof v==='string'&&v.startsWith('media:'))ids.add(v.slice(6));else if(v&&typeof v==='object')Object.values(v).forEach(refs)}refs(content);
const html=await readFile('dist/index.html','utf8');for(const m of html.matchAll(/data-media-id="([^"]+)"/g))ids.add(m[1]);assert.equal(ids.size,registry.length);assert(registry.every(m=>ids.has(m.id)));assert(!/noindex|LOCAL_CANDIDATE_ONLY/.test(html));
const allowed=new Set(['index.html','site.css','site.js','media-runtime.mjs','video-session.mjs','image-loading.mjs','content.preview.json','media-registry.json','.nojekyll','media-fallback.json']);
for(const m of registry)for(const x of [m,...m.variants||[]]){assert(/^\/media-library\/[a-z0-9_-]+\.[a-z0-9]+$/.test(x.url));if(x.remoteUrl)assertPublicMediaURL(x.remoteUrl);else allowed.add(x.url.slice(1));}
const site=process.env.SITE_URL || 'https://lisimin.top/';
const siteURL=new URL(site);assert(['https://lisimin.top','https://naillee.github.io'].includes(siteURL.origin)&&siteURL.pathname==='/');
if(siteURL.hostname==='lisimin.top'){allowed.add('CNAME');assert.equal((await readFile('dist/CNAME','utf8')).trim(),'lisimin.top');}
const canonical=html.match(/<link[^>]*rel=[\"']canonical[\"'][^>]*href=[\"']([^\"']+)/i)?.[1];assert.equal(canonical,new URL('/',siteURL).href,'Canonical URL differs from formal site');
const fallback=JSON.parse(await readFile('dist/media-fallback.json'));
for(const f of fallback){assert(/^media-library\/[a-z0-9_-]+\.[a-z0-9]+$/.test(f.path)&&f.publicApproved===true&&/^[a-f0-9]{64}$/.test(f.sha256));allowed.add(f.path);const data=await readFile('dist/'+f.path);assert.equal(data.length,f.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),f.sha256,'Rollback media changed: '+f.path);}
let bytes=0,files=0;const seen=new Set();
async function walk(dir,rel=''){for(const e of await readdir(dir)){const p=dir+'/'+e,r=rel+e,s=await lstat(p);assert(!s.isSymbolicLink());if(s.isDirectory())await walk(p,r+'/');else{assert(allowed.has(r)||/^fonts\/[a-zA-Z0-9_.-]+\.(woff2|txt)$/.test(r),'Unexpected output '+r);assert(s.size<=104857600,'File exceeds 100 MiB');bytes+=s.size;files++;seen.add(r);if(/\.(json|html|js|mjs|css|txt)$/.test(r)){const text=await readFile(p,'utf8');assert(!/sourceRefs|00_INBOX|10_CODEX|90_CODEX|\/Users\/|file:\/\//i.test(text),'Internal data '+r);}}}}
await walk('dist');for(const p of allowed)assert(seen.has(p),'Missing '+p);assert(bytes<=700000000);console.log(JSON.stringify({bytes,MB:bytes/1e6,files,mediaIDs:registry.length,fallbackMediaFiles:fallback.length,publicApproved:true}));
