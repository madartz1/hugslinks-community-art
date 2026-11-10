# Gallery interactions — preview build

This continues PR #4 without publishing production.

- Appreciations use a separate Postgres table; they do not modify gallery ratings or competition votes.
- One active appreciation per artwork/browser hash. Removing it only affects that browser's row.
- Reports are private, limited to one artwork/browser/day, and never auto-unpublish artwork.
- The report queue uses the existing gallery admin token. Review updates require a version match and note. Publication remains a separate admin decision.
- Publication timestamps are preserved on reapproval. Old approval timestamps are projected read-only; unknown dates stay unknown.
- Help, Contact, Privacy and Submission information describe the current implementation. Contact uses the existing public gallery email and opens the visitor's email app.

## Preview configuration

The isolated Neon branch is `br-winter-poetry-b43w6g99` in project `dry-breeze-15448377`, copied from the existing voting preview branch. `migrations/002-art-engagement.sql` is applied only there. Netlify `HUGS_VOTING_DATABASE_URL` and `HUGS_ENABLE_ART_ENGAGEMENT=true` are scoped to deploy-preview. The existing session secret and gallery admin token are unchanged. No credentials are stored here.

## Before an explicitly approved production release

1. Review the final preview and operational/privacy copy.
2. Apply the additive migration to the production voting database, preserving existing votes.
3. Enable the engagement flag in production only when the schema and private review workflow are ready.
4. Publish the approved source and verify counts, reports authentication and publication dates.

Production schema, flags and source are not changed by this preview work. Artist email delivery and a new real upload need a separate end-to-end check; automated tests use dependency-injected services and do not email users or publish test submissions.
