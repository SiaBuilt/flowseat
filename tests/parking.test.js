const {test}=require('node:test');
const assert=require('node:assert/strict');
const ready=import('../site-preview/server/parking.mjs');
test('停车候选去重，内部不标可停，距离与实时信息不混淆',async()=>{
 const {nearbyParking}=await ready;const p={lat:31.23,lng:121.47,system:'GCJ-02'};let calls=0;
 const fetcher=async u=>{calls++;assert.equal(u.hostname,'apis.map.qq.com');assert.equal(u.searchParams.get('page_size'),'5');return Response.json({status:0,data:[{id:'a',title:'测试内部停车场',address:'测试路',location:{lat:31.231,lng:121.47}},{id:'a',title:'重复',location:{lat:31.231,lng:121.47}},{id:'b',title:'停车场',location:{lat:31.23,lng:121.471}},{id:'bad',title:'无坐标'}]});};
 const r=await nearbyParking(p,{key:'test'},fetcher);assert.equal(r.items.length,2);assert.equal(r.items[0].access,'internal');assert.equal(r.items[1].access,'unknown');assert.equal(r.items[0].distanceMeters,111);assert.equal(r.items[0].vacancy,'未知');assert.equal(r.items[0].tariff,'待确认');assert.equal(r.items[0].entrance,'待确认');
 await nearbyParking(p,{key:'test'},fetcher);assert.equal(calls,1);
 assert.equal((await nearbyParking(undefined,{key:'test'},fetcher)).state,'no-location');
 assert.equal((await nearbyParking(p,{},fetcher)).state,'unconfigured');
});
test('供应商失败不当成零停车场，也不把供应商鉴权详情输出',async()=>{
 const {nearbyParking}=await ready;const p={lat:31.24,lng:121.49,system:'GCJ-02'};
 await assert.rejects(nearbyParking(p,{key:'test'},async()=>Response.json({status:110,message:'secret'})),e=>e.status===502&&!e.message.includes('secret'));
 await assert.rejects(nearbyParking({...p,lat:39.9},{key:'test'}),e=>e.status===400);
});

test('停车查询兼容 Workers 且不跟随供应商重定向',async()=>{const {nearbyParking}=await ready;let calls=0;await assert.rejects(nearbyParking({lat:31.235,lng:121.475,system:'GCJ-02'},{key:'test'},async(_url,options)=>{calls++;assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://other.example/collect'}});}),e=>e.status===502);assert.equal(calls,1);});
