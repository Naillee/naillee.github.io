// Public URLs only. No account configuration or credentials are exported.
// Exact reviewed destinations only; the Hangzhou origin remains for rollback.
const directOrigins = new Set([
  'https://lisimin.oss-cn-hangzhou.aliyuncs.com',
  'https://lisimin-top.oss-cn-hongkong.aliyuncs.com',
]);
export function assertPublicMediaURL(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash) throw Error('Invalid external delivery URL');
  if (u.hostname.endsWith('.aliyuncs.com')) {
    if (!directOrigins.has(u.origin) || !/^\/staging\/portfolio\/upload-private\/[a-f0-9]{64}\.(?:webp|jpg|jpeg|png|gif|avif|mp4|m4v)$/.test(u.pathname)) throw Error('Invalid direct OSS delivery URL');
  } else if (!u.pathname.includes('/published/')) throw Error('Invalid external delivery URL');
  return u.href;
}
