const {test}=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {readFileSync,existsSync}=require('node:fs');
const {pathToFileURL}=require('node:url');
const {resolve}=require('node:path');
const prefix=existsSync('server/api.mjs')?'':'site-preview/';
let api;
const discoveryReady=import(pathToFileURL(resolve(prefix+'server/discovery.mjs')).href);
const ready=import(pathToFileURL(resolve(prefix+'server/api.mjs')).href).then(m=>api=m.handle);
function database(){const raw=new DatabaseSync(':memory:');raw.exec(readFileSync(prefix+'drizzle/0000_mixed_talkback.sql','utf8'));raw.exec(readFileSync(prefix+'drizzle/0002_merchant_links.sql','utf8'));return{exec(sql){raw.exec(sql);},prepare(sql){return{bind(...args){const p=raw.prepare(sql);return{first:async()=>p.get(...args)||null,all:async()=>({results:p.all(...args)}),run:async()=>p.run(...args),execute:()=>p.run(...args)}}}},async batch(items){raw.exec('BEGIN');try{const result=items.map(p=>p.execute());raw.exec('COMMIT');return result;}catch(e){raw.exec('ROLLBACK');throw e;}}};}
const today=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
const place=()=>({name:'测试工作空间',address:'上海市静安区测试路 123 号',district:'静安',type:'咖啡馆',cost:'purchase',budget:'¥30',basis:'一杯饮品',sourceUrl:'https://merchant.example/place',sourceDate:today(),laptopFriendly:true,deskFits:true,hours:'09:00—18:00',entry:'直接进入',evidence:Object.fromEntries(['laptopFriendly','deskFits','cost','hours'].map(f=>[f,{kind:'official',url:'https://merchant.example/place',date:today(),note:'已逐项核对具体规则'}]))});
async function setup(){await ready;const db=database();const call=async(path,method='GET',body,uid='a',origin='https://flowseat.example')=>{const headers={'Content-Type':'application/json',Origin:origin};if(uid)headers['oai-authenticated-user-id']=uid;const r=await api(new Request('https://flowseat.example/api/'+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})}),{db,seedDiscovery:false,reviewerIds:'owner'});return{...await r.json(),status:r.status};};for(const id of ['a','b','owner'])assert.equal((await call('me','PUT',{displayName:'用户'+id},id)).status,200);return{db,call};}
async function published(call){const p=await call('submissions','POST',place());assert.equal(p.status,201);const r=await call('review/place/'+p.id,'POST',{action:'approve',note:'已核对公开来源与两项办公门槛'},'owner');assert.equal(r.status,200);return p.id;}
test('真实接口默认拒绝匿名写入、前端伪造审核角色和跨站写入',async()=>{const{call}=await setup();assert.equal((await call('submissions','POST',place(),'')).status,401);assert.equal((await call('review-queue','GET',undefined,'a')).status,403);assert.equal((await call('me','PUT',{displayName:'测试用户',canReview:true},'a','https://evil.example')).status,403);assert.equal((await call('me','PUT',{displayName:'测试用户',canReview:true},'a')).status,200);assert.equal((await call('me','GET',undefined,'a')).user.canReview,false);});
test('投稿审核前不公开，拒绝重复门店和未确认电脑门槛',async()=>{const{call}=await setup();const p=await call('submissions','POST',{...place(),deskFits:false});assert.equal(p.status,201);assert.deepEqual((await call('places')).places,[]);assert.equal((await call('review/place/'+p.id,'POST',{action:'approve',note:'尝试绕过条件'},'owner')).status,400);assert.equal((await call('submissions','POST',place())).status,409);assert.equal((await call('submissions/'+p.id,'PUT',place(),'b')).status,404);assert.equal((await call('submissions/'+p.id,'PUT',place(),'a')).status,200);assert.equal((await call('review/place/'+p.id,'POST',{action:'approve',note:'两项条件已核对'},'owner')).status,200);assert.equal((await call('places')).places.length,1);});
test('收藏按账号隔离，隐藏后旧链接和收藏均不泄露地点',async()=>{const{call}=await setup(),id=await published(call);assert.equal((await call('saved/'+id,'PUT',{saved:true},'a')).status,200);assert.deepEqual((await call('saved','GET',undefined,'b')).ids,[]);await call('review/place/'+id,'POST',{action:'hide',note:'等待进一步核对'},'owner');assert.equal((await call('places/'+id)).status,404);assert.deepEqual((await call('saved','GET',undefined,'a')).ids,[]);});
test('坐满不会闭店，空位使用服务端时间并自动过期',async()=>{const{call,db}=await setup(),id=await published(call);await call('places/'+id+'/seats','POST',{status:'full',at:9999999999999});assert.equal((await call('places/'+id)).status,200);const c=await call('places/'+id+'/community');assert.equal(c.seat.status,'full');assert.ok(c.seat.at<9999999999999);await db.prepare('UPDATE seats SET at=?').bind(Date.now()-3600001).run();assert.equal((await call('places/'+id+'/community')).seat,null);});
test('体验需审核，不能自赞，其他账号的有帮助去重',async()=>{const{call}=await setup(),id=await published(call);const r=await call('places/'+id+'/reviews','POST',{date:today(),period:'下午',text:'插座好找，椅子舒适，环境安静。',spend:35});assert.equal(r.status,201);assert.equal((await call('places/'+id+'/community','GET',undefined,'b')).visits.length,0);await call('review/review/'+r.id,'POST',{action:'approve',note:'内容符合到访体验要求'},'owner');assert.equal((await call('reviews/'+r.id+'/helpful','PUT',{active:true},'a')).status,400);await call('reviews/'+r.id+'/helpful','PUT',{active:true},'b');await call('reviews/'+r.id+'/helpful','PUT',{active:true},'b');assert.equal((await call('places/'+id+'/community')).visits[0].helps,1);});
test('闭店需要两位用户且来源去重；恢复会清除旧有效反馈',async()=>{const{call}=await setup(),id=await published(call);const report=sourceUrl=>({kind:'closed',reason:'怀疑永久闭店',date:today(),detail:'现场发布了停止营业通知，需要核对。',sourceUrl});await call('places/'+id+'/report','PUT',report('https://merchant.example/notice?share=1'),'a');await call('places/'+id+'/report','PUT',report('https://merchant.example/notice?share=2'),'a');assert.equal((await call('places/'+id)).status,200);await call('places/'+id+'/report','PUT',report('https://merchant.example/notice?share=3'),'b');assert.equal((await call('places/'+id)).status,200);await call('places/'+id+'/report','PUT',report('https://other.example/closure'),'b');assert.equal((await call('places/'+id)).status,404);await call('review/place/'+id,'POST',{action:'restore',note:'核对到新的恢复营业证据'},'owner');assert.equal((await call('places/'+id+'/community')).closureReports,0);await call('places/'+id+'/report','PUT',report('https://merchant.example/new-notice'),'a');assert.equal((await call('places/'+id)).status,200);});
test('日期、链接与费用未知条件不会被误录为已确认',async()=>{const{call}=await setup();assert.equal((await call('submissions','POST',{...place(),sourceUrl:'javascript:alert(1)'})).status,400);assert.equal((await call('submissions','POST',{...place(),sourceDate:'2026-02-30'})).status,400);assert.equal((await call('submissions','POST',{...place(),cost:'free',budget:'¥35'})).status,400);});

test('公开线索导入仅审核员可用、保持待审核并按资料整理署名',async()=>{const{call,db}=await setup();assert.equal((await call('seed-candidates','POST',{},'a')).status,403);await db.prepare('DELETE FROM profiles WHERE uid=?').bind('owner').run();const r=await call('seed-candidates','POST',{},'owner');assert.equal(r.status,200);assert.equal(r.inserted,6);assert.deepEqual((await call('places')).places,[]);const queue=await call('review-queue','GET',undefined,'owner');assert.equal(queue.places.length,6);assert.ok(queue.places.every(p=>p.contributor==='FlowSeat 资料整理'));assert.equal((await call('seed-candidates','POST',{},'owner')).inserted,0);});

test('列表同步最新一小时空位，排除过期和未来数据',async()=>{
 const{call,db}=await setup(),id=await published(call);
 await call('places/'+id+'/seats','POST',{status:'busy'},'a');
 assert.equal((await call('places')).places[0].seat.status,'busy');
 await db.prepare('UPDATE seats SET at=?').bind(Date.now()-3600001).run();
 assert.equal((await call('places')).places[0].seat,undefined);
 await db.prepare('UPDATE seats SET at=?').bind(Date.now()+60000).run();
 assert.equal((await call('places')).places[0].seat,undefined);
 await call('places/'+id+'/seats','POST',{status:'full'},'b');
 assert.equal((await call('places')).places[0].seat.status,'full');
});
test('地点坐标需要上海 GCJ-02，提交和审核保留坐标',async()=>{
 const{call}=await setup();
 for(const location of [{lng:121.47,lat:null,system:'GCJ-02'},{lng:'121.47',lat:31.23,system:'GCJ-02'},{lng:121.47,lat:31.23,system:'WGS84'},{lng:116.4,lat:39.9,system:'GCJ-02'}])assert.equal((await call('submissions','POST',{...place(),location})).status,400);
 const r=await call('submissions','POST',{...place(),location:{lng:121.4701234,lat:31.2305678,system:'GCJ-02'}});
 assert.equal(r.status,201);assert.equal((await call('places')).places.length,0);
 const pending=(await call('review-queue','GET',undefined,'owner')).places.find(p=>p.id===r.id);
 assert.deepEqual(pending.location,{lng:121.470123,lat:31.230568,system:'GCJ-02'});
 await call('review/place/'+r.id,'POST',{action:'approve',note:'来源及地图坐标已核对'},'owner');
 assert.deepEqual((await call('places/'+r.id)).place.location,pending.location);
});
test('公开候选迁移可重复执行，不改动已有审核结果或重复导入',async()=>{
 const{call,db}=await setup();await call('seed-candidates','POST',{},'owner');
 const before=(await call('review-queue','GET',undefined,'owner')).places;
 const id=before[0].id;await call('review/place/'+id,'POST',{action:'reject',note:'保留本次退回结果'},'owner');
 const migration=readFileSync(prefix+'drizzle/0001_public_candidates.sql','utf8');db.exec(migration);db.exec(migration);
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM places').bind().first()).n,6);
 assert.equal((await db.prepare('SELECT status FROM places WHERE id=?').bind(id).first()).status,'rejected');
 assert.deepEqual((await call('places')).places,[]);
});
test('空库迁移六条线索全部待审核，旧咖啡馆线索不自动通过',async()=>{
 const{call,db}=await setup();db.exec(readFileSync(prefix+'drizzle/0001_public_candidates.sql','utf8'));
 const queue=await call('review-queue','GET',undefined,'owner');assert.equal(queue.places.length,6);
 assert.ok(queue.places.every(p=>p.reviewStatus==='pending'&&p.contributor==='FlowSeat 资料整理'));
 const cafes=queue.places.filter(p=>p.type==='咖啡馆');assert.equal(cafes.length,2);
 for(const p of cafes)assert.equal((await call('review/place/'+p.id,'POST',{action:'approve',note:'试图直接发布历史线索'},'owner')).status,400);
 assert.deepEqual((await call('places')).places,[]);
});

test('上架和恢复必须具备近期逐项证据与费用时间进入条件',async()=>{
 const {call}=await setup();const input=place();delete input.evidence;
 const r=await call('submissions','POST',input);
 assert.equal((await call('review/place/'+r.id,'POST',{action:'approve',note:'尚无逐项依据'},'owner')).status,400);
 const queue=await call('review-queue','GET',undefined,'owner');assert.ok(queue.places[0].publicationIssues.some(x=>x.includes('逐项依据')));
 for(const patch of [{cost:'unknown'},{hours:'开放时间待确认'},{entry:'进入方式待确认'},{evidence:Object.fromEntries(Object.entries(place().evidence).map(([k,v])=>[k,{...v,date:'2020-01-01'}]))}]){
  assert.equal((await call('submissions/'+r.id,'PUT',{...place(),...patch})).status,200);
  assert.equal((await call('review/place/'+r.id,'POST',{action:'approve',note:'不能绕过核实'},'owner')).status,400);
 }
 assert.equal((await call('submissions/'+r.id,'PUT',place())).status,200);
 assert.equal((await call('review/place/'+r.id,'POST',{action:'approve',note:'逐项核对完成'},'owner')).status,200);
 assert.equal((await call('places/'+r.id)).place.evidence.cost.kind,'official');
 assert.equal((await call('places/'+r.id+'/parking')).state,'no-location');
 await call('review/place/'+r.id,'POST',{action:'hide',note:'需要重新核对'},'owner');
 assert.equal((await call('places/'+r.id+'/parking')).status,404);
});
test('证据白名单与零插座支持，不接受伪造审核状态',async()=>{
 const {call}=await setup();let p=place();p.evidence.cost.kind='verified';assert.equal((await call('submissions','POST',p)).status,400);
 p=place();p.plugs='0 个';p.evidence.cost.reviewed=true;
 const r=await call('submissions','POST',p);assert.equal(r.status,201);
 const q=await call('review-queue','GET',undefined,'owner');assert.equal(q.places[0].plugs,'0 个');assert.equal(q.places[0].evidence.cost.reviewed,undefined);
});

const daysAgo=n=>new Date(Date.now()+8*3600000-n*86400000).toISOString().slice(0,10);
test('到访核对先审核，保留原始依据与字段值，每人每天一次',async()=>{
 const {db,call}=await setup();const input=place();
 for(const key of Object.keys(input.evidence))input.evidence[key]={...input.evidence[key],date:daysAgo(10)};
 const p=await call('submissions','POST',input);assert.equal(p.status,201);
 assert.equal((await call('review/place/'+p.id,'POST',{action:'approve',note:'已核对来源与两项门槛'},'owner')).status,200);
 const before=(await call('places/'+p.id)).place;
 assert.equal((await call('places/'+p.id+'/confirm','POST',{fields:['cost','hours','laptopFriendly'],note:'三项一起核对'})).status,400);
 assert.equal((await call('places/'+p.id+'/confirm','POST',{fields:['cost','bogus'],note:'未知信息项'})).status,400);
 const saved=await call('places/'+p.id+'/confirm','POST',{fields:['cost','hours'],note:'18:10 仍在营业，吧台可充电'});
 assert.equal(saved.status,200);assert.equal(saved.saved,true);assert.equal(saved.status===200,true);
 assert.deepEqual((await call('places/'+p.id)).place.evidence,before.evidence);assert.equal((await call('places/'+p.id)).place.confirmations,undefined);
 assert.equal((await call('review/review/'+saved.id,'POST',{action:'approve',note:'核对内容与当前条件一致'},'owner')).status,200);
 const after=(await call('places/'+p.id)).place;
 assert.equal(after.cost,before.cost);assert.equal(after.hours,before.hours);
 assert.deepEqual(after.evidence,before.evidence);assert.equal(after.confirmations.cost.kind,'visit');assert.equal(after.confirmations.cost.date,today());
 assert.equal(after.publicationIssues.length,0);
 assert.equal((await call('places/'+p.id+'/confirm','POST',{fields:['cost'],note:'同一天再次核对'})).saved,false);
 assert.equal((await call('places/'+p.id+'/confirm','POST',{fields:['cost'],note:'未登录核对'},'')).status,401);
 const raw=JSON.parse((await db.prepare('SELECT payload FROM places WHERE id=?').bind(p.id).first()).payload);raw.hours='开放时间待确认';
 await db.prepare('UPDATE places SET payload=? WHERE id=?').bind(JSON.stringify(raw),p.id).run();
 assert.equal((await call('places/'+p.id+'/confirm','POST',{fields:['hours'],note:'未知字段不能核对'})).status,400);
 const queue=await call('review-queue','GET',undefined,'owner');
 assert.ok(queue.history.some(h=>h.action==='confirm'&&h.note.includes('费用规则')));
});

test('到访核对在条件变动或地点隐藏后不能通过',async()=>{
 const {db,call}=await setup(),id=await published(call);
 let r=await call('places/'+id+'/confirm','POST',{fields:['cost'],note:'确认消费规则'});
 const raw=JSON.parse((await db.prepare('SELECT payload FROM places WHERE id=?').bind(id).first()).payload);raw.cost='paid';
 await db.prepare('UPDATE places SET payload=? WHERE id=?').bind(JSON.stringify(raw),id).run();
 assert.equal((await call('review/review/'+r.id,'POST',{action:'approve',note:'不能通过已变动条件'},'owner')).status,409);
 assert.equal((await call('review/review/'+r.id,'POST',{action:'reject',note:'条件已发生变化'},'owner')).status,200);
 r=await call('places/'+id+'/confirm','POST',{fields:['hours'],note:'确认开放时间'});
 await call('review/place/'+id,'POST',{action:'hide',note:'等待重新核对'},'owner');
 assert.equal((await call('review/review/'+r.id,'POST',{action:'approve',note:'不能通过隐藏地点'},'owner')).status,409);
});

test('真实地点候选公开但不认证办公，普通投稿仍私有；隐藏不会被重新导入',async()=>{
 const {db,call}=await setup();
 db.exec(readFileSync(prefix+'drizzle/0001_public_candidates.sql','utf8'));
 const {ensureDiscovery}=await discoveryReady;await ensureDiscovery(db);
 const list=(await call('places')).places;assert.equal(list.length,42);
 assert.ok(list.every(p=>p.discovery&&!p.demo&&!p.laptopFriendly&&p.cost==='unknown'&&p.location.system==='GCJ-02'));
 assert.equal((await call('places/source-7754766b48220f30fe6d5c76')).status,404);
 const id=list[0].id;
 assert.equal((await call('saved/'+id,'PUT',{saved:true})).status,200);
 assert.ok((await call('saved')).ids.includes(id));
 assert.equal((await call('places/'+id+'/confirm','POST',{fields:['laptopFriendly'],note:'我看过了'})).status,400);
 assert.equal((await call('review/place/'+id,'POST',{action:'approve',note:'仅有地图坐标'},'owner')).status,400);
 await call('review/place/'+id,'POST',{action:'hide',note:'地点匹配有误，需要重新核对'},'owner');
 await ensureDiscovery(db);assert.equal((await call('places/'+id)).status,404);assert.equal((await call('places')).places.length,41);
 assert.ok(!(await call('saved')).ids.includes(id));
});
test('候选的社区闭店反馈也能隐藏；只有审核员可以补充候选资料',async()=>{
 const {db,call}=await setup();await (await discoveryReady).ensureDiscovery(db);
 const list=(await call('places')).places,id=list[0].id;
 const report=sourceUrl=>({kind:'closed',reason:'怀疑永久闭店',date:today(),detail:'现场有关闭通知，请核对',sourceUrl});
 await call('places/'+id+'/report','PUT',report('https://merchant.example/closed'),'a');
 assert.equal((await call('places/'+id)).status,200);
 await call('places/'+id+'/report','PUT',report('https://other.example/closed'),'b');
 assert.equal((await call('places/'+id)).status,404);
 const second=list[1];assert.equal((await call('submissions/'+second.id,'PUT',place(),'a')).status,404);
 assert.equal((await call('submissions/'+second.id,'PUT',{...place(),name:second.name,address:second.address,location:second.location},'owner')).status,200);
 assert.equal((await call('places/'+second.id)).status,404);
 await call('review/place/'+second.id,'POST',{action:'approve',note:'逐项核对全部办公条件'},'owner');
 assert.equal((await call('places/'+second.id)).place.discovery,false);
});

test('补充一项先审核，按字段更新并保留依据，不自动认证地点',async()=>{
 const {db,call}=await setup();await (await discoveryReady).ensureDiscovery(db);const p=(await call('places')).places[0];
 const draft={field:'plugs',value:'1—5 个',date:today(),text:'靠窗一排实见四个插座，其他座位未确认',sourceUrl:''};
 assert.equal((await call('places/'+p.id+'/supplements','POST',draft,'')).status,401);
 assert.equal((await call('places/'+p.id+'/supplements','POST',{...draft,field:'status',value:'published'})).status,400);
 const r=await call('places/'+p.id+'/supplements','POST',draft);assert.equal(r.status,201);
 assert.equal((await call('places/'+p.id)).place.plugs,'待确认');
 assert.equal((await call('places/'+p.id+'/community','GET',undefined,'b')).visits.length,0);
 assert.equal((await call('places/'+p.id+'/supplements','POST',draft)).status,409);
 assert.equal((await call('review/review/'+r.id,'POST',{action:'approve',note:'核对到访依据'},'b')).status,403);
 assert.equal((await call('review/review/'+r.id,'POST',{action:'approve',note:'核对到访依据'},'owner')).status,200);
 const updated=(await call('places/'+p.id)).place;assert.equal(updated.plugs,'1—5 个');assert.equal(updated.observations.plugs.reviewId,r.id);assert.equal(updated.discovery,true);assert.equal(updated.charging,draft.text);
 assert.equal((await call('places/'+p.id+'/community','GET',undefined,'b')).visits.length,1);
});
test('冲突补充不覆盖新依据；否定电脑办公的审核会隐藏地点',async()=>{
 const {call}=await setup(),id=await published(call);const draft={field:'chair',value:'舒适',date:today(),text:'到访看见靠背软垫椅，坐了一个小时',sourceUrl:''};
 const a=await call('places/'+id+'/supplements','POST',draft,'a'),b=await call('places/'+id+'/supplements','POST',{...draft,value:'硬座'},'b');
 await call('review/review/'+a.id,'POST',{action:'approve',note:'通过现场依据'},'owner');
 assert.equal((await call('review/review/'+b.id,'POST',{action:'approve',note:'过期的并发补充'},'owner')).status,409);assert.equal((await call('places/'+id)).place.chair,'舒适');
 const no=await call('places/'+id+'/supplements','POST',{...draft,field:'laptopFriendly',value:false,text:'店内现在明确禁止电脑办公，请核实'},'a');
 await call('review/review/'+no.id,'POST',{action:'approve',note:'已核实不允许电脑办公'},'owner');assert.equal((await call('places/'+id)).status,404);
});
test('核心字段无链接补充不能沿用旧证据，也不自动宣称已核实',async()=>{
 const {call}=await setup(),id=await published(call);const r=await call('places/'+id+'/supplements','POST',{field:'hours',value:'10:00—17:00',date:today(),text:'本周门口告示调整营业时间',sourceUrl:''});
 await call('review/review/'+r.id,'POST',{action:'approve',note:'通过现场补充但缺少公开依据'},'owner');const p=(await call('places/'+id)).place;assert.equal(p.hours,'10:00—17:00');assert.equal(p.discovery,true);assert.equal(p.evidence.hours,undefined);
});

test('商家确认链接仅审核员生成，一次性，新链接撤销旧链接',async()=>{
 const{call,db}=await setup(),id=await published(call);
 assert.equal((await call('merchant-links','POST',{placeId:id},'a')).status,403);
 const first=await call('merchant-links','POST',{placeId:id,fields:['hours','wifi']},'owner');assert.equal(first.status,201);
 assert.equal((await call('merchant/'+first.token,'GET',undefined,'')).fields.length,2);
 const second=await call('merchant-links','POST',{placeId:id},'owner');
 assert.equal((await call('merchant/'+first.token,'GET',undefined,'')).status,404);
 assert.equal((await call('merchant/'+second.token,'POST',{answers:{plugs:'1—5 个'},contact:'店长'},'')).status,201);
 assert.equal((await call('merchant/'+second.token,'GET',undefined,'')).status,404);
 assert.equal((await call('merchant/'+second.token,'POST',{answers:{plugs:'1—5 个'},contact:'店长'},'')).status,404);
 const third=await call('merchant-links','POST',{placeId:id},'owner');await db.prepare('UPDATE merchant_links SET expires_at=?').bind(Date.now()-1).run();
 assert.equal((await call('merchant/'+third.token,'GET',undefined,'')).status,404);
 assert.equal((await call('merchant/not-a-real-token','GET',undefined,'')).status,404);
 assert.equal((await call('merchant/'+first.token,'POST',{answers:{plugs:'1—5 个'},contact:'店长'},'','https://evil.example')).status,403);
});
test('商家确认先审核、不进社区体验，通过后按商家自述更新依据',async()=>{
 const{call}=await setup(),id=await published(call);
 const link=await call('merchant-links','POST',{placeId:id},'owner');
 assert.equal((await call('merchant/'+link.token,'POST',{answers:{hours:'待确认'},contact:'店长'},'')).status,400);
 assert.equal((await call('merchant/'+link.token,'POST',{answers:{cost:'free',budget:'¥30'},contact:'店长'},'')).status,400);
 assert.equal((await call('merchant/'+link.token,'POST',{answers:{hours:'08:00—22:00',plugs:'6—10 个'},contact:'店长 王',note:'靠窗长桌都有插座'},'')).status,201);
 assert.equal((await call('places/'+id)).place.hours,'09:00—18:00');
 assert.equal((await call('places/'+id+'/community')).visits.length,0);
 const queue=await call('review-queue','GET',undefined,'owner'),r=queue.reviews.find(x=>x.payload.kind==='merchant');
 assert.equal(r.payload.previous.hours,'09:00—18:00');
 assert.equal((await call('review/review/'+r.id,'POST',{action:'approve',note:'电话回访一致'},'owner')).status,200);
 const p=(await call('places/'+id)).place;
 assert.equal(p.hours,'08:00—22:00');assert.equal(p.plugs,'6—10 个');assert.equal(p.evidence.hours.kind,'merchant');assert.equal(p.evidence.hours.url,'');assert.equal(p.evidence.cost.kind,'official');
 assert.deepEqual(p.merchant.fields,['hours','plugs']);assert.equal(p.reviewStatus,'published');
 assert.equal((await call('places/'+id+'/community')).visits.length,0);
});
test('商家确认遇到字段已变动拒绝通过；否定电脑办公会隐藏地点',async()=>{
 const{call,db}=await setup(),id=await published(call);
 let link=await call('merchant-links','POST',{placeId:id},'owner');
 await call('merchant/'+link.token,'POST',{answers:{hours:'10:00—20:00'},contact:'前台'},'');
 const row=await db.prepare('SELECT payload FROM places WHERE id=?').bind(id).first(),payload=JSON.parse(row.payload);payload.hours='07:00—23:00';
 await db.prepare('UPDATE places SET payload=? WHERE id=?').bind(JSON.stringify(payload),id).run();
 let r=(await call('review-queue','GET',undefined,'owner')).reviews.find(x=>x.payload.kind==='merchant');
 assert.equal((await call('review/review/'+r.id,'POST',{action:'approve',note:'核对'},'owner')).status,409);
 assert.equal((await call('review/review/'+r.id,'POST',{action:'reject',note:'信息已更新'},'owner')).status,200);
 link=await call('merchant-links','POST',{placeId:id},'owner');
 await call('merchant/'+link.token,'POST',{answers:{laptopFriendly:false},contact:'店长'},'');
 r=(await call('review-queue','GET',undefined,'owner')).reviews.find(x=>x.payload.kind==='merchant');
 const res=await call('review/review/'+r.id,'POST',{action:'approve',note:'商家明确不允许'},'owner');assert.equal(res.status,200);assert.equal(res.visibility,'hidden');
 assert.equal((await call('places/'+id)).status,404);
});


test('费用和菜单补充经审核更新；费用变化清空旧预算并阻止过期预算覆盖',async()=>{
 const {call}=await setup(),id=await published(call);
 const draft=(field,value)=>({field,value,date:today(),text:'本次到访核对门口价目表和使用规则',sourceUrl:''});
 const budget=await call('places/'+id+'/supplements','POST',draft('budget','¥35 / 人'));
 const cost=await call('places/'+id+'/supplements','POST',draft('cost','paid'));
 assert.equal(cost.status,201);
 assert.equal((await call('review/review/'+cost.id,'POST',{action:'approve',note:'核对消费要求'},'owner')).status,200);
 const p=(await call('places/'+id)).place;
 assert.equal(p.cost,'paid');assert.equal(p.budget,'费用待确认');assert.equal(p.evidence.cost,undefined);
 assert.equal((await call('review/review/'+budget.id,'POST',{action:'approve',note:'旧预算'},'owner')).status,409);
 assert.equal((await call('places/'+id+'/supplements','POST',draft('menuUrl','javascript:alert(1)'))).status,400);
 for(const [field,value] of [['menuUrl','https://merchant.example/menu'],['stay','工作日限坐两小时']]){
  const r=await call('places/'+id+'/supplements','POST',draft(field,value),'b');assert.equal(r.status,201);
  assert.notEqual((await call('places/'+id)).place[field],value);
  assert.equal((await call('review/review/'+r.id,'POST',{action:'approve',note:'通过公开规则核对'},'owner')).status,200);
  assert.equal((await call('places/'+id)).place[field],value);
 }
});

test('扩充批次幂等，保留已隐藏地点并公开发现来源',async()=>{
 const {db,call}=await setup();const {ensureDiscovery}=await discoveryReady;
 await ensureDiscovery(db);await ensureDiscovery(db);
 assert.equal((await call('places')).places.length,42);
 const id='tencent-16435788558534883525';
 assert.ok((await call('places/'+id)).place.leadSources[0].url.startsWith('https:'));
 await call('review/place/'+id,'POST',{action:'hide',note:'等待再次核对'},'owner');
 db.exec("DELETE FROM audit WHERE id='bootstrap:shanghai-expansion-20261025'");
 await ensureDiscovery(db);
 assert.equal((await call('places/'+id)).status,404);
 assert.equal((await call('places')).places.length,41);
});

test('工作分区可多选或明确无分区，审核前不更新且拒绝非法分区',async()=>{
 const {call}=await setup(),id=await published(call);
 const draft=value=>({field:'zones',value,date:today(),text:'本次到访确认了现场分区标识',sourceUrl:''});
 assert.equal((await call('places/'+id+'/supplements','POST',draft(['private']))).status,400);
 assert.equal((await call('places/'+id+'/supplements','POST',draft('quiet'))).status,400);
 const r=await call('places/'+id+'/supplements','POST',draft(['quiet','booth','quiet']));
 assert.equal(r.status,201);
 assert.notDeepEqual((await call('places/'+id)).place.zones,['booth','quiet']);
 assert.equal((await call('review/review/'+r.id,'POST',{action:'approve',note:'核对分区'},'owner')).status,200);
 assert.deepEqual((await call('places/'+id)).place.zones,['booth','quiet']);
 const none=await call('places/'+id+'/supplements','POST',draft([]));
 assert.equal((await call('review/review/'+none.id,'POST',{action:'approve',note:'现已撤除专门分区'},'owner')).status,200);
 const p=(await call('places/'+id)).place;assert.deepEqual(p.zones,[]);assert.deepEqual(p.observations.zones.value,[]);
});

test('地图导入地点同名同址不可重复投稿，忽略空格与全角符号；隐藏后仍不重复',async()=>{
 const {db,call}=await setup();await (await discoveryReady).ensureDiscovery(db);
 const p=(await call('places')).places.find(p=>p.id==='tencent-16435788558534883525');
 const submission={...place(),name:p.name,address:p.address,district:p.district,type:p.type};
 assert.equal((await call('submissions','POST',submission)).status,409);
 assert.equal((await call('submissions','POST',{...submission,name:' '+p.name+' ',address:p.address.replace(/\(/g,'（').replace(/\)/g,'）')})).status,409);
 const other=await call('submissions','POST',{...place(),name:'另一处独立空间'});
 assert.equal(other.status,201);
 assert.equal((await call('submissions/'+other.id,'PUT',submission)).status,409);
 await call('review/place/'+p.id,'POST',{action:'hide',note:'暂不开放'},'owner');
 assert.equal((await call('submissions','POST',submission)).status,409);
 assert.equal((await call('submissions','POST',{...submission,address:'上海市徐汇区另一条路100号'})).status,201);
});

test('免费地点的预算补充不允许非零收费，费用变免费后展示零预算',async()=>{
 const {call}=await setup(),id=await published(call);
 const draft=(field,value)=>({field,value,date:today(),text:'现场核对空间使用不收费，饮品自选',sourceUrl:''});
 const r=await call('places/'+id+'/supplements','POST',draft('cost','free'));
 assert.equal((await call('review/review/'+r.id,'POST',{action:'approve',note:'核对免费使用规则'},'owner')).status,200);
 assert.equal((await call('places/'+id)).place.budget,'¥0');
 assert.equal((await call('places/'+id+'/supplements','POST',draft('budget','¥35'))).status,400);
 const zero=await call('places/'+id+'/supplements','POST',draft('budget','0'));assert.equal(zero.status,201);
 assert.equal((await call('review/review/'+zero.id,'POST',{action:'approve',note:'空间费为零'},'owner')).status,200);
});

test('证据不足的候选隐藏后不会被重新导入，插座松紧占位不再输出',async()=>{
 const {db,call}=await setup();const {ensureDiscovery}=await discoveryReady;
 await ensureDiscovery(db);
 const hunan='tencent-13353016511687307342';
 assert.equal((await call('places/'+hunan)).status,404);
 assert.equal((await db.prepare('SELECT status FROM places WHERE id=?').bind(hunan).first()).status,'hidden');
 db.exec("DELETE FROM audit WHERE id LIKE 'bootstrap:shanghai-expansion%'");await ensureDiscovery(db);
 assert.equal((await call('places/'+hunan)).status,404);
 const list=(await call('places')).places;
 assert.ok(list.every(p=>!String(p.charging).includes('松紧')));
 await db.prepare("UPDATE places SET payload=json_set(payload,'$.charging','数量、位置与松紧待到访确认') WHERE id=?").bind(list[0].id).run();
 assert.equal((await call('places/'+list[0].id)).place.charging,'数量与位置待到访确认');
});

test('退回后本人可修改重提，其他账号不能编辑，重新通过后才公开',async()=>{
 const {call}=await setup();
 const input={...place(),name:'退回流程验收空间'};
 const submitted=await call('submissions','POST',input,'owner');assert.equal(submitted.status,201);
 assert.equal((await call('review/place/'+submitted.id,'POST',{action:'reject',note:'请补充进入方式'},'owner')).status,200);
 const own=(await call('contributions','GET',undefined,'owner')).places.find(p=>p.id===submitted.id);
 assert.equal(own.status,'rejected');assert.equal((await call('places/'+submitted.id)).status,404);
 assert.equal((await call('submissions/'+submitted.id,'PUT',{...input,entry:'出示预约码进入'},'b')).status,404);
 assert.equal((await call('submissions/'+submitted.id,'PUT',{...input,entry:'出示预约码进入'},'owner')).status,200);
 const pending=(await call('review-queue','GET',undefined,'owner')).places.find(p=>p.id===submitted.id);
 assert.equal(pending.reviewStatus,'pending');assert.equal(pending.entry,'出示预约码进入');
 assert.equal((await call('places/'+submitted.id)).status,404);
 assert.equal((await call('review/place/'+submitted.id,'POST',{action:'approve',note:'进入规则已核对'},'owner')).status,200);
 assert.equal((await call('places/'+submitted.id)).status,200);
});

test('旧审核页不能把已发布或隐藏地点再次退回补充',async()=>{
 const {call}=await setup(),id=await published(call);
 assert.equal((await call('review/place/'+id,'POST',{action:'reject',note:'旧页面上的退回操作'},'owner')).status,409);
 assert.equal((await call('places/'+id)).status,200);
 assert.equal((await call('review/place/'+id,'POST',{action:'hide',note:'核对后暂时隐藏'},'owner')).status,200);
 assert.equal((await call('review/place/'+id,'POST',{action:'reject',note:'旧页面上的退回操作'},'owner')).status,409);
 assert.equal((await call('places/'+id)).status,404);
});

test('详情社区与列表都排除未来时间的空位反馈',async()=>{
 const {call,db}=await setup(),id=await published(call);
 await call('places/'+id+'/seats','POST',{status:'full'});
 await db.prepare('UPDATE seats SET at=? WHERE place_id=?').bind(Date.now()+60000,id).run();
 assert.equal((await call('places')).places[0].seat,undefined);
 assert.equal((await call('places/'+id+'/community')).seat,null);
});

test('隐藏地点可由审核员补新依据但保持隐藏，普通作者不能修改，复核后显式恢复',async()=>{
 const {call,db}=await setup(),id=await published(call);
 assert.equal((await call('review/place/'+id,'POST',{action:'hide',note:'旧依据需要重新核对'},'owner')).status,200);
 const stale={...place(),evidence:Object.fromEntries(Object.entries(place().evidence).map(([k,v])=>[k,{...v,date:'2020-01-01'}]))};
 await db.prepare('UPDATE places SET payload=? WHERE id=?').bind(JSON.stringify(stale),id).run();
 assert.equal((await call('review/place/'+id,'POST',{action:'restore',note:'旧依据不能直接恢复'},'owner')).status,400);
 assert.equal((await call('submissions/'+id,'PUT',place(),'a')).status,409);
 assert.equal((await call('submissions/'+id,'PUT',place(),'owner')).status,200);
 assert.equal((await call('places/'+id)).status,404);
 const hidden=(await call('review-queue','GET',undefined,'owner')).places.find(p=>p.id===id);
 assert.equal(hidden.reviewStatus,'hidden');assert.deepEqual(hidden.publicationIssues,[]);
 assert.equal((await call('review/place/'+id,'POST',{action:'restore',note:'新依据已逐项核对'},'owner')).status,200);
 assert.equal((await call('places/'+id)).status,200);
});

test('审核读取后发生状态或内容更新时，旧审核不能覆盖更新',async()=>{
 for(const mutation of ['status','payload']){
  const {call,db}=await setup();const p=await call('submissions','POST',place());
  const batch=db.batch.bind(db);let intervened=false;
  db.batch=async items=>{
   if(!intervened){intervened=true;
    if(mutation==='status')await db.prepare("UPDATE places SET status='hidden' WHERE id=?").bind(p.id).run();
    else await db.prepare("UPDATE places SET payload=json_set(payload,'$.laptopFriendly',json('false')) WHERE id=?").bind(p.id).run();
   }
   return batch(items);
  };
  const r=await call('review/place/'+p.id,'POST',{action:'approve',note:'尝试通过旧审核依据'},'owner');
  assert.equal(r.status,409,mutation);
  assert.equal((await call('places/'+p.id)).status,404);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM audit WHERE subject=? AND action='approve'").bind(p.id).first()).n,0);
 }
});

test('修改投稿期间被审核或隐藏时，旧稿保存不能覆盖新状态',async()=>{
 for(const nextStatus of ['published','hidden']){
  const {call,db}=await setup();const p=await call('submissions','POST',place());
  const batch=db.batch.bind(db);let intervened=false;
  db.batch=async items=>{
   if(!intervened){intervened=true;await db.prepare('UPDATE places SET status=? WHERE id=?').bind(nextStatus,p.id).run();}
   return batch(items);
  };
  const r=await call('submissions/'+p.id,'PUT',{...place(),name:'不应写入的旧稿修改'});
  assert.equal(r.status,409,nextStatus);
  const current=await db.prepare('SELECT status,payload FROM places WHERE id=?').bind(p.id).first();
  assert.equal(current.status,nextStatus);assert.equal(JSON.parse(current.payload).name,place().name);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM audit WHERE subject=? AND action='resubmit'").bind(p.id).first()).n,0);
 }
});

test('体验审核遇到并发退回不能覆盖处理结果',async()=>{
 const {call,db}=await setup(),id=await published(call);
 const r=await call('places/'+id+'/reviews','POST',{date:today(),period:'下午',text:'用于并发审核的测试体验',spend:''});
 const batch=db.batch.bind(db);let intervened=false;
 db.batch=async items=>{if(!intervened){intervened=true;await db.prepare("UPDATE reviews SET status='rejected',note='另一审核已退回' WHERE id=?").bind(r.id).run();}return batch(items);};
 assert.equal((await call('review/review/'+r.id,'POST',{action:'approve',note:'旧审核页面通过'},'owner')).status,409);
 const current=await db.prepare('SELECT status,note FROM reviews WHERE id=?').bind(r.id).first();
 assert.equal(current.status,'rejected');assert.equal(current.note,'另一审核已退回');
 assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM audit WHERE subject=? AND action='approve'").bind(r.id).first()).n,0);
});

test('补充和商家确认被并发退回后不能改动地点',async()=>{
 for(const kind of ['supplement','merchant']){
  const {call,db}=await setup(),id=await published(call);
  let reviewId;
  if(kind==='supplement')reviewId=(await call('places/'+id+'/supplements','POST',{field:'hours',value:'10:00—16:00',date:today(),text:'测试新时间但应因冲突而不写入',sourceUrl:'https://merchant.example/hours'})).id;
  else{
   const link=await call('merchant-links','POST',{placeId:id,fields:['hours']},'owner');
   const submitted=await call('merchant/'+link.token,'POST',{contact:'测试负责人',note:'测试商家确认的新开放时间',answers:{hours:'10:00—16:00'}},'');
   assert.equal(submitted.status,201);
   reviewId=(await call('review-queue','GET',undefined,'owner')).reviews.find(r=>r.payload.kind==='merchant').id;
  }
  const before=await db.prepare('SELECT payload,status FROM places WHERE id=?').bind(id).first();
  const batch=db.batch.bind(db);let intervened=false;
  db.batch=async items=>{if(!intervened){intervened=true;await db.prepare("UPDATE reviews SET status='rejected' WHERE id=?").bind(reviewId).run();}return batch(items);};
  assert.equal((await call('review/review/'+reviewId,'POST',{action:'approve',note:'旧审核页面通过'},'owner')).status,409,kind);
  const after=await db.prepare('SELECT payload,status FROM places WHERE id=?').bind(id).first();
  assert.deepEqual(after,before,kind+' must not mutate the place');
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM audit WHERE subject=? AND action='approve'").bind(reviewId).first()).n,0);
 }
});

test('到访确认审批不能覆盖审批期间变化的地点条件或审核结果',async()=>{
 for(const change of ['place','review']){
  const {call,db}=await setup(),id=await published(call);
  const r=await call('places/'+id+'/confirm','POST',{fields:['hours'],note:'确认当前开放时间'});
  const batch=db.batch.bind(db);let intervened=false;
  db.batch=async items=>{if(!intervened){intervened=true;
   if(change==='place')await db.prepare("UPDATE places SET payload=json_set(payload,'$.hours','已变更时间') WHERE id=?").bind(id).run();
   else await db.prepare("UPDATE reviews SET status='rejected' WHERE id=?").bind(r.id).run();
  }return batch(items);};
  assert.equal((await call('review/review/'+r.id,'POST',{action:'approve',note:'旧核对页面审批'},'owner')).status,409,change);
  const payload=JSON.parse((await db.prepare('SELECT payload FROM places WHERE id=?').bind(id).first()).payload);
  assert.equal(payload.confirmations,undefined);
  if(change==='place')assert.equal(payload.hours,'已变更时间');
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM audit WHERE subject=? AND action='approve'").bind(r.id).first()).n,0);
 }
});
