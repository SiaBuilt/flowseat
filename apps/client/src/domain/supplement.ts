export const supplementLabels:Record<string,string>={plugs:'插座数量',chair:'座椅舒适度',wifi:'Wi-Fi',laptopFriendly:'电脑办公许可',deskFits:'桌面条件',hours:'开放时间',entry:'进入方式'};
export function supplementValue(value:unknown){return value===true?'是':value===false?'否':value==null?'待确认':String(value);}
export const supplementOptions:Record<string,{value:string|boolean;label:string}[]>={
 plugs:['0 个','1—5 个','6—10 个','10 个以上'].map(value=>({value,label:value})),
 chair:['硬座','舒适','超舒适'].map(value=>({value,label:value})),
 wifi:[{value:true,label:'提供 Wi-Fi'},{value:false,label:'不提供'}],
 laptopFriendly:[{value:true,label:'允许电脑办公'},{value:false,label:'不允许'}],
 deskFits:[{value:true,label:'电脑和鼠标放得下'},{value:false,label:'放不下'}]
};
