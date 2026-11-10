import {neon} from '@neondatabase/serverless';
import {createReportAdminHandler} from '../lib/art-engagement.mjs';
export default createReportAdminHandler({makeSql:neon});
export const config={rateLimit:{action:'rate_limit',aggregateBy:['ip','domain'],windowSize:60,windowLimit:60}};
