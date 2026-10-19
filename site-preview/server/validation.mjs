export class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
export const fail=(status,message)=>{throw new ApiError(status,message);};
export function text(value,min=1,max=500){if(typeof value!=='string'||value.trim().length<min||value.trim().length>max)fail(400,`请填写 ${min}–${max} 字的有效内容`);return value.trim();}
export function url(value,optional=false){if(optional&&!value)return '';let u;try{u=new URL(value);}catch{fail(400,'请填写完整的 HTTPS 公开来源链接');}if(u.protocol!=='https:'||u.username||u.password||u.hostname==='localhost'||u.hostname.endsWith('.local')||/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)||u.hostname.includes(':'))fail(400,'仅支持公开网站的 HTTPS 链接');return u.href;}
export function sourceKey(value){const u=new URL(url(value));const ids=['id','note_id','docId','aid','v'].filter(k=>u.searchParams.has(k)).sort().map(k=>k+'='+u.searchParams.get(k)).join('&');return u.hostname.toLowerCase()+u.pathname.replace(/\/+$/,'')+(ids?'?'+ids:'');}
export const fingerprint=(name,address)=>(name+'|'+address).normalize('NFKC').toLowerCase().replace(/[\s，,。·.（）()\-_]/g,'');
export function location(value){
 if(value==null)return undefined;
 if(typeof value!=='object'||Array.isArray(value)||value.system!=='GCJ-02'||typeof value.lng!=='number'||typeof value.lat!=='number'||!Number.isFinite(value.lng)||!Number.isFinite(value.lat)||value.lng<120.8||value.lng>122.3||value.lat<30.6||value.lat>31.9)fail(400,'请填写上海区域内的 GCJ-02 经纬度；不知道可留空');
 return {lng:Number(value.lng.toFixed(6)),lat:Number(value.lat.toFixed(6)),system:'GCJ-02'};
}
export function date(value){const v=text(value,10,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v||v>new Date(Date.now()+8*3600000).toISOString().slice(0,10))fail(400,'请选择有效的到访日期，不能填写未来日期');return v;}
export function one(value,values){if(!values.includes(value))fail(400,'请选择有效选项');return value;}
export function placeInput(b){
 const p={name:text(b.name,2,70),address:text(b.address,5,160),district:one(b.district,['静安','徐汇','黄浦','长宁','浦东','普陀','虹口','杨浦','闵行','宝山','嘉定','松江','青浦','奉贤','金山','崇明']),type:one(b.type,['咖啡馆','公共空间','联合办公','自习室','图书馆','其他']),cost:one(b.cost,['free','purchase','paid','unknown']),budget:text(b.budget||'费用待确认',1,70),basis:text(b.basis||'请以场地方最新规则为准',1,200),sourceUrl:url(b.sourceUrl),sourceDate:date(b.sourceDate),menuUrl:url(b.menuUrl,true),plugs:one(b.plugs||'待确认',['待确认','1—5 个','6—10 个','10 个以上']),charging:text(b.charging||'插座可达性待确认',1,90),chair:one(b.chair||'待确认',['待确认','硬座','舒适','超舒适']),chairNote:text(b.chairNote||'尚无到访体验',1,100),wifi:typeof b.wifi==='boolean'?b.wifi:null,hours:text(b.hours||'开放时间待确认',1,100),entry:text(b.entry||'进入方式待确认',1,160),stay:text(b.stay||'停留规则待确认',1,160),laptopFriendly:b.laptopFriendly===true,deskFits:b.deskFits===true,zones:Array.isArray(b.zones)?[...new Set(b.zones.filter(z=>['quiet','discussion','booth'].includes(z)))]:[],extras:[],drawing:one(b.type,['咖啡馆','公共空间','联合办公','自习室','图书馆','其他'])==='咖啡馆'?1:3,demo:false};
 if(b.cost==='free'&&b.budget&&!/^([¥￥]?0|免费|无需消费)$/.test(b.budget.trim()))fail(400,'免费地点的空间使用费用应为 0；其他消费请写入费用说明');
 const point=location(b.location);if(point)p.location=point;
 return p;
}
export function visitInput(b){return {date:date(b.date),period:one(b.period,['上午','下午','晚间']),text:text(b.text,5,600),spend:b.spend===''||b.spend==null?'':(()=>{const n=Number(b.spend);if(!Number.isFinite(n)||n<0||n>100000)fail(400,'请填写有效消费金额');return n.toFixed(2);})()};}
