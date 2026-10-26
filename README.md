# Nail Lee portfolio

Public website build snapshot. Contains only reviewed display content, B web media copies, font subsets and the approved original portrait and résumé.

GitHub Settings → Pages → Source: GitHub Actions. Formal site: https://lisimin.top/. public/CNAME preserves the custom domain; Actions uses the same canonical site and root base. The GitHub Pages hostname remains managed by GitHub.

Content and lossless font subsets are maintained and regenerated in the private local engineering project, then exported here. Do not edit this generated snapshot directly. GitHub Actions runs npm ci, Astro build, file/permission/size verification and Pages deployment.

Local check: SITE_URL=https://lisimin.top/ BASE_PATH=/ npm run build. Rollback to the GitHub hostname requires restoring its site setting and removing the custom domain in Pages settings; changing code alone does not remove GitHub redirects.
