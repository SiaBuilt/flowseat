import {withResearch} from './research.mjs';
import {supplementInput,supplementLabels,validateSupplementContext} from './supplements.mjs';
import {merchantLabels,merchantFieldsInput,merchantInput,newToken,hashToken,applyMerchant,merchantConflict,linkDays} from './merchant.mjs';
import {ensureDiscovery} from './discovery.mjs';
import {nearbyParking} from './parking.mjs';
import candidates from '../data/shanghai-public-candidates.json' with {type:'json'};
import {publicMapConfig,proxyMap} from './map.mjs';
import {ApiError,fail,text,url,date,sourceKey,fingerprint,placeInput,visitInput,one,publicationIssues,coreFields} from './validation.mjs';
const fieldLabels={laptopFriendly:'电脑办公许可',deskFits:'桌面条件',cost:'费用规则',hours:'开放时间'};
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const uuid=()=>crypto.randomUUID();
export async function handle(request,{db,reviewerIds='',mapCredentials={},seedDiscovery=true}){
 try{
 const path=new URL(request.url).pathname.replace(/^\/api\/?/,'').split('/').filter(Boolean).map(decodeURIComponent),method=request.method,now=Date.now();
 const uid=request.headers.get('oai-authenticated-user-id')||'';
 if(path[0]==='_TMapService')return await proxyMap(request,mapCredentials);
 const canReview=Boolean(uid&&reviewerIds.split(',').map(x=>x.trim()).filter(Boolean).includes(uid));
 if(!['GET','HEAD'].includes(method)){const origin=request.headers.get('origin');if((origin&&origin!==new URL(request.url).origin)||request.headers.get('sec-fetch-site')==='cross-site')fail(403,'请从本站发起操作');if(!request.headers.get('content-type')?.includes('application/json'))fail(415,'需要 JSON 请求');}
 if(path[0]==='health')return json({ok:true,storage:Boolean(db),version:'0.7.0'});
 if(path[0]==='map-config'&&method==='GET')return json(publicMapConfig(mapCredentials));
 if(!db)fail(503,'数据库尚未连接，请稍后再试');
 if(seedDiscovery&&method==='GET'&&path[0]==='places')await ensureDiscovery(db);
 const q=(sql,...args)=>db.prepare(sql).bind(...args),all=async(sql,...args)=>(await q(sql,...args).all()).results||[],first=async(sql,...args)=>q(sql,...args).first();
 const audit=(subject,action,note='')=>q('INSERT INTO audit(id,actor,subject,action,note,at) VALUES(?,?,?,?,?,?)',uuid(),uid,subject,action,note,now);
 const auth=()=>{if(!uid)fail(401,'请先登录后再操作');};
 const reviewer=()=>{auth();if(!canReview)fail(403,'此操作需要审核权限');};
 const body=async()=>{let count=0;const chunks=[];const reader=request.body?.getReader();if(!reader)fail(400,'缺少请求内容');while(true){const{done,value}=await reader.read();if(done)break;count+=value.length;if(count>24000){await reader.cancel();fail(413,'内容过长');}chunks.push(value);}try{const value=JSON.parse(new TextDecoder().decode(Uint8Array.from(chunks.flatMap(c=>[...c]))));if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'请求应为对象');return value;}catch{fail(400,'请求内容格式不正确');}};
 const profile=async()=>{auth();const p=await first('SELECT name FROM profiles WHERE uid=?',uid);if(!p)fail(400,'请先在我的页面设置贡献署名');return p;};
 const rate=async(limit=30)=>{const r=await first('SELECT COUNT(*) AS n FROM audit WHERE actor=? AND at>?',uid,now-60000);if(r.n>=limit)fail(429,'操作较频繁，请一分钟后重试');};
 const visible=async id=>{const p=await first("SELECT p.*,u.name AS contributor FROM places p LEFT JOIN profiles u ON u.uid=p.author WHERE p.id=? AND p.status IN ('published','candidate')",id);if(!p)fail(404,'地点不存在或已隐藏');return p;};
 const project=p=>withResearch({...JSON.parse(p.payload),id:p.id,contributor:p.contributor||'社区贡献者',updatedAt:p.updated_at,reviewStatus:p.status,discovery:p.status==='candidate',note:p.note,publicationIssues:publicationIssues(JSON.parse(p.payload)),...(p.seat_at?{seat:{status:p.seat_status,at:p.seat_at}}:{})});
 if(path[0]==='merchant'&&path[1]){
  const hash=await hashToken(path[1]),link=await first("SELECT * FROM merchant_links WHERE token_hash=? AND status='open' AND expires_at>?",hash,now);if(!link)fail(404,'链接无效或已过期');
  const p=await first("SELECT * FROM places WHERE id=? AND status IN ('pending','candidate','published')",link.place_id);if(!p)fail(404,'链接无效或已过期');
  const payload=JSON.parse(p.payload),fields=JSON.parse(link.fields);
  if(method==='GET')return json({place:{name:payload.name,address:payload.address,district:payload.district,type:payload.type},fields:fields.map(key=>({key,label:merchantLabels[key],current:payload[key]??null,...(key==='cost'?{budget:payload.budget??''}:{})})),expiresAt:link.expires_at});
  if(method!=='POST')fail(405,'不支持的操作');
  const input=merchantInput(await body(),fields),reviewId=uuid(),today=new Date(now+8*3600000).toISOString().slice(0,10);
  const previous=Object.fromEntries(Object.keys(input.answers).map(f=>[f,payload[f]??null]));if(input.answers.cost)previous.budget=payload.budget??null;
  const v={kind:'merchant',answers:input.answers,previous,contact:input.contact,text:input.note,date:today,period:'商家确认',spend:''};
  await db.batch([q("UPDATE merchant_links SET status='used',used_at=? WHERE token_hash=? AND status='open'",now,hash),q("INSERT INTO reviews(id,author,place_id,payload,status,note,created_at) SELECT ?,?,?,?,'pending','',? WHERE changes()=1",reviewId,'merchant:'+hash.slice(0,12),p.id,JSON.stringify(v),now),q("INSERT INTO audit(id,actor,subject,action,note,at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM reviews WHERE id=?)",uuid(),'merchant:'+hash.slice(0,12),p.id,'merchant',Object.keys(input.answers).map(f=>merchantLabels[f]).join('、'),now,reviewId)]);
  if(!await first('SELECT id FROM reviews WHERE id=?',reviewId))fail(409,'该链接已使用');
  return json({saved:true,status:'pending'},201);
 }
 if(path[0]==='merchant-links'&&method==='POST'){
  reviewer();await rate(8);const b=await body(),placeId=text(b.placeId,1,100),fields=merchantFieldsInput(b.fields);
  const p=await first("SELECT id FROM places WHERE id=? AND status IN ('pending','candidate','published')",placeId);if(!p)fail(404,'地点不存在或已隐藏');
  const token=newToken(),hash=await hashToken(token),expiresAt=now+linkDays*86400000;
  await db.batch([q("UPDATE merchant_links SET status='revoked' WHERE place_id=? AND status='open'",placeId),q("INSERT INTO merchant_links(token_hash,place_id,created_by,fields,status,created_at,expires_at) VALUES(?,?,?,?,'open',?,?)",hash,placeId,uid,JSON.stringify(fields),now,expiresAt),audit(placeId,'merchant-link',fields.map(f=>merchantLabels[f]).join('、'))]);
  return json({token,expiresAt,fields},201);
 }
 if(path[0]==='me'){
  if(method==='GET'){if(!uid)return json({user:null});const p=await first('SELECT name FROM profiles WHERE uid=?',uid);return json({user:{userId:uid,displayName:p?.name||'',canReview}});}
  auth();const b=await body();const name=text(b.displayName,2,24);await q('INSERT INTO profiles(uid,name,updated_at) VALUES(?,?,?) ON CONFLICT(uid) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at',uid,name,now).run();return json({saved:true});
 }
 if(path[0]==='places'&&path.length===1&&method==='GET')return json({places:(await all("SELECT p.*,u.name AS contributor,s.status AS seat_status,s.at AS seat_at FROM places p LEFT JOIN profiles u ON u.uid=p.author LEFT JOIN seats s ON s.rowid=(SELECT recent.rowid FROM seats recent WHERE recent.place_id=p.id AND recent.at>? AND recent.at<=? ORDER BY recent.at DESC,recent.rowid DESC LIMIT 1) WHERE p.status IN ('published','candidate') ORDER BY p.updated_at DESC LIMIT 300",now-3600000,now)).map(project)});
 const duplicatePlace=async(p,exclude='')=>{
  const fp=fingerprint(p.name,p.address),direct=await first('SELECT id FROM places WHERE fingerprint=? AND id<>?',fp,exclude);
  if(direct)return direct;
  // Older map imports use provider IDs as fingerprints; compare their normalized names and addresses too.
  const imported=await all("SELECT id,payload FROM places WHERE fingerprint LIKE 'tencent:%' AND id<>?",exclude);
  return imported.find(row=>{const old=JSON.parse(row.payload);return fingerprint(old.name,old.address)===fp;});
 };
 if(path[0]==='submissions'){
  auth();if(method==='PUT'&&path[1]){await profile();await rate(8);const old=await first('SELECT * FROM places WHERE id=?',path[1]);if(!old||(old.author!==uid&&!canReview))fail(404,'投稿不存在');if(!['pending','rejected'].includes(old.status)&&!(canReview&&['candidate','hidden'].includes(old.status)))fail(409,'当前地点状态不允许修改投稿');const p=placeInput(await body());const nextStatus=old.status==='hidden'?'hidden':'pending';const fp=fingerprint(p.name,p.address);const duplicate=await duplicatePlace(p,old.id);if(duplicate)fail(409,'与已有地点重复');const editId=uuid();await db.batch([q("UPDATE places SET payload=?,fingerprint=?,status=?,note=?,updated_at=? WHERE id=? AND status=? AND payload=? AND updated_at=?",JSON.stringify(p),fp,nextStatus,nextStatus==='hidden'?old.note:'',now,old.id,old.status,old.payload,old.updated_at),q('INSERT INTO audit(id,actor,subject,action,note,at) SELECT ?,?,?,?,?,? WHERE changes()=1',editId,uid,old.id,'resubmit','',now)]);if(!await first('SELECT id FROM audit WHERE id=?',editId))fail(409,'地点刚刚被更新，请重新打开投稿再修改');return json({id:old.id,status:nextStatus});}
  if(method==='POST'){await profile();await rate(8);const p=placeInput(await body()),id=uuid();const duplicate=await duplicatePlace(p);if(duplicate)fail(409,'该地点已有记录，请先搜索现有地点；自己的投稿可在我的贡献中查看');await db.batch([q("INSERT INTO places(id,author,fingerprint,payload,status,note,created_at,updated_at) VALUES(?,?,?,?,'pending','',?,?)",id,uid,fingerprint(p.name,p.address),JSON.stringify(p),now,now),audit(id,'submit')]);return json({id,status:'pending'},201);}
 }
 if(path[0]==='contributions'&&method==='GET'){
  auth();const rows=await all('SELECT id,payload,status,note,created_at,updated_at FROM places WHERE author=? ORDER BY created_at DESC LIMIT 100',uid);const rv=await all('SELECT r.id,r.payload,r.status,r.note,r.created_at,p.payload AS place_payload FROM reviews r JOIN places p ON p.id=r.place_id WHERE r.author=? ORDER BY r.created_at DESC LIMIT 100',uid);return json({places:rows.map(p=>({...p,payload:JSON.parse(p.payload)})),reviews:rv.map(r=>({...r,payload:JSON.parse(r.payload),placeName:JSON.parse(r.place_payload).name,place_payload:undefined}))});
 }
 if(path[0]==='saved'){
  auth();if(method==='GET')return json({ids:(await all("SELECT s.place_id FROM saved s JOIN places p ON p.id=s.place_id WHERE s.uid=? AND p.status IN ('published','candidate')",uid)).map(x=>x.place_id)});
  const id=path[1];await visible(id);const b=await body();if(typeof b.saved!=='boolean')fail(400,'收藏状态无效');await (b.saved?q('INSERT OR IGNORE INTO saved(uid,place_id,created_at) VALUES(?,?,?)',uid,id,now):q('DELETE FROM saved WHERE uid=? AND place_id=?',uid,id)).run();return json({saved:b.saved});
 }
 if(path[0]==='places'&&path[1]){
  const id=path[1],p=await visible(id);if(path.length===2&&method==='GET')return json({place:project(p)});
  if(path[2]==='parking'&&method==='GET')return json(await nearbyParking(JSON.parse(p.payload).location,mapCredentials));
  if(path[2]==='community'&&method==='GET'){
   const rs=await all("SELECT r.*,u.name AS name,(SELECT COUNT(*) FROM helpful h WHERE h.review_id=r.id) AS helps,(SELECT COUNT(*) FROM helpful h WHERE h.review_id=r.id AND h.uid=?) AS mine FROM reviews r LEFT JOIN profiles u ON u.uid=r.author WHERE r.place_id=? AND json_extract(r.payload,'$.kind') IS NOT 'merchant' AND (r.status='approved' OR (r.author=? AND r.status='pending')) ORDER BY r.created_at DESC LIMIT 60",uid,id,uid);
   const seat=await first('SELECT status,at FROM seats WHERE place_id=? AND at>? AND at<=? ORDER BY at DESC,rowid DESC LIMIT 1',id,now-3600000,now),report=await first("SELECT COUNT(DISTINCT author) AS count FROM reports WHERE place_id=? AND status='active' AND kind='closed' AND at>?",id,now-30*86400000);
   return json({visits:rs.map(r=>({...JSON.parse(r.payload),id:r.id,authorName:r.name||'社区贡献者',own:r.author===uid,pending:r.status==='pending',helps:r.helps,helpful:Boolean(r.mine)})),seat:seat||null,closureReports:report.count});
  }
  auth();await profile();await rate();const b=await body();
  if(path[2]==='supplements'&&method==='POST'){
   const v=supplementInput(b),payload=JSON.parse(p.payload);validateSupplementContext(v,payload);
   const existing=await all("SELECT payload FROM reviews WHERE place_id=? AND author=? AND status='pending' AND json_extract(payload,'$.kind')='supplement'",id,uid);
   if(existing.some(row=>JSON.parse(row.payload).field===v.field))fail(409,'这一项已有待审核补充，请在我的贡献查看');
   if(v.field==='budget')v.previousCost=payload.cost;v.previous=payload[v.field]??null;v.previousObservation=payload.observations?.[v.field]?.reviewId||'';
   const reviewId=uuid();await db.batch([q("INSERT INTO reviews(id,author,place_id,payload,status,note,created_at) VALUES(?,?,?,?,'pending','',?)",reviewId,uid,id,JSON.stringify(v),now),audit(id,'supplement',supplementLabels[v.field])]);return json({saved:true,id:reviewId,status:'pending'},201);
  }
  if(path[2]==='confirm'){
   const picked=Array.isArray(b.fields)?[...new Set(b.fields)]:[];if(!picked.length||picked.length>2)fail(400,'每次到访最多核对 2 项信息');for(const field of picked)if(!coreFields.includes(field))fail(400,'请选择有效的信息项');
   const note=text(b.note,2,200),payload=JSON.parse(p.payload),today=new Date(now+8*3600000).toISOString().slice(0,10),known=field=>({laptopFriendly:payload.laptopFriendly===true,deskFits:payload.deskFits===true,cost:payload.cost&&payload.cost!=='unknown',hours:payload.hours&&!/待确认|未知|不详/.test(payload.hours)})[field];for(const field of picked)if(!known(field))fail(400,fieldLabels[field]+'仍是待确认，不能核对；请用「地点纠错」补充实际信息');payload.evidence={...(payload.evidence||{})};
   const prior=await all("SELECT payload FROM reviews WHERE place_id=? AND author=? AND status IN ('pending','approved') AND json_extract(payload,'$.kind')='confirmation' AND json_extract(payload,'$.date')=?",id,uid,today);
   const already=new Set(prior.flatMap(row=>JSON.parse(row.payload).confirmationFields||[]));
   const changed=picked.filter(field=>!already.has(field));if(!changed.length)return json({saved:false,unchanged:true});
   const reviewId=uuid(),v={kind:'confirmation',confirmationFields:changed,values:Object.fromEntries(changed.map(field=>[field,payload[field]])),date:today,period:'到访核对',text:note,spend:''};
   await db.batch([q("INSERT INTO reviews(id,author,place_id,payload,status,note,created_at) VALUES(?,?,?,?,'pending','',?)",reviewId,uid,id,JSON.stringify(v),now),audit(id,'confirm',changed.map(field=>fieldLabels[field]).join('、')+'：已提交审核')]);
   return json({saved:true,status:'pending',id:reviewId});
  }
  if(path[2]==='seats'){one(b.status,['available','busy','full']);await db.batch([q('INSERT INTO seats(author,place_id,status,at) VALUES(?,?,?,?) ON CONFLICT(author,place_id) DO UPDATE SET status=excluded.status,at=excluded.at',uid,id,b.status,now),audit(id,'seat')]);return json({seat:{status:b.status,at:now}});}
  if(path[2]==='reviews'){const v=visitInput(b),reviewId=uuid();await db.batch([q("INSERT INTO reviews(id,author,place_id,payload,status,note,created_at) VALUES(?,?,?,?,'pending','',?)",reviewId,uid,id,JSON.stringify(v),now),audit(reviewId,'review')]);return json({id:reviewId,status:'pending'},201);}
  if(path[2]==='report'){
   const kind=one(b.kind,['closed','temporary','laptop','information']),v={reason:text(b.reason,2,80),date:date(b.date),detail:text(b.detail,10,600),sourceUrl:url(b.sourceUrl,kind!=='closed')},key=v.sourceUrl?sourceKey(v.sourceUrl):'';
   await db.batch([q("INSERT INTO reports(id,author,place_id,kind,source_key,payload,status,at) VALUES(?,?,?,?,?,?,'active',?) ON CONFLICT(author,place_id,kind) DO UPDATE SET source_key=excluded.source_key,payload=excluded.payload,status='active',at=excluded.at",uuid(),uid,id,kind,key,JSON.stringify(v),now),q("UPDATE places SET status='hidden',note='社区标记闭店：两位独立用户、不同公开来源；可提交恢复依据',updated_at=? WHERE id=? AND status IN ('published','candidate') AND (SELECT COUNT(DISTINCT author) FROM reports WHERE place_id=? AND kind='closed' AND status='active' AND source_key<>'' AND at>?)>=2 AND (SELECT COUNT(DISTINCT source_key) FROM reports WHERE place_id=? AND kind='closed' AND status='active' AND source_key<>'' AND at>?)>=2",now,id,id,now-30*86400000,id,now-30*86400000),audit(id,'report',kind)]);return json({saved:true,visibility:(await first('SELECT status FROM places WHERE id=?',id)).status});
  }
 }
 if(path[0]==='reviews'&&path[2]==='helpful'){
  auth();const r=await first("SELECT r.* FROM reviews r JOIN places p ON p.id=r.place_id WHERE r.id=? AND r.status='approved' AND p.status IN ('published','candidate')",path[1]);if(!r)fail(404,'体验不存在或未公开');if(r.author===uid)fail(400,'不能给自己的体验标记有帮助');const b=await body();if(typeof b.active!=='boolean')fail(400,'标记状态无效');await(b.active?q('INSERT OR IGNORE INTO helpful(uid,review_id) VALUES(?,?)',uid,r.id):q('DELETE FROM helpful WHERE uid=? AND review_id=?',uid,r.id)).run();return json({saved:true});
 }
 if(path[0]==='seed-candidates'&&method==='POST'){
  reviewer();await rate(8);const editor='system:flowseat';await q('INSERT OR IGNORE INTO profiles(uid,name,updated_at) VALUES(?,?,?)',editor,'FlowSeat 资料整理',now).run();let inserted=0;for(const candidate of candidates){const p=placeInput(candidate),fp=fingerprint(p.name,p.address);if(await first('SELECT id FROM places WHERE fingerprint=?',fp))continue;const id=uuid();await db.batch([q("INSERT OR IGNORE INTO places(id,author,fingerprint,payload,status,note,created_at,updated_at) VALUES(?,?,?,?,'pending','公开资料线索，未实访；请核对使用权益',?,?)",id,editor,fp,JSON.stringify(p),now,now),audit(id,'seed','官方公开空间资料，待审核')]);inserted++;}return json({inserted});
 }
 if(path[0]==='review-queue'){
  reviewer();return json({places:(await all("SELECT p.*,u.name AS contributor FROM places p LEFT JOIN profiles u ON u.uid=p.author WHERE p.status IN ('pending','hidden','candidate') ORDER BY p.updated_at DESC LIMIT 100")).map(project),reviews:(await all("SELECT r.*,u.name AS contributor,p.payload AS place_payload FROM reviews r LEFT JOIN profiles u ON u.uid=r.author JOIN places p ON p.id=r.place_id WHERE r.status='pending' ORDER BY r.created_at DESC LIMIT 100")).map(r=>({id:r.id,payload:JSON.parse(r.payload),contributor:r.contributor,placeName:JSON.parse(r.place_payload).name})),reports:(await all("SELECT r.*,p.payload AS place_payload FROM reports r JOIN places p ON p.id=r.place_id WHERE r.status='active' ORDER BY r.at DESC LIMIT 100")).map(r=>({id:r.id,placeId:r.place_id,payload:JSON.parse(r.payload),kind:r.kind,at:r.at,placeName:JSON.parse(r.place_payload).name})),history:await all('SELECT subject,action,note,at FROM audit ORDER BY at DESC LIMIT 50')});
 }
 if(path[0]==='review'&&method==='POST'){
  reviewer();const b=await body(),kind=one(path[1],['place','review','report']),id=text(path[2],1,100),action=one(b.action,['approve','reject','hide','restore','resolve']);const note=text(b.note||'',2,400);
  if(kind==='place'){
   const p=await first('SELECT * FROM places WHERE id=?',id);if(!p)fail(404,'投稿不存在');if(action==='approve'||action==='restore'){const payload=JSON.parse(p.payload);const issues=publicationIssues(payload);if(issues.length)fail(400,'暂不能发布：'+issues.join('；'));if(action==='approve'&&!['pending','candidate'].includes(p.status))fail(409,'该投稿已经处理');}
   const state=action==='approve'||action==='restore'?'published':action==='hide'?'hidden':action==='reject'?'rejected':null;if(!state)fail(400,'操作无效');if(action==='restore'&&p.status!=='hidden')fail(409,'仅隐藏地点可恢复');if(action==='reject'&&p.status!=='pending')fail(409,'仅待审核投稿可退回，请刷新处理记录');if(action==='hide'&&!['published','candidate','pending'].includes(p.status))fail(409,'当前地点已处理，请刷新处理记录');const transitionId=uuid();const tasks=[q('UPDATE places SET status=?,note=?,updated_at=? WHERE id=? AND status=? AND payload=? AND updated_at=?',state,note,now,id,p.status,p.payload,p.updated_at),q('INSERT INTO audit(id,actor,subject,action,note,at) SELECT ?,?,?,?,?,? WHERE changes()=1',transitionId,uid,id,action,note,now)];if(action==='restore')tasks.push(q("UPDATE reports SET status='resolved' WHERE place_id=? AND status='active' AND EXISTS(SELECT 1 FROM audit WHERE id=?)",id,transitionId));await db.batch(tasks);if(!await first('SELECT id FROM audit WHERE id=?',transitionId))fail(409,'地点刚刚被更新，请刷新后重新审核');return json({saved:true});
  }
  if(kind==='review'){one(action,['approve','reject']);const r=await first("SELECT * FROM reviews WHERE id=? AND status='pending'",id);if(!r)fail(409,'该体验已处理或不存在');const v=JSON.parse(r.payload);
   const commitReview=async(place=null,next=null,state=null,placeNote=null)=>{
    const auditId=uuid(),tasks=[];
    if(place){
     tasks.push(q("UPDATE places SET payload=?,status=?,note=?,updated_at=? WHERE id=? AND payload=? AND status=? AND updated_at=? AND EXISTS(SELECT 1 FROM reviews WHERE id=? AND status='pending' AND payload=?)",next,state,placeNote??place.note,now,place.id,place.payload,place.status,place.updated_at,id,r.payload));
     tasks.push(q("UPDATE reviews SET status=?,note=? WHERE id=? AND status='pending' AND payload=? AND changes()=1",action==='approve'?'approved':'rejected',note,id,r.payload));
    }else tasks.push(q("UPDATE reviews SET status=?,note=? WHERE id=? AND status='pending' AND payload=?",action==='approve'?'approved':'rejected',note,id,r.payload));
    tasks.push(q('INSERT INTO audit(id,actor,subject,action,note,at) SELECT ?,?,?,?,?,? WHERE changes()=1',auditId,uid,id,action,note,now));
    await db.batch(tasks);
    if(!await first('SELECT id FROM audit WHERE id=?',auditId))fail(409,'地点或审核记录刚刚被更新，请刷新后重新审核');
   };
   if(action==='approve'&&v.kind==='supplement'){
    const valid=supplementInput(v),place=await first("SELECT * FROM places WHERE id=? AND status IN ('candidate','published')",r.place_id);if(!place)fail(409,'地点已隐藏或转入审核，请先处理地点状态');
    const payload=JSON.parse(place.payload),field=valid.field;validateSupplementContext(valid,payload);
    if(field==='budget'&&v.previousCost!==payload.cost)fail(409,'费用类型已有变化，请重新核对消费预算');
    if(JSON.stringify(payload[field]??null)!==JSON.stringify(v.previous)||(payload.observations?.[field]?.reviewId||'')!==v.previousObservation)fail(409,'这一项已有更新，请退回后重新核对');
    if(now-Date.parse(valid.date+'T00:00:00+08:00')>30*86400000)fail(409,'到访依据已超过 30 天，请重新核对');
    if(field==='cost'&&payload.cost!==valid.value){payload.budget=valid.value==='free'?'¥0':'费用待确认';payload.basis=valid.text;delete payload.observations?.budget;}
    if(field==='budget')payload.basis=valid.text;
    payload[field]=valid.value;if(field==='plugs')payload.charging=valid.text;if(field==='chair')payload.chairNote=valid.text;payload.observations={...payload.observations,[field]:{value:valid.value,date:valid.date,note:valid.text,sourceUrl:valid.sourceUrl,reviewId:id}};
    if(coreFields.includes(field)){payload.evidence={...payload.evidence};delete payload.confirmations?.[field];if(valid.sourceUrl)payload.evidence[field]={kind:'visit',url:valid.sourceUrl,date:valid.date,note:valid.text};else delete payload.evidence[field];}
    const state=['laptopFriendly','deskFits'].includes(field)&&valid.value===false?'hidden':place.status==='published'&&publicationIssues(payload).length?'candidate':place.status,next=JSON.stringify(payload);
    await commitReview(place,next,state);return json({saved:true});
   }
   if(action==='approve'&&v.kind==='merchant'){
    const place=await first("SELECT * FROM places WHERE id=? AND status IN ('pending','candidate','published')",r.place_id);if(!place)fail(409,'地点已隐藏或已退回，请先处理地点状态');
    const payload=JSON.parse(place.payload);if(merchantConflict(payload,v))fail(409,'商家确认的项目已有更新，请退回后重新发送确认链接');
    if(now-Date.parse(v.date+'T00:00:00+08:00')>30*86400000)fail(409,'商家确认已超过 30 天，请重新发送确认链接');
    const updated=applyMerchant(payload,v,id),denied=updated.laptopFriendly===false||updated.deskFits===false;
    const state=denied?'hidden':place.status==='published'&&publicationIssues(updated).length?'candidate':place.status,next=JSON.stringify(updated);
    await commitReview(place,next,state,denied?'商家确认不支持电脑办公或桌面不足':place.note);return json({saved:true,visibility:state});
   }
   if(action==='approve'&&v.kind==='confirmation'){
    const place=await first("SELECT * FROM places WHERE id=? AND status='published'",r.place_id);if(!place)fail(409,'地点已隐藏，不能通过到访核对');const payload=JSON.parse(place.payload);
    if(!Array.isArray(v.confirmationFields)||!v.confirmationFields.length||v.confirmationFields.some(f=>!coreFields.includes(f)||payload[f]!==v.values?.[f]))fail(409,'地点条件已有变化，请退回后重新核对');
    if(now-Date.parse(v.date+'T00:00:00+08:00')>30*86400000)fail(409,'到访记录已超过 30 天，请重新核对');
    payload.confirmations={...payload.confirmations};for(const f of v.confirmationFields)payload.confirmations[f]={kind:'visit',date:v.date,note:v.text,reviewId:id};
    await commitReview(place,JSON.stringify(payload),place.status);return json({saved:true});
   }
   await commitReview();return json({saved:true});}
  one(action,['resolve']);await db.batch([q("UPDATE reports SET status='resolved' WHERE id=?",id),audit(id,'resolve',note)]);return json({saved:true});
 }
 fail(404,'接口不存在');
 }catch(e){if(e instanceof ApiError)return json({error:e.message},e.status);if(e instanceof Error&&e.message.includes('places.fingerprint'))return json({error:'该地点已有投稿，请勿重复提交'},409);console.error('FlowSeat API error',e instanceof Error?e.message:'unknown');return json({error:'服务暂时不可用，请稍后重试'},500);}
}
