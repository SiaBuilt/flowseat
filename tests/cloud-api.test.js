const {test}=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {readFileSync,existsSync}=require('node:fs');
const {pathToFileURL}=require('node:url');
const {resolve}=require('node:path');
const prefix=existsSync('server/api.mjs')?'':'site-preview/';
let api;
const ready=import(pathToFileURL(resolve(prefix+'server/api.mjs')).href).then(m=>api=m.handle);
function database(){const raw=new DatabaseSync(':memory:');raw.exec(readFileSync(prefix+'drizzle/0000_mixed_talkback.sql','utf8'));return{exec(sql){raw.exec(sql);},prepare(sql){return{bind(...args){const p=raw.prepare(sql);return{first:async()=>p.get(...args)||null,all:async()=>({results:p.all(...args)}),run:async()=>p.run(...args),execute:()=>p.run(...args)}}}},async batch(items){raw.exec('BEGIN');try{const result=items.map(p=>p.execute());raw.exec('COMMIT');return result;}catch(e){raw.exec('ROLLBACK');throw e;}}};}
const today=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
const place=()=>({name:'测试工作空间',address:'上海市静安区测试路 123 号',district:'静安',type:'咖啡馆',cost:'purchase',budget:'¥30',basis:'一杯饮品',sourceUrl:'https://merchant.example/place',sourceDate:today(),laptopFriendly:true,deskFits:true});
async function setup(){await ready;const db=database();const call=async(path,method='GET',body,uid='a',origin='https://flowseat.example')=>{const headers={'Content-Type':'application/json',Origin:origin};if(uid)headers['oai-authenticated-user-id']=uid;const r=await api(new Request('https://flowseat.example/api/'+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})}),{db,reviewerIds:'owner'});return{...await r.json(),status:r.status};};for(const id of ['a','b','owner'])assert.equal((await call('me','PUT',{displayName:'用户'+id},id)).status,200);return{db,call};}
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
