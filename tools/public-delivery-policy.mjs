// Exact public destinations only. No credentials, signed URLs or arbitrary hosts.
// Hangzhou remains accepted only to validate preserved historical rollback files.
const nativeOrigins = new Set([
 'https://lisimin.oss-cn-hangzhou.aliyuncs.com',
 'https://lisimin-top.oss-cn-hongkong.aliyuncs.com',
]);
const currentOrigin='https://media.lisimin.top';
const objectPath=/^\/staging\/portfolio\/upload-private\/[a-f0-9]{64}(?:_1080p)?\.(?:webp|jpg|jpeg|png|gif|avif|mp4|m4v)$/;
export function assertPublicMediaURL(value) {
 const u=new URL(value);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.port)throw Error('Invalid external delivery URL');
 if((!nativeOrigins.has(u.origin)&&u.origin!==currentOrigin)||!objectPath.test(u.pathname))throw Error('Invalid external delivery destination or object key');
 if(u.pathname.includes('_1080p.')&&!u.pathname.endsWith('_1080p.mp4'))throw Error('Invalid HD video object key');
 return u.href;
}
