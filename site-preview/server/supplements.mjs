import {one,text,date,url,fail} from './validation.mjs';
export const supplementLabels={plugs:'插座数量',chair:'座椅舒适度',wifi:'Wi-Fi',laptopFriendly:'电脑办公许可',deskFits:'桌面条件',hours:'开放时间',entry:'进入方式'};
export function supplementInput(b){
 const field=one(b.field,Object.keys(supplementLabels));let value=b.value;
 if(field==='plugs')value=one(value,['0 个','1—5 个','6—10 个','10 个以上']);
 else if(field==='chair')value=one(value,['硬座','舒适','超舒适']);
 else if(['wifi','laptopFriendly','deskFits'].includes(field)){if(typeof value!=='boolean')fail(400,'请选择明确的现场情况');}
 else value=text(value,2,100);
 return {kind:'supplement',field,value,date:date(b.date),text:text(b.text,5,240),sourceUrl:url(b.sourceUrl,true),period:'信息补充',spend:''};
}
