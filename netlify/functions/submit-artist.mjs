import {getStore} from '@netlify/blobs';
import {createArtistSubmissionHandler} from '../lib/artist-submission.mjs';
export default createArtistSubmissionHandler({getStore});
export const config={rateLimit:{action:'rate_limit',aggregateBy:['ip','domain'],windowSize:60,windowLimit:10}};
