import { handlePayments } from '../lib/print-payments.mjs';
export default (request,context)=>handlePayments(request,context);
export const config={rateLimit:{action:'rate_limit',aggregateBy:['ip','domain'],windowSize:60,windowLimit:60}};
