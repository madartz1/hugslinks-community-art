# Artist workflow preview

The artist studio groups submissions by the normalized email in the verified submission record. The private session is signed, HttpOnly, Secure and SameSite=Lax; it lasts 12 hours. Emailed links expire after 15 minutes and are consumed with an atomic compare-and-set. The sign-in token is removed from browser history before verification, and the studio sends no referrer.

Artists can select each submission, view their private upload, distinguish admin approval from actual gallery publication, and propose a biography for that selected submission. Only current published works get a public profile link. Private contact details, legal names, flags and admin notes are excluded from studio responses.

Upload retries on the same open page retain a UUID request key. The service returns the original reference for a successful retry and uses compare-and-set writes to avoid losing concurrent new submissions. The key is intentionally not saved in browser storage; reloading the page starts a new submission. The form stays populated after errors and is locked while uploading. JPEG, PNG and WebP up to 4 MB remain the supported formats; the browser also checks that the selected image can decode.

Runtime sign-in configuration uses the existing HUGS_VOTER_SESSION_SECRET, HUGS_VOTER_RESEND_API_KEY and HUGS_VOTER_FROM_EMAIL variables with Functions scope. Missing mail configuration and delivery failures now return an actionable error rather than a misleading success. Successful known and unknown email requests get the same message; per-email minute buckets reduce repeat mail requests. This does not promise resistance to all email enumeration by timing or upstream delivery failures.

## Verification

Run `node --test tests/*.test.mjs` and `npm run build`.

The new workflow tests use only memory stores and a captured fake mail transport: private upload → email link → cookie → studio → admin publication → biography proposal → admin approval. Coverage includes multiple submissions, foreign private image denial, expired/replayed/concurrently claimed links, cooldown, unavailable mail, upload retry deduplication, concurrent uploads, origin checks, file validation, and private field exclusion.

No real email is sent and no production/shared Blobs record is created by this test suite. Preview deployments still share the site's artist/gallery Blobs stores; do not create sample submissions there for QA. Existing admin review writes use the older read/write mechanism and are not made transactional by this change.

Before release, the owner should verify actual inbox delivery and one real artwork submission in their normal browser, including an iPhone check. Automated fixture tests do not establish actual inbox delivery, image quality for printing, or physical device behavior. This change does not activate paid checkout or supplier fulfillment. Production publishing remains a separate release step.
