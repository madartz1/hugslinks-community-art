# Swan payment sandbox

The gallery draft uses Stripe Checkout at USD 444.49 plus the server-requested
FinerWorks shipping quote for one unmounted 36 x 43-inch canvas. Tax is not
calculated in the sandbox. Quotes expire after 15 minutes. The delivery address
used for the quote is saved to the Stripe test customer; checkout does not offer
a separate editable shipping address.

`art-print-payments` is available only in deploy previews and refuses live API
keys. The price and SKU are server-owned. The browser never receives supplier or
Stripe API keys. `config`, `quote`, `checkout`, and `status` are the browser flow.
The `setup` action is protected by `HUGS_PRINT_CHECKOUT_ADMIN_TOKEN`; it registers
the test webhook at the immutable preview URL and stores its signing secret in
a private deploy-specific Netlify configuration store. No secret is returned.
Webhook handlers verify Stripe signatures and re-read payment details before
recording `hugs_test_payment_verified=true` and `hugs_fulfillment=test-hold` on
the Stripe session. Duplicate deliveries use the same idempotency key. Stripe
is the source of truth for these test payments; this store holds configuration,
not transactional order data.

Required preview variables: STRIPE_SECRET_KEY (test key only),
HUGS_PRINT_BRIDGE_PREVIEW_TOKEN, HUGS_PRINT_QUOTE_SECRET,
HUGS_PRINT_CHECKOUT_ADMIN_TOKEN. The supplier connection is pinned to the tested
commerce deploy and its Swan SKU. Configuration is redeploy-specific; a new
deploy requires running setup and creates a new preview webhook. Deactivate old
HUGS sandbox webhook endpoints when retiring previews.

No endpoint submits supplier orders. This is a payment test, not live sales or
automatic physical fulfillment. Production requires a reviewed print master
and matching SKU, a transactional order ledger, tax configuration, live keys,
verified shipping and supplier-order submission with duplicate protection.

Validation: `node --test tests/print-payments.test.mjs` and `npm run build`.
