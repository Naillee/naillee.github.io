# Nail Lee portfolio

Public website build snapshot. Contains only reviewed display content, B web media copies, font subsets and the approved original portrait and résumé.

GitHub Settings → Pages → Source: GitHub Actions. Workflow derives site/base from the repository name. No custom domain required.

Content and lossless font subsets are maintained and regenerated in the private local engineering project, then exported here. Do not edit this generated snapshot directly. GitHub Actions runs npm ci, Astro build, file/permission/size verification and Pages deployment.

Local check: SITE_URL=https://USERNAME.github.io BASE_PATH=/ npm run build
