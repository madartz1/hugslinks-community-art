import {neon} from '@neondatabase/serverless';
import {getStore,digest,guestVoter} from './_art-voter-auth.mjs';
import {createGalleryVotingHandler} from '../lib/gallery-voting.mjs';
export default createGalleryVotingHandler({makeSql:neon,getStore,digest,guestVoter});
export const config={rateLimit:{action:'rate_limit',aggregateBy:['ip','domain'],windowSize:60,windowLimit:30}};
