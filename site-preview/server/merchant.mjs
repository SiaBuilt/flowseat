import {one,text,fail} from './validation.mjs';
// 商家确认链接：审核员生成一次性链接，商家免登录确认或更正，提交后进入审核队列，通过后作为「商家自述」依据。
export const merchantLabels={laptopFriendly:'电脑办公许可',deskFits:'桌面条件',cost:'费用规则',hours:'开放时间',entry:'进入方式',wifi:'Wi-Fi',plugs:'插座数量'};
export const merchantFields=Object.keys(merchantLabels);
export const linkDays=14;
const costs=['free','purchase','paid'];
export function merchantFieldsInput(value){
 if(value==null)return merchantFields;
 if(!Array.isArray(value))fail(400,'请选择需要商家确认的信息项');
 const picked=[...new Set(value)];if(!picked.length)fail(400,'至少选择一项');for(const f of picked)one(f,merchantFields);return picked;
}
function answer(field,value,budget){
 if(['laptopFriendly','deskFits','wifi'].includes(field)){if(typeof value!=='boolean')fail(400,merchantLabels[field]+'请选择是或否');return {value};}
 if(field==='plugs')return {value:one(value,['0 个','1—5 个','6—10 个','10 个以上'])};
 if(field==='cost'){const cost=one(value,costs),b=text(budget,1,70);if(cost==='free'&&!/^([¥￥]?0|免费|无需消费)$/.test(b))fail(400,'免费地点的空间使用费用应为 0；其他消费请写入费用说明');return {value:cost,budget:b};}
 const v=text(value,2,100);if(/待确认|未知|不详/.test(v))fail(400,merchantLabels[field]+'请填写明确内容');return {value:v};
}
export function merchantInput(b,allowed){
 if(!b.answers||typeof b.answers!=='object'||Array.isArray(b.answers))fail(400,'请至少确认一项信息');
 const answers={};
 for(const [field,value] of Object.entries(b.answers)){if(field==='budget'||value===''||value==null)continue;if(!allowed.includes(field))fail(400,'该链接不包含此信息项');answers[field]=answer(field,value,b.answers.budget);}
 if(!Object.keys(answers).length)fail(400,'请至少确认一项信息');
 return {answers,contact:text(b.contact,2,40),note:b.note?text(b.note,2,240):''};
}
export function newToken(){const bytes=crypto.getRandomValues(new Uint8Array(24));return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export async function hashToken(token){if(typeof token!=='string'||!/^[A-Za-z0-9_-]{32}$/.test(token))fail(404,'链接无效或已过期');const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');}
// 依据只记录商家身份与日期，不当作独立实测；字段原值保留在 previous 里用于冲突判断。
export function applyMerchant(payload,v,reviewId){
 const next={...payload,evidence:{...payload.evidence},confirmations:{...payload.confirmations}};
 for(const [field,a] of Object.entries(v.answers)){
  next[field]=a.value;if(field==='cost')next.budget=a.budget;
  if(['laptopFriendly','deskFits','cost','hours'].includes(field)){next.evidence[field]={kind:'merchant',url:'',date:v.date,note:'商家确认（'+v.contact+'）'+(v.text?'：'+v.text:'')};delete next.confirmations[field];}
 }
 next.merchant={date:v.date,contact:v.contact,note:v.text,fields:Object.keys(v.answers),reviewId};
 return next;
}
export function merchantConflict(payload,v){return Object.keys(v.answers).some(field=>JSON.stringify(payload[field]??null)!==JSON.stringify(v.previous?.[field]??null)||(field==='cost'&&JSON.stringify(payload.budget??null)!==JSON.stringify(v.previous?.budget??null)));}
