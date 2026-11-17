import { startGoldenHorizonCheckout } from '../lib/golden-horizon-live.mjs';
import { collectorEdition } from '../lib/collector-live.mjs';
export default (request,context)=>startGoldenHorizonCheckout(request,context,{edition:collectorEdition});
export const config={rateLimit:{action:'rate_limit',aggregateBy:['ip','domain'],windowSize:60,windowLimit:15}};
