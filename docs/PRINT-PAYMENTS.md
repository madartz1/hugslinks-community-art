# Swan payment sandbox

The default Swan edition uses Stripe Checkout at USD 444.49 plus the server-requested
FinerWorks shipping quote for one unmounted 36 x 43-inch canvas. Tax is not
calculated in the sandbox. Quotes expire after 15 minutes. The delivery address
used for the quote is saved to the Stripe test customer; checkout does not offer
a separate editable shipping address.

`art-print-payments` accepts only the gallery’s stable PR #4 Deploy Preview
host and refuses live API keys. The price and SKU are server-owned. The browser
never receives supplier or Stripe API keys. `config`, `quote`, `checkout`, and
`status` are the browser flow. Quotes are available before webhook setup, but
creating a checkout requires the webhook.

The `setup` action is protected by `HUGS_PRINT_CHECKOUT_ADMIN_TOKEN` or the
preview-only `HUGS_PRINT_PREVIEW_SETUP_TOKEN`. It registers a sandbox webhook
on the stable preview URL and saves its signing secret in the dedicated private
`print-checkout-preview-4-config` store. This store holds one configuration
record and deliberately persists across rebuilds; production and all other
hosts are rejected before it is opened. No secret is returned. Setup is
idempotent and does not remove existing Stripe endpoints. If the sandbox
is at capacity, setup can move a previous gallery test endpoint to the stable
URL, but only when its deploy record contains the matching endpoint ID and
signing secret. It does not change unrelated or live endpoints.

Webhook handlers verify Stripe signatures and re-read payment details before
recording `hugs_test_payment_verified=true` and `hugs_fulfillment=test-hold` on
the Stripe session. Duplicate deliveries use the same idempotency key. Stripe
is the source of truth for these test payments. The receipt displays canvas,
shipping, and total only after verification. No personal data is returned by
`status`. The checkout form can fill in a fictional test recipient and a public
landmark address to avoid using a customer's information in the sandbox.

Required preview variables: STRIPE_SECRET_KEY (test key only),
HUGS_PRINT_BRIDGE_PREVIEW_TOKEN, HUGS_PRINT_QUOTE_SECRET, and one of the setup
tokens above. The supplier connection is pinned to the tested commerce deploy
and its Swan SKU. Tax is not calculated in this sandbox.

The 36 × 43-inch sample JPEG is 10,800 × 12,900 pixels, tagged 300 PPI. Its
1,147 × 1,371-pixel original supplies only about 32 native PPI at that size.
Upsampling provides the expected dimensions, not additional original detail.
Use it for testing; the production master and supplier SKU still require a
quality review before selling this edition.

No endpoint submits supplier orders. This is a payment test, not live sales or
automatic physical fulfillment. Production requires a reviewed print master
and matching SKU, a transactional order ledger, tax configuration, live keys,
verified shipping and supplier-order submission with duplicate protection.

Validation: `node --test tests/print-payments.test.mjs` and `npm run build`.

## Additional sizes

The preview menu is generated from the server catalog. The built-in Swan
36 × 43-inch edition uses the existing supplier bridge. To add a verified
Swan edition in the sandbox, set `HUGS_PRINT_TEST_EDITIONS_JSON` to an array
of objects with `id`, `artworkId` (`archive-eye`), `width`, `height`, `material`,
`finish`, `sku`, and `priceCents`. Set the Netlify Functions variables
`FINERWORKS_TEST_WEB_API_KEY` and `FINERWORKS_TEST_APP_KEY` in deploy-preview
for direct, test-mode shipping quotes for those additional SKUs. The original
bridge can only quote its own configured SKU and is never reused for a different
size. Use confirmed supplier SKUs and approved retail prices; no extra sizes
are assumed by default.

The chosen edition is signed into the shipping quote. A catalog change requires
a new quote; buyers cannot supply a different SKU or price. The payment
confirmation validates the exact signed edition and total. Older verified
sandbox receipts remain readable.

Before connecting a live edition, record its exact live FinerWorks SKU, format,
size, finish, approved master, selling price, and verified shipping options.
Live payments and physical orders remain disabled; the test catalog is not a
production inventory list. Complete the order ledger and supplier submission
with idempotency before accepting live payments.
