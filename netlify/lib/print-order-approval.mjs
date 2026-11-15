// Decide whether a verified paid print order can be released. This module
// neither charges customers nor submits orders to the print supplier.
const cents = value => Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000;
const token = value => typeof value === 'string' && value.length > 0 && value.length <= 256;
const pairMatches = (left, right) => token(left) && left === right;
const hold = (reason, details = {}) => ({ status: 'needs_review', reason, ...details });

export function assessPrintOrder({ order, edition, supplier, minimumProfitCents = 0, now = Date.now() } = {}) {
 // Pass only data read or verified on the server. Payment status and the
 // accepted quote's fields must never come directly from the browser.
 if (order?.paymentVerified !== true || order?.paymentStatus !== 'paid' || order?.refunded !== false) {
  return hold('payment_not_cleared');
 }
 if (edition?.approvedForPrint !== true
   || !pairMatches(order.editionId, edition.id)
   || !pairMatches(order.editionRevision, edition.revision)
   || !pairMatches(order.sku, edition.sku)) {
  return hold('edition_not_approved');
 }
 if (!supplier || !Number.isSafeInteger(now)
   || !Number.isSafeInteger(supplier.expiresAt) || supplier.expiresAt <= now
   || supplier.available !== true || !pairMatches(supplier.sku, edition.sku)) {
  return hold('supplier_quote_unavailable');
 }
 if (order.currency !== 'usd' || supplier.currency !== order.currency
   || ![order.printCents, order.shippingChargedCents, order.taxCollectedCents,
    order.totalPaidCents, order.paymentFeeCents, order.quotedSupplierShippingCents,
    supplier.printCents, supplier.shippingCents, supplier.otherCostCents,
    minimumProfitCents].every(cents)) {
  return hold('costs_unverified');
 }
 const receiptsBeforeTax = order.printCents + order.shippingChargedCents;
 if (receiptsBeforeTax + order.taxCollectedCents !== order.totalPaidCents) {
  return hold('payment_total_mismatch');
 }
 if (!pairMatches(order.shippingService, supplier.shippingService)
   || !pairMatches(order.destinationKey, supplier.destinationKey)
   || supplier.shippingCents !== order.quotedSupplierShippingCents) {
  return hold('shipping_discrepancy', {
   quotedSupplierShippingCents: order.quotedSupplierShippingCents,
   currentSupplierShippingCents: supplier.shippingCents
  });
 }
 const profitCents = receiptsBeforeTax - order.paymentFeeCents
   - supplier.printCents - supplier.shippingCents - supplier.otherCostCents;
 if (profitCents < minimumProfitCents) {
  return hold('profit_below_floor', { profitCents, minimumProfitCents });
 }
 return { status: 'auto_approved', profitCents };
}
