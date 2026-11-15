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

Required preview variables: `STRIPE_SECRET_KEY` (test key only),
`HUGS_PRINT_QUOTE_SECRET`, `FINERWORKS_TEST_WEB_API_KEY`,
`FINERWORKS_TEST_APP_KEY`, and one of the setup tokens above. The two
FinerWorks keys must be saved on the gallery project, as secret Functions
variables for Deploy Previews. The supplier request always uses test mode and
looks up shipping for the buyer's address. Tax is not calculated here.

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
36 × 43-inch edition quotes its current SKU directly with FinerWorks. To add a verified
Swan edition in the sandbox, set `HUGS_PRINT_TEST_EDITIONS_JSON` to an array
of objects with `id`, `artworkId` (`archive-eye` or `archive-horizon`), `width`, `height`, `material`,
`finish`, `sku`, and `priceCents`. Set the Netlify Functions variables
`FINERWORKS_TEST_WEB_API_KEY` and `FINERWORKS_TEST_APP_KEY` in deploy-preview
for direct, test-mode shipping quotes for those additional SKUs. The legacy bridge is not used by checkout. Use confirmed supplier SKUs and approved retail prices; no extra sizes
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

## Enhanced Swan sandbox edition

- Default preview SKU: `AP108137P700678`, 36 × 43-inch unmounted Artisan
  Archival Canvas, using the enhanced detail proof. Gallery price: $444.49.
- `AP108137P696937` was the previous preview SKU. Existing verified receipts
  remain readable, but requests for new quotes and checkout use the enhanced
  SKU. The earlier `AP108137P696597` remains supported for historical receipts.
- $27.59 Standard tube shipping to New York ZIP 10118 was verified for the
  previous edition. Compare against a fresh FinerWorks quote; no rate is
  hardcoded. No physical order is submitted from this sandbox.


## Additional built-in sandbox editions

- Swan — The Eye, 18 × 22-inch stretched Artisan Archival Canvas with
  Floater Black 1: `AP108137P700682`, $220 supplier cost, $499 draft sandbox retail.
- Golden Horizon, 5 × 4-inch borderless Archival Matte Paper, unframed:
  `AP108137P700685`, $7 supplier cost, $29 draft sandbox retail.
- Shipping is quoted per SKU and address. Draft sandbox prices do not configure
  or authorize a live sale.

## Proposed production order release

Approve each artwork / SKU / size / finish and its exact print file once in the
production catalog. A verified paid order for that edition should not need
another artist or admin approval. Use `assessPrintOrder` from
`netlify/lib/print-order-approval.mjs` at production release time, after verifying
payment and refreshing the supplier quote for the exact SKU, address, and shipping
service. Do not take payment on quote-only listings.

- Calculate contribution after supplier print cost, supplier shipping, any other
  per-order supplier costs (including supplier tax), and Stripe's fee or a
  conservative fee reserve. Exclude buyer sales tax from revenue. The floor is
  configurable in cents; zero holds orders only when projected contribution is
  negative. Choose a higher floor if desired before launch.
- Compare the current supplier shipping cost with the supplier cost saved in the
  accepted checkout quote, separately from what the buyer was charged. Hold on
  a rate, destination, or service discrepancy. Derive the destination key on the
  server from the complete normalized address, including apartment, and avoid
  logging the address in decision details. Never increase a buyer's charge
  automatically.
- Hold on missing or expired cost data, quote or payment mismatch, or an edition
  that is no longer approved. A hold is a paid order awaiting review, not a
  rejection or refund. Show the exact reason and let staff resolve it or refund.
- Production still needs payment verification, a durable fulfillment queue with
  one supplier submission per order, recovery for uncertain supplier responses,
  and tracking. Persist the approval result and supplier request identifier before
  submission. On a retry, reconcile supplier status before attempting to
  submit again. The current sandbox does not submit any supplier orders.

### Preview rehearsal

With `HUGS_PRINT_APPROVAL_PREVIEW=true` scoped to Deploy Previews, new sandbox
checkouts record a signed address fingerprint and the accepted service. After a
verified sandbox payment, the app refreshes the test shipping quote and creates
one durable ledger entry for either an automatic approval or an exception.
Print Order Review shows the result and reason. The simulated release reference
is never sent to FinerWorks. The three built-in editions use their prior test
production costs and a fee estimate for this rehearsal. Live release must use
verified live costs and a separate supplier submission worker. Old test
checkouts keep their original behavior.

Before enabling live supplier submission, confirm that the selected shipping
service and landed cost can be enforced when the order is submitted. FinerWorks
documents that an unavailable service can fall back to the first available
rate, and that validation-only does not validate price. A refreshed quote is
therefore not a supplier price or service lock. Until that is resolved, keep
actual supplier submissions under review. Never retry an ambiguous submission
just because the first status lookup returns no result; reconcile it by the
stable purchase order reference first.

Supplier reference: https://v2.api.finerworks.com/Documentation/Troubleshooting
