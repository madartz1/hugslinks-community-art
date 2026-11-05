import {getStore} from '@netlify/blobs';
import {createArtistAccountHandler} from '../lib/artist-account.mjs';
export default createArtistAccountHandler({getStore,env:()=>Object.fromEntries(['HUGS_VOTER_SESSION_SECRET','HUGS_VOTER_RESEND_API_KEY','HUGS_VOTER_FROM_EMAIL'].map(key=>[key,globalThis.Netlify?.env?.get(key)??process.env[key]]))});
export const config={rateLimit:{action:'rate_limit',aggregateBy:['ip','domain'],windowSize:60,windowLimit:40}};
