import { adminPrintRequests } from '../lib/print-requests.mjs';
export default (request,context)=>adminPrintRequests(request,context);
export const config={rateLimit:{action:'rate_limit',aggregateBy:['ip','domain'],windowSize:60,windowLimit:30}};
