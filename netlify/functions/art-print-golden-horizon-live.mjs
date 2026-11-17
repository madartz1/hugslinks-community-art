import { startGoldenHorizonCheckout } from '../lib/golden-horizon-live.mjs';
export default (request,context)=>startGoldenHorizonCheckout(request,context);
export const config={rateLimit:{action:'rate_limit',aggregateBy:['ip','domain'],windowSize:60,windowLimit:15}};
