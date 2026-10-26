export type FieldEvidence={kind:'official'|'merchant'|'visit'|'public';url:string;date:string;note:string};
export const evidenceKinds={official:'官方资料',merchant:'商家自述',visit:'到访体验',public:'公开线索'};
export const coreFields=[{key:'laptopFriendly',label:'电脑办公许可'},{key:'deskFits',label:'桌面条件'},{key:'cost',label:'费用规则'},{key:'hours',label:'开放时间'}] as const;
export function evidenceFresh(date:string,now=Date.now()){const at=Date.parse(date+'T00:00:00+08:00');return Number.isFinite(at)&&at<=now&&now-at<=30*86400000;}
export type CostKind = 'free' | 'purchase' | 'paid' | 'unknown';
export type Zone = 'quiet' | 'discussion' | 'booth';
export type PlaceLocation = {lng:number;lat:number;system:'GCJ-02'};
export type Place = { id: string; name: string; type: string; district: string; cost: CostKind; price: string; plugs: string; charging: string; chair: string; chairNote: string; zones: Zone[]; wifi: boolean | null; hours: string; entry: string; stay: string; extras: string[]; x: number; y: number; drawing: number; demo:boolean;merchant?:{date:string;contact:string;note:string;fields:string[];reviewId:string};observations?:Record<string,{value:string|boolean|string[];date:string;note:string;sourceUrl:string;reviewId:string}>;discovery?:boolean;researchFacts?:{field:string;value:string;status:string;url:string;publishedAt:string;checkedAt:string;scope:string}[];leadSources?:{url:string;note:string;checkedAt:string;kind:string}[];poiSource?:string;poiId?:string;address?:string;budget?:string;basis?:string;sourceUrl?:string;sourceDate?:string;menuUrl?:string;contributor?:string;laptopFriendly?:boolean;deskFits?:boolean;evidence?:Partial<Record<'laptopFriendly'|'deskFits'|'cost'|'hours',FieldEvidence>>;confirmations?:Partial<Record<'laptopFriendly'|'deskFits'|'cost'|'hours',{kind:'visit';date:string;note:string;reviewId:string}>>;publicationIssues?:string[];reviewStatus?:string;note?:string;updatedAt?:number;location?:PlaceLocation;seat?:{status:SeatStatus;at:number} };
export const costLabels: Record<CostKind,string> = { free:'免费', purchase:'需消费', paid:'付费工位',unknown:'费用待确认' };
export const zoneLabels: Record<Zone,string> = { quiet:'安静工作', discussion:'多人讨论', booth:'独立通话' };
// 全部为虚构演示，不可导入真实地点库。
export const demoPlaces: Place[] = [
{id:'demo-common',name:'The Common Room',type:'咖啡馆',district:'静安',cost:'purchase',price:'饮品消费后可用',plugs:'6—10 个',charging:'部分座位可充电',chair:'舒适',chairNote:'软垫与靠背',zones:['quiet','discussion'],wifi:true,hours:'09:00—20:00',entry:'直接进入',stay:'停留规则待确认',extras:['场内卫生间','付费饮品','空调'],x:30,y:32,drawing:1,demo:true},
{id:'demo-corner',name:'A Quiet Corner',type:'公共空间',district:'徐汇',cost:'free',price:'无需消费',plugs:'1—5 个',charging:'插座位较少',chair:'硬座',chairNote:'木质座椅，有靠背',zones:['quiet'],wifi:null,hours:'10:00—18:00',entry:'进入条件待确认',stay:'活动期间可能暂停',extras:['卫生间','饮水','空调'],x:43,y:65,drawing:2,demo:true},
{id:'demo-club',name:'Work / Club',type:'联合办公',district:'黄浦',cost:'paid',price:'按日购买工位',plugs:'10 个以上',charging:'多数座位可充电',chair:'超舒适',chairNote:'可调办公椅，体验因人而异',zones:['quiet','discussion','booth'],wifi:true,hours:'09:00—19:00',entry:'预约进入',stay:'按所购权益使用',extras:['会议室另付费','饮水','打印另付费'],x:64,y:46,drawing:3,demo:true},
{id:'demo-study',name:'North Study',type:'自习室',district:'长宁',cost:'paid',price:'按小时使用',plugs:'10 个以上',charging:'多数座位可充电',chair:'舒适',chairNote:'带软垫的办公椅',zones:['quiet'],wifi:true,hours:'08:00—22:00',entry:'预约进入',stay:'按所购时长使用',extras:['卫生间','饮水','空调'],x:18,y:57,drawing:4,demo:true}
];

export type SeatStatus = 'available' | 'busy' | 'full';
export const seatLabels: Record<SeatStatus,string> = {available:'有空位',busy:'空位较少',full:'已坐满'};
export type Visit = {id:string;date:string;period:string;text:string;spend:string;authorName?:string;own?:boolean;pending?:boolean;helps?:number};
export type Feedback = {seat?:{status:SeatStatus;at:number};visits:Visit[];helpful:string[];report?:{reason:string;date:string;detail:string}};
export function freshSeat(seat:Feedback['seat'],now=Date.now()) {return seat && now>=seat.at && now-seat.at<60*60*1000 ? seat : undefined;}
export const practical:Record<string,{budget:string;basis:string;menuUrl?:string;menuUpdatedAt?:string;menu:{name:string;price:string}[]}>={
'demo-common':{budget:'¥28–45',basis:'1 人 · 约 2 小时 · 1 杯饮品；非最低消费承诺',menu:[{name:'美式咖啡',price:'¥28'},{name:'拿铁',price:'¥35'},{name:'茶饮',price:'¥32'},{name:'可颂',price:'¥22'}]},
'demo-corner':{budget:'¥0',basis:'空间使用免费；进入条件仍需确认',menu:[]},
'demo-club':{budget:'¥98 / 天',basis:'1 人日票示例；会议室与打印另计',menu:[{name:'开放工位 · 日票',price:'¥98'},{name:'会议室 · 小时',price:'¥80'}]},
'demo-study':{budget:'¥30 / 2 小时',basis:'示例时价 ¥15；饮品另计',menu:[{name:'安静区工位 · 小时',price:'¥15'},{name:'全天工位',price:'¥68'}]}
};

export function wifiLabel(value:boolean|null){return value===true?'有 Wi-Fi':value===false?'无 Wi-Fi':'Wi-Fi 待确认';}
export function matchesSearch(p:Pick<Place,'name'|'type'|'district'|'address'>,query:string){
 const normalize=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/\s+/g,'');
 const haystack=normalize([p.name,p.type,p.district,p.address||''].join(' '));
 return query.trim().split(/\s+/).every(term=>haystack.includes(normalize(term)));
}
export function amapLocationLink(p:Pick<Place,'name'|'address'|'location'>){
 if(p.location){const {lng,lat}=p.location;return 'https://uri.amap.com/marker?position='+lng+','+lat+'&name='+encodeURIComponent(p.name)+'&coordinate=gaode&src=flowseat&callnative=0';}
 return 'https://uri.amap.com/search?keyword='+encodeURIComponent(p.name+' '+(p.address||''))+'&city=310000&src=flowseat&callnative=0';
}
