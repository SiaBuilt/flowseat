// 与服务端 merchant.mjs 字段一致；商家自述审核后展示，不等于独立实测。
export const merchantLabels:Record<string,string>={laptopFriendly:'电脑办公许可',deskFits:'桌面条件',cost:'费用规则',hours:'开放时间',entry:'进入方式',wifi:'Wi-Fi',plugs:'插座数量'};
export const merchantCostLabels:Record<string,string>={free:'免费',purchase:'需消费',paid:'付费工位',unknown:'待确认'};
export function merchantValue(field:string,value:unknown){if(field==='cost')return merchantCostLabels[String(value)]||'待确认';return value===true?'是':value===false?'否':value==null||value===''?'待确认':String(value);}
export type MerchantStatement={date:string;contact:string;note:string;fields:string[];reviewId:string};
