import {ref} from 'vue';
import type {UserSession} from '../adapters/contracts';
export const session=ref<UserSession|null>(null);
export const serverReady=ref(false);
export class ApiError extends Error{constructor(message:string,public status=0){super(message);}}
export async function request<T=any>(path:string,method:'GET'|'POST'|'PUT'='GET',data?:unknown):Promise<T>{
 let base='';
 // #ifndef H5
 base=import.meta.env.VITE_API_BASE_URL||'';
 if(!base)throw new ApiError('当前终端尚未配置服务地址');
 // #endif
 return new Promise((resolve,reject)=>uni.request({url:base+'/api/'+path,method,data:data as any,header:{'Content-Type':'application/json'},withCredentials:true,timeout:15000,success:r=>{const value=r.data as any;if(r.statusCode>=200&&r.statusCode<300&&value&&typeof value==='object')resolve(value);else reject(new ApiError(value?.error||'服务暂时不可用，请稍后重试',r.statusCode));},fail:()=>reject(new ApiError('网络连接失败，请检查后重试'))}));
}
export async function loadSession(){try{const r=await request<{user:UserSession|null}>('me');session.value=r.user;serverReady.value=true;return r.user;}catch{serverReady.value=false;session.value=null;return null;}}
export function signIn(){
 // #ifdef H5
 window.location.assign('/signin-with-chatgpt?return_to='+encodeURIComponent('/#/pages/me/index'));
 return;
 // #endif
 uni.showToast({title:'当前终端登录尚未接入，请使用网页端',icon:'none'});
}
export function signOut(){
 // #ifdef H5
 window.location.assign('/signout-with-chatgpt?return_to='+encodeURIComponent('/'));
 // #endif
}
export function errorMessage(e:unknown){return e instanceof Error?e.message:'操作未完成，请稍后重试';}
