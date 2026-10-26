import {defineConfig} from 'astro/config';
const site=process.env.SITE_URL || 'https://lisimin.top/';
if(!['https://lisimin.top','https://naillee.github.io'].includes(new URL(site).origin))throw Error('Unapproved SITE_URL');
export default defineConfig({output:'static',site,base:process.env.BASE_PATH||'/',devToolbar:{enabled:false}});
