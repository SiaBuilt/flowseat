import records from '../data/shanghai-real-discovery.json' with {type:'json'};
import expansion from '../data/shanghai-expansion-20261025.json' with {type:'json'};
import expansion1027 from '../data/shanghai-expansion-20261027.json' with {type:'json'};
import expansion1101 from '../data/shanghai-expansion-20261101.json' with {type:'json'};
const marker='bootstrap:real-shanghai-v06';
// Bounded application data initialization. Never changes schema or replays after review.
async function ensureBaseDiscovery(db){
 if(await db.prepare('SELECT id FROM audit WHERE id=?').bind(marker).first())return;
 const at=Date.now(),q=(sql,...args)=>db.prepare(sql).bind(...args);
 const tasks=[q("INSERT OR IGNORE INTO profiles(uid,name,updated_at) VALUES('system:flowseat','FlowSeat 资料整理',?)",at)];
 for(const record of records){const {id,...p}=record,payload=JSON.stringify(p);
  tasks.push(q("INSERT OR IGNORE INTO places(id,author,fingerprint,payload,status,note,created_at,updated_at) SELECT ?,'system:flowseat',?,?,'candidate','真实地点线索；办公条件待核实',?,? WHERE NOT EXISTS(SELECT 1 FROM audit WHERE id=?)",id,'tencent:'+p.poiId,payload,at,at,marker));
  if(id.startsWith('source-'))tasks.push(q("UPDATE places SET payload=?,status='candidate',note='真实地点线索；办公条件待核实',updated_at=? WHERE id=? AND author='system:flowseat' AND status='pending' AND NOT EXISTS(SELECT 1 FROM audit WHERE id=?)",payload,at,id,marker));
 }
 tasks.push(q("INSERT OR IGNORE INTO audit(id,actor,subject,action,note,at) VALUES(?,'system:flowseat','shanghai','seed','8 个真实地点线索，未认证办公条件',?)",marker,at));
 await db.batch(tasks);
}

// 已导入后证据不足的地点：仅从候选转为隐藏，保留记录，审核员可凭新依据恢复。
const hidden=[{id:'tencent-13353016511687307342',note:'办公依据不足：原来源已失效，现有资料仅提及政务工作站；有新依据可恢复'}];
const hideBatch='bootstrap:hide-insufficient-20261028';
const batches=[
 {id:'bootstrap:shanghai-expansion-20261025',places:expansion,note:'新增12个公开资料候选，未认证办公条件'},
 {id:'bootstrap:shanghai-expansion-20261027',places:expansion1027,note:'新增8个官方名录与公开资料候选，未认证办公条件'},
 {id:'bootstrap:shanghai-expansion-20261101',places:expansion1101,note:'新增15个小红书线索候选（7处有官方名录时间），未认证办公条件'}
];
export async function ensureDiscovery(db){
 await ensureBaseDiscovery(db);
 for(const batch of batches){
  if(await db.prepare('SELECT id FROM audit WHERE id=?').bind(batch.id).first())continue;
  const at=Date.now(),q=(sql,...args)=>db.prepare(sql).bind(...args);
  const tasks=batch.places.map(({id,...p})=>q("INSERT OR IGNORE INTO places(id,author,fingerprint,payload,status,note,created_at,updated_at) VALUES(?,'system:flowseat',?,?,'candidate','公开资料线索；办公条件待核实',?,?)",id,'tencent:'+p.poiId,JSON.stringify(p),at,at));
  tasks.push(q("INSERT OR IGNORE INTO audit(id,actor,subject,action,note,at) VALUES(?,'system:flowseat','shanghai','seed',?,?)",batch.id,batch.note,at));
  await db.batch(tasks);
 }
 if(await db.prepare('SELECT id FROM audit WHERE id=?').bind(hideBatch).first())return;
 const at=Date.now(),q=(sql,...args)=>db.prepare(sql).bind(...args);
 await db.batch([...hidden.flatMap(({id,note})=>[q("UPDATE places SET status='hidden',note=?,updated_at=? WHERE id=? AND author='system:flowseat' AND status='candidate'",note,at,id),q("INSERT INTO audit(id,actor,subject,action,note,at) SELECT ?,'system:flowseat',?,'hide',?,? WHERE EXISTS(SELECT 1 FROM places WHERE id=? AND status='hidden' AND note=?)",hideBatch+':'+id,id,note,at,id,note)]),q("INSERT OR IGNORE INTO audit(id,actor,subject,action,note,at) VALUES(?,'system:flowseat','shanghai','hide','隐藏办公依据不足的候选',?)",hideBatch,at)]);
}
