import {neon} from '@neondatabase/serverless';
import {getStore,guestVoter,digest} from './_art-voter-auth.mjs';
import {createAppreciationHandler} from '../lib/art-engagement.mjs';
export default createAppreciationHandler({makeSql:neon,getStore,guestVoter,digest});
export const config={rateLimit:{action:'rate_limit',aggregateBy:['ip','domain'],windowSize:60,windowLimit:40}};
