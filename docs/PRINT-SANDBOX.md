# Swan print: FinerWorks sandbox checks

This is a deploy-preview-only diagnostic, not a customer checkout or an order-submission endpoint. Calls use the SKU and credentials from environment variables, never the public client. It provides only product lookup and shipping quotation. Shipping quotation passes test_mode=true and does not submit an order. Production always returns 404.

Before testing, use test-mode FinerWorks credentials and the actual test SKU for the Swan canvas; these were configured on the separate commerce site and are not automatically available to this gallery site. Scope these variables to the gallery's deploy-preview functions:

- FINERWORKS_WEB_API_KEY
- FINERWORKS_APP_KEY
- FINERWORKS_TEST_SKU
- HUGS_ART_PRINT_TEST_TOKEN (a long random value distinct from other tokens)

Never place credentials, the diagnostic token, or customer information in a repository or chat. The diagnostic checks token authorization and returns minimal error categories, never supplier bodies, SKU, or keys. Only a valid contiguous-US address can be used for shipping lookup. Customer addresses should never be recorded in logs.

POST to the deploy preview's /.netlify/functions/art-print-sandbox with x-hugs-print-test-token and JSON:

- {"action":"product"} checks whether FinerWorks accepts the configured SKU. A successful lookup does not itself verify that the SKU maps to a 36 x 43 canvas, a usable source image, a final cost or a live product.
- {"action":"shipping","recipient":{...}} uses fields first_name, last_name, address_1, optional address_2, city, two-letter state_code, zip_postal_code, optional phone to fetch options for one configured SKU. Returned shipping IDs of zero are marked automationReady:false and must not be submitted as if they were valid shipping IDs.

Use only artificial or properly authorized test addresses. Never use this diagnostic for real orders. Run node --test tests/print-sandbox.test.mjs to exercise security and response handling without network access or real credentials.

Remaining before automatic purchase: confirmed SKU and price, artwork resolution and canvas wrapping, sandbox Stripe checkout and signature-verified webhook, durable order state with idempotent fulfillment and recovery for ambiguous supplier responses, customer shipping choices, and an end-to-end supplier test with real account configuration. Do not enable customer payment or place live orders based only on this diagnostic.
