# Shareable PR 25 preview hosting

Production: https://chrouos.github.io/Loop_and_Town/player.html

Preview (only while PR #25 remains open):
https://chrouos.github.io/Loop_and_Town/previews/pr-25/player.html

Deployment design:
- The trusted deployment workflow lives on main, not on the unmerged PR branch.
- The PR verification workflow runs tests and checks its preview build.
- Upon a successful PR #25 verification, `workflow_run` rebuilds main and the exact preview branch.
- The production build is preserved at the root; preview assets and story data are staged under `/previews/pr-25/`.
- `LOOP_TOWN_BASE` sets correct absolute Vite JS/CSS paths for the nested preview.
- The build job runs with read-only repository access; only the deploy job gets Pages write credentials.
- The preview application prefixes its localStorage keys so ordinary preview play does not overwrite production progress.
- Pages previews share an origin with production. Only preview trusted same-repository branches; do not generalize to arbitrary fork PRs.
- If PR #25 closes, preview is omitted from future deployments. A real deployment is required before the preview URL exists.

Test the actual HTTPS URL after the main workflow succeeds. A green PR CI alone does not establish that the preview was deployed.
