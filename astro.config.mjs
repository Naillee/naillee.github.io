import {defineConfig} from 'astro/config';
const site=process.env.SITE_URL;
if(!site || !site.startsWith('https://'))throw Error('SITE_URL is required');
export default defineConfig({output:'static',site,base:process.env.BASE_PATH||'/',devToolbar:{enabled:false}});
