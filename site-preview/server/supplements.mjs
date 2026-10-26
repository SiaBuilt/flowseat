import {one,text,date,url,fail} from './validation.mjs';
export const supplementLabels={zones:'工作分区',plugs:'插座数量',chair:'座椅舒适度',wifi:'Wi-Fi',laptopFriendly:'电脑办公许可',deskFits:'桌面条件',hours:'开放时间',entry:'进入方式',cost:'费用类型',budget:'消费预算',stay:'停留规则',menuUrl:'菜单或价目链接'};
export function supplementInput(b){
 const field=one(b.field,Object.keys(supplementLabels));let value=b.value;
 if(field==='zones'){if(!Array.isArray(value)||value.length>3||value.some(v=>!['quiet','discussion','booth'].includes(v)))fail(400,'请选择有效的工作分区');value=[...new Set(value)].sort();}
 else if(field==='cost')value=one(value,['free','purchase','paid']);
 else if(field==='menuUrl')value=url(value);
 else if(field==='budget')value=text(value,2,70);
 else if(field==='stay'||field==='entry')value=text(value,2,160);
 else if(field==='plugs')value=one(value,['0 个','1—5 个','6—10 个','10 个以上']);
 else if(field==='chair')value=one(value,['硬座','舒适','超舒适']);
 else if(['wifi','laptopFriendly','deskFits'].includes(field)){if(typeof value!=='boolean')fail(400,'请选择明确的现场情况');}
 else value=text(value,2,100);
 return {kind:'supplement',field,value,date:date(b.date),text:text(b.text,5,240),sourceUrl:url(b.sourceUrl,true),period:'信息补充',spend:''};
}
