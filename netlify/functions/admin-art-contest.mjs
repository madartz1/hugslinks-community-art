import {neon} from '@neondatabase/serverless';
import {getStore,digest,guestVoter} from './_art-voter-auth.mjs';
import {createCompetitionHandlers} from '../lib/competition.mjs';
export default createCompetitionHandlers({getStore,makeSql:neon,digest,guestVoter}).admin;
