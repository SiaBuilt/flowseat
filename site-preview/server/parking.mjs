import {fail,location as validateLocation} from './validation.mjs';
const cache=new Map();
export function distanceMeters(a,b){const rad=x=>x*Math.PI/180;const dlat=rad(b.lat-a.lat),dlng=rad(b.lng-a.lng);const h=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlng/2)**2;return Math.round(6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h))));}
export async function nearbyParking(point,{key=''}={},fetcher=fetch){
 if(!point)return {state:'no-location',items:[]};
 validateLocation(point);
 if(!key)return {state:'unconfigured',items:[]};
 const cacheKey=point.lat+','+point.lng;
 const old=cache.get(cacheKey);if(old&&old.until>Date.now())return old.value;
 const target=new URL('https://apis.map.qq.com/ws/place/v1/search');
 target.search=new URLSearchParams({key,keyword:'停车场',boundary:`nearby(${point.lat},${point.lng},500)`,page_size:'5',orderby:'_distance'}).toString();
 let data;try{const res=await fetcher(target,{signal:AbortSignal.timeout(8000),redirect:'error'});if(!res.ok)throw new Error();data=await res.json();}catch{fail(502,'附近停车信息暂不可用，请稍后重试');}
 if(data.status!==0||!Array.isArray(data.data))fail(502,'附近停车信息暂不可用，请稍后重试');
 const ids=new Set();const items=[];
 for(const row of data.data.slice(0,5)){
  if(!row.id||ids.has(row.id)||!row.title||!Number.isFinite(row.location?.lat)||!Number.isFinite(row.location?.lng))continue;
  ids.add(row.id);const internal=/内部|专用/.test(row.title);
  items.push({id:String(row.id),name:String(row.title),address:String(row.address||''),location:{lat:row.location.lat,lng:row.location.lng,system:'GCJ-02'},distanceMeters:distanceMeters(point,row.location),access:internal?'internal':'unknown',tariff:'待确认',vacancy:'未知',entrance:'待确认',source:'腾讯位置服务',status:'candidate'});
 }
 const value={state:'ready',fetchedAt:Date.now(),items};
 if(cache.size>=100)cache.delete(cache.keys().next().value);
 cache.set(cacheKey,{until:Date.now()+5*60000,value});return value;
}
