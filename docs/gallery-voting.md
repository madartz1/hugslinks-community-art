# Gallery voting

The community-art draft uses Neon project `dry-breeze-15448377`, branch `br-hidden-moon-b49byyc1` (`hl-art-gallery-preview`), database `hugs_voting`. The parent branch and other applications are unchanged. Existing table structures and copied records are preserved.

Netlify Deploy Previews must have `HUGS_VOTING_DATABASE_URL`, `HUGS_VOTER_SESSION_SECRET`, and `HUGS_ENABLE_PUBLIC_VOTING=true` available to Functions. Credentials are stored in Netlify only. Production was not enabled by this change.

One gallery vote per artwork per browser cookie is enforced by the `(artwork_id, voter_hash)` primary key. Each browser may vote for multiple artworks. A secure HttpOnly guest cookie identifies a browser; clearing cookies or using another browser can permit another vote. This is browser-level duplicate protection, not verified one-person voting. Gallery votes are separate from competition votes; competitions must also be configured and opened by an administrator.

POST requests must originate on the gallery's own origin. The gallery endpoint is limited to 30 requests per IP/domain per minute. Only published artwork can receive gallery votes. Counts include only currently published works. The gallery remains browsable if the vote service is temporarily unavailable.

Validation: mocked API tests cover first votes, secure guest cookies, duplicate and concurrent votes, unpublished work, cross-site requests, closed voting, and error redaction. A PostgreSQL subtransaction test verified insert/duplicate protection and rolled back its synthetic vote. No test votes were left on published artwork.
