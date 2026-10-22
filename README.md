# HUGSLinks Community Art — Recovered Project

Recovered October 22, 2026 from `madartz1/hugslinks-updated`. This repository is distinct from the separate HUGSLinks LUXE commerce store.

## Original recovered pages

- `/art-community.html` — community landing page
- `/artist-submit.html` — artist application form
- `/art-voting.html` — public gallery and voting
- `/hugs-admin.html` — original broad HUGS admin dashboard (**do not publish publicly without an access-control review**)

## Netlify deployment

Import this repository as a new Netlify site. Build command: `npm run build`; publish directory: `.`; functions directory: `netlify/functions` (also specified in netlify.toml). Root redirects to community landing page.

**Do not enable public voting or promote the site as production-ready until all backend integrations and voting abuse controls are verified.**

## Dependencies and configuration

Original source code references:
- `HUGS_ADMIN_TOKEN` for administrative API authorization
- `HUGS_VOTER_SESSION_SECRET` and `HUGS_VOTING_DATABASE_URL` for voting APIs
- Netlify Blobs stores: `hugs-artists`, `hugs-art-images`, `hugs-art-gallery`, `hugs-art-contests`
- Neon/Postgres voting data (existing records are **not** included in GitHub source).
- Additional session routes and assets might be required: audit original frontend requests and original deployment before enabling voting.

Secrets must be configured in Netlify UI, never added to GitHub.

## Important migration caveats

This repo currently contains original source files, not production data. Artworks, uploaded images, stored gallery entries, contest state, historic votes, and submission records reside outside git. They require a deliberate migration/export from the prior environment. Some navigation items and image assets reference the original HUGSLinks site; verify and update links. Original large admin dashboard contains unrelated HUGS modules: separate art-only admin before launch.

## What remains

1. Audit/fix access control, voter session endpoints, database schemas and antispam controls.
2. Migrate relevant artwork and submissions with permission.
3. Check nav/assets and build an independent art-specific admin panel.
4. Run one complete submission → moderation → publishing → vote test.
5. Connect approved work to LUXE later; keep purchasing disabled until print and fulfillment checks pass.
