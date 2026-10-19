import {amapLocationLink} from '../domain/place';
export function readSaved(): string[] { const value=uni.getStorageSync('lf-preview-saved'); return Array.isArray(value)?value.filter((item):item is string=>typeof item==='string'):[]; }
export function toggleSaved(id:string):string[]{const old=readSaved();const next=old.includes(id)?old.filter(item=>item!==id):old.concat(id);uni.setStorageSync('lf-preview-saved',next);return next;}
export function copyText(text:string):Promise<void>{return new Promise((resolve,reject)=>uni.setClipboardData({data:text,success:()=>resolve(),fail:reject}));}
export function notify(title:string){uni.showToast({title,icon:'none',duration:2600});}
// 浏览器没有通用 Wi-Fi 接入 API；真实连接能力由小程序/App 适配器单独实现。

export function readFeedback(id:string):import('../domain/place').Feedback {const v=uni.getStorageSync('flowseat-feedback-'+id);return v&&Array.isArray(v.visits)&&Array.isArray(v.helpful)?v:{visits:[],helpful:[]};}
export function writeFeedback(id:string,value:import('../domain/place').Feedback){uni.setStorageSync('flowseat-feedback-'+id,value);}
export function placeLink(id:string):string {
  // #ifdef H5
  return window.location.href.split('#')[0]+'#/pages/index/index?id='+encodeURIComponent(id);
  // #endif
  // #ifndef H5
  return '/pages/index/index?id='+encodeURIComponent(id);
  // #endif
}

export async function openMenu(url:string){
 if(!/^https:\/\//i.test(url)){notify('菜单链接暂不可用');return;}
 // #ifdef H5
 window.open(url,'_blank','noopener,noreferrer');return;
 // #endif
 // #ifndef H5
 await copyText(url);notify('已复制链接，请在浏览器打开');
 // #endif
}

export function openLocation(place:import('../domain/place').Place){
 if(place.demo){notify('演示地点没有实际地址');return;}
 return openMenu(amapLocationLink(place));
}
