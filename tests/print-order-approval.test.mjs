import test from 'node:test';
import assert from 'node:assert/strict';
import { assessPrintOrder } from '../netlify/lib/print-order-approval.mjs';

function fixture() {
 const edition = { id: 'horizon-5x4-matte', revision: 'v1', sku: 'AP108137P700685', approvedForPrint: true };
 return {
  now: 1000, minimumProfitCents: 1000, edition,
  order: {
   paymentVerified: true, paymentStatus: 'paid', refunded: false,
   currency: 'usd', editionId: edition.id, editionRevision: edition.revision, sku: edition.sku,
   printCents: 2900, shippingChargedCents: 695, taxCollectedCents: 200, totalPaidCents: 3795,
   paymentFeeCents: 135, quotedSupplierShippingCents: 695,
   shippingService: 'economy', destinationKey: 'key1'
  },
  supplier: {
   available: true, currency: 'usd', sku: edition.sku, expiresAt: 2000,
   printCents: 700, shippingCents: 695, otherCostCents: 50,
   shippingService: 'economy', destinationKey: 'key1'
  }
 };
}

test('a paid order for a verified edition is automatically approved and customer tax is excluded from margin', () => {
 assert.deepEqual(assessPrintOrder(fixture()), { status: 'auto_approved', profitCents: 2015 });
});

test('an otherwise profitable order with a changed rate, service, or destination needs review', () => {
 for (const change of [{ shippingCents: 700 }, { shippingService: 'ground' }, { destinationKey: 'key2' }]) {
  const input = fixture();
  Object.assign(input.supplier, change);
  assert.equal(assessPrintOrder(input).reason, 'shipping_discrepancy');
 }
});

test('a supplier cost increase can hold a loss or breach a configured profit floor without a shipping change', () => {
 for (const cost of [2850, 2100]) {
  const input = fixture();
  input.supplier.printCents = cost;
  assert.equal(assessPrintOrder(input).reason, 'profit_below_floor');
 }
});

test('no release when payment is unverified, refunded, or mismatched', () => {
 for (const change of [{ paymentVerified: false }, { refunded: true }, { totalPaidCents: 4000 }]) {
  const input = fixture();
  Object.assign(input.order, change);
  assert.equal(assessPrintOrder(input).status, 'needs_review');
 }
});

test('an unapproved SKU, expired supplier quote, or missing fee cannot be auto-approved', () => {
 const wrongEdition = fixture();
 wrongEdition.order.editionRevision = 'older';
 assert.equal(assessPrintOrder(wrongEdition).reason, 'edition_not_approved');
 const stale = fixture();
 stale.supplier.expiresAt = stale.now;
 assert.equal(assessPrintOrder(stale).reason, 'supplier_quote_unavailable');
 const missing = fixture();
 delete missing.order.paymentFeeCents;
 assert.equal(assessPrintOrder(missing).reason, 'costs_unverified');
});
