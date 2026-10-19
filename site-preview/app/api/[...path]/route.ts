import {env} from 'cloudflare:workers';
import {handle} from '../../../server/api.mjs';
export const dynamic='force-dynamic';
const endpoint=(request:Request)=>handle(request,{db:env.DB,reviewerIds:env.REVIEWER_USER_IDS||'',mapCredentials:{key:env.TENCENT_MAP_KEY||''}});
export const GET=endpoint;export const POST=endpoint;export const PUT=endpoint;
