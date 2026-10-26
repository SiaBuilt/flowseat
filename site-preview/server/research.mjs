import records from '../data/shanghai-research-20261026.json' with {type:'json'};
const hours={
 'tencent-3299611627541318899':'周一至周四、周六日9:00–21:00；周五12:30–21:00（馆方官网）',
 'tencent-16899764175500191690':'8:30–20:30，周末开放（品牌官网，海粟店）',
 'tencent-7356209017016184253':'综合馆1楼24小时、2楼9:00–21:00；周一8:00–13:00全馆闭馆（政府公告）'
};
export function withResearch(place){
 const facts=records[place.id];if(!facts)return place;
 const result={...place,researchFacts:facts};
 if(hours[place.id]&&(!place.hours||place.hours==='开放时间待确认')&&!place.observations?.hours&&!place.merchant?.fields?.includes('hours'))result.hours=hours[place.id];
 return result;
}
