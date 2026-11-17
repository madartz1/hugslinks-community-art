import { submitPrintRequest } from '../lib/print-requests.mjs';
export default (request,context)=>submitPrintRequest(request,context);
export const config={rateLimit:{action:'rate_limit',aggregateBy:['ip','domain'],windowSize:60,windowLimit:8}};
